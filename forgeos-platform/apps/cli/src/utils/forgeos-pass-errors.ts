import {
	type ForgeOSSubscriptionPlan,
	extractForgeOSFreeModelLimitResetTime,
	extractForgeOSPassLimitMessage,
	getForgeOSOrgIndividualInferenceSubscriptionMessage,
	isForgeOSFreeModelLimitError,
	isForgeOSFreeModelLimitMessage,
	isForgeOSModelNotFoundMessage,
	isForgeOSNotSubscribedError,
	isForgeOSNotSubscribedMessage,
	isForgeOSOrgIndividualInferenceSubscriptionError,
	isForgeOSOrgIndividualInferenceSubscriptionMessage,
	isForgeOSPassLimitError,
	isForgeOSPassLimitMessage,
} from "@forgeos/core";

import { getForgeOSEnvironmentConfig } from "@forgeos/shared";

export { getForgeOSOrgIndividualInferenceSubscriptionMessage };

export const CLI_PROMO_CODE = "";

export function getCliSubscriptionUrl(): string {
	if (!CLI_PROMO_CODE) {
		return new URL(
			`/dashboard/subscription?personal=true`,
			getForgeOSEnvironmentConfig().appBaseUrl,
		).toString();
	}

	return `${new URL(
		`/promo?code=${CLI_PROMO_CODE}&personal=true`,
		getForgeOSEnvironmentConfig().appBaseUrl,
	).toString()}`;
}

export function getCliNotSubscribedMessage(): string {
	return `No access to ForgeOSPass subscription models yet. Subscribe to ForgeOSPass, the low cost open weights model coding plan: ${getCliSubscriptionUrl()}`;
}

export function getCliForgeOSPassLimitMessage(message: string): string {
	const detail = getForgeOSPassLimitDetailMessage(message) ?? message.trim();
	const lines = [
		"ForgeOSPass limit reached",
		detail,
		"Switch to ForgeOS usage-based billing and retry with the ForgeOS provider.",
		"Interactive CLI: open the model selector with /model, choose ForgeOS, then retry.",
		"Headless CLI: rerun with --provider forgeos.",
	];
	return lines.filter((line) => line.trim().length > 0).join("\n");
}

const FORGEOS_FREE_MODEL_PREFIX = "forgeos-free/";
const FORGEOS_FREE_PROMOTION_ENDED_HEADER = "Free model promotion ended";
const FORGEOS_FREE_MODEL_LIMIT_HEADER = "Daily free model limit reached";

export function getCliForgeOSFreePromotionEndedMessage(): string {
	return [
		FORGEOS_FREE_PROMOTION_ENDED_HEADER,
		"The free promotion for this model has ended and it is no longer available.",
		"Select another model to continue.",
		"Open the model selector with /model.",
	].join("\n");
}

export function getCliForgeOSFreeModelLimitMessage(message: string): string {
	const resetTime = extractForgeOSFreeModelLimitResetTime(message);
	return [
		FORGEOS_FREE_MODEL_LIMIT_HEADER,
		"You've reached today's free usage limit for this model.",
		resetTime
			? `Try again in ${resetTime} or select another model.`
			: "Try again later or select another model.",
		"Open the model selector with /model.",
	].join("\n");
}

export function getIndividualPlanFeatures(
	plans: ForgeOSSubscriptionPlan[],
): string[] {
	const planWithFeatures = plans.find((plan) => plan.interval === "Monthly");

	return planWithFeatures?.features?.included ?? [];
}

function isFormattedForgeOSPassSubscriptionMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized.includes("no access to forgeospass subscription models yet") &&
		normalized.includes("subscribe to forgeospass")
	);
}

export function isForgeOSPassSubscriptionError(error: unknown): boolean {
	if (isForgeOSNotSubscribedError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ForgeOSNotSubscribedError" ||
			isForgeOSNotSubscribedMessage(error.message) ||
			isFormattedForgeOSPassSubscriptionMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(isForgeOSNotSubscribedMessage(error) ||
			isFormattedForgeOSPassSubscriptionMessage(error))
	);
}

export function isForgeOSOrgIndividualInferenceSubscriptionErrorMessage(
	error: unknown,
): boolean {
	if (isForgeOSOrgIndividualInferenceSubscriptionError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ForgeOSOrgIndividualInferenceSubscriptionError" ||
			isForgeOSOrgIndividualInferenceSubscriptionMessage(error.message) ||
			error.message === getForgeOSOrgIndividualInferenceSubscriptionMessage()
		);
	}
	return (
		typeof error === "string" &&
		(isForgeOSOrgIndividualInferenceSubscriptionMessage(error) ||
			error === getForgeOSOrgIndividualInferenceSubscriptionMessage())
	);
}

export function getForgeOSPassLimitDetailMessage(
	error: unknown,
): string | undefined {
	return extractForgeOSPassLimitMessage(
		error instanceof Error ? error.message : String(error),
	);
}

export function isForgeOSPassLimitErrorMessage(error: unknown): boolean {
	if (isForgeOSPassLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ForgeOSPassLimitError" ||
			isForgeOSPassLimitMessage(error.message)
		);
	}
	return typeof error === "string" && isForgeOSPassLimitMessage(error);
}

// Detects that a deleted free model was requested: the backend answers "model
// not found" once a free promotion ends and the forgeos-free/ model is removed.
// The modelId gate keeps regular model-not-found errors on their generic path.
export function isForgeOSFreePromotionEndedErrorMessage(
	error: unknown,
	modelId?: string,
): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";
	if (
		message
			.toLowerCase()
			.includes(FORGEOS_FREE_PROMOTION_ENDED_HEADER.toLowerCase())
	) {
		return true;
	}
	if (!modelId?.startsWith(FORGEOS_FREE_MODEL_PREFIX)) {
		return false;
	}
	return isForgeOSModelNotFoundMessage(message);
}

export function isForgeOSFreeModelLimitErrorMessage(error: unknown): boolean {
	if (isForgeOSFreeModelLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ForgeOSFreeModelLimitError" ||
			isForgeOSFreeModelLimitMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(error
			.toLowerCase()
			.includes(FORGEOS_FREE_MODEL_LIMIT_HEADER.toLowerCase()) ||
			isForgeOSFreeModelLimitMessage(error))
	);
}

export function formatCliErrorMessage(
	error: unknown,
	options?: { modelId?: string },
): string {
	if (isForgeOSPassSubscriptionError(error)) {
		return getCliNotSubscribedMessage();
	}
	if (isForgeOSOrgIndividualInferenceSubscriptionErrorMessage(error)) {
		return getForgeOSOrgIndividualInferenceSubscriptionMessage();
	}
	if (isForgeOSPassLimitErrorMessage(error)) {
		return getCliForgeOSPassLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isForgeOSFreeModelLimitErrorMessage(error)) {
		return getCliForgeOSFreeModelLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isForgeOSFreePromotionEndedErrorMessage(error, options?.modelId)) {
		return getCliForgeOSFreePromotionEndedMessage();
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
