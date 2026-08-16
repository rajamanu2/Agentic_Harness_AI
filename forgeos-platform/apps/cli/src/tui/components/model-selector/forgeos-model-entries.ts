import type {
	ForgeOSRecommendedModel,
	ForgeOSRecommendedModelsData,
} from "@forgeos/core";

export type ForgeOSModelPickerTier = "recommended" | "subscribed" | "free";

export interface ForgeOSModelPickerItem {
	kind: "model";
	model: ForgeOSRecommendedModel;
	tier: ForgeOSModelPickerTier;
}

export interface ForgeOSModelPickerBrowse {
	kind: "browse";
}

export type ForgeOSModelPickerEntry =
	| ForgeOSModelPickerItem
	| ForgeOSModelPickerBrowse;

export const FORGEOS_MODEL_PICKER_TIER_LABELS: Record<
	ForgeOSModelPickerTier,
	string
> = {
	recommended: "Recommended",
	subscribed: "Subscribed",
	free: "Free",
};

// Featured entries for the sectioned picker, keyed by provider: forgeos gets
// Recommended/Free with a browse-all escape into the full catalog; forgeos-pass
// gets Subscribed/Free (see buildForgeOSPassModelEntries for why no browse-all).
export function buildFeaturedModelEntries(
	providerId: string,
	data: ForgeOSRecommendedModelsData,
): ForgeOSModelPickerEntry[] {
	return providerId === "forgeos-pass"
		? buildForgeOSPassModelEntries(data)
		: buildForgeOSModelEntries(data);
}

function buildForgeOSModelEntries(
	data: ForgeOSRecommendedModelsData,
): ForgeOSModelPickerEntry[] {
	const entries: ForgeOSModelPickerEntry[] = [];
	for (const m of data.recommended) {
		entries.push({ kind: "model", model: m, tier: "recommended" });
	}
	for (const m of data.free) {
		entries.push({ kind: "model", model: m, tier: "free" });
	}
	entries.push({ kind: "browse" });
	return entries;
}

// Shown under the Free section header when picking a model for ForgeOSPass
export const FORGEOS_PASS_FREE_SECTION_DESCRIPTION =
	"Try with limited usage, separate from ForgeOSPass quota.";

// ForgeOSPass shows the subscription's models plus the ForgeOS free models — both
// providers hit the same ForgeOS API, so free models are selectable in place
// (they ride usage billing at $0 instead of the subscription quota).
// No "browse all" entry when the forgeosPass bucket is populated: unlike forgeos,
// the ForgeOSPass catalog contains exactly these two buckets, so the sections
// already list every selectable model. An empty forgeosPass bucket means the
// fetch fell back to the bundled list (which has no pass models) — without an
// escape into the full catalog a subscriber could only pick free models, so
// browse-all comes back in that degraded mode.
function buildForgeOSPassModelEntries(
	data: ForgeOSRecommendedModelsData,
): ForgeOSModelPickerEntry[] {
	const entries: ForgeOSModelPickerEntry[] = [];
	for (const m of data.forgeosPass) {
		entries.push({ kind: "model", model: m, tier: "subscribed" });
	}
	for (const m of data.free) {
		entries.push({ kind: "model", model: m, tier: "free" });
	}
	if (data.forgeosPass.length === 0) {
		entries.push({ kind: "browse" });
	}
	return entries;
}

// The quota explainer only makes sense in the ForgeOSPass picker, which is the
// only picker that has a "subscribed" section
export function freeTierDescriptionFor(
	entries: ForgeOSModelPickerEntry[],
): string | undefined {
	const isForgeOSPassPicker = entries.some(
		(entry) => entry.kind === "model" && entry.tier === "subscribed",
	);
	return isForgeOSPassPicker ? FORGEOS_PASS_FREE_SECTION_DESCRIPTION : undefined;
}
