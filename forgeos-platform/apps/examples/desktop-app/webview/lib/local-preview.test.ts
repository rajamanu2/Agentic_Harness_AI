import { describe, expect, it } from "vitest";
import type { ChatMessage } from "./chat-schema";
import { findLatestLocalPreviewUrl, normalizeLocalPreviewUrl } from "./local-preview";

describe("local preview URL detection", () => {
	it("accepts loopback web servers and rejects remote sites", () => {
		expect(normalizeLocalPreviewUrl("http://localhost:5173/app")).toBe(
			"http://localhost:5173/app",
		);
		expect(normalizeLocalPreviewUrl("https://example.com")).toBeNull();
	});

	it("uses the latest preview URL emitted by the agent", () => {
		const messages = [
			{ content: "Started http://localhost:3000", createdAt: 1 },
			{ content: "Preview: http://127.0.0.1:4173/.", createdAt: 2 },
		] as ChatMessage[];
		expect(findLatestLocalPreviewUrl(messages)).toBe("http://127.0.0.1:4173/");
	});
});
