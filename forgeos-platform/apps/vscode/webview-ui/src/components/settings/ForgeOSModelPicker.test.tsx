import { toProtobufModelInfo } from "@shared/proto-conversions/models/typeConversion"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useDynamicProviderSelection } from "@/hooks/useDynamicProviderSelection"
import { useProviderConfig } from "@/hooks/useProviderConfig"
import { useProviderModels } from "@/hooks/useProviderModels"
import ForgeOSModelPicker from "./ForgeOSModelPicker"

const mocks = vi.hoisted(() => ({
	commitSelection: vi.fn(async () => undefined),
	writeProviderConfig: vi.fn(async () => undefined),
	updateApiConfigurationProto: vi.fn(async () => undefined),
	makeUnaryRequest: vi.fn(async () => ({
		recommended: [
			{
				id: "forgeos-next",
				name: "ForgeOS Next",
				description: "Next ForgeOS model",
				tags: ["recommended"],
			},
		],
		free: [],
	})),
	toggleFavoriteModel: vi.fn(async () => undefined),
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@/hooks/useDynamicProviderSelection", () => ({
	useDynamicProviderSelection: vi.fn(),
}))

vi.mock("@/hooks/useProviderModels", () => ({
	useProviderModels: vi.fn(),
}))

vi.mock("@/hooks/useProviderConfig", () => ({
	useProviderConfig: vi.fn(),
}))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: {
		makeUnaryRequest: mocks.makeUnaryRequest,
		updateApiConfigurationProto: mocks.updateApiConfigurationProto,
	},
	StateServiceClient: {
		toggleFavoriteModel: mocks.toggleFavoriteModel,
	},
}))

describe("ForgeOSModelPicker", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		vi.mocked(useExtensionState).mockReturnValue({
			apiConfiguration: {
				actModeForgeOSModelId: "forgeos-default",
				actModeForgeOSModelInfo: {
					name: "ForgeOS Default",
					supportsPromptCache: true,
				},
			},
			favoritedModelIds: [],
			planActSeparateModelsSetting: true,
		} as ReturnType<typeof useExtensionState>)

		vi.mocked(useProviderModels).mockReturnValue({
			models: {
				"forgeos-default": { name: "ForgeOS Default", supportsPromptCache: true },
				"forgeos-next": {
					name: "ForgeOS Next",
					supportsPromptCache: true,
					contextWindow: 128_000,
				},
			},
			defaultModelId: "forgeos-default",
			isLoading: false,
			isStale: false,
			error: undefined,
			refresh: vi.fn(),
			fingerprint: "fingerprint",
		})

		vi.mocked(useProviderConfig).mockReturnValue({
			config: undefined,
			write: mocks.writeProviderConfig,
			commitSelection: mocks.commitSelection,
		})

		vi.mocked(useDynamicProviderSelection).mockReturnValue({
			selectedModelId: "forgeos-default",
			selectedModelInfo: { name: "ForgeOS Default", supportsPromptCache: true },
			hideUsageCost: false,
		})
	})

	it("commits ForgeOS model selections through provider config so providers.json is updated", async () => {
		render(<ForgeOSModelPicker currentMode="act" />)

		// Featured cards render the display name from the RPC, but selection
		// still commits the underlying model id.
		fireEvent.click(await screen.findByText("ForgeOS Next"))

		await waitFor(() => expect(mocks.commitSelection).toHaveBeenCalledTimes(1))
		expect(mocks.commitSelection).toHaveBeenCalledWith("act", {
			providerId: "forgeos",
			modelId: "forgeos-next",
		})
	})

	it("renders RPC-provided display names on featured cards, falling back to ids", async () => {
		// Names arrive display-ready: the extension host resolves them against
		// the model catalog in fetchForgeOSRecommendedModels.
		mocks.makeUnaryRequest.mockResolvedValueOnce({
			recommended: [{ id: "anthropic/claude-opus-5", name: "Claude Opus 5", description: "Frontier model", tags: ["NEW"] }],
			free: [
				{ id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", description: "Fast and efficient", tags: [] },
				{ id: "unknown/mystery-model", name: "", description: "No display name", tags: [] },
			],
		})

		render(<ForgeOSModelPicker currentMode="act" />)

		expect(await screen.findByText("Claude Opus 5")).toBeInTheDocument()

		fireEvent.click(screen.getByText("Free"))

		expect(await screen.findByText("DeepSeek V4 Flash")).toBeInTheDocument()
		// A missing display name degrades to the raw id
		expect(screen.getByText("unknown/mystery-model")).toBeInTheDocument()
	})

	it("hydrates the selected ForgeOS model from provider config when legacy settings are empty", () => {
		vi.mocked(useExtensionState).mockReturnValue({
			apiConfiguration: {},
			favoritedModelIds: [],
			planActSeparateModelsSetting: true,
		} as ReturnType<typeof useExtensionState>)
		vi.mocked(useProviderConfig).mockReturnValue({
			config: {
				providerId: "forgeos",
				actSelection: {
					providerId: "forgeos",
					modelId: "forgeos-next",
					modelInfo: toProtobufModelInfo({
						name: "ForgeOS Next",
						supportsPromptCache: true,
						contextWindow: 128_000,
					}),
				},
			},
			write: mocks.writeProviderConfig,
			commitSelection: mocks.commitSelection,
		})

		render(<ForgeOSModelPicker currentMode="act" />)

		expect(screen.getByRole("combobox")).toHaveValue("forgeos-next")
	})

	it("uses live catalog reasoning support when the saved ForgeOS model snapshot is stale", () => {
		vi.mocked(useExtensionState).mockReturnValue({
			apiConfiguration: {
				actModeForgeOSModelId: "glm-5.2",
				actModeForgeOSModelInfo: {
					name: "GLM 5.2",
					supportsPromptCache: true,
				},
			},
			favoritedModelIds: [],
			planActSeparateModelsSetting: true,
		} as ReturnType<typeof useExtensionState>)
		vi.mocked(useProviderModels).mockReturnValue({
			models: {
				"glm-5.2": {
					name: "GLM 5.2",
					supportsPromptCache: true,
					contextWindow: 1_048_576,
					supportsReasoning: true,
				},
			},
			defaultModelId: "glm-5.2",
			isLoading: false,
			isStale: false,
			error: undefined,
			refresh: vi.fn(),
			fingerprint: "fingerprint",
		})
		vi.mocked(useProviderConfig).mockReturnValue({
			config: {
				providerId: "forgeos",
				actSelection: {
					providerId: "forgeos",
					modelId: "glm-5.2",
					modelInfo: toProtobufModelInfo({
						name: "GLM 5.2",
						supportsPromptCache: true,
					}),
				},
			},
			write: mocks.writeProviderConfig,
			commitSelection: mocks.commitSelection,
		})
		vi.mocked(useDynamicProviderSelection).mockReturnValue({
			selectedModelId: "glm-5.2",
			selectedModelInfo: { name: "GLM 5.2", supportsPromptCache: true },
			hideUsageCost: false,
		})

		render(<ForgeOSModelPicker currentMode="act" />)

		expect(screen.getByText("Reasoning Effort")).toBeInTheDocument()
	})
})
