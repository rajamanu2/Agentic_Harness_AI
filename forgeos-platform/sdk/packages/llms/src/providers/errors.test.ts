import { describe, expect, it } from "vitest";
import { isForgeOSPassLimitMessage } from "../index.browser";
import {
	extractForgeOSFreeModelLimitResetTime,
	extractForgeOSPassLimitMessage,
	isForgeOSFreeModelLimitMessage,
} from "./errors";

describe("isForgeOSPassLimitMessage", () => {
	it("matches the ForgeOSPass weekly limit message", () => {
		const message =
			"You have reached your weekly ForgeOSpass limit. The limit resets in 7d, please try again later.";
		expect(isForgeOSPassLimitMessage(message)).toBe(true);
	});

	it("matches the 5-hour ForgeOSPass limit message", () => {
		const message =
			"You have reached your 5-hour ForgeOSpass limit. The limit resets in 5h, please try again later.";
		expect(isForgeOSPassLimitMessage(message)).toBe(true);
	});

	it("handles tab-heavy non-matches without regex backtracking", () => {
		expect(
			isForgeOSPassLimitMessage(`You have reached your\t${"\t".repeat(10_000)}`),
		).toBe(false);
		expect(
			isForgeOSPassLimitMessage(`You have reached your\t-${"\t".repeat(10_000)}`),
		).toBe(false);
		expect(
			isForgeOSPassLimitMessage(
				`You have reached your\t-\tForgeOSpass limit.The limit resets in\t${"\t".repeat(10_000)}`,
			),
		).toBe(false);
	});
});

describe("extractForgeOSPassLimitMessage", () => {
	it("extracts the ForgeOSPass weekly limit message", () => {
		const message =
			"You have reached your weekly ForgeOSpass limit. The limit resets in 7d, please try again later.";

		const extracted = extractForgeOSPassLimitMessage(`Error: ${message}`);
		expect(extracted).toBe(message);
	});

	it("extracts the 5-hour ForgeOSPass limit message", () => {
		const message =
			"You have reached your 5-hour ForgeOSpass limit. The limit resets in 5h, please try again later.";

		const extracted = extractForgeOSPassLimitMessage(`Error: ${message}`);
		expect(extracted).toBe(message);
	});
});

describe("ForgeOS free model limit messages", () => {
	const message =
		"Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m";

	it("detects the message in an HTTP error", () => {
		const error = `Error: Error 429: ${message}`;
		expect(isForgeOSFreeModelLimitMessage(error)).toBe(true);
		expect(extractForgeOSFreeModelLimitResetTime(error)).toBe("23h 59m");
	});

	it("does not match unrelated daily limits", () => {
		expect(
			isForgeOSFreeModelLimitMessage(
				"Your daily spend limit has been reached. Try again in 23h 59m",
			),
		).toBe(false);
	});
});
