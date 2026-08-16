import { buildModelInfoNameMap, type ModelInfo, resolveForgeOSPassModelInfo } from "@shared/api"
import { FORGEOS_ONBOARDING_MODELS } from "@shared/forgeos/onboarding"
import { EmptyRequest } from "@shared/proto/forgeos/common"
import type { ForgeOSRecommendedModel } from "@shared/proto/forgeos/models"
import type { OnboardingModel, OnboardingModelGroup } from "@shared/proto/forgeos/state"
import { useEffect, useMemo, useState } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useProviderModels } from "@/hooks/useProviderModels"
import { ModelsServiceClient } from "@/services/grpc-client"
import { FORGEOSPASS_GROUP, getRecommendedModelsData, type RecommendedModelsData } from "./data-models"

type OnboardingModelsStatus = "loading" | "success" | "empty"

export interface UseOnboardingModelsResult {
	status: OnboardingModelsStatus
	models: OnboardingModelGroup
}

function toOnboardingModel(
	rec: ForgeOSRecommendedModel,
	group: string,
	fallbackBadge: string,
	modelCatalog: Record<string, ModelInfo>,
): OnboardingModel {
	const catalogInfo = modelCatalog[rec.id]
	const tag = rec.tags?.[0] ?? ""
	const badge = tag || fallbackBadge

	return {
		id: rec.id,
		// Names arrive display-ready from the recommended-models RPC
		name: rec.name || rec.id,
		group,
		badge,
		score: 0,
		latency: 0,
		info: catalogInfo
			? {
					contextWindow: catalogInfo.contextWindow ?? 0,
					supportsImages: catalogInfo.supportsImages ?? false,
					supportsPromptCache: catalogInfo.supportsPromptCache ?? false,
					inputPrice: catalogInfo.inputPrice ?? 0,
					outputPrice: catalogInfo.outputPrice ?? 0,
					tiers: catalogInfo.tiers ?? [],
				}
			: undefined,
	}
}

type FetchState = { status: "loading" } | { status: "success"; data: RecommendedModelsData } | { status: "empty" }

export function useOnboardingModels(): UseOnboardingModelsResult {
	const { openRouterModels } = useExtensionState()
	const { models: forgeosModels } = useProviderModels("forgeos")
	const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" })

	useEffect(() => {
		let cancelled = false

		const refreshRecommendedModels = async () => {
			try {
				const response = await ModelsServiceClient.refreshForgeOSRecommendedModelsRpc(EmptyRequest.create({}))
				if (!cancelled) {
					const data = getRecommendedModelsData(response)
					if (!data) {
						setFetchState({ status: "empty" })
					} else {
						setFetchState({ status: "success", data })
					}
				}
			} catch {
				if (!cancelled) {
					setFetchState({ status: "empty" })
				}
			}
		}

		refreshRecommendedModels()

		return () => {
			cancelled = true
		}
	}, [])

	// Merge openRouter and forgeos models into a single catalog for lookups
	const modelCatalog = useMemo<Record<string, ModelInfo>>(() => {
		return { ...openRouterModels, ...(forgeosModels ?? {}) }
	}, [openRouterModels, forgeosModels])

	// ForgeOSPass model IDs omit the upstream lab (e.g. "forgeos-pass/glm-5.2"), so look up
	// capabilities via the model slug against the OpenRouter catalog, falling back to
	// conservative ForgeOSPass defaults. Mirrors ForgeOSPassProvider's resolution.
	const openRouterModelsByName = useMemo(() => buildModelInfoNameMap(openRouterModels), [openRouterModels])

	return useMemo<UseOnboardingModelsResult>(() => {
		if (fetchState.status !== "success") {
			return { status: fetchState.status, models: { models: FORGEOS_ONBOARDING_MODELS } }
		}

		const { data } = fetchState
		const freeModels = data.free.map((rec) => toOnboardingModel(rec, "free", "Free", modelCatalog))
		const frontierModels = data.recommended.map((rec) => toOnboardingModel(rec, "frontier", "", modelCatalog))
		const forgeosPassCatalog = Object.fromEntries(
			data.forgeosPass.map((rec) => [rec.id, resolveForgeOSPassModelInfo(rec.id, openRouterModelsByName)]),
		)
		const forgeosPassModels = data.forgeosPass.map((rec) => toOnboardingModel(rec, FORGEOSPASS_GROUP, "", forgeosPassCatalog))

		return { status: "success", models: { models: [...forgeosPassModels, ...freeModels, ...frontierModels] } }
	}, [fetchState, modelCatalog, openRouterModelsByName])
}
