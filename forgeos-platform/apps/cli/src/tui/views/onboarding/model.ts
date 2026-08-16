import { isOpenAICodexCliProvider } from "../../../utils/codex-cli";
import { isOAuthProvider } from "../../../utils/provider-auth";

export type OnboardingStep =
	| "menu"
	| "oauth_pending"
	| "device_code"
	| "byo_provider"
	| "byo_apikey"
	| "codex_cli_setup"
	| "forgeos_pass_subscription"
	| "forgeos_model"
	| "model_picker"
	| "custom_model_id"
	| "thinking_level"
	| "done";

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "xhigh";
export type ReasoningEffort = Exclude<ThinkingLevel, "none">;

export const THINKING_LEVELS: {
	value: ThinkingLevel;
	label: string;
	desc: string;
}[] = [
	{ value: "none", label: "Off", desc: "No extended thinking" },
	{ value: "low", label: "Low", desc: "Minimal reasoning" },
	{ value: "medium", label: "Medium", desc: "Balanced reasoning" },
	{ value: "high", label: "High", desc: "Deep reasoning" },
	{ value: "xhigh", label: "Extra High", desc: "Maximum reasoning" },
];

export const DEFAULT_THINKING_LEVEL_INDEX = THINKING_LEVELS.findIndex(
	(l) => l.value === "medium",
);

export interface MenuOption {
	label: string;
	value: string;
	detail: string;
	icon: string;
}

export type ForgeOSPassSubscriptionAction =
	| "subscribe"
	| "refresh"
	| "skip"
	| "back";

export interface ForgeOSPassSubscriptionOption {
	value: ForgeOSPassSubscriptionAction;
	label: string;
}

export const MAIN_MENU: MenuOption[] = [
	{
		label: "Sign in with ForgeOS",
		value: "forgeos",
		detail: "Latest models with regular free promos",
		icon: "\u263a",
	},
	{
		label: "Sign in with ForgeOSPass",
		value: "forgeos-pass",
		detail: "Low cost subscription for everyone",
		icon: "\u2726",
	},
	{
		label: "Sign in with ChatGPT",
		value: "openai-codex",
		detail: "Use your ChatGPT Plus subscription",
		icon: "\u2726",
	},
	{
		label: "Bring your own provider",
		value: "byo",
		detail: "API key or local server (e.g. Ollama)",
		icon: "\u26b7",
	},
];

export function getMainMenuOptions(options?: {
	isForgeOSPassEnabled?: boolean;
}): MenuOption[] {
	return MAIN_MENU.filter(
		(option) => option.value !== "forgeos-pass" || options?.isForgeOSPassEnabled,
	);
}

export const FORGEOS_PASS_SUBSCRIPTION_OPTIONS: ForgeOSPassSubscriptionOption[] = [
	{
		value: "subscribe",
		label: "Subscribe to ForgeOSPass",
	},
	{
		value: "refresh",
		label: "Re-check subscription status",
	},
	{
		value: "skip",
		label: "Skip for now",
	},
	{
		value: "back",
		label: "Go back",
	},
];

export interface OnboardingResult {
	providerId: string;
	modelId: string;
	apiKey?: string;
	thinking?: boolean;
	reasoningEffort?: ReasoningEffort;
}

export interface ProviderEntry {
	id: string;
	name: string;
	isOAuth: boolean;
	isLocalAuth: boolean;
	hasAuth: boolean;
	capabilities?: readonly string[];
	models: number | null;
	defaultModelId?: string;
}

export interface ModelEntry {
	id: string;
	name: string;
	supportsReasoning: boolean;
}

export type ForgeOSPassSubscriptionStatus =
	| "loading"
	| "subscribed"
	| "unsubscribed"
	| "error";

export interface ProviderCatalogItem {
	id: string;
	name: string;
	apiKey?: string;
	oauthAccessTokenPresent?: boolean;
	capabilities?: readonly string[];
	models: number | null;
	defaultModelId?: string;
}

export interface ProviderModelItem {
	id: string;
	name?: string;
	supportsReasoning?: boolean;
}

export interface KnownModelInfo {
	name?: string;
	capabilities?: string[];
}

export function toProviderEntry(provider: ProviderCatalogItem): ProviderEntry {
	return {
		id: provider.id,
		name: provider.name,
		isOAuth: isOAuthProvider(provider.id),
		isLocalAuth: isOpenAICodexCliProvider(provider.id),
		hasAuth:
			Boolean(provider.apiKey) || provider.oauthAccessTokenPresent === true,
		...(provider.capabilities ? { capabilities: provider.capabilities } : {}),
		models: provider.models,
		defaultModelId: provider.defaultModelId,
	};
}

export function toModelEntry(model: ProviderModelItem): ModelEntry {
	return {
		id: model.id,
		name: model.name || model.id,
		supportsReasoning: model.supportsReasoning === true,
	};
}

export function toModelEntriesFromKnownModels(
	knownModels: Record<string, KnownModelInfo> | undefined,
): ModelEntry[] {
	if (!knownModels) return [];
	return Object.entries(knownModels)
		.map(([id, info]) => ({
			id,
			name: info.name || id,
			supportsReasoning: info.capabilities?.includes("reasoning") ?? false,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function getOAuthProviderLabel(providerId: string): string {
	if (providerId === "forgeos-pass") {
		return "ForgeOSPass";
	}
	if (providerId === "forgeos") {
		return "ForgeOS";
	}
	if (providerId === "openai-codex") {
		return "ChatGPT";
	}
	return providerId;
}

export function shouldUseFeaturedForgeOSModelPicker(providerId: string): boolean {
	// ForgeOSPass uses the featured picker too, with Subscribed/Free sections
	return providerId === "forgeos" || providerId === "forgeos-pass";
}
