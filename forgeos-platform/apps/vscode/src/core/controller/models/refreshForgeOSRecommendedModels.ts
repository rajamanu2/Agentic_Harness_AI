import { FALLBACK_FORGEOS_RECOMMENDED_MODELS, fetchForgeOSRecommendedModels } from "@forgeos/core"
import { ForgeOSEnv } from "@/config"
import { fetch } from "@/shared/net"

interface ForgeOSRecommendedModelData {
	id: string
	name: string
	description: string
	tags: string[]
}

export interface ForgeOSRecommendedModelsData {
	recommended: ForgeOSRecommendedModelData[]
	free: ForgeOSRecommendedModelData[]
	forgeosPass?: ForgeOSRecommendedModelData[]
}

const RECOMMENDED_MODELS_CACHE_TTL_MS = 60 * 60 * 1000

let pendingRefresh: Promise<ForgeOSRecommendedModelsData> | null = null
let inMemoryCache: { data: ForgeOSRecommendedModelsData; timestamp: number } | null = null

export async function refreshForgeOSRecommendedModels(): Promise<ForgeOSRecommendedModelsData> {
	if (inMemoryCache && Date.now() - inMemoryCache.timestamp <= RECOMMENDED_MODELS_CACHE_TTL_MS) {
		return inMemoryCache.data
	}

	if (pendingRefresh) {
		return pendingRefresh
	}

	pendingRefresh = (async () => {
		try {
			return await fetchAndCacheForgeOSRecommendedModels()
		} finally {
			pendingRefresh = null
		}
	})()

	return pendingRefresh
}

export function resetForgeOSRecommendedModelsCacheForTests(): void {
	pendingRefresh = null
	inMemoryCache = null
}

function isFallbackRecommendedModels(data: ForgeOSRecommendedModelsData): boolean {
	return JSON.stringify(data) === JSON.stringify(FALLBACK_FORGEOS_RECOMMENDED_MODELS)
}

async function fetchAndCacheForgeOSRecommendedModels(): Promise<ForgeOSRecommendedModelsData> {
	// Delegate the actual HTTP fetch + response normalization + offline fallback
	// to the SDK so the CLI/JetBrains and the extension share one implementation.
	// We pass the proxy-aware fetch (per .forgeosrules/network.md) and the
	// extension's configured API base URL. On failure the SDK returns its own
	// fallback list.
	const result = await fetchForgeOSRecommendedModels({
		baseUrl: ForgeOSEnv.config().apiBaseUrl,
		fetchImpl: fetch,
	})

	// Only pin a populated, non-fallback result in memory for the full TTL; a
	// transient failure (SDK returns a clone of its fallback) should be retried
	// next call.
	if ((result.recommended.length > 0 || result.free.length > 0) && !isFallbackRecommendedModels(result)) {
		inMemoryCache = { data: result, timestamp: Date.now() }
	}
	return result
}
