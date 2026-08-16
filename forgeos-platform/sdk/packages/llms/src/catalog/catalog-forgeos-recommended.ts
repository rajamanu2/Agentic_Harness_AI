import { getForgeOSEnvironmentConfig } from "@forgeos/shared";
import type { ModelInfo } from "./types";

export interface ForgeOSRecommendedModelEntry {
	id: string;
	name?: string;
	description?: string;
}

export interface ForgeOSRecommendedModelsPayload {
	forgeosPass?: ForgeOSRecommendedModelEntry[];
	free?: ForgeOSRecommendedModelEntry[];
}

type ModelCapabilities = Pick<
	ModelInfo,
	| "contextWindow"
	| "maxInputTokens"
	| "maxTokens"
	| "capabilities"
	| "reasoningOptions"
	| "pricing"
>;

const FORGEOS_PASS_PROVIDER_ID = "forgeos-pass";
const FORGEOS_PROVIDER_ID = "forgeos";

const FORGEOS_PASS_MODEL_DEFAULTS = {
	contextWindow: 128_000,
	maxInputTokens: 128_000,
	maxTokens: 8_192,
	capabilities: ["tools", "reasoning", "temperature"],
	pricing: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
	},
} as const satisfies ModelCapabilities;

function findORModelCapabilities(
	entry: ForgeOSRecommendedModelEntry,
	openRouterModels: Record<string, ModelInfo>,
): ModelCapabilities {
	if (!openRouterModels) {
		return FORGEOS_PASS_MODEL_DEFAULTS;
	}

	const modelSlug = entry.id.split("/").at(-1) ?? entry.id;

	return openRouterModels[modelSlug] || FORGEOS_PASS_MODEL_DEFAULTS;
}

// ForgeOS-Pass models have only the model name (and not the lab),
// so we need to look-up using glm-5.2 instead of forgeos-pass/glm-5.2
function buildModelsNameMap(
	openrouterModels: Record<string, ModelInfo>,
): Record<string, ModelInfo> {
	const nameMap: Record<string, ModelInfo> = {};

	for (const model of Object.values(openrouterModels)) {
		const modelSlugWithoutProvider = model.id.split("/").at(-1) ?? model.id;

		nameMap[modelSlugWithoutProvider] = model;
	}

	return nameMap;
}

export function normalizeForgeOSRecommendedProviderModels(
	payload: ForgeOSRecommendedModelsPayload,
	openRouterModels: Record<string, ModelInfo>,
): Record<string, Record<string, ModelInfo>> {
	const forgeosPass = payload.forgeosPass ?? [];
	const models: Record<string, ModelInfo> = {};
	const forgeosFreeModels: Record<string, ModelInfo> = {};
	const openRouterModelsByName = buildModelsNameMap(openRouterModels);

	forgeosPass.forEach((entry) => {
		const capabilities = findORModelCapabilities(entry, openRouterModelsByName);

		models[entry.id] = {
			// We should use the OR name, unless there is not one (like when using defaults)
			name: entry.name,
			...capabilities,
			id: entry.id,
			description: entry.description,
		};
	});

	// ForgeOS free models are selectable on the ForgeOSPass provider too (same API
	// underneath; they ride usage billing at $0 instead of the subscription quota).
	// Unlike pass models their ids are full OpenRouter-style ids or forgeos-free ids,
	// so look up capabilities by full id before falling back to the slug map.
	(payload.free ?? []).forEach((entry) => {
		const capabilities =
			openRouterModels?.[entry.id] ??
			findORModelCapabilities(entry, openRouterModelsByName);
		// The recommended-models endpoint only sends slug-like names (e.g.
		// "deepseek-v4-flash"), so prefer the OpenRouter catalog's display name
		// for every free entry. Without this, the free overlay overwrites the
		// nice OpenRouter names in the merged forgeos/forgeos-pass catalogs and the
		// pickers end up rendering raw model ids for the Free section.
		const entryName =
			capabilities.name?.trim() || entry.name?.trim() || entry.id;
		const name = entry.id.startsWith("forgeos-free/")
			? `${entryName} (free)`
			: entryName;

		const modelInfo = {
			...capabilities,
			name,
			id: entry.id,
			description: entry.description,
		};

		forgeosFreeModels[entry.id] = {
			...modelInfo,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		};

		if (models[entry.id]) {
			return;
		}

		models[entry.id] = {
			...modelInfo,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		};
	});

	const result: Record<string, Record<string, ModelInfo>> = {};
	if (Object.keys(forgeosFreeModels).length > 0) {
		result[FORGEOS_PROVIDER_ID] = forgeosFreeModels;
	}
	if (forgeosPass.length > 0) {
		result[FORGEOS_PASS_PROVIDER_ID] = models;
	}
	return result;
}

export async function fetchForgeOSRecommendedModelsPayload(
	fetcher: typeof fetch = fetch,
): Promise<ForgeOSRecommendedModelsPayload> {
	const url = `${getForgeOSEnvironmentConfig().apiBaseUrl}/api/v1/ai/forgeos/recommended-models`;
	const response = await fetcher(url);
	if (!response.ok) {
		throw new Error(
			`Failed to load ForgeOS recommended models from ${url}: HTTP ${response.status}`,
		);
	}

	return (await response.json()) as ForgeOSRecommendedModelsPayload;
}

export async function fetchForgeOSRecommendedProviderModels(
	fetcher: typeof fetch = fetch,
	openRouterModels: Record<string, ModelInfo>,
): Promise<Record<string, Record<string, ModelInfo>>> {
	const payload = await fetchForgeOSRecommendedModelsPayload(fetcher);
	return normalizeForgeOSRecommendedProviderModels(payload, openRouterModels);
}
