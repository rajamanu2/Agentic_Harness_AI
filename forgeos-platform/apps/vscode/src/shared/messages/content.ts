import type { Anthropic } from "@anthropic-ai/sdk"
import type { ForgeOSMessageMetricsInfo, ForgeOSMessageModelInfo } from "./metrics"

export type ForgeOSPromptInputContent = string

export type ForgeOSMessageRole = "user" | "assistant"

export interface ForgeOSReasoningDetailParam {
	type: "reasoning.text" | string
	text: string
	signature: string
	format: "anthropic-claude-v1" | string
	index: number
}

interface ForgeOSSharedMessageParam {
	// The id of the response that the block belongs to
	call_id?: string
}

export const REASONING_DETAILS_PROVIDERS = ["forgeos", "openrouter"]

/**
 * An extension of Anthropic.MessageParam that includes ForgeOS-specific fields: reasoning_details.
 * This ensures backward compatibility where the messages were stored in Anthropic format with additional
 * fields unknown to Anthropic SDK.
 */
export interface ForgeOSTextContentBlock extends Anthropic.TextBlockParam, ForgeOSSharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: ForgeOSReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface ForgeOSImageContentBlock extends Anthropic.ImageBlockParam, ForgeOSSharedMessageParam {}

export interface ForgeOSDocumentContentBlock extends Anthropic.DocumentBlockParam, ForgeOSSharedMessageParam {}

export interface ForgeOSUserToolResultContentBlock extends Anthropic.ToolResultBlockParam, ForgeOSSharedMessageParam {}

/**
 * Assistant only content types
 */
export interface ForgeOSAssistantToolUseBlock extends Anthropic.ToolUseBlockParam, ForgeOSSharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: unknown[] | ForgeOSReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface ForgeOSAssistantThinkingBlock extends Anthropic.ThinkingBlock, ForgeOSSharedMessageParam {
	// The summary items returned by OpenAI response API
	// The reasoning details that will be moved to the text block when finalized
	summary?: unknown[] | ForgeOSReasoningDetailParam[]
}

export interface ForgeOSAssistantRedactedThinkingBlock extends Anthropic.RedactedThinkingBlockParam, ForgeOSSharedMessageParam {}

export type ForgeOSToolResponseContent = ForgeOSPromptInputContent | Array<ForgeOSTextContentBlock | ForgeOSImageContentBlock>

export type ForgeOSUserContent =
	| ForgeOSTextContentBlock
	| ForgeOSImageContentBlock
	| ForgeOSDocumentContentBlock
	| ForgeOSUserToolResultContentBlock

export type ForgeOSAssistantContent =
	| ForgeOSTextContentBlock
	| ForgeOSImageContentBlock
	| ForgeOSDocumentContentBlock
	| ForgeOSAssistantToolUseBlock
	| ForgeOSAssistantThinkingBlock
	| ForgeOSAssistantRedactedThinkingBlock

export type ForgeOSContent = ForgeOSUserContent | ForgeOSAssistantContent

/**
 * An extension of Anthropic.MessageParam that includes ForgeOS-specific fields.
 * This ensures backward compatibility where the messages were stored in Anthropic format,
 * while allowing for additional metadata specific to ForgeOS to avoid unknown fields in Anthropic SDK
 * added by ignoring the type checking for those fields.
 */
export interface ForgeOSStorageMessage extends Anthropic.MessageParam {
	/**
	 * Response ID associated with this message
	 */
	id?: string
	role: ForgeOSMessageRole
	content: ForgeOSPromptInputContent | ForgeOSContent[]
	/**
	 * NOTE: model information used when generating this message.
	 * Internal use for message conversion only.
	 * MUST be removed before sending message to any LLM provider.
	 */
	modelInfo?: ForgeOSMessageModelInfo
	/**
	 * LLM operational and performance metrics for this message
	 * Includes token counts, costs.
	 */
	metrics?: ForgeOSMessageMetricsInfo
	/**
	 * Timestamp of when the message was created
	 */
	ts?: number
}

/**
 * Converts ForgeOSStorageMessage to Anthropic.MessageParam by removing ForgeOS-specific fields
 * ForgeOS-specific fields (like modelInfo, reasoning_details) are properly omitted.
 */
export function convertForgeOSStorageToAnthropicMessage(
	forgeosMessage: ForgeOSStorageMessage,
	provider = "anthropic",
): Anthropic.MessageParam {
	const { role, content } = forgeosMessage

	// Handle string content - fast path
	if (typeof content === "string") {
		return { role, content }
	}

	// Removes thinking block that has no signature (invalid thinking block that's incompatible with Anthropic API)
	const filteredContent = content.filter((b) => b.type !== "thinking" || !!b.signature)

	// Handle array content - strip ForgeOS-specific fields for non-reasoning_details providers
	const shouldCleanContent = !REASONING_DETAILS_PROVIDERS.includes(provider)
	const cleanedContent = shouldCleanContent
		? filteredContent.map(cleanContentBlock)
		: (filteredContent as Anthropic.MessageParam["content"])

	return { role, content: cleanedContent }
}

/**
 * ForgeOS stores images as base64, so an image block's source is always a base64 source.
 * The Anthropic SDK types the source as a Base64ImageSource | URLImageSource union, so this
 * narrows to the base64 variant for the transform layer. URL sources are not produced by ForgeOS,
 * so they degrade to empty values rather than throwing.
 */
export function getBase64ImageSource(source: Anthropic.ImageBlockParam["source"]): { mediaType: string; data: string } {
	if (source.type === "base64") {
		return { mediaType: source.media_type, data: source.data }
	}
	return { mediaType: "", data: "" }
}

/**
 * Builds a base64 data URL from an image block's source. See getBase64ImageSource.
 */
export function getImageDataUrl(source: Anthropic.ImageBlockParam["source"]): string {
	const { mediaType, data } = getBase64ImageSource(source)
	return `data:${mediaType};base64,${data}`
}

/**
 * Clean a content block by removing ForgeOS-specific fields and returning only Anthropic-compatible fields
 */
export function cleanContentBlock(block: ForgeOSContent): Anthropic.ContentBlock {
	// Fast path: if no ForgeOS-specific fields exist, return as-is
	const hasForgeOSFields =
		"reasoning_details" in block ||
		"call_id" in block ||
		"summary" in block ||
		(block.type !== "thinking" && "signature" in block)

	if (!hasForgeOSFields) {
		return block as Anthropic.ContentBlock
	}

	// Removes ForgeOS-specific fields & the signature field that's added for Gemini.
	const { reasoning_details, call_id, summary, ...rest } = block as any

	// Remove signature from non-thinking blocks that were added for Gemini
	if (block.type !== "thinking" && rest.signature) {
		rest.signature = undefined
	}

	return rest satisfies Anthropic.ContentBlock
}
