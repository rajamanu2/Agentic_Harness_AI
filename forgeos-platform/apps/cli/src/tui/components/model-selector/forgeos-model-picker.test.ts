import { describe, expect, it } from "vitest";
import {
	buildFeaturedModelEntries,
	FORGEOS_PASS_FREE_SECTION_DESCRIPTION,
	freeTierDescriptionFor,
} from "./forgeos-model-entries";

const model = (id: string) => ({ id, name: id, description: "", tags: [] });

describe("forgeos model picker entries", () => {
	it("builds Recommended/Free sections for the forgeos provider", () => {
		const entries = buildFeaturedModelEntries("forgeos", {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			forgeosPass: [model("forgeos-pass/glm-5.1")],
		});

		expect(entries).toEqual([
			{
				kind: "model",
				model: model("anthropic/claude-sonnet-5"),
				tier: "recommended",
			},
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
			{ kind: "browse" },
		]);
	});

	it("builds Subscribed/Free sections for the forgeos-pass provider", () => {
		const entries = buildFeaturedModelEntries("forgeos-pass", {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			forgeosPass: [model("forgeos-pass/glm-5.1"), model("forgeos-pass/kimi-k2.6")],
		});

		expect(entries).toEqual([
			{ kind: "model", model: model("forgeos-pass/glm-5.1"), tier: "subscribed" },
			{
				kind: "model",
				model: model("forgeos-pass/kimi-k2.6"),
				tier: "subscribed",
			},
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
		]);
	});

	it("adds the browse-all escape when the forgeosPass bucket is empty", () => {
		// The fetch fell back to the bundled list (no pass models); the sections
		// alone would leave a subscriber able to pick only free models.
		const entries = buildFeaturedModelEntries("forgeos-pass", {
			recommended: [],
			free: [model("deepseek/deepseek-v4-flash")],
			forgeosPass: [],
		});

		expect(entries).toEqual([
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
			{ kind: "browse" },
		]);
	});

	it("attaches the quota explainer only to the ForgeOSPass picker's free section", () => {
		const data = {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			forgeosPass: [model("forgeos-pass/glm-5.1")],
		};

		expect(
			freeTierDescriptionFor(buildFeaturedModelEntries("forgeos-pass", data)),
		).toBe(FORGEOS_PASS_FREE_SECTION_DESCRIPTION);
		expect(
			freeTierDescriptionFor(buildFeaturedModelEntries("forgeos", data)),
		).toBe(undefined);
	});
});
