import { describe, expect, it } from "vitest";
import type { ChatMessage } from "./chat-schema";
import {
	buildTaskEvidence,
	computeEvidenceChain,
	extractVerificationEvidence,
} from "./task-evidence";

function toolMessage(options: {
	command: string;
	id?: string;
	isError?: boolean;
	result?: unknown;
}): ChatMessage {
	return {
		id: options.id ?? "tool-1",
		sessionId: "session-1",
		role: "tool",
		content: JSON.stringify({
			toolName: "run_commands",
			input: { commands: [options.command] },
			result: options.result ?? { exitCode: 0, output: "passed" },
			isError: options.isError,
		}),
		createdAt: 1,
	};
}

describe("task evidence", () => {
	it("captures verification commands without treating ordinary commands as checks", () => {
		const evidence = extractVerificationEvidence([
			toolMessage({ command: "bun run test" }),
			toolMessage({ command: "git status", id: "tool-2" }),
		]);
		expect(evidence).toEqual([
			{
				command: "bun run test",
				messageId: "tool-1",
				state: "passed",
			},
		]);
	});

	it("does not claim a completed run is verified without a passing check", () => {
		const evidence = buildTaskEvidence({
			fileDiffs: [],
			messages: [],
			status: "completed",
		});
		expect(evidence.outcome.label).toBe("Completed");
		expect(evidence.outcome.tone).toBe("warning");
	});

	it("reports verified and failed outcomes from structured command results", () => {
		const passed = buildTaskEvidence({
			fileDiffs: [],
			messages: [toolMessage({ command: "npm run typecheck" })],
			status: "completed",
		});
		const failed = buildTaskEvidence({
			fileDiffs: [],
			messages: [
				toolMessage({
					command: "npm run build",
					result: { exitCode: 1, error: "compile failed" },
				}),
			],
			status: "completed",
		});
		expect(passed.outcome.label).toBe("Verified");
		expect(failed.outcome.label).toBe("Failed");
	});

	it("creates a deterministic chain that changes when an event changes", async () => {
		const original = [toolMessage({ command: "vitest run" })];
		const same = [{ ...original[0] }];
		const changed = [
			{ ...original[0], content: `${original[0].content} changed` },
		];
		const root = await computeEvidenceChain(original);
		expect(await computeEvidenceChain(same)).toBe(root);
		expect(await computeEvidenceChain(changed)).not.toBe(root);
		expect(root).toMatch(/^[a-f0-9]{64}$/);
	});
});
