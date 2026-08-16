import { getForgeOSEnvironmentConfig } from "@forgeos/shared";

export const FORGEOS_NOT_SUBSCRIBED_RESPONSE_MESSAGE =
	"the user is not subscribed to required model plan";
const FORGEOS_NOT_SUBSCRIBED_FORMATTED_MESSAGE_PREFIX =
	"no access to forgeospass subscription models yet. subscribe to forgeospass";
export const FORGEOS_ORG_INDIVIDUAL_INFERENCE_SUBSCRIPTION_RESPONSE_MESSAGE =
	"organization accounts cannot use individual model inference subscriptions";

const FORGEOS_PASS_LIMIT_PREFIX = "you have reached your";
const FORGEOS_PASS_LIMIT_MARKER = "forgeospass limit";
const FORGEOS_PASS_LIMIT_SUFFIX = "please try again later.";
const FORGEOS_FREE_MODEL_LIMIT_MARKER = "free limit reached on model";
const FORGEOS_FREE_MODEL_LIMIT_RETRY_MARKER = "try again in ";
const FORGEOS_MODEL_NOT_FOUND_MARKER = "model not found";

function findForgeOSPassLimitMessageBounds(
	text: string,
): { start: number; end: number } | undefined {
	const normalized = text.toLowerCase();
	const start = normalized.indexOf(FORGEOS_PASS_LIMIT_PREFIX);
	if (start === -1) {
		return undefined;
	}

	const suffixStart = normalized.indexOf(FORGEOS_PASS_LIMIT_SUFFIX, start);
	if (suffixStart === -1) {
		return undefined;
	}

	const end = suffixStart + FORGEOS_PASS_LIMIT_SUFFIX.length;
	if (!normalized.slice(start, end).includes(FORGEOS_PASS_LIMIT_MARKER)) {
		return undefined;
	}

	return { start, end };
}

export function getForgeOSPassSubscriptionUrl(): string {
	return `${new URL(
		"/dashboard/subscription?personal=true",
		getForgeOSEnvironmentConfig().appBaseUrl,
	).toString()}`;
}

export function getForgeOSNotSubscribedMessage(): string {
	return `No access to ForgeOSPass subscription models yet. Subscribe to ForgeOSPass, the low cost open weights model coding plan: ${getForgeOSPassSubscriptionUrl()}`;
}

export class ForgeOSNotSubscribedError extends Error {
	public readonly providerId?: string;

	constructor(providerId?: string) {
		super(getForgeOSNotSubscribedMessage());
		this.name = "ForgeOSNotSubscribedError";
		this.providerId = providerId;
	}
}

export function getForgeOSOrgIndividualInferenceSubscriptionMessage(): string {
	return "Organization accounts cannot use ForgeOSPass subscriptions. Go to /account -> change account to switch to your personal account for ForgeOSPass";
}

export class ForgeOSOrgIndividualInferenceSubscriptionError extends Error {
	public readonly providerId?: string;

	constructor(providerId?: string) {
		super(getForgeOSOrgIndividualInferenceSubscriptionMessage());
		this.name = "ForgeOSOrgIndividualInferenceSubscriptionError";
		this.providerId = providerId;
	}
}

export class ForgeOSPassLimitError extends Error {
	public readonly providerId?: string;

	constructor(message: string, providerId?: string) {
		super(message);
		this.name = "ForgeOSPassLimitError";
		this.providerId = providerId;
	}
}

export class ForgeOSFreeModelLimitError extends Error {
	public readonly providerId?: string;

	constructor(message: string, providerId?: string) {
		super(message);
		this.name = "ForgeOSFreeModelLimitError";
		this.providerId = providerId;
	}
}

export function isForgeOSNotSubscribedError(
	error: unknown,
): error is ForgeOSNotSubscribedError {
	return error instanceof ForgeOSNotSubscribedError;
}

export function isForgeOSOrgIndividualInferenceSubscriptionError(
	error: unknown,
): error is ForgeOSOrgIndividualInferenceSubscriptionError {
	return error instanceof ForgeOSOrgIndividualInferenceSubscriptionError;
}

export function isForgeOSPassLimitError(
	error: unknown,
): error is ForgeOSPassLimitError {
	return error instanceof ForgeOSPassLimitError;
}

export function isForgeOSFreeModelLimitError(
	error: unknown,
): error is ForgeOSFreeModelLimitError {
	return error instanceof ForgeOSFreeModelLimitError;
}

export function isForgeOSNotSubscribedMessage(text: string): boolean {
	const normalized = text.trim().toLowerCase();
	return (
		normalized.includes(FORGEOS_NOT_SUBSCRIBED_RESPONSE_MESSAGE) ||
		normalized.includes(FORGEOS_NOT_SUBSCRIBED_FORMATTED_MESSAGE_PREFIX)
	);
}

export function isForgeOSOrgIndividualInferenceSubscriptionMessage(
	text: string,
): boolean {
	return text
		.toLowerCase()
		.includes(FORGEOS_ORG_INDIVIDUAL_INFERENCE_SUBSCRIPTION_RESPONSE_MESSAGE);
}

export function isForgeOSPassLimitMessage(text: string): boolean {
	return findForgeOSPassLimitMessageBounds(text) !== undefined;
}

export function extractForgeOSPassLimitMessage(text: string): string | undefined {
	const bounds = findForgeOSPassLimitMessageBounds(text);
	return bounds ? text.slice(bounds.start, bounds.end) : undefined;
}

export function isForgeOSFreeModelLimitMessage(text: string): boolean {
	return text.toLowerCase().includes(FORGEOS_FREE_MODEL_LIMIT_MARKER);
}

export function isForgeOSModelNotFoundMessage(text: string): boolean {
	return text.toLowerCase().includes(FORGEOS_MODEL_NOT_FOUND_MARKER);
}

export function extractForgeOSFreeModelLimitResetTime(
	text: string,
): string | undefined {
	const message = text.toLowerCase();
	const resetStart = message.indexOf(FORGEOS_FREE_MODEL_LIMIT_RETRY_MARKER);
	if (resetStart === -1) {
		return undefined;
	}

	const resetTime = message
		.slice(resetStart + FORGEOS_FREE_MODEL_LIMIT_RETRY_MARKER.length)
		.trim();
	return resetTime || undefined;
}
