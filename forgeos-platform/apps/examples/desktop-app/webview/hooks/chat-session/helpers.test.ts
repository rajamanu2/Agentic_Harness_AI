import { describe, expect, it } from "vitest";
import type { ChatSessionConfig } from "@/lib/chat-schema";
import { DEFAULT_CHAT_CONFIG } from "./constants";
import { resolveCredentialError } from "./helpers";

function config(overrides: Partial<ChatSessionConfig>): ChatSessionConfig {
	return { ...DEFAULT_CHAT_CONFIG, ...overrides };
}

describe("resolveCredentialError", () => {
	it("allows local Ollama without an API key", () => {
		expect(
			resolveCredentialError(
				config({ provider: "ollama", model: "qwen2.5-coder:7b", apiKey: "" }),
			),
		).toBeNull();
	});

	it("still requires credentials for hosted providers", () => {
		expect(resolveCredentialError(config({ provider: "gemini", apiKey: "" }))).toContain(
			'Missing API key for provider "gemini"',
		);
	});
});
