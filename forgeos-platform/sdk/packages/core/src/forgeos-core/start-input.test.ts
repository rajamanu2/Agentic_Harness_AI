import { describe, expect, it } from "vitest";
import { normalizeForgeOSCoreStartInput } from "./start-input";
import type { ForgeOSCoreStartInput } from "./types";

function createInput(
	overrides: Partial<ForgeOSCoreStartInput> = {},
): ForgeOSCoreStartInput {
	return {
		config: {
			providerId: "anthropic",
			modelId: "claude-sonnet-4-6",
			cwd: "/workspace",
			systemPrompt: "",
			enableTools: true,
			enableSpawnAgent: true,
			enableAgentTeams: true,
			extensionContext: {
				client: {
					name: "VSCode Extension",
					version: "3.99.0",
				},
			},
		},
		...overrides,
	};
}

describe("normalizeForgeOSCoreStartInput", () => {
	it("captures the client surface, version, and default user mode", () => {
		const normalized = normalizeForgeOSCoreStartInput(createInput());

		expect(normalized.source).toBe("vscode");
		expect(normalized.sessionMetadata).toMatchObject({
			sessionHistoryOrigin: {
				mode: "user",
				version: "3.99.0",
			},
		});
	});

	it("keeps an explicit session mode separate from the client", () => {
		const normalized = normalizeForgeOSCoreStartInput(
			createInput({ mode: "automation" }),
		);

		expect(normalized.source).toBe("vscode");
		expect(normalized.sessionMetadata).toMatchObject({
			sessionHistoryOrigin: {
				mode: "automation",
				version: "3.99.0",
			},
		});
	});
});
