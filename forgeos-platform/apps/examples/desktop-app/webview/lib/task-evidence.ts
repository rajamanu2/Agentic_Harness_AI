import type { ChatMessage, ChatSessionStatus } from "./chat-schema";
import type { SessionFileDiff } from "./session-diff";

type UnknownRecord = Record<string, unknown>;

export type VerificationState = "running" | "passed" | "failed";

export type VerificationEvidence = {
	command: string;
	messageId: string;
	state: VerificationState;
};

export type TaskOutcome = {
	description: string;
	label:
		| "Awaiting run"
		| "In progress"
		| "Verified"
		| "Completed"
		| "Cancelled"
		| "Failed";
	tone: "neutral" | "running" | "success" | "warning" | "danger";
};

export type TaskEvidence = {
	changedFiles: SessionFileDiff[];
	outcome: TaskOutcome;
	verification: VerificationEvidence[];
};

const COMMAND_TOOLS = new Set([
	"bash",
	"execute_command",
	"execute-command",
	"run_command",
	"run-command",
	"run_commands",
	"run-commands",
	"shell",
	"terminal",
]);

const VERIFICATION_COMMAND =
	/(?:^|\s|[/:_-])(?:build|check|lint|test|tests|typecheck|verify|verification|validate|validation)(?:$|\s|[/:_-])|\b(?:cargo\s+test|go\s+test|gradle\w*\s+test|mvn\w*\s+test|playwright|pytest|rspec|vitest|jest)\b/i;

function asRecord(value: unknown): UnknownRecord | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as UnknownRecord)
		: null;
}

function parseJson(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
		return value;
	}
	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return value;
	}
}

function parseToolMessage(message: ChatMessage): UnknownRecord | null {
	return asRecord(parseJson(message.content));
}

function collectCommands(value: unknown): string[] {
	const normalized = parseJson(value);
	if (typeof normalized === "string") return [normalized];
	if (Array.isArray(normalized)) {
		return normalized.flatMap((entry) => collectCommands(entry));
	}
	const record = asRecord(normalized);
	if (!record) return [];
	for (const key of ["commands", "command", "cmd", "script"]) {
		if (record[key] !== undefined) return collectCommands(record[key]);
	}
	return [];
}

function hasStructuredFailure(value: unknown, depth = 0): boolean {
	if (depth > 4) return false;
	const normalized = parseJson(value);
	if (Array.isArray(normalized)) {
		return normalized.some((entry) => hasStructuredFailure(entry, depth + 1));
	}
	const record = asRecord(normalized);
	if (!record) return false;
	if (
		record.isError === true ||
		record.success === false ||
		record.ok === false
	) {
		return true;
	}
	for (const key of ["exitCode", "exit_code", "statusCode", "status_code"]) {
		const code = record[key];
		if (typeof code === "number" && code !== 0) return true;
	}
	if (typeof record.error === "string" && record.error.trim()) return true;
	for (const key of ["result", "results", "output", "data"]) {
		if (
			record[key] !== undefined &&
			hasStructuredFailure(record[key], depth + 1)
		) {
			return true;
		}
	}
	return false;
}

export function extractVerificationEvidence(
	messages: ChatMessage[],
): VerificationEvidence[] {
	return messages.flatMap((message) => {
		if (message.role !== "tool") return [];
		const payload = parseToolMessage(message);
		const toolName = String(
			message.meta?.toolName ?? payload?.toolName ?? "",
		).toLowerCase();
		if (!COMMAND_TOOLS.has(toolName)) return [];
		const commands = collectCommands(payload?.input).filter((command) =>
			VERIFICATION_COMMAND.test(command),
		);
		if (commands.length === 0) return [];
		const isRunning =
			message.meta?.hookEventName === "tool_call_start" ||
			message.meta?.hookEventName === "history_tool_use" ||
			payload?.result == null;
		const state: VerificationState = isRunning
			? "running"
			: payload?.isError === true || hasStructuredFailure(payload?.result)
				? "failed"
				: "passed";
		return commands.map((command) => ({
			command,
			messageId: message.id,
			state,
		}));
	});
}

export function deriveTaskOutcome(
	status: ChatSessionStatus,
	verification: VerificationEvidence[],
): TaskOutcome {
	if (status === "failed" || status === "error") {
		return {
			label: "Failed",
			description: "The agent run ended with an error.",
			tone: "danger",
		};
	}
	if (status === "cancelled") {
		return {
			label: "Cancelled",
			description: "The agent run was stopped before completion.",
			tone: "warning",
		};
	}
	if (status === "starting" || status === "running" || status === "stopping") {
		return {
			label: "In progress",
			description: "ForgeOS is working and recording evidence live.",
			tone: "running",
		};
	}
	if (status === "completed") {
		const finished = verification.filter((item) => item.state !== "running");
		const failed = finished.some((item) => item.state === "failed");
		if (finished.length > 0 && !failed) {
			return {
				label: "Verified",
				description: `${finished.length} verification ${finished.length === 1 ? "check passed" : "checks passed"}.`,
				tone: "success",
			};
		}
		return failed
			? {
					label: "Failed",
					description: "One or more verification checks failed.",
					tone: "danger",
				}
			: {
					label: "Completed",
					description:
						"The run completed without a captured verification check.",
					tone: "warning",
				};
	}
	return {
		label: "Awaiting run",
		description: "Send a task to begin collecting evidence.",
		tone: "neutral",
	};
}

export function buildTaskEvidence(options: {
	fileDiffs: SessionFileDiff[];
	messages: ChatMessage[];
	status: ChatSessionStatus;
}): TaskEvidence {
	const verification = extractVerificationEvidence(options.messages);
	return {
		changedFiles: options.fileDiffs,
		outcome: deriveTaskOutcome(options.status, verification),
		verification,
	};
}

function stableSerialize(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "undefined";
	}
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
	}
	const record = value as UnknownRecord;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
		.join(",")}}`;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function sha256(value: string): Promise<Uint8Array> {
	if (!globalThis.crypto?.subtle) {
		throw new Error("SHA-256 is unavailable in this runtime.");
	}
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return new Uint8Array(digest);
}

/**
 * Builds a deterministic SHA-256 chain over the visible, persisted session
 * events. Replaying the same ordered transcript produces the same root.
 */
export async function computeEvidenceChain(
	messages: ChatMessage[],
): Promise<string> {
	let previous = await sha256("forgeos-task-evidence-v1");
	for (const message of messages) {
		const event = stableSerialize({
			content: message.content,
			createdAt: message.createdAt,
			id: message.id,
			images: message.images,
			media: message.media,
			meta: message.meta,
			reasoning: message.reasoning,
			role: message.role,
			sessionId: message.sessionId,
		});
		previous = await sha256(`${bytesToHex(previous)}\n${event}`);
	}
	return bytesToHex(previous);
}
