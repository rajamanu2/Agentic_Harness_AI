import { Mode } from "../storage/types"

export interface ForgeOSMessageModelInfo {
	modelId: string
	providerId: string
	mode: Mode
}

interface ForgeOSTokensInfo {
	prompt: number // Total input tokens (includes cached + non-cached)
	completion: number // Total output tokens
	cached: number // Subset of prompt_tokens that were cache hits
}

export interface ForgeOSMessageMetricsInfo {
	tokens?: ForgeOSTokensInfo
	cost?: number // Monetary cost for this turn
}
