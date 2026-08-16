import { openAiModelInfoSafeDefaults } from "@shared/api"
import { FORGEOS_RECOMMENDED_MODELS_FALLBACK } from "@shared/forgeos/recommended-models"
import { EmptyRequest, StringRequest } from "@shared/proto/forgeos/common"
import { type ForgeOSRecommendedModel, ForgeOSRecommendedModelsResponse } from "@shared/proto/forgeos/models"
import { fromProtobufModelInfo } from "@shared/proto-conversions/models/typeConversion"
import type { Mode } from "@shared/storage/types"
import { isClaudeOpusAdaptiveThinkingModel, resolveClaudeOpusAdaptiveThinking } from "@shared/utils/reasoning-support"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse from "fuse.js"
import type React from "react"
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useDynamicProviderSelection } from "@/hooks/useDynamicProviderSelection"
import { useProviderConfig } from "@/hooks/useProviderConfig"
import { useProviderModels } from "@/hooks/useProviderModels"
import { ModelsServiceClient, StateServiceClient } from "@/services/grpc-client"
import { highlight } from "../history/HistoryView"
import { ModelInfoView } from "./common/ModelInfoView"
import FeaturedModelCard from "./FeaturedModelCard"
import ReasoningEffortSelector from "./ReasoningEffortSelector"
import { filterOpenRouterModelIds, getModeSpecificFields } from "./utils/providerUtils"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

// Star icon for favorites
const StarIcon = ({ isFavorite, onClick }: { isFavorite: boolean; onClick: (e: React.MouseEvent) => void }) => {
	return (
		<button
			onClick={onClick}
			style={{
				background: "none",
				border: "none",
				padding: 0,
				cursor: "pointer",
				color: isFavorite ? "var(--vscode-terminal-ansiBlue)" : "var(--vscode-descriptionForeground)",
				marginLeft: "8px",
				fontSize: "16px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				userSelect: "none",
				WebkitUserSelect: "none",
			}}
			type="button">
			{isFavorite ? "★" : "☆"}
		</button>
	)
}

interface ForgeOSModelPickerProps {
	isPopup?: boolean
	currentMode: Mode
	showProviderRouting?: boolean
	initialTab?: "recommended" | "free"
}

interface FeaturedModelCardEntry {
	id: string
	name?: string
	description: string
	label: string
}

const FORGEOS_RECOMMENDED_MODELS_RETRY_DELAY_MS = 5000

function normalizeModelId(modelId: string): string {
	return modelId.trim().toLowerCase()
}

function toFeaturedModelCardEntry(
	model: Pick<ForgeOSRecommendedModel, "id" | "name" | "description" | "tags">,
	fallbackLabel: string,
): FeaturedModelCardEntry | null {
	if (!model.id) {
		return null
	}

	const firstTag = model.tags?.[0]
	const normalizedLabel = typeof firstTag === "string" && firstTag.length > 0 ? firstTag.toUpperCase() : undefined

	return {
		id: model.id,
		name: model.name,
		description: model.description || (fallbackLabel === "FREE" ? "Free model" : "Recommended model"),
		label: normalizedLabel || fallbackLabel,
	}
}

const RECOMMENDED_MODELS_FALLBACK: FeaturedModelCardEntry[] = FORGEOS_RECOMMENDED_MODELS_FALLBACK.recommended
	.map((model) => toFeaturedModelCardEntry(model, "RECOMMENDED"))
	.filter((model): model is FeaturedModelCardEntry => model !== null)

const FREE_MODELS_FALLBACK: FeaturedModelCardEntry[] = FORGEOS_RECOMMENDED_MODELS_FALLBACK.free
	.map((model) => toFeaturedModelCardEntry(model, "FREE"))
	.filter((model): model is FeaturedModelCardEntry => model !== null)

