import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type AgentPlugin, createTool } from "@forgeos/core";

type Json = Record<string, unknown> | unknown[];

const agenticaUrl = (process.env.FORGEOS_ENGINE_URL || process.env.AGENTICA_BASE_URL || "http://127.0.0.1:8797").replace(/\/$/, "");
const commandCenterUrl = (process.env.COMMAND_CENTER_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
let workspaceRoot = process.cwd();
let runId = "not-started";
let sequence = 0;
let previousHash: string | null = null;
let ledgerPath = "";

function stable(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

function hash(value: unknown): string {
	return createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

async function record(type: string, payload: Record<string, unknown>): Promise<void> {
	if (!ledgerPath) return;
	const unsigned = { sequence: ++sequence, timestamp: new Date().toISOString(), runId, type, payload, previousHash };
	const event = { ...unsigned, hash: hash(unsigned) };
	await appendFile(ledgerPath, `${JSON.stringify(event)}\n`, "utf8");
	previousHash = event.hash;
}

async function request(base: string, path: string, init?: RequestInit): Promise<Json> {
	const response = await fetch(`${base}${path}`, {
		...init,
		headers: { "content-type": "application/json", accept: "application/json", ...(init?.headers || {}) },
		signal: AbortSignal.timeout(Number(process.env.AGENTICA_TOOL_TIMEOUT_MS || 60_000)),
	});
	const text = await response.text();
	let body: unknown;
	try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
	if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
	return body as Json;
}

function postTool(name: string, description: string, base: string, path: string, properties: Record<string, unknown>, required: string[]) {
	return createTool({
		name,
		description,
		inputSchema: { type: "object", properties, required },
		execute: async (input: unknown) => request(base, path, { method: "POST", body: JSON.stringify(input) }),
	});
}

const plugin: AgentPlugin = {
	name: "forgeos-core-bridge",
	manifest: { capabilities: ["tools", "hooks"] },
	setup(api, context) {
		workspaceRoot = context.workspaceInfo?.rootPath || process.cwd();
		api.registerTool(createTool({ name: "forgeos_status", description: "Check the ForgeOS engine, model, MCP, learning, and generated-app runtime status.", inputSchema: { type: "object", properties: {} }, execute: async () => ({ health: await request(agenticaUrl, "/api/health"), models: await request(agenticaUrl, "/api/model-status"), mcp: await request(agenticaUrl, "/api/mcp/status") }) }));
		api.registerTool(createTool({ name: "forgeos_adapters", description: "List built-in and workspace-extensible technology adapters.", inputSchema: { type: "object", properties: {} }, execute: async () => request(agenticaUrl, "/api/adapters") }));
		api.registerTool(createTool({ name: "forgeos_connections", description: "Discover model providers, authenticated Salesforce orgs, AWS identity, Kubernetes contexts, n8n readiness, and Git without returning secrets.", inputSchema: { type: "object", properties: {} }, execute: async () => request(agenticaUrl, "/api/connections") }));
		api.registerTool(postTool("forgeos_scan", "Detect any repository technology stack from live files and manifests and return build, test, run, and verification commands.", agenticaUrl, "/api/scan", { repoPath: { type: "string", description: "Absolute or workspace-relative repository path" } }, ["repoPath"]));
		api.registerTool(postTool("forgeos_scan_website", "Inspect a public website in realtime and identify technologies from live HTML evidence.", agenticaUrl, "/api/scan-website", { url: { type: "string", description: "Public HTTP or HTTPS website URL" } }, ["url"]));
		api.registerTool(postTool("agentica_neural_plan", "Use Agentica's intent, context, learning, teacher-routing, quality, and delivery agents to create a unified plan.", agenticaUrl, "/api/agentica", { message: { type: "string" }, repoPath: { type: "string" }, executionMode: { type: "string", enum: ["PLAN_ONLY", "SUPERVISED", "AUTONOMOUS_LAB"] } }, ["message", "repoPath"]));
		api.registerTool(postTool("agentica_teacher_ensemble", "Ask the configured teacher-model ensemble and return answers plus a distilled lesson.", agenticaUrl, "/api/teacher-ensemble", { message: { type: "string" }, repoPath: { type: "string" } }, ["message"]));
		api.registerTool(postTool("agentica_learn", "Distill and persist a reusable lesson from configured teacher models.", agenticaUrl, "/api/learning/teach", { message: { type: "string" }, repoPath: { type: "string" } }, ["message"]));
		api.registerTool(createTool({ name: "agentica_learning_memory", description: "Read Agentica's durable learned lessons and learning metadata.", inputSchema: { type: "object", properties: {} }, execute: async () => request(agenticaUrl, "/api/learning") }));
		api.registerTool(createTool({ name: "salesforce_org_status", description: "Read the configured Salesforce org connection and authentication status without changing the org.", inputSchema: { type: "object", properties: {} }, execute: async () => request(commandCenterUrl, "/api/org/status") }));
		api.registerTool(postTool("salesforce_org_scan", "Run a read-oriented Salesforce metadata and org scan through the command-center backend.", commandCenterUrl, "/api/org/scan/run", { targetOrg: { type: "string" }, scope: { type: "string" } }, ["targetOrg"]));
		api.registerTool(postTool("salesforce_validate", "Run a Salesforce validation-only deployment. This tool must not perform a production deployment.", commandCenterUrl, "/api/deployment/validate", { targetOrg: { type: "string" }, sourceDir: { type: "string" }, testLevel: { type: "string" }, tests: { type: "array", items: { type: "string" } } }, ["targetOrg", "sourceDir"]));
		api.registerTool(postTool("delivery_plan", "Create a Jira, Git, validation, Harness, and approval-aware delivery workflow.", commandCenterUrl, "/api/delivery/run", { title: { type: "string" }, targetOrg: { type: "string" }, description: { type: "string" } }, ["title", "targetOrg"]));
	},
	hooks: {
		async beforeRun() {
			runId = `forge-${Date.now()}-${randomUUID().slice(0, 8)}`;
			sequence = 0; previousHash = null;
			const directory = join(workspaceRoot, ".forgeos", "evidence", runId);
			await mkdir(directory, { recursive: true });
			ledgerPath = join(directory, "events.jsonl");
			await record("run.started", { workspaceRoot, agenticaUrl, commandCenterUrl });
		},
		async beforeTool({ toolCall, input }) {
			await record("tool.requested", { toolName: toolCall.toolName, inputHash: hash(input) });
			if (toolCall.toolName === "run_commands") {
				const commands = (input as { commands?: string[] })?.commands || [];
				const prohibited = commands.find((command) => /\bsf\s+project\s+deploy\s+start\b/i.test(command) && !/--dry-run\b/i.test(command));
				if (prohibited) return { stop: true, reason: "ForgeOS policy blocked a non-validation Salesforce deployment command. Use salesforce_validate or obtain an explicit release approval." };
			}
			return undefined;
		},
		async afterTool({ toolCall, result }) {
			await record("tool.completed", { toolName: toolCall.toolName, resultHash: hash(result), isError: result.isError === true });
		},
		async afterRun({ result }) {
			await record("run.completed", { status: result.status, iterations: result.iterations, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, totalCost: result.usage.totalCost, evidenceHead: previousHash });
		},
	},
};

export { plugin };
export default plugin;
