import { describe, expect, it } from "vitest";
import {
	formatCliErrorMessage,
	getCliForgeOSFreeModelLimitMessage,
	getCliForgeOSPassLimitMessage,
	getCliNotSubscribedMessage,
	getForgeOSOrgIndividualInferenceSubscriptionMessage,
	getForgeOSPassLimitDetailMessage,
	isForgeOSFreeModelLimitErrorMessage,
	isForgeOSFreePromotionEndedErrorMessage,
	isForgeOSOrgIndividualInferenceSubscriptionErrorMessage,
	isForgeOSPassLimitErrorMessage,
	isForgeOSPassSubscriptionError,
} from "./forgeos-pass-errors";

describe("forgeos-pass-errors", () => {
	it("recognizes both raw and formatted ForgeOSPass subscription messages", () => {
		expect(
			isForgeOSPassSubscriptionError(
				"the user is not subscribed to required model plan",
			),
		).toBe(true);

		const sdkFormatted =
			"No access to ForgeOSPass subscription models yet. Subscribe to ForgeOSPass, the low cost open weights model coding plan: https://app.forgeos.bot/dashboard/subscription?personal=true";
		const formatted = getCliNotSubscribedMessage();
		expect(isForgeOSPassSubscriptionError(sdkFormatted)).toBe(true);
		expect(isForgeOSPassSubscriptionError(formatted)).toBe(true);
		expect(formatCliErrorMessage(new Error(sdkFormatted))).toBe(formatted);
		expect(formatCliErrorMessage(new Error(formatted))).toBe(formatted);
	});

	it("recognizes and formats organization account individual subscription errors", () => {
		const raw =
			"403 Error 403: organization accounts cannot use individual model inference subscriptions";
		const formatted = getForgeOSOrgIndividualInferenceSubscriptionMessage();

		expect(isForgeOSOrgIndividualInferenceSubscriptionErrorMessage(raw)).toBe(
			true,
		);
		expect(
			isForgeOSOrgIndividualInferenceSubscriptionErrorMessage(
				new Error(formatted),
			),
		).toBe(true);
		expect(formatCliErrorMessage(new Error(raw))).toBe(formatted);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain(
			"deepseek-v4-flash",
		);
	});

	it("recognizes and formats ForgeOSPass period limit errors with usage-billing guidance", () => {
		const raw =
			"Error: You have reached your 5-hour ForgeOSpass limit. The limit resets in 5h, please try again later.";
		const detail =
			"You have reached your 5-hour ForgeOSpass limit. The limit resets in 5h, please try again later.";

		expect(isForgeOSPassLimitErrorMessage(raw)).toBe(true);
		expect(isForgeOSPassLimitErrorMessage(new Error(raw))).toBe(true);
		expect(getForgeOSPassLimitDetailMessage(raw)).toBe(detail);
		expect(formatCliErrorMessage(new Error(raw))).toBe(
			getCliForgeOSPassLimitMessage(raw),
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"Switch to ForgeOS usage-based billing",
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain("--provider forgeos");
	});

	it("recognizes and formats daily free model limits without usage-billing guidance", () => {
		const raw =
			"Error: Error 429: Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m";

		expect(isForgeOSFreeModelLimitErrorMessage(raw)).toBe(true);
		expect(isForgeOSFreeModelLimitErrorMessage(new Error(raw))).toBe(true);
		expect(formatCliErrorMessage(new Error(raw))).toBe(
			getCliForgeOSFreeModelLimitMessage(raw),
		);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain("Error 429");
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"Try again in 23h 59m",
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"select another model",
		);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain(
			"usage-based billing",
		);
		expect(
			isForgeOSFreeModelLimitErrorMessage(getCliForgeOSFreeModelLimitMessage(raw)),
		).toBe(true);
	});

	it("formats model-not-found errors for removed free models", () => {
		const raw = new Error("Error 404: model not found");

		expect(
			formatCliErrorMessage(raw, { modelId: "forgeos-free/retired-model" }),
		).toContain("Free model promotion ended");
		expect(
			isForgeOSFreePromotionEndedErrorMessage(
				formatCliErrorMessage(raw, { modelId: "forgeos-free/retired-model" }),
			),
		).toBe(true);
		expect(
			formatCliErrorMessage(raw, { modelId: "vendor/retired-model" }),
		).toBe(raw.message);
	});
});
