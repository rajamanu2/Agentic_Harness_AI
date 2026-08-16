import type { ForgeOSRecommendedModel, OpenRouterModelInfo } from "@shared/proto/forgeos/models"
import type { OnboardingModel, OnboardingModelGroup } from "@shared/proto/forgeos/state"

export const FORGEOSPASS_GROUP = "forgeos-pass"

export interface RecommendedModelsData {
	recommended: ForgeOSRecommendedModel[]
	free: ForgeOSRecommendedModel[]
	forgeosPass: ForgeOSRecommendedModel[]
}

type RecommendedModelsResponseLike = {
	recommended?: ForgeOSRecommendedModel[]
	free?: ForgeOSRecommendedModel[]
	forgeosPass?: ForgeOSRecommendedModel[]
}

export function getRecommendedModelsData(response: RecommendedModelsResponseLike): RecommendedModelsData | undefined {
	const recommended = response.recommended ?? []
	const free = response.free ?? []
	const forgeosPass = response.forgeosPass ?? []

	if (recommended.length === 0 && free.length === 0 && forgeosPass.length === 0) {
		return undefined
	}

	return { recommended, free, forgeosPass }
}

export interface OnboardingModelsByGroup {
	forgeosPass: ModelGroup[]
	free: ModelGroup[]
	power: ModelGroup[]
}

interface ModelGroup {
	group: string
	models: OnboardingModel[]
}

function isForgeOSPassOnboardingModel(model: OnboardingModel): boolean {
	return model.group === FORGEOSPASS_GROUP
}

export function getForgeOSUIOnboardingGroups(groupedModels: OnboardingModelGroup): OnboardingModelsByGroup {
	const { models } = groupedModels

	const forgeosPassModels = models.filter(isForgeOSPassOnboardingModel)
	const freeModels = models.filter((m) => m.group === "free")
	const frontierModels = models.filter((m) => m.group === "frontier")
	const openSourceModels = models.filter((m) => m.group === "open source")

	return {
		forgeosPass: forgeosPassModels.length > 0 ? [{ group: FORGEOSPASS_GROUP, models: forgeosPassModels }] : [],
		free: freeModels.length > 0 ? [{ group: "free", models: freeModels }] : [],
		power: [
			...(frontierModels.length > 0 ? [{ group: "frontier", models: frontierModels }] : []),
			...(openSourceModels.length > 0 ? [{ group: "open source", models: openSourceModels }] : []),
		],
	}
}

export function getOnboardingGroupDisplayName(group: string): string {
	if (group === FORGEOSPASS_GROUP) {
		return "ForgeOSPass"
	}
	return group
}

export function getPriceRange(modelInfo: OpenRouterModelInfo): string {
	const prompt = Number(modelInfo.inputPrice ?? 0)
	const completion = Number(modelInfo.outputPrice ?? 0)
	const cost = prompt + completion
	if (cost === 0) {
		return "Free"
	}
	if (cost < 10) {
		return "$"
	}
	if (cost > 50) {
		return "$$$"
	}
	return "$$"
}

export function getCapabilities(modelInfo: OpenRouterModelInfo): string[] {
	const capabilities = new Set<string>()
	if (modelInfo.supportsImages) {
		capabilities.add("Images")
	}
	if (modelInfo.supportsPromptCache) {
		capabilities.add("Prompt Cache")
	}
	capabilities.add("Tools")
	return Array.from(capabilities)
}

export function getSpeedLabel(latency?: number): string {
	if (!latency) {
		return "Average"
	}
	if (latency < 1) {
		return "Instant"
	}
	if (latency < 2) {
		return "Fast"
	}
	if (latency > 5) {
		return "Slow"
	}

	return "Average"
}