const ForgeOSModelPicker: React.FC<ForgeOSModelPickerProps> = ({ isPopup, currentMode, showProviderRouting, initialTab }) => {
	const { handleModeFieldsChange, handleFieldChange } = useApiConfigurationHandlers()
	const { apiConfiguration, favoritedModelIds } = useExtensionState()
	const { models: catalogForgeOSModels, defaultModelId: forgeosDefaultModelId } = useProviderModels("forgeos")
	const { config, write: writeProviderConfig, commitSelection } = useProviderConfig("forgeos")
	const modeFields = getModeSpecificFields(apiConfiguration, currentMode)
	const effectiveForgeOSModels = catalogForgeOSModels
	const committedSelection = currentMode === "plan" ? config?.planSelection : config?.actSelection
	const committedModelInfo = committedSelection?.modelInfo ? fromProtobufModelInfo(committedSelection.modelInfo) : undefined
	const currentForgeOSModelId =
		committedSelection?.modelId ||
		modeFields.forgeosModelId ||
		forgeosDefaultModelId ||
		Object.keys(effectiveForgeOSModels ?? {})[0] ||
		""
	const [searchTerm, setSearchTerm] = useState(currentForgeOSModelId)
	const searchTermEditedByUserRef = useRef(false)
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const [forgeosRecommendedModels, setForgeOSRecommendedModels] = useState<FeaturedModelCardEntry[]>([])
	const [forgeosFreeModels, setForgeOSFreeModels] = useState<FeaturedModelCardEntry[]>([])
	const freeForgeOSModelIds = useMemo(() => {
		const freeModelIds =
			forgeosFreeModels.length > 0 ? forgeosFreeModels.map((model) => model.id) : FREE_MODELS_FALLBACK.map((model) => model.id)
		return [...new Set(freeModelIds)]
	}, [forgeosFreeModels])
	const freeForgeOSModelIdSet = useMemo(
		() => new Set(freeForgeOSModelIds.map((modelId) => normalizeModelId(modelId))),
		[freeForgeOSModelIds],
	)
	const [activeTab, setActiveTab] = useState<"recommended" | "free">(initialTab ?? "recommended")
	const recommendedModels = useMemo(
		() => (forgeosRecommendedModels.length > 0 ? forgeosRecommendedModels : RECOMMENDED_MODELS_FALLBACK),
		[forgeosRecommendedModels],
	)
	const freeModels = useMemo(() => (forgeosFreeModels.length > 0 ? forgeosFreeModels : FREE_MODELS_FALLBACK), [forgeosFreeModels])
	const hasSuccessfulForgeOSRecommendedModelsFetchRef = useRef(false)
	const isFetchingForgeOSRecommendedModelsRef = useRef(false)
	const forgeosRecommendedModelsRetryTimeoutRef = useRef<number | null>(null)

	const refreshForgeOSRecommendedModels = useCallback(async (): Promise<boolean> => {
		try {
			const response = await ModelsServiceClient.makeUnaryRequest(
				"refreshForgeOSRecommendedModelsRpc",
				EmptyRequest.create({}),
				EmptyRequest.toJSON,
				ForgeOSRecommendedModelsResponse.fromJSON,
			)
			const recommended = (response.recommended ?? [])
				.map((model) => toFeaturedModelCardEntry(model, "RECOMMENDED"))
				.filter((model): model is FeaturedModelCardEntry => model !== null)
			const free = (response.free ?? [])
				.map((model) => toFeaturedModelCardEntry(model, "FREE"))
				.filter((model): model is FeaturedModelCardEntry => model !== null)
			setForgeOSRecommendedModels(recommended)
			setForgeOSFreeModels(free)
			return true
		} catch (error) {
			console.error("Failed to refresh ForgeOS recommended models:", error)
			return false
		}
	}, [])

	const clearForgeOSRecommendedModelsRetryTimeout = useCallback(() => {
		if (forgeosRecommendedModelsRetryTimeoutRef.current !== null) {
			window.clearTimeout(forgeosRecommendedModelsRetryTimeoutRef.current)
			forgeosRecommendedModelsRetryTimeoutRef.current = null
		}
	}, [])

	const fetchForgeOSRecommendedModels = useCallback(async () => {
		if (hasSuccessfulForgeOSRecommendedModelsFetchRef.current || isFetchingForgeOSRecommendedModelsRef.current) {
			return
		}
		isFetchingForgeOSRecommendedModelsRef.current = true
		const succeeded = await refreshForgeOSRecommendedModels()
		isFetchingForgeOSRecommendedModelsRef.current = false

		if (succeeded) {
			hasSuccessfulForgeOSRecommendedModelsFetchRef.current = true
			clearForgeOSRecommendedModelsRetryTimeout()
			return
		}

		if (forgeosRecommendedModelsRetryTimeoutRef.current === null) {
			forgeosRecommendedModelsRetryTimeoutRef.current = window.setTimeout(() => {
				forgeosRecommendedModelsRetryTimeoutRef.current = null
				void fetchForgeOSRecommendedModels()
			}, FORGEOS_RECOMMENDED_MODELS_RETRY_DELAY_MS)
		}
	}, [clearForgeOSRecommendedModelsRetryTimeout, refreshForgeOSRecommendedModels])

	useEffect(() => {
		return () => {
			clearForgeOSRecommendedModelsRetryTimeout()
		}
	}, [clearForgeOSRecommendedModelsRetryTimeout])

	useEffect(() => {
		if (initialTab) {
			setActiveTab(initialTab)
		}
	}, [initialTab])

	useEffect(() => {
		if (initialTab) {
			return
		}
		setActiveTab(freeForgeOSModelIdSet.has(normalizeModelId(currentForgeOSModelId)) ? "free" : "recommended")
	}, [currentForgeOSModelId, freeForgeOSModelIdSet, initialTab])
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const dropdownListRef = useRef<HTMLDivElement>(null)

	const handleModelChange = (newModelId: string) => {
		searchTermEditedByUserRef.current = false
		setSearchTerm(newModelId)

		const modelInfo = effectiveForgeOSModels?.[newModelId] ?? {
			...openAiModelInfoSafeDefaults,
			name: newModelId,
		}

		void commitSelection(currentMode, {
			providerId: "forgeos",
			modelId: newModelId,
		}).catch((err) => console.error("Failed to commit ForgeOS model selection:", err))

		void handleModeFieldsChange(
			{
				forgeosModelId: {
					plan: "planModeForgeOSModelId",
					act: "actModeForgeOSModelId",
				},
				forgeosModelInfo: {
					plan: "planModeForgeOSModelInfo",
					act: "actModeForgeOSModelInfo",
				},
			},
			{
				forgeosModelId: newModelId,
				forgeosModelInfo: modelInfo,
			},
			currentMode,
		)
	}

	const baseSelection = useDynamicProviderSelection("forgeos", apiConfiguration, currentMode)
	const { selectedModelId, selectedModelInfo } = useMemo(() => {
		const selected = {
			selectedProvider: "forgeos" as const,
			selectedModelId: baseSelection.selectedModelId,
			selectedModelInfo: baseSelection.selectedModelInfo,
		}
		const selectedWithCatalogDefault = currentForgeOSModelId
			? {
					...selected,
					selectedModelId: currentForgeOSModelId,
					selectedModelInfo: (() => {
						const persistedModelInfo = committedModelInfo || modeFields.forgeosModelInfo || selected.selectedModelInfo
						const liveModelInfo = effectiveForgeOSModels?.[currentForgeOSModelId]
						// Persisted ForgeOS model info is a snapshot from selection time. When the
						// model is still in the catalog, refresh metadata/capability flags from
						// the live catalog so UI controls reflect current model support.
						return liveModelInfo ? { ...persistedModelInfo, ...liveModelInfo } : persistedModelInfo
					})(),
				}
			: selected
		if (freeForgeOSModelIdSet.has(normalizeModelId(selectedWithCatalogDefault.selectedModelId))) {
			return {
				...selectedWithCatalogDefault,
				selectedModelInfo: {
					...selectedWithCatalogDefault.selectedModelInfo,
					inputPrice: 0,
					outputPrice: 0,
					cacheReadsPrice: 0,
					cacheWritesPrice: 0,
				},
			}
		}
		return selectedWithCatalogDefault
	}, [
		baseSelection.selectedModelId,
		baseSelection.selectedModelInfo,
		committedModelInfo,
		currentForgeOSModelId,
		effectiveForgeOSModels,
		freeForgeOSModelIdSet,
		modeFields.forgeosModelInfo,
	])

	useEffect(() => {
		void fetchForgeOSRecommendedModels()
	}, [fetchForgeOSRecommendedModels])

	// Sync external changes when the modelId changes
	useEffect(() => {
		searchTermEditedByUserRef.current = false
		setSearchTerm(currentForgeOSModelId)
	}, [currentForgeOSModelId])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	const modelIds = useMemo(() => {
		const unfilteredModelIds = Object.keys(effectiveForgeOSModels ?? {}).sort((a, b) => a.localeCompare(b))
		return filterOpenRouterModelIds(unfilteredModelIds, "forgeos", freeForgeOSModelIds)
	}, [effectiveForgeOSModels, freeForgeOSModelIds])

	const searchableItems = useMemo(() => {
		return modelIds.map((id) => ({
			id,
			html: id,
		}))
	}, [modelIds])

	const fuse = useMemo(() => {
		return new Fuse(searchableItems, {
			keys: ["html"], // highlight function will update this
			threshold: 0.6,
			shouldSort: true,
			isCaseSensitive: false,
			ignoreLocation: false,
			includeMatches: true,
			minMatchCharLength: 1,
		})
	}, [searchableItems])

	const modelSearchResults = useMemo(() => {
		// First, get all favorited models
		const favoritedModels = searchableItems.filter((item) => favoritedModelIds.includes(item.id))

		// Then get search results for non-favorited models
		const searchResults = searchTerm
			? highlight(fuse.search(searchTerm), "model-item-highlight").filter((item) => !favoritedModelIds.includes(item.id))
			: searchableItems.filter((item) => !favoritedModelIds.includes(item.id))

		// Combine favorited models with search results
		return [...favoritedModels, ...searchResults]
	}, [searchableItems, searchTerm, fuse, favoritedModelIds])

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) {
			return
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < modelSearchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < modelSearchResults.length) {
					handleModelChange(modelSearchResults[selectedIndex].id)
					setIsDropdownVisible(false)
				} else {
					handleModelChange(searchTerm)
					setIsDropdownVisible(false)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSelectedIndex(-1)
				break
		}
	}

	const hasInfo = useMemo(() => {
		try {
			return modelIds.some((id) => id.toLowerCase() === searchTerm.toLowerCase())
		} catch {
			return false
		}
	}, [modelIds, searchTerm])

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset dropdown navigation whenever the search text changes
	useEffect(() => {
		setSelectedIndex(-1)
		if (dropdownListRef.current) {
			dropdownListRef.current.scrollTop = 0
		}
	}, [searchTerm])

	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	const showAdaptiveThinkingEffort = useMemo(() => isClaudeOpusAdaptiveThinkingModel(selectedModelId), [selectedModelId])
	const adaptiveThinkingDefaultEffort = useMemo(
		() => resolveClaudeOpusAdaptiveThinking(modeFields.reasoningEffort, modeFields.thinkingBudgetTokens).effort ?? "none",
		[modeFields.reasoningEffort, modeFields.thinkingBudgetTokens],
	)
	// Show reasoning effort selector for all models that support reasoning,
	// using the SDK catalog's supportsReasoning capability flag.
	const showReasoningEffort = useMemo(
		() => showAdaptiveThinkingEffort || selectedModelInfo?.supportsReasoning === true,
		[showAdaptiveThinkingEffort, selectedModelInfo?.supportsReasoning],
	)

	return (
		<div style={{ width: "100%", paddingBottom: 2 }}>
			<style>
				{`
				.model-item-highlight {
					background-color: var(--vscode-editor-findMatchHighlightBackground);
					color: inherit;
				}
				`}
			</style>
			<div style={{ display: "flex", flexDirection: "column" }}>
				<label htmlFor="model-search">
					<span style={{ fontWeight: 500 }}>Model</span>
				</label>

				{/* Tabs */}
				<TabsContainer style={{ marginTop: 4 }}>
					<Tab active={activeTab === "recommended"} onClick={() => setActiveTab("recommended")}>
						Recommended
					</Tab>
					<Tab active={activeTab === "free"} onClick={() => setActiveTab("free")}>
						Free
					</Tab>
				</TabsContainer>

				{/* Model Cards */}
				<div style={{ marginBottom: "6px" }}>
					{activeTab === "recommended" &&
						recommendedModels.map((model) => (
							<FeaturedModelCard
								description={model.description}
								displayName={model.name || model.id}
								isSelected={selectedModelId === model.id}
								key={model.id}
								label={model.label}
								onClick={() => {
									handleModelChange(model.id)
									setIsDropdownVisible(false)
								}}
							/>
						))}
					{activeTab === "free" &&
						freeModels.map((model) => (
							<FeaturedModelCard
								description={model.description}
								displayName={model.name || model.id}
								isSelected={selectedModelId === model.id}
								key={model.id}
								label={model.label}
								onClick={() => {
									handleModelChange(model.id)
									setIsDropdownVisible(false)
								}}
							/>
						))}
				</div>

				<DropdownWrapper ref={dropdownRef}>
					<VSCodeTextField
						id="model-search"
						key={currentForgeOSModelId}
						onBlur={() => {
							if (searchTermEditedByUserRef.current && searchTerm !== selectedModelId) {
								handleModelChange(searchTerm)
							}
						}}
						onFocus={() => setIsDropdownVisible(true)}
						onInput={(e) => {
							searchTermEditedByUserRef.current = true
							setSearchTerm((e.target as HTMLInputElement)?.value.toLowerCase() || "")
							setIsDropdownVisible(true)
						}}
						onKeyDown={handleKeyDown}
						placeholder="Search and select a model..."
						role="combobox"
						style={{
							width: "100%",
							zIndex: FORGEOS_MODEL_PICKER_Z_INDEX,
							position: "relative",
						}}
						value={searchTerm}>
						{searchTerm && (
							<button
								aria-label="Clear search"
								className="input-icon-button codicon codicon-close"
								onClick={() => {
									setSearchTerm("")
									setIsDropdownVisible(true)
								}}
								slot="end"
								style={{
									background: "none",
									border: "none",
									padding: 0,
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									height: "100%",
								}}
								type="button"
							/>
						)}
					</VSCodeTextField>
					{isDropdownVisible && (
						<DropdownList ref={dropdownListRef} role="listbox">
							{modelSearchResults.map((item, index) => {
								const isFavorite = (favoritedModelIds || []).includes(item.id)
								return (
									<DropdownItem
										isSelected={index === selectedIndex}
										key={item.id}
										onClick={() => {
											handleModelChange(item.id)
											setIsDropdownVisible(false)
										}}
										onMouseEnter={() => setSelectedIndex(index)}
										ref={(el) => (itemRefs.current[index] = el)}
										role="option">
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
											}}>
											{/* biome-ignore lint/security/noDangerouslySetInnerHtml: highlight() returns sanitized model-id markup for matched search text */}
											<span dangerouslySetInnerHTML={{ __html: item.html }} />
											<StarIcon
												isFavorite={isFavorite}
												onClick={(e) => {
													e.stopPropagation()
													StateServiceClient.toggleFavoriteModel(
														StringRequest.create({ value: item.id }),
													).catch((error) => console.error("Failed to toggle favorite model:", error))
												}}
											/>
										</div>
									</DropdownItem>
								)
							})}
						</DropdownList>
					)}
				</DropdownWrapper>
			</div>

			{hasInfo ? (
				<>
					{showReasoningEffort && (
						<ReasoningEffortSelector
							allowedEfforts={
								showAdaptiveThinkingEffort ? (["none", "low", "medium", "high", "xhigh"] as const) : undefined
							}
							currentMode={currentMode}
							defaultEffort={showAdaptiveThinkingEffort ? adaptiveThinkingDefaultEffort : "medium"}
							description={
								showAdaptiveThinkingEffort
									? "Use None to disable adaptive thinking. Higher effort increases response detail and token usage."
									: undefined
							}
							label={showAdaptiveThinkingEffort ? "Adaptive Thinking" : undefined}
							onEffortChange={(effort) => {
								writeProviderConfig({
									reasoning: {
										enabled: effort !== "none",
										effort: effort !== "none" ? effort : undefined,
									},
								})
							}}
						/>
					)}

					<ModelInfoView
						isPopup={isPopup}
						modelInfo={selectedModelInfo}
						onProviderSortingChange={(value) => handleFieldChange("openRouterProviderSorting", value)}
						providerSorting={apiConfiguration?.openRouterProviderSorting}
						selectedModelId={selectedModelId}
						showProviderRouting={showProviderRouting}
					/>
				</>
			) : (
				<p
					style={{
						fontSize: "12px",
						marginTop: 0,
						color: "var(--vscode-descriptionForeground)",
					}}>
					The extension automatically fetches the latest ForgeOS model list.
				</p>
			)}
		</div>
	)
}

export default ForgeOSModelPicker

const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

const FORGEOS_MODEL_PICKER_Z_INDEX = 1_000

const DropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${FORGEOS_MODEL_PICKER_Z_INDEX - 1};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

const DropdownItem = styled.div<{ isSelected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};
	color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionForeground, inherit)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
		color: var(--vscode-list-activeSelectionForeground, inherit);
	}
`

const TabsContainer = styled.div`
	display: flex;
	gap: 0;
	margin-bottom: 12px;
	border-bottom: 1px solid #333;
`

const Tab = styled.div<{ active: boolean }>`
	padding: 8px 16px;
	cursor: pointer;
	font-size: 12px;
	font-weight: 500;
	color: ${({ active }) => (active ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)")};
	border-bottom: 2px solid ${({ active }) => (active ? "var(--vscode-textLink-foreground)" : "transparent")};
	transition: all 0.15s ease;

	&:hover {
		color: var(--vscode-foreground);
	}
`
