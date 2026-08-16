import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
	LanguageModelV4,
	LanguageModelV4FunctionTool,
	LanguageModelV4Middleware,
} from "@ai-sdk/provider";
import { createProviderDefinedToolFactory } from "@ai-sdk/provider-utils";
import type {
	GatewayProviderContext,
	GatewayResolvedProviderConfig,
} from "@forgeos/shared";
import {
	modelProducesImages,
	usesImageGenerationOperation,
} from "@forgeos/shared";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";
import { z } from "zod";
import { ensureFetch, resolveApiKey } from "../http";
import { splitToolImagesMiddleware } from "../middleware/split-tool-images";
import {
	createSuccessDataResponseFetch,
	withMaxCompletionTokensForReasoningModels,
} from "./openai-compatible";
import type { ProviderFactoryResult } from "./types";

export interface ForgeOSWebSearchInput {
	query: string;
	allowed_domains?: string[];
	blocked_domains?: string[];
}

export interface ForgeOSWebSearchResult {
	results: Array<{ title?: string; url?: string }>;
}

export interface ForgeOSWebSearchOptions {
	allowedDomains?: string[];
	blockedDomains?: string[];
}

export interface ForgeOSProviderOptions {
	apiKey?: string;
	baseURL: string;
	headers?: Record<string, string>;
	fetch?: typeof fetch;
	onResponseError?: (response: Response) => Promise<void> | void;
}

const FORGEOS_WEB_SEARCH_INPUT_SCHEMA: LanguageModelV4FunctionTool["inputSchema"] =
	{
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "The search query.",
			},
			allowed_domains: {
				type: "array",
				items: { type: "string" },
				description: "Optional domains to restrict results to.",
			},
			blocked_domains: {
				type: "array",
				items: { type: "string" },
				description: "Optional domains to exclude from results.",
			},
		},
		required: ["query"],
		additionalProperties: false,
	};

const ForgeOSWebSearchInputSchema = z.object({
	query: z.string().min(1),
	allowed_domains: z.array(z.string()).optional(),
	blocked_domains: z.array(z.string()).optional(),
});

const webSearchFactory = createProviderDefinedToolFactory<
	ForgeOSWebSearchInput,
	ForgeOSWebSearchOptions
>({
	id: "forgeos.web_search",
	inputSchema: ForgeOSWebSearchInputSchema,
});

function withoutTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeDomains(value: string[] | undefined): string[] | undefined {
	const domains = value?.map((domain) => domain.trim()).filter(Boolean);
	return domains?.length ? domains : undefined;
}

function createForgeOSFetch(options: ForgeOSProviderOptions): typeof fetch {
	const baseFetch = ensureFetch(options.fetch);
	return (async (input, init) => {
		const response = await baseFetch(input, init);
		await options.onResponseError?.(response);
		return response;
	}) as typeof fetch;
}

async function executeWebSearch(
	input: ForgeOSWebSearchInput,
	options: ForgeOSWebSearchOptions,
	provider: ForgeOSProviderOptions,
	abortSignal?: AbortSignal,
): Promise<ForgeOSWebSearchResult> {
	const allowedDomains = normalizeDomains(
		input.allowed_domains ?? options.allowedDomains,
	);
	const blockedDomains = normalizeDomains(
		input.blocked_domains ?? options.blockedDomains,
	);
	if (allowedDomains && blockedDomains) {
		throw new Error(
			"web_search accepts allowed domains or blocked domains, but not both.",
		);
	}

	const response = await createForgeOSFetch(provider)(
		`${withoutTrailingSlash(provider.baseURL)}/search/websearch`,
		{
			method: "POST",
			headers: {
				...(provider.apiKey
					? { Authorization: `Bearer ${provider.apiKey}` }
					: {}),
				"Content-Type": "application/json",
				...provider.headers,
			},
			body: JSON.stringify({
				query: input.query,
				...(allowedDomains ? { allowed_domains: allowedDomains } : {}),
				...(blockedDomains ? { blocked_domains: blockedDomains } : {}),
			}),
			signal: abortSignal,
		},
	);
	const body = await response.text();
	if (!response.ok) {
		throw new Error(
			`ForgeOS web search failed (HTTP ${response.status}): ${body || response.statusText}`,
		);
	}

	const parsed = body ? (JSON.parse(body) as unknown) : {};
	const result = parsed as {
		data?: { results?: Array<{ title?: string; url?: string }> };
	};
	return {
		results: Array.isArray(result.data?.results) ? result.data.results : [],
	};
}

