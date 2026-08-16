import type { OnboardingModel, OnboardingModelGroup } from "@shared/proto/forgeos/state"
import { describe, expect, it } from "vitest"
import {
	FORGEOSPASS_GROUP,
	getForgeOSUIOnboardingGroups,
	getOnboardingGroupDisplayName,
	getRecommendedModelsData,
} from "../data-models"

function model(id: string, group: string): OnboardingModel {
	return {
		id,
		name: id,
		group,
		badge: "",
		score: 0,
		latency: 0,
		info: undefined,
	} as OnboardingModel
}

function groupOf(models: OnboardingModel[]): OnboardingModelGroup {
	return { models } as OnboardingModelGroup
}

describe("getForgeOSUIOnboardingGroups", () => {
	it("buckets ForgeOSPass models into the forgeosPass group", () => {
		const result = getForgeOSUIOnboardingGroups(
			groupOf([
				model("forgeos-pass/glm-5.2", FORGEOSPASS_GROUP),
				model("free-model", "free"),
				model("anthropic/claude", "frontier"),
				model("z-ai/glm", "open source"),
			]),
		)

		expect(result.forgeosPass).toHaveLength(1)
		expect(result.forgeosPass[0].group).toBe(FORGEOSPASS_GROUP)
		expect(result.forgeosPass[0].models.map((m) => m.id)).toEqual(["forgeos-pass/glm-5.2"])
		expect(result.free[0].models.map((m) => m.id)).toEqual(["free-model"])
		expect(result.power.flatMap((g) => g.models.map((m) => m.id))).toEqual(["anthropic/claude", "z-ai/glm"])
	})

	it("does not bucket forgeos-pass ids without a ForgeOSPass group label", () => {
		const result = getForgeOSUIOnboardingGroups(groupOf([model("forgeos-pass/glm-5.2", "frontier")]))

		expect(result.forgeosPass).toEqual([])
	})

	it("returns an empty forgeosPass group when no ForgeOSPass models are present", () => {
		const result = getForgeOSUIOnboardingGroups(groupOf([model("free-model", "free")]))
		expect(result.forgeosPass).toEqual([])
	})
})

describe("getRecommendedModelsData", () => {
	it("includes ForgeOSPass-only responses without depending on feature-flag timing", () => {
		const result = getRecommendedModelsData({
			recommended: [],
			free: [],
			forgeosPass: [{ id: "forgeos-pass/glm-5.2", name: "GLM 5.1", description: "", tags: [] }],
		})

		expect(result?.forgeosPass.map((model) => model.id)).toEqual(["forgeos-pass/glm-5.2"])
	})

	it("keeps classic recommended/free responses and ForgeOSPass responses", () => {
		const result = getRecommendedModelsData({
			recommended: [{ id: "anthropic/claude", name: "Claude", description: "", tags: [] }],
			free: [{ id: "free-model", name: "Free", description: "", tags: [] }],
			forgeosPass: [{ id: "forgeos-pass/glm-5.2", name: "GLM 5.1", description: "", tags: [] }],
		})

		expect(result?.recommended.map((model) => model.id)).toEqual(["anthropic/claude"])
		expect(result?.free.map((model) => model.id)).toEqual(["free-model"])
		expect(result?.forgeosPass.map((model) => model.id)).toEqual(["forgeos-pass/glm-5.2"])
	})

	it("returns undefined when every recommended bucket is empty", () => {
		const result = getRecommendedModelsData({ recommended: [], free: [], forgeosPass: [] })

		expect(result).toBeUndefined()
	})
})

describe("onboarding display labels", () => {
	it("renders the canonical ForgeOSPass group as a user-facing product name", () => {
		expect(getOnboardingGroupDisplayName(FORGEOSPASS_GROUP)).toBe("ForgeOSPass")
		expect(getOnboardingGroupDisplayName("frontier")).toBe("frontier")
	})
})