function createForgeOSProviderToolMiddleware(): LanguageModelV4Middleware {
	return {
		specificationVersion: "v4",
		transformParams: async ({ params }) => ({
			...params,
			tools: params.tools?.map((tool) => {
				if (tool.type !== "provider" || tool.id !== "forgeos.web_search") {
					return tool;
				}
				return {
					type: "function",
					name: tool.name,
					description:
						"Search the public web for current information and return matching pages.",
					inputSchema: FORGEOS_WEB_SEARCH_INPUT_SCHEMA,
				} satisfies LanguageModelV4FunctionTool;
			}),
		}),
	};
}

export interface ForgeOSProvider {
	(modelId: string): LanguageModelV4;
	tools: {
		webSearch(
			options?: ForgeOSWebSearchOptions,
		): ReturnType<typeof webSearchFactory<ForgeOSWebSearchResult>>;
	};
}

/** Create the ForgeOS AI SDK provider, including ForgeOS-native client tools. */
export function createForgeOS(options: ForgeOSProviderOptions): ForgeOSProvider {
	const providerFetch = createForgeOSFetch(options);
	const compatible = createOpenAICompatible({
		// Both ForgeOS gateway providers ("forgeos" and "forgeos-pass") share this AI
		// SDK provider and the same ForgeOS API; option routing keys their
		// providerOptions to the "forgeos" bucket (see buildProviderAndAliasPatch).
		name: "forgeos",
		baseURL: withoutTrailingSlash(options.baseURL),
		apiKey: options.apiKey,
		headers: options.headers,
		fetch: providerFetch,
		includeUsage: true,
		transformRequestBody: withMaxCompletionTokensForReasoningModels,
	});
	const createModel = (modelId: string): LanguageModelV4 =>
		wrapLanguageModel({
			model: wrapLanguageModel({
				model: compatible(modelId),
				middleware: createForgeOSProviderToolMiddleware(),
			}),
			middleware: splitToolImagesMiddleware,
		});
	const forgeos = ((modelId: string) => createModel(modelId)) as ForgeOSProvider;
	forgeos.tools = {
		webSearch: (toolOptions = {}) =>
			webSearchFactory<ForgeOSWebSearchResult>({
				...toolOptions,
				execute: (input, execution) =>
					executeWebSearch(input, toolOptions, options, execution.abortSignal),
			}),
	};
	return forgeos;
}

function readResponseErrorHandler(
	config: GatewayResolvedProviderConfig,
): ForgeOSProviderOptions["onResponseError"] {
	const candidate = config.options?.onResponseError;
	return typeof candidate === "function"
		? (candidate as ForgeOSProviderOptions["onResponseError"])
		: undefined;
}

export async function createForgeOSProviderModule(
	config: GatewayResolvedProviderConfig,
	context: GatewayProviderContext,
): Promise<ProviderFactoryResult> {
	const providerOptions: ForgeOSProviderOptions = {
		apiKey: await resolveApiKey(config),
		baseURL: config.baseUrl ?? "https://api.forgeos.bot/api/v1",
		headers: config.headers,
		fetch: config.fetch,
		onResponseError: readResponseErrorHandler(config),
	};
	const forgeos = createForgeOS(providerOptions);
	const openRouter =
		context.provider.metadata?.imageTransport === "openrouter"
			? createOpenRouter({
					apiKey: providerOptions.apiKey,
					baseURL: providerOptions.baseURL,
					headers: providerOptions.headers,
					fetch: createSuccessDataResponseFetch(
						createForgeOSFetch(providerOptions),
					),
					compatibility: "compatible",
				})
			: undefined;
	return {
		operations: {
			language: (modelId) =>
				openRouter &&
				modelProducesImages(context.model) &&
				!usesImageGenerationOperation(context.model)
					? openRouter.chat(modelId)
					: forgeos(modelId),
			...(openRouter
				? {
						imageGeneration: (modelId: string) =>
							openRouter.imageModel(modelId),
					}
				: {}),
		},
		buildModelTools: (tools) => {
			const result: ReturnType<
				NonNullable<ProviderFactoryResult["buildModelTools"]>
			> = {};
			for (const tool of tools) {
				if (tool.name === "web_search") {
					result.web_search = {
						tool: forgeos.tools.webSearch({
							allowedDomains: tool.allowedDomains,
							blockedDomains: tool.blockedDomains,
						}),
					};
				}
			}
			return result;
		},
		executesModelTools: true,
	};
}
