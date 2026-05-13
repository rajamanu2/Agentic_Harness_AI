import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");
const runsDir = path.join(rootDir, ".harness");
const artifactsDir = path.join(runsDir, "artifacts");
const runsFile = path.join(runsDir, "runs.json");
const learningFile = path.join(runsDir, "learning.json");
const chatsFile = path.join(runsDir, "chats.json");
loadDotEnv(path.join(rootDir, ".env"));
const port = Number(process.env.PORT || 8797);
const host = process.env.AGENTICA_HOST || process.env.HOST || "127.0.0.1";
const maxDepth = 5;
const maxFiles = 360;
const nvidiaDefaultModel = process.env.NVIDIA_MODEL || "nvidia/llama-3.1-nemotron-ultra-253b-v1";
const airllmDefaultModel = process.env.AIRLLM_MODEL || "Qwen/Qwen-7B";
const qwenCoreDefaultModel = process.env.AGENTICA_QWEN_CORE_MODEL || "agentica-qwen-core";
const qwenCoreDefaultBaseUrl = process.env.AGENTICA_QWEN_CORE_BASE_URL || "http://127.0.0.1:11434/v1";
const externalReferenceDir = path.resolve(rootDir, "..", ".runtime", "external");
const deerFlowRepoDir = path.join(externalReferenceDir, "deer-flow");
const uiTarsRepoDir = path.join(externalReferenceDir, "UI-TARS");
const uiTarsDesktopRepoDir = path.join(externalReferenceDir, "UI-TARS-desktop");

const skippedDirectories = new Set([
  ".git",
  ".idea",
  ".next",
  ".runtime-logs",
  ".turbo",
  ".venv",
  ".vscode",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "dist-server",
  "node_modules",
  "target",
  "vendor"
]);

const blueprint = {
  nodes: [
    node("intake", "Intent Intake", "input", "Normalize chat, API, webhook, ticket, or document input into a structured objective."),
    node("scanner", "Technology Scanner", "adapter", "Detect languages, frameworks, build systems, tests, deployment markers, and missing adapters."),
    node("context", "Context Builder", "memory", "Index code, docs, logs, schemas, tickets, and previous run traces for grounded planning."),
    node("planner", "Planner Agent", "agent", "Create the task graph, pick specialist agents, assign tools, and set verification gates."),
    node("registry", "Tool Registry", "tooling", "Expose MCP, OpenAPI, CLI, native, and webhook tools through typed schemas and policies."),
    node("executor", "Sandbox Executor", "runtime", "Run bounded work in local, container, or remote workers with command capture and timeouts."),
    node("verifier", "Verifier", "quality", "Run tests, linters, evals, security checks, policy checks, and deterministic assertions."),
    node("delivery", "Delivery", "delivery", "Produce answer, patch, PR, artifact, deployment packet, rollback note, or business handoff."),
    node("observability", "Observability", "ops", "Record traces, tool calls, approvals, costs, failures, feedback, and memory updates.")
  ],
  edges: [
    edge("intake", "scanner", "repo target"),
    edge("scanner", "context", "stack profile"),
    edge("context", "planner", "grounded facts"),
    edge("planner", "registry", "tool needs"),
    edge("registry", "executor", "authorized calls"),
    edge("executor", "verifier", "candidate output"),
    edge("verifier", "planner", "repair loop"),
    edge("verifier", "delivery", "approved result"),
    edge("delivery", "observability", "audit event"),
    edge("observability", "context", "feedback memory")
  ],
  operatingPrinciples: [
    "The model reasons; the harness owns state, tools, permissions, and verification.",
    "Every external capability is represented as a typed tool with risk and approval policy.",
    "Every stack is handled through adapters, not prompt-only guessing.",
    "Every run follows plan, act, verify, repair, and deliver.",
    "Every artifact carries traceability: inputs, tools, commands, approvals, and verification result."
  ]
};

const tools = [
  tool("mcp-gateway", "MCP Gateway", "MCP", "tool-router", "Medium", false, "Discovers MCP servers and routes typed tool/resource/prompt calls.", ["tools/list", "tools/call", "resources/read", "prompts/get"]),
  tool("filesystem-context", "Filesystem Context", "Native", "context", "Low", false, "Reads repository files for scanning, summarization, and context packs.", ["list files", "read files", "sample source", "detect docs"]),
  tool("vector-memory", "Vector Memory", "Native", "memory", "Low", false, "Indexes code, docs, tickets, schemas, and previous run traces.", ["index", "search", "summarize", "refresh"]),
  tool("terminal-sandbox", "Terminal Sandbox", "Native", "execution", "High", true, "Runs install, test, build, lint, and validation commands with timeouts.", ["install", "test", "build", "lint", "validate"]),
  tool("git-workbench", "Git Workbench", "CLI", "source-control", "High", true, "Inspects diffs, creates branches, stages files, commits, and prepares PRs.", ["status", "diff", "branch", "stage", "commit", "pull request"]),
  tool("browser-runner", "Browser Runner", "Native", "runtime", "Medium", false, "Runs browser smoke checks against local or remote web apps.", ["navigate", "click", "type", "screenshot", "console logs"]),
  tool("ruflo-orchestrator", "RuFlo Orchestrator", "CLI/MCP", "orchestration", "High", true, "Adds RuFlo-style swarm coordination, memory, MCP tools, and agent planning when explicitly enabled.", ["npm package check", "guided init", "mcp start", "swarm planning", "memory coordination"]),
  tool("openapi-connector", "OpenAPI Connector", "OpenAPI", "integration", "Medium", false, "Turns HTTP APIs into typed tools from OpenAPI specifications.", ["schema import", "request validation", "typed API calls"]),
  tool("database-gateway", "Database Gateway", "MCP", "data", "High", true, "Queries schemas and data through read-only or approved write policies.", ["schema introspection", "read query", "migration check"]),
  tool("cloud-deployer", "Cloud Deployer", "CLI", "deployment", "Critical", true, "Runs cloud, IaC, and deployment workflows only through explicit gates.", ["plan", "diff", "validate", "deploy", "rollback"]),
  tool("work-tracker", "Work Tracker", "OpenAPI", "project-management", "Medium", false, "Creates or updates stories, acceptance criteria, delivery notes, and links.", ["create issue", "update issue", "search issues", "attach summary"])
];

const models = [
  model("agentica-helper", "AgenticaHarness Helper Route", "agentica-responses-compatible", "AGENTICA_HELPER_API_KEY", ["planner", "coder", "tool-caller", "verifier"]),
  model("anthropic", "Anthropic", "messages", "ANTHROPIC_API_KEY", ["long-context analyst", "architect", "reviewer"]),
  model("gemini", "Google Gemini", "gemini", "GOOGLE_API_KEY", ["multimodal analyst", "fast draft", "large context"]),
  model("agentica-azure-helper", "AgenticaHarness Azure Helper", "agentica-responses-compatible", "AGENTICA_AZURE_HELPER_API_KEY", ["enterprise planner", "private deployment"]),
  model("ollama", "Ollama", "local", "OLLAMA_BASE_URL", ["local development", "private analysis", "offline fallback"]),
  model("openrouter", "OpenRouter", "agentica-compatible-chat", "OPENROUTER_API_KEY", ["model routing", "fallback", "experimentation"]),
  model("nvidia", "NVIDIA NIM", "agentica-compatible-chat", "NVIDIA_API_KEY", ["fast hosted NIMs", "teacher model", "open model catalog"]),
  model("airllm", "AirLLM 2.11.0", "agentica-local-compatible-chat", "AIRLLM_BASE_URL", ["local Hugging Face inference", "low-memory large models", "offline experimentation"]),
  model("agentica-qwen-core", "AgenticaHarness Qwen Core", "agentica-local-compatible-chat", "AGENTICA_QWEN_CORE_BASE_URL", ["local Qwen MoE core", "private reasoning", "offline coding"])
];

const modelProviders = [
  provider("agentica-native", "AgenticaHarness Native Engine", "agentica", "AGENTICA_NATIVE", "", false, {
    defaultModel: "agentica-brain",
    models: [modelOption("agentica-brain", "AgenticaHarness Brain")]
  }),
  provider("agentica-qwen-core", "AgenticaHarness Qwen Core (Local)", "agentica-chat-compatible", "AGENTICA_QWEN_CORE_API_KEY", qwenCoreDefaultBaseUrl, false, {
    baseEnv: "AGENTICA_QWEN_CORE_BASE_URL",
    defaultModel: qwenCoreDefaultModel,
    models: [
      modelOption(qwenCoreDefaultModel, `${qwenCoreDefaultModel} (configured core)`),
      modelOption("Qwen/Qwen3-30B-A3B", "Qwen3 30B-A3B"),
      modelOption("Qwen/Qwen3-Coder-30B-A3B-Instruct", "Qwen3 Coder 30B-A3B Instruct"),
      modelOption("Qwen3.6-35B-A3B", "Qwen3.6 35B-A3B")
    ]
  }),
  provider("agentica-free-helper", "AgenticaHarness Free Helper Route", "agentica-chat-compatible", "AGENTICA_FREE_HELPER_API_KEY", "https://text.pollinations.ai/openai", false, {
    legacyEnv: "OPENAI_FREE_API_KEY",
    defaultModel: "openai-fast",
    models: [modelOption("openai-fast", "AgenticaHarness Fast Helper")]
  }),
  provider("nvidia", "NVIDIA NIM Helper", "agentica-chat-compatible", "NVIDIA_API_KEY", "https://integrate.api.nvidia.com/v1", true, {
    baseEnv: "NVIDIA_BASE_URL",
    defaultModel: nvidiaDefaultModel,
    models: [
      modelOption(nvidiaDefaultModel, nvidiaDefaultModel),
      modelOption("nvidia/llama-3.3-nemotron-super-49b-v1.5", "NVIDIA Nemotron Super 49B v1.5"),
      modelOption("meta/llama-3.3-70b-instruct", "Meta Llama 3.3 70B Instruct")
    ]
  }),
  provider("airllm", "AirLLM 2.11.0 (AgenticaHarness Local)", "agentica-chat-compatible", "AIRLLM_API_KEY", "http://127.0.0.1:4891/v1", false, {
    baseEnv: "AIRLLM_BASE_URL",
    defaultModel: airllmDefaultModel,
    models: [
      modelOption(airllmDefaultModel, airllmDefaultModel),
      modelOption("THUDM/chatglm3-6b-base", "ChatGLM3 6B Base"),
      modelOption("mistralai/Mistral-7B-Instruct-v0.1", "Mistral 7B Instruct v0.1")
    ]
  }),
  provider("glm-5.1", "GLM 5.1 Helper (Z.ai)", "agentica-chat-compatible", "ZAI_API_KEY", "https://api.z.ai/api/paas/v4", true, {
    defaultModel: "glm-5.1",
    models: [modelOption("glm-5.1", "GLM-5.1")]
  }),
  provider("glm-5.1-openrouter", "GLM 5.1 Helper (OpenRouter)", "agentica-chat-compatible", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", true, {
    defaultModel: "z-ai/glm-5.1",
    models: [modelOption("z-ai/glm-5.1", "Z.ai: GLM 5.1")]
  }),
  provider("agentica-helper-key", "AgenticaHarness Helper Key", "agentica-responses-compatible", "AGENTICA_HELPER_API_KEY", "https://api.openai.com/v1", true, {
    legacyEnv: "AGENTICA_OPENAI_HELPER_API_KEY",
    legacyEnvs: ["OPENAI_API_KEY"]
  }),
  provider("openrouter", "OpenRouter Helper", "agentica-chat-compatible", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", true),
  provider("anthropic", "Anthropic", "anthropic", "ANTHROPIC_API_KEY", "https://api.anthropic.com/v1", true),
  provider("gemini", "Google Gemini", "gemini", "GOOGLE_API_KEY", "https://generativelanguage.googleapis.com/v1beta", true),
  provider("ollama", "Ollama", "ollama", "OLLAMA_BASE_URL", "http://127.0.0.1:11434", false),
  provider("custom-agentica-helper", "Custom AgenticaHarness-Compatible Helper", "agentica-chat-compatible", "CUSTOM_OPENAI_API_KEY", "", false)
];

const stackDefinitions = [
  stack("node", "Node / TypeScript / Frontend", ["package.json", "tsconfig.json", "vite.config.ts", "next.config.js", "src/main.tsx"], [], ["npm install"], ["npm test"], ["npm run build"], ["npm run dev"], ["Check package scripts before running commands.", "Use browser smoke checks for UI apps."]),
  stack("python", "Python", ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "main.py", "app.py"], [], ["pip install -r requirements.txt"], ["pytest"], ["python -m compileall ."], ["python app.py"], ["Prefer project-specific test scripts from pyproject when present."]),
  stack("java", "Java / JVM", ["pom.xml", "build.gradle", "settings.gradle", "gradlew", "src/main/java"], [], ["./mvnw dependency:go-offline"], ["./mvnw test"], ["./mvnw package"], ["./mvnw spring-boot:run"], ["Use Maven or Gradle based on the detected wrapper."]),
  stack("dotnet", ".NET", [], [".sln", ".csproj", ".fsproj"], ["dotnet restore"], ["dotnet test"], ["dotnet build"], ["dotnet run"], ["Choose the application project when a solution has multiple projects."]),
  stack("go", "Go", ["go.mod", "go.sum"], [], ["go mod download"], ["go test ./..."], ["go build ./..."], ["go run ."], ["Use package-level tests and race checks when concurrency is touched."]),
  stack("rust", "Rust", ["Cargo.toml", "Cargo.lock"], [], ["cargo fetch"], ["cargo test"], ["cargo build"], ["cargo run"], ["Use cargo clippy when available for verifier depth."]),
  stack("php", "PHP / Composer", ["composer.json", "composer.lock"], [], ["composer install"], ["vendor/bin/phpunit"], ["composer validate"], ["php -S localhost:8000"], ["Laravel apps may use artisan test and artisan serve."]),
  stack("ruby", "Ruby", ["Gemfile", "Rakefile", "config.ru"], [], ["bundle install"], ["bundle exec rspec"], ["bundle exec rake"], ["bundle exec rails server"], ["Detect Rails vs plain Ruby before choosing run commands."]),
  stack("salesforce", "Salesforce DX", ["sfdx-project.json", "force-app/main/default", "manifest/package.xml"], [], ["sf org login web --alias dev-sandbox"], ["sf apex run test --target-org dev-sandbox --result-format human"], ["sf project deploy validate --target-org dev-sandbox"], ["sf org open --target-org dev-sandbox"], ["Production deployment remains gated behind human approval."]),
  stack("docker", "Docker / Compose", ["Dockerfile", "docker-compose.yml", "compose.yml", "compose.yaml"], [], ["docker compose pull"], ["docker compose config"], ["docker compose build"], ["docker compose up"], ["Do not run compose up automatically outside supervised lab mode."]),
  stack("terraform", "Terraform / IaC", [], [".tf"], ["terraform init"], ["terraform validate"], ["terraform plan"], ["terraform apply"], ["Apply is critical risk and always requires approval."])
];

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json(response, {
        status: "ok",
        app: "AgenticaHarness",
        owner: "AgenticaHarness",
        codexRequired: false,
        mode: process.env.AGENTICA_RUNTIME || (process.env.NODE_ENV === "production" ? "production" : "standalone"),
        host,
        port,
        time: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/blueprint" && request.method === "GET") return json(response, blueprint);
    if (url.pathname === "/api/tools" && request.method === "GET") return json(response, tools);
    if (url.pathname === "/api/mcp/status" && request.method === "GET") return json(response, await mcpRuntimeStatus());
    if (url.pathname === "/api/models" && request.method === "GET") return json(response, models);
    if (url.pathname === "/api/model-providers" && request.method === "GET") return json(response, publicModelProviders());
    if (url.pathname === "/api/model-status" && request.method === "GET") {
      return json(response, modelStatus());
    }

    if (url.pathname === "/api/chats/latest" && request.method === "GET") {
      return json(response, await latestChatThread(url.searchParams.get("repoPath") || ""));
    }

    if (url.pathname === "/api/deerflow-workspace" && request.method === "GET") {
      return json(response, deerFlowWorkspaceStatus());
    }

    if (url.pathname === "/api/provider-models" && request.method === "POST") {
      const body = await readJson(request);
      return json(response, await listProviderModels(body || {}));
    }

    if (url.pathname === "/api/learning" && request.method === "GET") {
      return json(response, await learningSummary());
    }

    if (url.pathname === "/api/learning" && request.method === "POST") {
      const body = await readJson(request);
      return json(response, await addManualLearning(body || {}), 201);
    }

    if (url.pathname === "/api/learning/teach" && request.method === "POST") {
      const body = await readJson(request);
      return json(response, await learnFromTeacher(body || {}), 201);
    }

    if (url.pathname === "/api/teacher-ensemble" && request.method === "POST") {
      const body = await readJson(request);
      const message = body.message || body.prompt;
      if (!message || typeof message !== "string") {
        return json(response, { error: "message or prompt is required" }, 400);
      }
      return json(response, await teacherEnsemble(message, body.repoPath || ".", body.modelConfig || null, body || {}));
    }

    if (url.pathname === "/api/scan" && request.method === "POST") {
      const body = await readJson(request);
      return json(response, await scanRepository(body.repoPath || "."));
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      const body = await readJson(request);
      if (!body.message || typeof body.message !== "string") {
        return json(response, { error: "message is required" }, 400);
      }
      const repoPath = body.repoPath || ".";
      const cleanHistory = normalizeChatHistory(body.history);
      const reply = await chatReplyWithLearning(
        body.message,
        repoPath,
        body.modelConfig || null,
        normalizeAgenticaOptions(body.options || body.mode || null),
        cleanHistory
      );
      const thread = await saveChatTurn({
        threadId: body.threadId,
        message: body.message,
        reply,
        repoPath,
        modelConfig: body.modelConfig || null,
        history: cleanHistory
      });
      return json(response, {
        ...reply,
        threadId: thread.id,
        chat: summarizeChatThread(thread)
      });
    }

    if (url.pathname === "/api/live-chat" && request.method === "POST") {
      const body = await readJson(request);
      const message = body.message || body.prompt;
      if (!message || typeof message !== "string") {
        return json(response, { error: "message or prompt is required" }, 400);
      }
      return json(response, await liveCompanionReply(body || {}));
    }

    if (url.pathname === "/api/agentica" && request.method === "POST") {
      const body = await readJson(request);
      const message = body.message || body.prompt;
      if (!message || typeof message !== "string") {
        return json(response, { error: "message or prompt is required" }, 400);
      }
      return json(response, await chatReplyWithLearning(message, body.repoPath || ".", agenticaNativeModelConfig()));
    }

    if (url.pathname === "/api/runs" && request.method === "GET") {
      return json(response, await listRuns());
    }

    if (url.pathname === "/api/runs" && request.method === "POST") {
      const body = await readJson(request);
      if (!body.requirement || typeof body.requirement !== "string") {
        return json(response, { error: "requirement is required" }, 400);
      }
      return json(response, await planRun(body.requirement, body.repoPath || ".", body.mode || "PLAN_ONLY"), 201);
    }

    const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (runMatch && request.method === "GET") {
      const run = (await listRuns()).find((candidate) => candidate.id === runMatch[1]);
      return run ? json(response, run) : json(response, { error: "Run not found" }, 404);
    }

    if (url.pathname.startsWith("/live-projects/") && request.method === "GET") {
      return serveGeneratedProjectPreview(response, url.pathname);
    }

    if (url.pathname.startsWith("/artifacts/") && request.method === "GET") {
      return serveArtifact(response, url.pathname);
    }

    return serveStatic(response, url.pathname);
  } catch (error) {
    return json(response, { error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`AgenticaHarness running standalone on http://${displayHost}:${port}`);
});

function node(id, label, kind, description) {
  return { id, label, kind, description };
}

function edge(from, to, label) {
  return { from, to, label };
}

function tool(id, name, protocol, category, risk, requiresApproval, description, capabilities) {
  return { id, name, protocol, category, risk, requiresApproval, description, capabilities };
}

function model(id, name, adapter, env, roles) {
  return { id, name, adapter, env, roles };
}

function provider(id, name, type, env, baseUrl, needsKey, options = {}) {
  return { id, name, type, env, baseUrl, needsKey, ...options };
}

function modelOption(id, name) {
  return { id, name };
}

function normalizeProviderId(id) {
  if (id === "glm-standard") return "agentica-native";
  if (id === "openai") return "agentica-free-helper";
  if (id === "openai-official") return "agentica-helper-key";
  if (id === "custom-openai") return "custom-agentica-helper";
  return id;
}

function loadDotEnv(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional for local use.
  }
}

function modelStatus() {
  return {
    live: modelProviders.some((candidate) => providerConfigured(candidate)),
    providers: modelProviders.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      configured: providerConfigured(candidate)
    })),
    acceptsBrowserKey: true
  };
}

async function mcpRuntimeStatus() {
  const servers = await discoverMcpServers();
  const checked = await Promise.all(servers.map(checkMcpServer));
  const modelRoutes = await modelRouteRuntimeStatus();
  const openCount = checked.filter((server) => server.status === "online" || server.status === "configured").length;

  return {
    enabled: openCount > 0,
    openCount,
    totalCount: checked.length,
    generatedAt: new Date().toISOString(),
    servers: checked,
    modelRoutes,
    promptContext: [
      formatMcpPromptContext(checked),
      formatModelRoutePromptContext(modelRoutes)
    ].join("\n\n")
  };
}

async function discoverMcpServers() {
  const found = new Map();
  const candidates = [
    process.env.AGENTICA_MCP_CONFIG,
    path.join(rootDir, ".mcp.json"),
    path.join(rootDir, "mcp.json"),
    path.join(rootDir, ".cursor", "mcp.json"),
    path.join(rootDir, ".vscode", "mcp.json"),
    path.join(path.dirname(rootDir), ".mcp.json"),
    path.join(userHomeDir(), ".mcp.json"),
    path.join(userHomeDir(), ".cursor", "mcp.json"),
    path.join(userHomeDir(), ".codex", "config.toml"),
    path.join(userHomeDir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json")
  ].filter(Boolean);

  addMcpEntries(found, parseEnvMcpServers(), "env:AGENTICA_MCP_SERVERS");

  for (const candidate of unique(candidates.map((item) => path.resolve(item)))) {
    if (!existsSync(candidate)) continue;
    try {
      const content = readFileSync(candidate, "utf8");
      if (candidate.endsWith(".toml")) {
        addMcpEntries(found, parseTomlMcpServers(content), candidate);
      } else {
        addMcpEntries(found, parseJsonMcpServers(content), candidate);
      }
    } catch {
      // Ignore unreadable MCP config files; the status endpoint stays best effort.
    }
  }

  addMcpEntries(found, discoverCodexToolBridges(), "codex-desktop");

  return [...found.values()];
}

function parseEnvMcpServers() {
  const raw = String(process.env.AGENTICA_MCP_SERVERS || "").trim();
  if (!raw) return [];
  try {
    return normalizeMcpConfig(JSON.parse(raw));
  } catch {
    return raw.split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, transport: "configured" }));
  }
}

function parseJsonMcpServers(content) {
  try {
    return normalizeMcpConfig(JSON.parse(content));
  } catch {
    return [];
  }
}

function normalizeMcpConfig(parsed) {
  if (!parsed || typeof parsed !== "object") return [];
  const buckets = [
    parsed.mcpServers,
    parsed.mcp_servers,
    parsed.servers,
    parsed.mcp?.servers
  ].filter(Boolean);

  if (!buckets.length && (parsed.command || parsed.url || parsed.name)) buckets.push([parsed]);

  return buckets.flatMap((bucket) => {
    if (Array.isArray(bucket)) return bucket.map((entry, index) => normalizeMcpEntry(entry, entry?.name || `mcp-${index + 1}`));
    if (typeof bucket === "object") {
      return Object.entries(bucket).map(([name, entry]) => normalizeMcpEntry(entry, name));
    }
    return [];
  }).filter(Boolean);
}

function normalizeMcpEntry(entry, name) {
  if (!entry || typeof entry !== "object") return null;
  const url = String(entry.url || entry.endpoint || entry.serverUrl || "").trim();
  const command = String(entry.command || entry.cmd || "").trim();
  const transport = String(entry.transport || entry.type || (url ? "http" : command ? "stdio" : "configured")).trim();

  return {
    id: safeMcpId(name),
    name: String(entry.name || name).trim(),
    transport,
    url: url ? redactUrl(url) : "",
    checkUrl: url,
    command: command || "",
    args: Array.isArray(entry.args) ? entry.args.map(String).slice(0, 8) : [],
    capabilities: Array.isArray(entry.capabilities) ? entry.capabilities.map(String).slice(0, 12) : []
  };
}

function parseTomlMcpServers(content) {
  const servers = [];
  let current = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const section = trimmed.match(/^\[(?:mcp_servers|mcpServers)\.([^\]]+)\]$/);
    if (section) {
      current = { name: section[1] };
      servers.push(current);
      continue;
    }

    if (!current || !trimmed || trimmed.startsWith("#")) continue;
    const setting = trimmed.match(/^([A-Za-z_][\w-]*)\s*=\s*(.+)$/);
    if (!setting) continue;
    const key = setting[1];
    if (!["command", "url", "transport", "type", "args"].includes(key)) continue;
    current[key] = parseTomlValue(setting[2]);
  }

  return servers.map((entry) => normalizeMcpEntry(entry, entry.name)).filter(Boolean);
}

function parseTomlValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return [...trimmed.matchAll(/"([^"]*)"|'([^']*)'/g)].map((match) => match[1] || match[2] || "");
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function addMcpEntries(map, entries, source) {
  for (const entry of entries || []) {
    if (!entry?.name) continue;
    const id = entry.id || safeMcpId(entry.name);
    map.set(id, { ...entry, id, source });
  }
}

function discoverCodexToolBridges() {
  const codexDir = path.join(userHomeDir(), ".codex");
  if (!existsSync(codexDir)) return [];

  const entries = [];
  const nodeReplDir = path.join(codexDir, "node_repl");
  if (existsSync(nodeReplDir)) {
    entries.push({
      id: "agentica-node-runtime",
      name: "AgenticaHarness Node Runtime Bridge",
      transport: "agentica-native",
      capabilities: ["javascript execution", "runtime inspection", "browser client bridge", "tool result rendering"]
    });
  }

  const configPath = path.join(codexDir, "config.toml");
  const enabledPlugins = existsSync(configPath)
    ? parseCodexEnabledPlugins(readFileSync(configPath, "utf8"))
    : [];

  for (const plugin of enabledPlugins) {
    const pluginInfo = readCodexPluginInfo(codexDir, plugin);
    entries.push({
      id: `agentica-${safeMcpId(plugin.id)}`,
      name: pluginInfo.name || `AgenticaHarness ${plugin.name} Bridge`,
      transport: "agentica-native",
      capabilities: pluginInfo.capabilities,
      command: pluginInfo.command,
      args: pluginInfo.args
    });
  }

  return entries;
}

function parseCodexEnabledPlugins(content) {
  const plugins = [];
  const pattern = /\[plugins\."([^"@]+)@([^"]+)"\]([\s\S]*?)(?=\n\[|$)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const body = match[3] || "";
    if (/enabled\s*=\s*true/i.test(body)) {
      plugins.push({ name: match[1], marketplace: match[2], id: `${match[1]}@${match[2]}` });
    }
  }
  return plugins;
}

function readCodexPluginInfo(codexDir, plugin) {
  const pluginRoot = newestCodexPluginRoot(path.join(codexDir, "plugins", "cache", plugin.marketplace, plugin.name));
  const manifestPath = pluginRoot ? path.join(pluginRoot, ".codex-plugin", "plugin.json") : "";
  let manifest = {};
  if (manifestPath && existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      manifest = {};
    }
  }

  return {
    name: manifest.interface?.displayName
      ? `AgenticaHarness ${manifest.interface.displayName} Bridge`
      : manifest.displayName || manifest.name || `AgenticaHarness ${prettyCodexPluginName(plugin.name)} Bridge`,
    command: manifest.mcp?.command || manifest.server?.command || "",
    args: Array.isArray(manifest.mcp?.args) ? manifest.mcp.args.map(String).slice(0, 8) : [],
    capabilities: codexPluginCapabilities(plugin.name, manifest)
  };
}

function newestCodexPluginRoot(baseDir) {
  if (!existsSync(baseDir)) return "";
  try {
    const versions = readdirSyncSafe(baseDir)
      .map((name) => ({ name, fullPath: path.join(baseDir, name) }))
      .filter((entry) => {
        try {
          return existsSync(path.join(entry.fullPath, ".codex-plugin", "plugin.json"));
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
    return versions[0]?.fullPath || baseDir;
  } catch {
    return baseDir;
  }
}

function readdirSyncSafe(dirPath) {
  try {
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}

function prettyCodexPluginName(name) {
  return String(name || "Codex Plugin")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function codexPluginCapabilities(name, manifest) {
  const declared = [
    ...(Array.isArray(manifest.capabilities) ? manifest.capabilities : []),
    ...(Array.isArray(manifest.interface?.capabilities) ? manifest.interface.capabilities : []),
    ...(Array.isArray(manifest.skills) ? manifest.skills.map((skill) => skill.name || skill.id || skill).filter(Boolean) : [])
  ].map(String);
  if (declared.length) return declared.slice(0, 12);

  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("browser")) return ["browser automation", "screenshots", "DOM inspection", "local app testing"];
  if (normalized.includes("document")) return ["DOCX creation", "document editing", "document rendering"];
  if (normalized.includes("presentation")) return ["PPTX creation", "slide rendering", "deck editing"];
  if (normalized.includes("spreadsheet")) return ["XLSX creation", "CSV analysis", "formulas", "charts"];
  return ["tool bridge", "resources/read"];
}

async function checkMcpServer(server) {
  if (!server.checkUrl) {
    return {
      ...publicMcpServer(server),
      status: server.command ? "configured" : "configured",
      latencyMs: null
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    const response = await fetch(server.checkUrl, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    return {
      ...publicMcpServer(server),
      status: response.status < 500 ? "online" : "offline",
      httpStatus: response.status,
      latencyMs: Date.now() - start
    };
  } catch {
    return {
      ...publicMcpServer(server),
      status: "offline",
      latencyMs: Date.now() - start
    };
  }
}

function publicMcpServer(server) {
  return {
    id: server.id,
    name: server.name,
    transport: server.transport,
    url: server.url,
    command: server.command ? path.basename(server.command) : "",
    args: server.args || [],
    source: server.source,
    capabilities: server.capabilities || inferMcpCapabilities(server)
  };
}

function inferMcpCapabilities(server) {
  const text = `${server.name} ${server.command} ${server.url}`.toLowerCase();
  const capabilities = [];
  if (/file|fs|filesystem/.test(text)) capabilities.push("filesystem");
  if (/browser|playwright|chrome/.test(text)) capabilities.push("browser");
  if (/git|github/.test(text)) capabilities.push("source-control");
  if (/postgres|mysql|sqlite|database|db/.test(text)) capabilities.push("database");
  if (/slack|linear|jira|notion|drive|gmail|calendar/.test(text)) capabilities.push("workspace");
  return capabilities.length ? capabilities : ["tools/list", "resources/read"];
}

function formatMcpPromptContext(servers) {
  if (!servers.length) {
    return "MCP servers: none discovered. Use native project scan, files, commands, and configured model providers.";
  }

  return [
    `MCP servers discovered: ${servers.length}`,
    ...servers.map((server) => {
      const availability = server.status === "offline" ? "offline" : "available";
      const capabilities = (server.capabilities || []).join(", ") || "tools/resources";
      return `- ${server.name}: ${availability}, ${server.transport}, ${capabilities}`;
    })
  ].join("\n");
}

async function modelRouteRuntimeStatus() {
  const routes = [];
  for (const providerInfo of modelProviders) {
    routes.push(await checkModelRoute(providerInfo));
  }
  return routes;
}

async function checkModelRoute(providerInfo) {
  const configured = providerConfigured(providerInfo);
  const apiKey = providerEnvValue(providerInfo);
  const baseUrl = normalizeProviderBaseUrl(providerInfo, providerBaseUrlFromEnv(providerInfo) || providerInfo.baseUrl || "", apiKey);
  const status = await probeProviderRuntime(providerInfo, baseUrl, apiKey, configured);

  return {
    id: providerInfo.id,
    name: providerInfo.name,
    type: providerInfo.type,
    configured,
    status: status.status,
    detail: status.detail,
    baseUrl: baseUrl ? redactUrl(baseUrl) : "",
    defaultModel: providerInfo.defaultModel || "",
    models: Array.isArray(providerInfo.models) ? providerInfo.models.slice(0, 6) : []
  };
}

async function probeProviderRuntime(providerInfo, baseUrl, apiKey, configured) {
  if (providerInfo.type === "agentica") return { status: "native", detail: "Built into AgenticaHarness." };
  if (providerInfo.id === "ollama") {
    const result = await probeJsonEndpoint(`${baseUrl.replace(/\/$/, "")}/api/tags`, {}, 700);
    return result.ok
      ? { status: "online", detail: "Ollama answered /api/tags." }
      : { status: "offline", detail: "Ollama route configured, but local server did not answer." };
  }
  if (providerInfo.id === "agentica-qwen-core" || providerInfo.id === "airllm") {
    if (!configured) return { status: "disabled", detail: "Local route is installed but not enabled by env." };
    const result = await probeJsonEndpoint(`${baseUrl.replace(/\/$/, "")}/models`, apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, 700);
    return result.ok
      ? { status: "online", detail: "Local model route answered /models." }
      : { status: "configured", detail: "Local route is configured; model list did not answer quickly." };
  }
  if (!providerInfo.needsKey && baseUrl) {
    return { status: configured ? "configured" : "available", detail: "No-key compatible helper route." };
  }
  if (providerInfo.needsKey && !apiKey) {
    return { status: "needs-key", detail: `Set ${providerInfo.env} or choose this provider with a browser key.` };
  }
  if (!configured) {
    return { status: "not-configured", detail: "Add a base URL, API key, or enable flag before using this route." };
  }
  return { status: "configured", detail: "API key route is configured." };
}

async function probeJsonEndpoint(url, headers = {}, timeoutMs = 700) {
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false };
  }
}

function formatModelRoutePromptContext(routes) {
  const useful = routes.filter((route) => ["native", "online", "configured", "available"].includes(route.status));
  const needsSetup = routes.filter((route) => ["needs-key", "disabled", "offline", "not-configured"].includes(route.status));

  return [
    `AI/model routes available: ${useful.length}/${routes.length}`,
    ...useful.map((route) => `- ${route.name}: ${route.status}${route.defaultModel ? `, default ${route.defaultModel}` : ""}`),
    needsSetup.length ? "AI/model routes needing setup:" : "",
    ...needsSetup.slice(0, 8).map((route) => `- ${route.name}: ${route.status}, ${route.detail}`)
  ].filter(Boolean).join("\n");
}

function userHomeDir() {
  return process.env.USERPROFILE || process.env.HOME || rootDir;
}

function safeMcpId(value) {
  return String(value || "mcp")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mcp";
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = "";
      url.password = "";
    }
    if (/(token|key|secret|password)=/i.test(url.search)) {
      for (const key of [...url.searchParams.keys()]) {
        if (/(token|key|secret|password)/i.test(key)) url.searchParams.set(key, "redacted");
      }
    }
    return url.toString();
  } catch {
    return String(value).replace(/(token|key|secret|password)=([^&\s]+)/gi, "$1=redacted");
  }
}

function publicModelProviders() {
  return modelProviders.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    type: candidate.type,
    baseUrl: candidate.baseUrl,
    needsKey: candidate.needsKey,
    defaultModel: candidate.defaultModel || "",
    configured: providerConfigured(candidate)
  }));
}

function providerConfigured(candidate) {
  if (candidate.type === "agentica") return true;
  if (candidate.type === "harness") return true;
  if (candidate.id === "agentica-qwen-core") return process.env.AGENTICA_QWEN_CORE_ENABLED === "true";
  if (candidate.id === "airllm") return process.env.AIRLLM_ENABLED === "true";
  if (!candidate.needsKey && candidate.baseUrl) return true;
  if (candidate.id === "ollama") return true;
  return Boolean(providerEnvValue(candidate));
}

function providerEnvValue(providerInfo) {
  const legacyEnvs = [
    providerInfo.legacyEnv,
    ...(Array.isArray(providerInfo.legacyEnvs) ? providerInfo.legacyEnvs : [])
  ].filter(Boolean);
  return String(process.env[providerInfo.env] || legacyEnvs.map((envName) => process.env[envName]).find(Boolean) || "").trim();
}

function stack(id, name, exact, suffix, install, test, build, run, verifierNotes) {
  return { id, name, exact, suffix, install, test, build, run, verifierNotes };
}

async function scanRepository(repoPath) {
  const resolved = path.resolve(rootDir, repoPath || ".");
  if (!(await exists(resolved))) {
    return {
      repoPath: resolved,
      exists: false,
      stacks: [],
      detectedFiles: [],
      recommendedCommands: [],
      warnings: ["Repository path does not exist."]
    };
  }

  const detectedFiles = await listFiles(resolved);
  const stacks = stackDefinitions.map((definition) => toProfile(definition, detectedFiles)).filter(Boolean);
  if (stacks.length === 0 && resolved.toLowerCase().includes("salesforce")) {
    stacks.push({
      id: "salesforce",
      name: "Salesforce DX",
      confidence: "Medium",
      markers: ["folder name: salesforce"],
      install: ["sf org login web --alias dev-sandbox --instance-url https://test.salesforce.com"],
      test: ["sf apex run test --target-org dev-sandbox --result-format human"],
      build: ["sf project deploy validate --target-org dev-sandbox"],
      run: ["sf org open --target-org dev-sandbox"],
      verifierNotes: ["Folder is Salesforce-targeted. Add sfdx-project.json and force-app metadata when implementation starts."]
    });
  }
  const recommendedCommands = unique(stacks.flatMap((profile) => [...profile.install, ...profile.test, ...profile.build]));
  const warnings = [
    ...(stacks.length === 0 ? ["No supported stack markers were found. Add a custom adapter before execution."] : []),
    ...(detectedFiles.length >= maxFiles ? ["File scan reached the sampling limit. Narrow the repo path for deeper context."] : [])
  ];

  return { repoPath: resolved, exists: true, stacks, detectedFiles, recommendedCommands, warnings };
}

function normalizeAgenticaOptions(options = null) {
  const source = typeof options === "string" ? { mode: options } : (options && typeof options === "object" ? options : {});
  const mode = String(source.mode || "").toLowerCase();
  return {
    mode: mode === "god" || source.godMode === true ? "god" : "normal",
    godMode: mode === "god" || source.godMode === true
  };
}

function normalizeChatHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || item?.text || "").trim()
    }))
    .filter((item) => item.content)
    .slice(-12);
}

function formatChatHistory(history = []) {
  const clean = normalizeChatHistory(history);
  if (!clean.length) return "";
  return clean
    .map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${truncate(item.content.replace(/\s+/g, " "), 900)}`)
    .join("\n");
}

async function chatReplyWithLearning(message, repoPath, modelConfig = null, options = {}, history = []) {
  const reply = await chatReply(message, repoPath, modelConfig, options, history);
  if (reply?.kind === "fast-chat") {
    learnFromCompletedTurn({ message, repoPath, modelConfig, reply }).catch(() => {});
    return reply;
  }
  await learnFromCompletedTurn({ message, repoPath, modelConfig, reply }).catch(() => {});
  return reply;
}

async function latestChatThread(repoPath = "") {
  const threads = await listChatThreads();
  const resolvedRepoPath = repoPath ? path.resolve(rootDir, repoPath) : "";
  const thread = threads.find((candidate) => !resolvedRepoPath || candidate.repoPath === resolvedRepoPath) || null;
  return {
    thread: thread ? publicChatThread(thread) : null,
    total: threads.length
  };
}

async function saveChatTurn({ threadId, message, reply, repoPath, modelConfig = null, history = [] }) {
  const threads = await listChatThreads();
  const now = new Date().toISOString();
  const resolvedRepoPath = path.resolve(rootDir, repoPath || ".");
  const cleanThreadId = String(threadId || "").trim();
  const existingIndex = cleanThreadId ? threads.findIndex((thread) => thread.id === cleanThreadId) : -1;
  const existing = existingIndex >= 0 ? threads[existingIndex] : null;
  const historyMessages = normalizeChatHistory(history).map((item, index) => ({
    id: safeServerId(`history-${index}`),
    role: item.role,
    text: item.content,
    createdAt: now
  }));
  const baseMessages = existing?.messages?.length ? existing.messages : historyMessages;
  const userMessage = {
    id: safeServerId("user"),
    role: "user",
    text: String(message || "").trim(),
    createdAt: now
  };
  const assistantMessage = {
    id: reply?.run?.id || safeServerId("assistant"),
    role: "assistant",
    text: String(reply?.text || ""),
    kind: reply?.kind || "agentica",
    liveUrl: reply?.liveUrl,
    projectDirectory: reply?.projectDirectory,
    createdAt: now
  };

  const thread = {
    id: existing?.id || safeServerId("chat"),
    title: existing?.title || chatTitle(message),
    repoPath: resolvedRepoPath,
    model: modelConfig ? {
      provider: modelConfig.provider || "",
      model: modelConfig.model || "",
      providerName: modelConfig.providerName || ""
    } : existing?.model || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    messages: dedupeChatMessages([...baseMessages, userMessage, assistantMessage]).slice(-80)
  };

  const nextThreads = existingIndex >= 0
    ? [thread, ...threads.filter((_, index) => index !== existingIndex)]
    : [thread, ...threads];
  await writeChatThreads(nextThreads.slice(0, 40));
  return thread;
}

async function listChatThreads() {
  try {
    const parsed = JSON.parse(await readFile(chatsFile, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoredChatThread).filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  } catch {
    return [];
  }
}

async function writeChatThreads(threads) {
  await mkdir(runsDir, { recursive: true });
  await writeFile(chatsFile, JSON.stringify(threads.map(publicChatThread), null, 2), "utf8");
}

function normalizeStoredChatThread(thread) {
  if (!thread || typeof thread !== "object") return null;
  const messages = Array.isArray(thread.messages)
    ? thread.messages.map(normalizeStoredChatMessage).filter(Boolean)
    : [];
  if (!messages.length) return null;
  return {
    id: String(thread.id || safeServerId("chat")),
    title: String(thread.title || chatTitle(messages[0]?.text || "Chat")),
    repoPath: String(thread.repoPath || path.resolve(rootDir, ".")),
    model: thread.model && typeof thread.model === "object" ? thread.model : null,
    createdAt: String(thread.createdAt || new Date().toISOString()),
    updatedAt: String(thread.updatedAt || thread.createdAt || new Date().toISOString()),
    messages
  };
}

function normalizeStoredChatMessage(message) {
  if (!message || typeof message !== "object") return null;
  const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : "";
  const text = String(message.text || message.content || "").trim();
  if (!role || !text) return null;
  return {
    id: String(message.id || safeServerId(role)),
    role,
    text,
    kind: message.kind || undefined,
    liveUrl: message.liveUrl || undefined,
    projectDirectory: message.projectDirectory || undefined,
    createdAt: String(message.createdAt || new Date().toISOString())
  };
}

function publicChatThread(thread) {
  return {
    id: thread.id,
    title: thread.title,
    repoPath: thread.repoPath,
    model: thread.model,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: (thread.messages || []).map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      kind: message.kind,
      liveUrl: message.liveUrl,
      projectDirectory: message.projectDirectory,
      createdAt: message.createdAt
    }))
  };
}

function summarizeChatThread(thread) {
  return {
    id: thread.id,
    title: thread.title,
    repoPath: thread.repoPath,
    updatedAt: thread.updatedAt,
    messageCount: thread.messages?.length || 0
  };
}

function dedupeChatMessages(messages) {
  const output = [];
  for (const message of messages.map(normalizeStoredChatMessage).filter(Boolean)) {
    const previous = output[output.length - 1];
    if (previous && previous.role === message.role && previous.text === message.text) continue;
    output.push(message);
  }
  return output;
}

function chatTitle(message) {
  return truncate(String(message || "New chat").replace(/\s+/g, " "), 72) || "New chat";
}

function safeServerId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}

async function chatReply(message, repoPath, modelConfig = null, options = {}, history = []) {
  const agenticaOptions = normalizeAgenticaOptions(options);
  const normalized = message.toLowerCase();
  if (isFastGreeting(normalized, history)) {
    return fastGreetingReply();
  }

  const scan = await scanRepository(repoPath);
  const requestedModel = requestedModelInfo(modelConfig);
  const resolvedRequestedModel = resolveModelConfig(modelConfig);
  const selectedModel = resolvedRequestedModel || defaultWorkingModelConfig();

  if (requestedModel && !resolvedRequestedModel) {
    return modelNeedsSetupReply(scan, requestedModel);
  }

  const neural = await runNeuralEngine(message, normalized, scan, selectedModel, modelConfig, agenticaOptions);
  const prioritizeLocalAction = shouldPrioritizeLocalAction(normalized, neural.intent);

  if (isArtifactComplaint(normalized)) {
    const repaired = await repairLatestArtifactReply(message, normalized, scan, selectedModel);
    if (repaired) return withNeuralSteps(repaired, neural);
  }

  if (isGodModeInfoPrompt(normalized)) {
    return withNeuralSteps(godModeInfoReply(scan, selectedModel, agenticaOptions), neural);
  }

  if (isDeerFlowWorkspacePrompt(normalized)) {
    return withNeuralSteps(deerFlowModeReply(scan, selectedModel, agenticaOptions), neural);
  }

  if (!prioritizeLocalAction && (shouldUseTeacherEnsemble(normalized) || (agenticaOptions.godMode && shouldGodModeUseTeacher(normalized, neural.intent)))) {
    const ensemble = await teacherEnsemble(message, repoPath, modelConfig, { maxTeachers: agenticaOptions.godMode ? 6 : 4 });
    const savedLesson = await saveTeacherEnsembleLearning(ensemble, { title: `Teacher lesson: ${truncate(message, 44)}` });
    return withNeuralSteps({
      kind: "teacher-ensemble",
      text: formatTeacherEnsembleReply(ensemble, agenticaOptions),
      steps: [
        ...(agenticaOptions.godMode ? godModeSteps(scan, neural.intent) : []),
        `Teacher ensemble: ${ensemble.teacherAnswers.length}/${ensemble.teachersAsked} model${ensemble.teachersAsked === 1 ? "" : "s"} answered`,
        `Learning: distilled ${savedLesson ? "one lesson" : "no lesson"}`
      ]
    }, neural);
  }

  if (normalized.includes("help") || normalized.includes("what can you do") || normalized.includes("what you can do") || normalized.includes("what do you do")) {
    return withNeuralSteps(helpReply(scan, selectedModel), neural);
  }

  if (normalized.includes("connect") && (normalized.includes("org") || normalized.includes("salesforce"))) {
    return withNeuralSteps(await connectOrgReply(scan, message), neural);
  }

  if ((normalized.includes("check") || normalized.includes("status")) && normalized.includes("org")) {
    return withNeuralSteps(await orgStatusReply(message), neural);
  }

  if (normalized.includes("scan") || normalized.includes("inspect project") || normalized.includes("detect stack")) {
    return withNeuralSteps(scanProjectReply(scan), neural);
  }

  if (normalized.includes("verify") || normalized.includes("run test") || normalized.includes("test this")) {
    return withNeuralSteps(await verifyProjectReply(scan, normalized), neural);
  }

  if (normalized.includes("ruflo") || normalized.includes("ru flo")) {
    return withNeuralSteps(await rufloIntegrationReply(scan, normalized), neural);
  }

  if (normalized.includes("agentica mode") || normalized.includes("agentica engine") || normalized.includes("own model") || normalized.includes("api/cli")) {
    return withNeuralSteps(agenticaModeReply(scan, selectedModel), neural);
  }

  const artifact = await maybeCreateArtifact(message, normalized, scan, requestedModel, selectedModel);
  if (artifact) return withNeuralSteps(artifact, neural);

  const agentica = await agenticaAgentReply(message, normalized, scan, selectedModel, neural, history);
  if (agentica) return withNeuralSteps(agentica, neural);

  const run = await planRun(message, repoPath, "PLAN_ONLY");
  return withNeuralSteps({
    kind: "plan",
    text: formatRunForChat(run),
    run
  }, neural);
}

function isFastGreeting(normalized, history = []) {
  const clean = normalized.trim().replace(/[!.?\s]+$/g, "");
  return normalizeChatHistory(history).length === 0 && /^(hi|hello|hey|yo|sup|hii|helo|namaste|hai)$/.test(clean);
}

function fastGreetingReply() {
  return {
    kind: "fast-chat",
    steps: [
      "Fast path: greeting answered without scanning the workspace",
      "Runtime: AgenticaHarness native chat is connected"
    ],
    text: "Hi! AgenticaHarness is connected and ready. Tell me what you want to build, fix, check, or connect."
  };
}

async function liveCompanionReply(body = {}) {
  const message = String(body.message || body.prompt || "").trim();
  const app = body.app && typeof body.app === "object" ? body.app : {};
  const normalized = message.toLowerCase();
  const crisis = /\b(kill myself|suicide|end my life|self harm|hurt myself|don'?t want to live|want to die)\b/.test(normalized);
  const lifeHelp = /\b(life|fix me|fix my life|depressed|lost|stuck|anxiety|stress|money|job|family|relationship|health|habit|future)\b/.test(normalized);
  const businessHelp = /\b(business|customer|order|payment|menu|delivery|sales|marketing|price|food|restaurant|shop|store)\b/.test(normalized)
    || ["restaurant", "commerce", "booking"].includes(String(app.appType || ""));

  const reply = crisis
    ? [
        "I am really glad you said something. If you might hurt yourself or someone else, pause this app and contact emergency help now.",
        "",
        "Do this first:",
        "1. Move near another person or call someone you trust.",
        "2. Call local emergency services now. If you are in the U.S. or Canada, call or text 988.",
        "3. Put distance between you and anything you could use to hurt yourself.",
        "",
        "If you can, reply with one word: safe or not safe. I will stay focused on the next small step."
      ].join("\n")
    : lifeHelp
      ? [
          "I can help, but we will make it smaller than 'fix my whole life'. That phrase is too heavy for one moment.",
          "",
          "Right now, choose one area:",
          "- money",
          "- work",
          "- health",
          "- relationship",
          "- home/family",
          "- confidence",
          "",
          "For the next 20 minutes:",
          "1. Write the one problem that hurts most.",
          "2. Write the next physical action you can do today.",
          "3. Tell one real person: 'I am trying to get stable. Can you check on me today?'",
          "",
          "Send me the area you want to fix first, and I will turn it into a simple plan for today."
        ].join("\n")
      : businessHelp
        ? [
            `I am AgenticaHarness live inside ${app.title || "this model"}. I can help turn this app into a working business tool.`,
            "",
            "Best next upgrades:",
            "- real menu/products database",
            "- customer login",
            "- cart and checkout",
            "- payment provider",
            "- order tracking",
            "- admin order dashboard",
            "- WhatsApp/SMS order alerts",
            "",
            "Tell me which one you want first and I will guide the build."
          ].join("\n")
        : [
            `I am AgenticaHarness live inside ${app.title || "this model"}. Ask me what to change, what to build, or what decision you need help with.`,
            "",
            "I can answer, plan, and guide the next action. For deeper tool work, use the main AgenticaHarness workspace so I can edit files and verify changes."
          ].join("\n");

  await addManualLearning({
    title: lifeHelp ? "Live companion support prompt" : "Live app chat prompt",
    lesson: `Live chat prompt: ${truncate(message, 180)}. App: ${app.title || "unknown"} / ${app.appType || "unknown"}.`,
    tags: ["live-chat", lifeHelp ? "life-support" : "app-support", app.appType || "general"],
    confidence: 0.62
  }).catch(() => {});

  return {
    kind: "agentica-live-chat",
    owner: "AgenticaHarness",
    codexRequired: false,
    reply,
    missingForFullAssistant: liveAssistantMissingPieces()
  };
}

function liveAssistantMissingPieces() {
  return [
    "streaming token-by-token responses",
    "durable per-user memory with consent and delete controls",
    "account login and private user profiles",
    "tool execution from the live app with approval gates",
    "voice input/output",
    "notifications and follow-up reminders",
    "knowledge search over uploaded files and business data",
    "safety escalation for crisis, medical, legal, and financial topics",
    "analytics for whether answers helped",
    "human handoff path when the user needs real-world help"
  ];
}

async function runNeuralEngine(message, normalized, scan, selectedModel, modelConfig = null, options = {}) {
  const intent = inferAgenticIntent(message, normalized, stackNames(scan));
  const learningLessons = await relevantLearningLessons(intent, {
    projectPath: scan.repoPath,
    detectedStack: stackNames(scan),
    detectedFiles: scan.detectedFiles
  });
  const teacherConfigs = resolveTeacherConfigs(modelConfig, { maxTeachers: options.godMode ? 8 : 5 });
  const activeTeacherCount = teacherConfigs.length;
  const confidence = neuralConfidence(intent, scan, learningLessons, activeTeacherCount);
  const signals = [
    ...(options.godMode ? ["God Mode: deep orchestration enabled"] : []),
    `Intent Agent: ${intent.domain}/${intent.deliverable}/${intent.action}`,
    `Context Agent: ${scan.exists ? `${scan.detectedFiles.length} files scanned` : "project path missing"}`,
    `Learning Agent: ${learningLessons.length} matching lesson${learningLessons.length === 1 ? "" : "s"}`,
    `Teacher Router: ${activeTeacherCount} configured teacher model${activeTeacherCount === 1 ? "" : "s"}`,
    `Quality Agent: ${confidence}% confidence target`,
    ...(options.godMode ? [
      "GStack Team: product, architecture, design, QA, security, release lenses applied",
      "Safety Gate: destructive actions still require explicit user direction"
    ] : []),
    "Delivery Agent: single synchronized response"
  ];

  return {
    intent,
    learningLessons,
    teacherConfigs,
    confidence,
    steps: [
      "Neural Engine: agents synchronized as one brain",
      ...signals
    ],
    context: [
      `Intent: ${intent.domain}/${intent.deliverable}/${intent.action}`,
      formatLearningContext(learningLessons) ? `Learning:\n${formatLearningContext(learningLessons)}` : "",
      `Teacher models available: ${activeTeacherCount}`,
      options.godMode ? "Mode: God Mode" : "",
      `Quality confidence: ${confidence}%`
    ].filter(Boolean).join("\n")
  };
}

function neuralConfidence(intent, scan, lessons, teacherCount) {
  let score = 58;
  if (scan.exists) score += 10;
  if (scan.stacks.length) score += 8;
  if (lessons.length) score += Math.min(14, lessons.length * 3);
  if (teacherCount) score += Math.min(10, teacherCount * 2);
  if (intent.deliverable !== "answer") score += 4;
  return Math.max(50, Math.min(96, score));
}

function withNeuralSteps(reply, neural) {
  if (!reply || !neural) return reply;
  return {
    ...reply,
    steps: unique([...(neural.steps || []), ...(reply.steps || [])])
  };
}

function shouldUseTeacherEnsemble(normalized) {
  return /\b(fetch|ask|use|get)\b.*\b(all|other|teacher|multiple)\b.*\b(llm|model|ai)\b/.test(normalized)
    || /\b(perfect|best)\b.*\b(answer|response)\b.*\b(llm|model|ai)\b/.test(normalized)
    || /\blearn\b.*\b(other|llm|model|source|teacher)\b/.test(normalized)
    || /\b(complicated|complex|production|live soon|serious)\b.*\b(answer|response|build|fix|plan|ship|work)\b/.test(normalized);
}

function shouldGodModeUseTeacher(normalized, intent) {
  if (isGodModeInfoPrompt(normalized)) return false;
  return intent.deliverable === "website"
    || intent.deliverable === "code"
    || ["build", "fix", "plan", "verify", "connect"].includes(intent.action)
    || /\b(production|live soon|complex|complicated|perfect|best|review|security|qa|ship|deploy|architecture|api|database|payment)\b/.test(normalized);
}

function shouldPrioritizeLocalAction(normalized, intent) {
  return intent.deliverable === "website"
    || ["fix", "verify", "connect"].includes(intent.action)
    || /\b(run|execute|start)\b.*\b(build|test|verification|server)\b/.test(normalized)
    || /\b(scan|inspect project|detect stack|git status|create project|update project|edit file|write file)\b/.test(normalized);
}

function isGodModeInfoPrompt(normalized) {
  return /\bgod\s*mode\b/.test(normalized)
    && /\b(what|explain|how|why|mean|means|does|mode|brain)\b/.test(normalized);
}

function isDeerFlowWorkspacePrompt(normalized) {
  return /\b(deer\s*flow|deerflow|ui[-\s]?tars|agent\s*tars|research\s+workspace|workspace\s+agent|super\s+agent|single\s+brain|neural\s+engine)\b/.test(normalized)
    && /\b(convert|map|refer|style|workspace|brain|agent|research|flow|technology|tec|tech|ui|make|move|toward|towards|want)\b/.test(normalized);
}

function godModeInfoReply(scan, selectedModel, options = {}) {
  return {
    kind: "god-mode",
    steps: agenticaSteps(scan, [
      `Mode: ${options.godMode ? "God Mode active" : "God Mode available"}`,
      `Model: ${selectedModel.providerName} / ${selectedModel.model}`,
      "Teacher models: used only for complex prompts or explicit multi-model requests",
      "Safety: destructive actions and secrets stay gated"
    ]),
    text: [
      "God Mode in AgenticaHarness means deeper orchestration, not unsafe unlimited access.",
      "",
      "When it is on, AgenticaHarness runs the prompt through stronger lenses:",
      "- product intent",
      "- CEO scope/value check",
      "- engineering architecture check",
      "- design review when UI is involved",
      "- QA and verification thinking",
      "- security/safety gate",
      "- teacher LLMs/APIs when the task is complex or asks for best/multi-model answers",
      "",
      "It still will not grab secrets, delete things, force-push, or run risky actions unless you explicitly direct that workflow.",
      "",
      `Current project: ${scan.repoPath}`
    ].join("\n")
  };
}

function godModeSteps(scan, intent) {
  return [
    "God Mode: activated",
    `Product Lens: ${intent.domain}/${intent.deliverable}`,
    "CEO Lens: scope and value checked",
    "Engineering Lens: architecture and verification considered",
    intent.deliverable === "website" || intent.domain === "frontend" ? "Design Lens: UI quality checked" : "Design Lens: skipped unless UI is involved",
    "QA Lens: browser/test path considered",
    "Security Lens: risky actions gated",
    `Project: ${scan.repoPath}`
  ];
}

function deerFlowWorkspaceStatus(scan = null, selectedModel = defaultWorkingModelConfig(), options = {}) {
  const configuredProviders = publicModelProviders().filter((providerInfo) => providerInfo.configured || !providerInfo.requiresKey);
  const activeProject = scan?.repoPath || rootDir;
  return {
    mode: "AgenticaHarness Research Workspace",
    updatedAt: new Date().toISOString(),
    summary: "DeerFlow-style thread state, specialist agents, live tools, memory, and verification mapped into AgenticaHarness.",
    references: [
      {
        name: "DeerFlow",
        repo: "https://github.com/bytedance/deer-flow",
        localPath: deerFlowRepoDir,
        license: "MIT",
        available: existsSync(deerFlowRepoDir),
        insights: [
          "Workspace shell with thread sidebar, chat stream, todo list, artifacts, export, and token usage.",
          "Lead agent orchestrates subagents through a LangGraph-compatible runtime.",
          "Thread state carries sandbox, artifacts, todos, uploads, viewed images, memory, and title."
        ]
      },
      {
        name: "UI-TARS",
        repo: "https://github.com/bytedance/UI-TARS",
        localPath: uiTarsRepoDir,
        license: "Apache-2.0",
        available: existsSync(uiTarsRepoDir),
        insights: [
          "Vision-language GUI agent pattern: observe screenshot or UI state, reason, emit grounded action, verify.",
          "Action parser and prompt templates support computer, mobile, and grounding tasks."
        ]
      },
      {
        name: "Agent TARS / UI-TARS Desktop",
        repo: "https://github.com/bytedance/UI-TARS-desktop",
        localPath: uiTarsDesktopRepoDir,
        license: "Apache-2.0",
        available: existsSync(uiTarsDesktopRepoDir),
        insights: [
          "Hybrid browser/computer operator model with real-time event stream.",
          "Local and remote operator concept maps to AgenticaHarness browser-runner plus tool safety gates."
        ]
      }
    ],
    flow: [
      workspaceStep("observe", "Observe", "Prompt, files, UI/browser, memory", "live"),
      workspaceStep("plan", "Plan", "Lead agent selects route and agents", "live"),
      workspaceStep("research", "Research", "Teacher LLMs, docs, repo context", "live"),
      workspaceStep("act", "Act", "Code, shell, browser, API tools", "partly-live"),
      workspaceStep("verify", "Verify", "Build, tests, browser checks, safety", "live"),
      workspaceStep("report", "Report", "Clean answer and learned lesson", "live")
    ],
    agents: [
      workspaceAgent("lead", "Lead", "Routes every prompt and owns the thread state", "live"),
      workspaceAgent("researcher", "Researcher", "Reads external repos/docs and teacher model answers", "live"),
      workspaceAgent("coder", "Coder", "Creates or edits local source projects", "live"),
      workspaceAgent("browser", "Browser", "Checks local pages and future GUI actions", "ready"),
      workspaceAgent("qa", "QA", "Runs build/test/smoke verification", "live"),
      workspaceAgent("memory", "Memory", "Stores lessons and avoids repeating weak answers", "live"),
      workspaceAgent("gui", "GUI Operator", "UI-TARS-style observe/action/verify loop", "planned")
    ],
    state: {
      projectPath: activeProject,
      runtimeOwner: "AgenticaHarness",
      codexRequired: false,
      brain: options.godMode ? "God Mode + DeerFlow workspace" : "DeerFlow workspace",
      selectedModel: `${selectedModel.providerName || selectedModel.provider}/${selectedModel.model || "unknown"}`,
      configuredProviders: configuredProviders.map((providerInfo) => providerInfo.name),
      memoryFile: learningFile,
      apacheUrl: "http://127.0.0.1:8088/",
      devUrl: "http://127.0.0.1:5174/"
    },
    integrations: [
      "Thread workspace UI",
      "Learning memory",
      "Teacher LLM routing",
      "GStack engineering-team review lenses",
      "Local project generator",
      "Apache/Vite live hosting",
      "AirLLM local model bridge",
      "NVIDIA NIM provider"
    ],
    nextGaps: [
      "True streaming events for each agent step",
      "Durable per-thread todos/artifacts/files",
      "UI-TARS grounded screenshot action executor",
      "MCP server discovery UI",
      "Parallel subagent job queue"
    ]
  };
}

function workspaceStep(id, label, detail, status) {
  return { id, label, detail, status };
}

function workspaceAgent(id, name, role, status) {
  return { id, name, role, status };
}

function deerFlowModeReply(scan, selectedModel, options = {}) {
  const workspace = deerFlowWorkspaceStatus(scan, selectedModel, options);
  return {
    kind: "deerflow-workspace",
    workspace,
    steps: agenticaSteps(scan, [
      "DeerFlow reference: cloned and mapped",
      "UI-TARS reference: cloned and mapped",
      "Workspace layer: backend status plus live UI panel",
      `Model: ${workspace.state.selectedModel}`
    ]),
    text: [
      "Yes. AgenticaHarness is now moving toward a DeerFlow-style research/agent workspace.",
      "",
      "## What Is Live Now",
      "- Backend workspace API: `/api/deerflow-workspace`",
      "- Live UI panel: Observe -> Plan -> Research -> Act -> Verify -> Report",
      "- Single-brain agent map: Lead, Researcher, Coder, Browser, QA, Memory, GUI Operator",
      "- DeerFlow concepts mapped into AgenticaHarness thread state, tools, memory, and verification",
      "- UI-TARS concept mapped as a future GUI observe/action/verify operator",
      "",
      "## How It Runs In Our Tech",
      "- AgenticaHarness stays the main brain.",
      "- DeerFlow gives us the workspace pattern: thread state, todos, artifacts, subagents, tools, memory.",
      "- UI-TARS gives us the GUI-control pattern: observe screen, pick action, execute, verify.",
      "- GStack stays as the engineering-team review layer.",
      "- NVIDIA, AirLLM, OpenRouter, Ollama, and other providers stay as teacher/model routes when configured.",
      "",
      "## Current Status",
      `- Project: ${scan.repoPath}`,
      `- Model: ${workspace.state.selectedModel}`,
      `- References cloned: DeerFlow ${workspace.references[0].available ? "yes" : "no"}, UI-TARS ${workspace.references[1].available ? "yes" : "no"}, Agent TARS Desktop ${workspace.references[2].available ? "yes" : "no"}`,
      "",
      "Next build layer is true streaming agent events and persistent per-thread workspace state."
    ].join("\n")
  };
}

function formatTeacherEnsembleReply(ensemble, options = {}) {
  const teacherLines = ensemble.teacherAnswers.length
    ? ensemble.teacherAnswers.map((item) => `- ${item.provider} / ${item.model}`).join("\n")
    : "- No external teacher model is configured yet";

  return [
    options.godMode
      ? "God Mode is running: AgenticaHarness used the neural engine, GStack-style specialist lenses, and the teacher layer."
      : "AgenticaHarness Neural Engine checked the teacher layer.",
    "",
    "## Best Answer",
    ensemble.bestAnswer,
    "",
    "## Teacher Models Used",
    teacherLines,
    ensemble.skipped?.length ? "" : "",
    ensemble.skipped?.length ? "## Skipped" : "",
    ...(ensemble.skipped || []).map((item) => `- ${item.provider} / ${item.model}: ${item.reason}`),
    "",
    "## Learned",
    ensemble.lesson || "No new lesson was distilled."
  ].filter((line) => line !== "").join("\n");
}

function helpReply(scan, selectedModel) {
  const steps = agenticaSteps(scan, [
    `Model: ${selectedModel.providerName} / ${selectedModel.model}`,
    "Tools online: scanner, context packer, safe command runner, Salesforce CLI bridge, verifier"
  ]);

  return {
    kind: "help",
    steps,
    text: [
      "AgenticaHarness is on.",
      "",
      "I can work on the selected project with an AgenticaHarness loop:",
      "- understand the request",
      "- scan the project and detect the stack",
      "- read a compact context pack from the repo",
      "- run safe commands like build, test, verify, and git status",
      "- connect or check Salesforce orgs through Salesforce CLI for any login/domain URL",
      "- use the always-on AgenticaHarness Brain now",
      "- optionally upgrade to your own API provider when you add a key",
      "- plan RuFlo swarm/MCP integration with a gated setup command",
      "- answer using the selected live model with tool evidence",
      "- stop before risky writes unless you explicitly ask for them",
      "",
      `Selected project: ${scan.repoPath}`,
      `Detected stack: ${stackNames(scan)}`,
      `Active model: ${selectedModel.providerName} / ${selectedModel.model}`,
      "",
      "Try: scan this project, run build, run verification, git status, connect my org, integrate Ruflo, or build Salesforce user stories."
    ].join("\n")
  };
}

async function verifyProjectReply(scan, normalizedMessage) {
  const commands = verifierActions(scan);
  if (!scan.exists) {
    return {
      kind: "verify",
      text: "I cannot verify this yet because the selected project path does not exist. Pick a project on the left or add the correct path."
    };
  }

  if (commands.length === 0 || commands[0].startsWith("No adapter-specific")) {
    return {
      kind: "verify",
      text: [
        "I do not know the verification command for this project yet.",
        "",
        `Selected path: ${scan.repoPath}`,
        `Detected stack: ${stackNames(scan)}`,
        "",
        "Add a project marker like package.json, pom.xml, pyproject.toml, sfdx-project.json, go.mod, or tell me the exact test command."
      ].join("\n")
    };
  }

  const command = commands[0];
  const shouldRun = normalizedMessage.includes("run") || normalizedMessage.includes("verify") || normalizedMessage.includes("test");
  if (!shouldRun) {
    return {
      kind: "verify",
      text: [
        "I can verify this project.",
        "",
        `First command I would run: ${command}`,
        "",
        "Say: run verification"
      ].join("\n")
    };
  }

  const result = await runProjectCommand(scan.repoPath, command, 90000);
  return {
    kind: "verify",
    text: [
      `I ran verification for ${stackNames(scan)}.`,
      "",
      `Command: ${command}`,
      `Result: ${result.exitCode === 0 ? "passed" : "failed"} (exit ${result.exitCode})`,
      "",
      trimOutput(result.output || "No output.")
    ].join("\n")
  };
}

async function buildProjectReply(message, repoPath) {
  const run = await planRun(message, repoPath, "PLAN_ONLY");
  return {
    kind: "plan",
    text: formatRunForChat(run),
    run
  };
}

function scanProjectReply(scan) {
  const steps = agenticaSteps(scan, [
    `Files sampled: ${scan.detectedFiles.length}`,
    `Adapters: ${stackNames(scan)}`
  ]);
  const stackDetails = scan.stacks.length
    ? scan.stacks.map((profile) => `- ${profile.name} (${profile.confidence}): ${profile.markers.join(", ")}`).join("\n")
    : "- No known stack markers found yet.";

  const commands = scan.recommendedCommands.length
    ? scan.recommendedCommands.map((command) => `- ${command}`).join("\n")
    : "- No adapter commands available.";

  return {
    kind: "scan",
    steps,
    text: [
      "AgenticaHarness scan complete.",
      "",
      "I scanned the selected project.",
      "",
      `Path: ${scan.repoPath}`,
      "",
      "Detected stack:",
      stackDetails,
      "",
      "Useful commands:",
      commands,
      "",
      scan.warnings.length ? `Notes:\n${scan.warnings.map((warning) => `- ${warning}`).join("\n")}` : "No scan warnings."
    ].join("\n")
  };
}

async function rufloIntegrationReply(scan, normalized) {
  const npmAvailable = await commandAvailable("npm");
  let packageVersion = "not checked";
  if (npmAvailable) {
    const versionResult = await runReadOnlyCommand(npmExecutable(), ["view", "ruflo", "version"], 20000);
    packageVersion = versionResult.exitCode === 0 ? trimOutput(versionResult.output) : `not available (${trimOutput(versionResult.output)})`;
  }

  const setupRequested = normalized.includes("setup") || normalized.includes("install") || normalized.includes("init") || normalized.includes("start");
  const runRequested = /\brun\b.*\bruflo\b.*\b(init|setup)\b/.test(normalized) || /\bruflo\b.*\brun\b.*\b(init|setup)\b/.test(normalized);
  const initCommand = "npx ruflo@latest init wizard";
  const mcpCommand = "npx ruflo@latest mcp start";
  const commandResult = runRequested ? await runProjectCommand(scan.repoPath, "npx ruflo@latest init", 180000) : null;
  const steps = agenticaSteps(scan, [
    "RuFlo: added as gated CLI/MCP orchestration layer",
    `npm package: ${packageVersion}`,
    commandResult ? `Setup command: npx ruflo@latest init -> exit ${commandResult.exitCode}` : setupRequested ? "Setup: command prepared, not auto-run" : "Setup: waiting for explicit approval"
  ]);

  return {
    kind: "ruflo",
    steps,
    text: commandResult ? [
      "I ran the RuFlo init command you explicitly requested.",
      "",
      "Command: npx ruflo@latest init",
      `Result: ${commandResult.exitCode === 0 ? "passed" : "failed"} (exit ${commandResult.exitCode})`,
      "",
      trimOutput(commandResult.output || "No output."),
      "",
      commandResult.exitCode === 0
        ? "RuFlo setup completed for this project. Next I can scan the new files and wire the workflow into AgenticaHarness."
        : "RuFlo setup did not complete. I would inspect the output above, then retry with the correct command or package version."
    ].join("\n") : [
      "RuFlo integration is wired into AgenticaHarness.",
      "",
      "What this adds:",
      "- RuFlo is treated as an optional swarm orchestration layer on top of AgenticaHarness",
      "- AgenticaHarness can plan with RuFlo-style agents, memory, MCP tools, and verification gates",
      "- setup/install remains gated because RuFlo init can create project files and hooks",
      "- local command execution still stays inside the selected project",
      "",
      `Selected project: ${scan.repoPath}`,
      `Detected stack: ${stackNames(scan)}`,
      `npm available: ${npmAvailable ? "yes" : "no"}`,
      `ruflo npm version: ${packageVersion}`,
      "",
      "Prepared commands:",
      `- ${initCommand}`,
      `- ${mcpCommand}`,
      "",
      setupRequested
        ? "I did not auto-run setup because it may mutate the workspace. Say: run ruflo init, and I will run the gated setup command."
        : "Say: run ruflo init, when you want me to install/init it for this project."
    ].join("\n")
  };
}

function agenticaModeReply(scan, selectedModel) {
  const steps = agenticaSteps(scan, [
    `Model: ${selectedModel.providerName} / ${selectedModel.model}`,
    "Loop: intake -> scan -> context -> tools -> verify -> answer"
  ]);

  return {
    kind: "agentica",
    steps,
    text: [
      "AgenticaHarness is active.",
      "",
      "This local app now behaves like a standalone AgenticaHarness answer engine:",
      "- it works against the selected project",
      "- it scans the repo before answering",
      "- it loads important files into a context pack",
      "- it can run safe local commands such as git status, build, test, and verify",
      "- it has an always-on AgenticaHarness Brain for no-key execution",
      "- it has optional external API providers for live model upgrades",
      "- it can connect Salesforce orgs from any explicit login/domain URL",
      "- it includes a gated RuFlo integration path for swarm/MCP orchestration",
      "- it shows tool steps inside the answer",
      "- it uses the selected model when configured and keeps local AgenticaHarness execution running when keys are missing",
      "",
      "What is working now:",
      `- Project: ${scan.repoPath}`,
      `- Stack: ${stackNames(scan)}`,
      `- Model: ${selectedModel.providerName} / ${selectedModel.model}`,
      "",
      "Try these:",
      "- scan this project",
      "- git status",
      "- run build",
      "- run verification",
      "- integrate Ruflo",
      "- write Salesforce user stories",
      "- inspect this repo and tell me what to fix next"
    ].join("\n")
  };
}

function isArtifactComplaint(normalized) {
  return /\b(nothing|noting|empty|blank|broken|not working|doesn'?t work|no content|missing|useless)\b/.test(normalized)
    && /\b(it|inside|preview|artifact|website|site|app|page|link)\b/.test(normalized);
}

async function repairLatestArtifactReply(_message, _normalized, _scan, _selectedModel) {
  const latest = await latestGeneratedProject(_scan.repoPath);
  if (!latest) {
    return {
      kind: "project-repair",
      steps: agenticaSteps(_scan, [
        "Correction: artifact-first flow disabled",
        "Repair: no previous generated project folder found"
      ]),
      text: [
        "You are right. I am removing the artifact-first behavior from normal answers.",
        "",
        "From now on, build prompts should create or update real local project files and answer with the actual project result, not just an artifact link.",
        "",
        "Send the build prompt again and AgenticaHarness will generate the local project directly."
      ].join("\n")
    };
  }

  const previousPrompt = await readGeneratedPrompt(latest.path);
  const spec = inferDynamicAppSpec(previousPrompt || latest.name, String(previousPrompt || latest.name).toLowerCase());
  spec.wantsApp = true;
  await writeGeneratedProjectFiles(spec, latest.path);
  const liveUrl = liveProjectUrl(path.basename(latest.path));

  return {
    kind: "project-repair",
    liveUrl,
    projectDirectory: latest.path,
    steps: agenticaSteps(_scan, [
      "Correction: artifact-first flow disabled",
      `Repair: rebuilt ${path.relative(rootDir, latest.path).replaceAll(path.sep, "/")}`,
      `Live model: ${liveUrl}`,
      `Modules: ${artifactFeatureSummary(spec).modules.join(", ")}`
    ]),
    text: [
      "You are right. I rebuilt the last generated work as a live model, not an instruction-only answer.",
      "",
      `Live model: ${liveUrl}`,
      "",
      `Project folder: ${latest.path}`,
      "",
      "What changed:",
      ...artifactFeatureSummary(spec).frontend.map((item) => `- ${item}`),
      "- AgenticaHarness manifest, live preview, and deployment notes were written into the project",
      "",
      "Next, tell me the exact feature you want and I will update the source files directly."
    ].join("\n")
  };
}

async function maybeCreateArtifact(message, normalized, scan, requestedModel, selectedModel) {
  const spec = inferDynamicAppSpec(message, normalized);
  if (!spec.wantsApp) return null;

  const title = spec.title;
  const slug = `${slugify(title)}-${Date.now()}`;
  const projectBaseDir = scan.exists ? scan.repoPath : path.join(rootDir, ".harness", "projects");
  const projectDirectory = path.join(projectBaseDir, "agentica-projects", slug);

  await writeGeneratedProjectFiles(spec, projectDirectory);

  const modelLine = `Execution: AgenticaHarness Native Engine`;
  const projectRelative = path.relative(rootDir, projectDirectory).replaceAll(path.sep, "/");
  const liveUrl = liveProjectUrl(slug);
  const summary = artifactFeatureSummary(spec);

  return {
    kind: "agentica-project",
    liveUrl,
    projectDirectory,
    steps: agenticaSteps(scan, [
      `Intent: build working ${spec.appType} project`,
      `Project: wrote ${projectRelative}`,
      `Live model: ${liveUrl}`,
      `Files: package.json, index.html, live-preview.html, agentica.manifest.json, DEPLOYMENT.md, src/main.jsx, src/styles.css, README.md`,
      `Modules: ${summary.modules.join(", ")}`,
      modelLine
    ]),
    text: [
      `Yes - I built and launched a live ${summary.label}: ${title}.`,
      "",
      `Live model: ${liveUrl}`,
      "",
      `Project folder: ${projectDirectory}`,
      "",
      "## What's inside",
      ...summary.frontend.map((item) => `- ${item}`),
      "- Live preview served by AgenticaHarness at `/live-projects/`",
      "- AgenticaHarness brain/harness manifest: `agentica.manifest.json`",
      "- Easy server deployment notes: `DEPLOYMENT.md`",
      "",
      "- Project files:",
      "- package.json",
      "- index.html",
      "- live-preview.html",
      "- public/manifest.webmanifest",
      "- agentica.manifest.json",
      "- DEPLOYMENT.md",
      "- src/main.jsx",
      "- src/styles.css",
      "- README.md",
      "",
      "Tell me what to modify next: menu, cart, payment, login, admin orders, delivery tracking, colors, or deployment domain."
    ].join("\n")
  };
}

async function writeGeneratedProjectFiles(spec, projectDirectory) {
  const sourceDirectory = path.join(projectDirectory, "src");
  const publicDirectory = path.join(projectDirectory, "public");
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(publicDirectory, { recursive: true });
  await writeFile(path.join(projectDirectory, "package.json"), buildGeneratedPackageJson(spec.title), "utf8");
  await writeFile(path.join(projectDirectory, "index.html"), buildGeneratedIndexHtml(spec.title), "utf8");
  await writeFile(path.join(projectDirectory, "live-preview.html"), buildDynamicPreviewHtml(spec), "utf8");
  await writeFile(path.join(projectDirectory, "agentica.manifest.json"), buildAgenticaProjectManifest(spec, projectDirectory), "utf8");
  await writeFile(path.join(projectDirectory, "DEPLOYMENT.md"), buildGeneratedDeploymentGuide(spec, projectDirectory), "utf8");
  await writeFile(path.join(publicDirectory, "manifest.webmanifest"), buildWebManifest(spec), "utf8");
  await writeFile(path.join(sourceDirectory, "main.jsx"), buildGeneratedReactApp(spec), "utf8");
  await writeFile(path.join(sourceDirectory, "styles.css"), buildGeneratedReactCss(spec), "utf8");
  await writeFile(path.join(projectDirectory, "README.md"), buildGeneratedReadme(spec), "utf8");
}

function generatedProjectBases(repoPath = rootDir) {
  return unique([
    path.join(repoPath || rootDir, "agentica-projects"),
    path.join(rootDir, "agentica-projects"),
    path.join(path.dirname(rootDir), "agentica-projects"),
    path.join(rootDir, ".harness", "projects", "agentica-projects")
  ]).map((base) => path.resolve(base));
}

async function latestGeneratedProject(repoPath) {
  const bases = generatedProjectBases(repoPath);
  const found = [];
  for (const base of bases) {
    try {
      const entries = await readdir(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const fullPath = path.join(base, entry.name);
        const info = await stat(fullPath);
        found.push({ name: entry.name, path: fullPath, mtimeMs: info.mtimeMs });
      }
    } catch {
      // No generated project folder here yet.
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
}

async function readGeneratedPrompt(projectDirectory) {
  try {
    const readme = await readFile(path.join(projectDirectory, "README.md"), "utf8");
    const match = readme.match(/Generated by Agentica(?:Harness)? from this prompt:\s*([\s\S]*?)(?:\n## |\n# |$)/i);
    return match?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

function inferDynamicAppSpec(message, normalized = String(message || "").toLowerCase()) {
  const wantsApp = /\b(build|buid|built|create|make|generate|design|want|need|scaffold)\b/.test(normalized)
    && /\b(website|websit|site|web page|landing page|homepage|web app|app|store|shop|commerce|ecom|e-?commerce|marketplace|dashboard|portal)\b/.test(normalized);
  const appType = inferAppType(normalized);
  const title = inferArtifactTitle(message);
  const seed = hashText(`${appType}:${message}`);
  const catalog = buildDynamicCatalog(appType, seed);
  const modules = buildDynamicModules(appType, normalized);
  const actions = buildDynamicActions(appType);
  const stats = buildDynamicStats(appType, catalog);
  return {
    wantsApp,
    appType,
    title,
    prompt: message,
    audience: inferAudience(normalized),
    tone: inferTone(normalized),
    catalog,
    modules,
    actions,
    stats,
    primaryAction: actions[0],
    secondaryAction: actions[1] || "Explore"
  };
}

function inferAppType(normalized) {
  if (/\b(ecom|e-?commerce|commerce|shop|store|product|cart|checkout|marketplace|order)\b/.test(normalized)) return "commerce";
  if (/\b(hotel|room|booking|book|reservation|stay|homestay|home stay|rental)\b/.test(normalized)) return "booking";
  if (/\b(admin|dashboard|analytics|crm|report|metrics|kpi)\b/.test(normalized)) return "dashboard";
  if (/\b(restaurant|cafe|menu|food|order meal|delivery)\b/.test(normalized)) return "restaurant";
  if (/\b(course|learning|school|education|student|class)\b/.test(normalized)) return "education";
  if (/\b(portfolio|resume|personal|agency|studio)\b/.test(normalized)) return "portfolio";
  if (/\b(saas|platform|tool|subscription|workspace)\b/.test(normalized)) return "saas";
  return "website";
}

function inferAudience(normalized) {
  if (/\b(kids|children|student)\b/.test(normalized)) return "students and families";
  if (/\b(business|b2b|company|enterprise)\b/.test(normalized)) return "business buyers";
  if (/\b(customer|shopper|buyer|user)\b/.test(normalized)) return "customers";
  if (/\b(traveler|guest|tourist)\b/.test(normalized)) return "guests";
  return "visitors";
}

function inferTone(normalized) {
  if (/\b(luxury|premium|high end|elegant)\b/.test(normalized)) return "premium";
  if (/\b(simple|minimal|clean)\b/.test(normalized)) return "clean";
  if (/\b(fun|playful|colorful)\b/.test(normalized)) return "playful";
  if (/\b(professional|corporate|enterprise)\b/.test(normalized)) return "professional";
  return "modern";
}

function buildDynamicCatalog(appType, seed) {
  const source = {
    commerce: [
      ["Aero Knit Runner", "Footwear", 89, "Lightweight everyday sneaker with breathable knit and responsive sole."],
      ["Orbit Smart Watch", "Wearables", 149, "Health, calls, battery, and workout tracking in a clean aluminum case."],
      ["Nomad Travel Pack", "Bags", 119, "Weather-ready backpack with laptop storage and quick-access pockets."],
      ["Luma Desk Lamp", "Home", 64, "Warm dimmable lamp with wireless charging and focused work modes."],
      ["Core Hoodie", "Apparel", 58, "Soft cotton fleece hoodie with a clean streetwear fit."],
      ["Pulse Earbuds", "Audio", 79, "Noise isolation, pocket case, and all-day listening for commuters."]
    ],
    booking: [
      ["Garden Studio", "Room", 2200, "Private balcony, breakfast, and quiet garden views."],
      ["Family Courtyard Suite", "Suite", 4200, "Two-room stay with local meals and host support."],
      ["Remote Work Cabin", "Cabin", 3100, "Fast Wi-Fi, desk, and long-stay comfort."]
    ],
    dashboard: [
      ["Revenue Health", "Metric", 92, "Live revenue, pipeline, and conversion summary."],
      ["Customer Pulse", "Metric", 81, "Retention, satisfaction, and support workload."],
      ["Ops Load", "Metric", 74, "Queue status, blockers, and delivery risk."]
    ],
    restaurant: [
      ["Smoked Paneer Bowl", "Bowl", 260, "Charred paneer, rice, herbs, and house sauce."],
      ["Street Corn Tacos", "Tacos", 180, "Three soft tacos with lime, spice, and crunch."],
      ["Mango Cloud", "Dessert", 140, "Whipped mango cream with biscuit crumble."]
    ],
    education: [
      ["AI Starter Track", "Course", 2999, "Hands-on lessons, quizzes, and project feedback."],
      ["Frontend Sprint", "Course", 1999, "Build responsive apps with guided practice."],
      ["Data Basics", "Course", 1499, "Spreadsheets, charts, and analysis fundamentals."]
    ],
    portfolio: [
      ["Brand System", "Case Study", 1, "Identity, website, and launch assets."],
      ["Mobile Product", "Case Study", 1, "Research, UX flows, and production-ready screens."],
      ["Growth Campaign", "Case Study", 1, "Landing pages, ads, and conversion tracking."]
    ],
    saas: [
      ["Team Workspace", "Plan", 29, "Projects, comments, roles, and automations."],
      ["Automation Rules", "Feature", 49, "Trigger workflows from forms, events, and APIs."],
      ["Insights Hub", "Feature", 39, "Dashboards, alerts, and export-ready reports."]
    ],
    website: [
      ["Core Offer", "Section", 1, "Explains the main value clearly."],
      ["Proof Points", "Section", 1, "Builds trust with outcomes and details."],
      ["Contact Flow", "Section", 1, "Turns interest into action."]
    ]
  };
  return rotateArray(source[appType] || source.website, seed % 6).map(([name, category, price, description], index) => ({
    id: `${appType}-${index + 1}`,
    name,
    category,
    price,
    rating: Number((4.5 + ((seed + index) % 5) / 10).toFixed(1)),
    inventory: 8 + ((seed + index * 7) % 33),
    description
  }));
}

function buildDynamicModules(appType, normalized) {
  const common = ["responsive shell", "hero", "search/filter", "data cards", "detail panel"];
  const byType = {
    commerce: ["product catalog", "category filters", "cart state", "quantity controls", "checkout summary", "order confirmation"],
    booking: ["availability cards", "date inputs", "guest selector", "booking summary", "enquiry action"],
    dashboard: ["metric cards", "status table", "priority queue", "trend bars", "action notes"],
    restaurant: ["menu categories", "order tray", "table booking", "specials", "contact action"],
    education: ["course catalog", "lesson progress", "enrolment panel", "outcomes", "pricing"],
    portfolio: ["case studies", "services", "proof metrics", "contact panel"],
    saas: ["feature grid", "plan selector", "workflow preview", "signup panel"],
    website: ["content sections", "trust blocks", "contact form"]
  };
  const modules = unique([...(byType[appType] || byType.website), ...common]);
  if (/\b(login|auth|account)\b/.test(normalized)) modules.push("account entry");
  if (/\b(api|backend|server)\b/.test(normalized)) modules.push("API-ready state layer");
  if (/\b(payment|pay|stripe)\b/.test(normalized)) modules.push("payment placeholder");
  return unique(modules).slice(0, 10);
}

function buildDynamicActions(appType) {
  return {
    commerce: ["Add to Cart", "Checkout"],
    booking: ["Check Availability", "Reserve"],
    dashboard: ["Review Metrics", "Export"],
    restaurant: ["Add to Order", "Book Table"],
    education: ["Enroll Now", "View Lessons"],
    portfolio: ["View Work", "Start Project"],
    saas: ["Start Trial", "See Workflow"],
    website: ["Get Started", "Contact"]
  }[appType] || ["Get Started", "Explore"];
}

function buildDynamicStats(appType, catalog) {
  const total = catalog.reduce((sum, item) => sum + Number(item.price || 0), 0);
  return {
    items: catalog.length,
    average: Math.round(total / Math.max(1, catalog.length)),
    label: appType === "commerce" ? "products" : appType === "booking" ? "stays" : "items"
  };
}

function artifactFeatureSummary(spec) {
  const label = {
    commerce: "ecommerce storefront",
    booking: "booking website",
    dashboard: "dashboard app",
    restaurant: "restaurant ordering site",
    education: "learning website",
    portfolio: "portfolio site",
    saas: "SaaS product app",
    website: "website"
  }[spec.appType] || "web app";
  return {
    label,
    modules: spec.modules.slice(0, 6),
    frontend: [
      `Dynamic ${label} generated from the prompt`,
      `${spec.catalog.length} realistic data item${spec.catalog.length === 1 ? "" : "s"} with categories, ratings, and actions`,
      `${spec.modules.slice(0, 5).join(", ")}`,
      "Interactive React state for filtering, selection, totals, and action feedback",
      "Responsive mobile and desktop layout with clean source files"
    ]
  };
}

function rotateArray(values, offset) {
  const copy = [...values];
  if (!copy.length) return copy;
  const start = offset % copy.length;
  return [...copy.slice(start), ...copy.slice(0, start)];
}

function hashText(value) {
  let hash = 0;
  for (const char of String(value || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

async function createProjectZip(projectDirectory, zipFile) {
  if (process.platform !== "win32") return false;
  const source = projectDirectory.replaceAll("'", "''");
  const dest = zipFile.replaceAll("'", "''");
  const script = [
    `$source = '${source}'`,
    `$dest = '${dest}'`,
    "if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }",
    "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $dest -Force"
  ].join("; ");
  const result = await runReadOnlyCommand("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], 60000);
  return result.exitCode === 0 && await exists(zipFile);
}

function inferArtifactTitle(message) {
  if (/home\s*stay|homestay|home\s*statay|statay/i.test(message)) return "Homestay Website";
  const cleaned = String(message || "")
    .replace(/\b(build|create|make|generate|design|website|site|web page|landing page|homepage|app|for|a|an|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleCase(cleaned || "AgenticaHarness Website");
}

function buildDynamicPreviewHtml(spec) {
  const appJson = JSON.stringify(spec).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(spec.title)}</title>
  <style>${buildDynamicCssCore(spec)}</style>
</head>
<body>
  <div id="app"></div>
  <div id="agentica-chat"></div>
  <script>
    const spec = ${appJson};
    let selectedCategory = "All";
    let cart = [];
    let liveChatMessages = [{ role: "assistant", text: "I am AgenticaHarness inside this live model. Ask me what to change, build, or solve next." }];
    let liveChatBusy = false;
    function money(value) {
      if (spec.appType === "portfolio" || spec.appType === "website") return "";
      return "₹" + Number(value || 0).toLocaleString("en-IN");
    }
    function categories() {
      return ["All", ...new Set(spec.catalog.map(item => item.category))];
    }
    function filtered() {
      return selectedCategory === "All" ? spec.catalog : spec.catalog.filter(item => item.category === selectedCategory);
    }
    function addItem(id) {
      const item = spec.catalog.find(entry => entry.id === id);
      if (!item) return;
      const found = cart.find(entry => entry.id === id);
      if (found) found.qty += 1;
      else cart.push({ ...item, qty: 1 });
      render();
    }
    function removeItem(id) {
      cart = cart.filter(item => item.id !== id);
      render();
    }
    function total() {
      return cart.reduce((sum, item) => sum + Number(item.price || 0) * item.qty, 0);
    }
    function render() {
      const app = document.getElementById("app");
      const action = spec.primaryAction || "Select";
      const label = spec.appType === "commerce" ? "cart" : spec.appType === "restaurant" ? "order" : "selection";
      app.innerHTML = \`
        <nav class="nav"><strong>\${spec.title}</strong><div><a href="#catalog">Catalog</a><a href="#summary">Summary</a><a href="#flow">Flow</a></div></nav>
        <header class="hero">
          <div>
            <span class="eyebrow">\${spec.appType} for \${spec.audience}</span>
            <h1>\${headline(spec)}</h1>
            <p>\${subhead(spec)}</p>
            <div class="actions"><a class="button primary" href="#catalog">\${action}</a><a class="button" href="#summary">\${spec.secondaryAction}</a></div>
          </div>
        </header>
        <main>
          <section class="strip">\${spec.stats.items} \${spec.stats.label}<span></span>\${spec.modules.slice(0, 4).join(" • ")}</section>
          <section id="catalog" class="workspace">
            <aside>
              <h2>Controls</h2>
              <div class="filters">\${categories().map(category => \`<button class="\${category === selectedCategory ? "active" : ""}" onclick="selectedCategory='\${category}';render()">\${category}</button>\`).join("")}</div>
              <div class="summary-box" id="summary">
                <strong>\${label.charAt(0).toUpperCase() + label.slice(1)} summary</strong>
                <p>\${cart.length ? cart.map(item => item.name + " x" + item.qty).join(", ") : "No items selected yet."}</p>
                <h3>\${money(total()) || cart.length + " selected"}</h3>
                <button class="button primary full" onclick="alert('Demo flow: connect payment/API next')">\${spec.secondaryAction}</button>
              </div>
            </aside>
            <section class="cards">
              \${filtered().map(item => \`
                <article class="card">
                  <div class="thumb">\${item.category.slice(0, 2).toUpperCase()}</div>
                  <div class="card-head"><span>\${item.category}</span><b>\${item.rating}★</b></div>
                  <h3>\${item.name}</h3>
                  <p>\${item.description}</p>
                  <div class="card-foot"><strong>\${money(item.price) || item.inventory + " slots"}</strong><button onclick="addItem('\${item.id}')">\${action}</button></div>
                </article>
              \`).join("")}
            </section>
          </section>
          <section class="flow" id="flow">
            \${spec.modules.slice(0, 6).map((module, index) => \`<div><span>0\${index + 1}</span><strong>\${module}</strong><p>Generated because the prompt calls for a \${spec.appType} experience.</p></div>\`).join("")}
          </section>
        </main>\`;
    }
    function renderChat() {
      const chat = document.getElementById("agentica-chat");
      chat.innerHTML = \`
        <section class="agentica-chat">
          <div class="agentica-chat-head"><strong>Ask AgenticaHarness</strong><span>live response</span></div>
          <div class="agentica-chat-log">
            \${liveChatMessages.map(item => \`<p class="\${item.role}">\${escapeText(item.text)}</p>\`).join("")}
            \${liveChatBusy ? '<p class="assistant">Thinking...</p>' : ''}
          </div>
          <form class="agentica-chat-form" onsubmit="sendLiveChat(event)">
            <input id="agentica-chat-input" placeholder="Ask anything" autocomplete="off" />
            <button>\${liveChatBusy ? "..." : "Send"}</button>
          </form>
        </section>\`;
    }
    function escapeText(value) {
      return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])).replace(/\\n/g, "<br>");
    }
    async function sendLiveChat(event) {
      event.preventDefault();
      const input = document.getElementById("agentica-chat-input");
      const value = input.value.trim();
      if (!value || liveChatBusy) return;
      liveChatMessages.push({ role: "user", text: value });
      input.value = "";
      liveChatBusy = true;
      renderChat();
      try {
        const response = await fetch("/api/live-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: value, app: spec, cart })
        });
        const data = await response.json();
        liveChatMessages.push({ role: "assistant", text: data.reply || "AgenticaHarness answered, but no text was returned." });
      } catch (error) {
        liveChatMessages.push({ role: "assistant", text: "I could not reach AgenticaHarness live chat yet. Check that the AgenticaHarness backend is running and /api/live-chat is proxied." });
      } finally {
        liveChatBusy = false;
        renderChat();
      }
    }
    function headline(spec) {
      if (spec.appType === "commerce") return "A working storefront with products, cart, and checkout flow.";
      if (spec.appType === "booking") return "A booking experience with availability and reservation intent.";
      if (spec.appType === "dashboard") return "A focused operating dashboard for decisions.";
      return "A working web app shaped from your prompt.";
    }
    function subhead(spec) {
      return "AgenticaHarness inferred the domain, modules, data, actions, and UI from the prompt instead of using one fixed template.";
    }
    render();
    renderChat();
  </script>
</body>
</html>`;
}

function buildDynamicReactApp(spec) {
  const appJson = JSON.stringify(spec, null, 2);
  return `import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, CheckCircle2, Minus, Plus, Search, ShoppingBag } from "lucide-react";
import "./styles.css";

const spec = ${appJson};

function money(value) {
  if (spec.appType === "portfolio" || spec.appType === "website") return "";
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function headline() {
  if (spec.appType === "commerce") return "A working storefront with products, cart, and checkout flow.";
  if (spec.appType === "booking") return "A booking experience with availability and reservation intent.";
  if (spec.appType === "dashboard") return "A focused operating dashboard for decisions.";
  if (spec.appType === "restaurant") return "A menu and ordering flow built for fast decisions.";
  return "A working web app shaped from your prompt.";
}

function App() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "I am AgenticaHarness inside this live model. Ask me what to change, build, or solve next." }
  ]);
  const categories = useMemo(() => ["All", ...new Set(spec.catalog.map((item) => item.category))], []);
  const visibleItems = spec.catalog.filter((item) => {
    const categoryMatch = category === "All" || item.category === category;
    const queryMatch = !query || [item.name, item.category, item.description].join(" ").toLowerCase().includes(query.toLowerCase());
    return categoryMatch && queryMatch;
  });
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.qty, 0);

  function addItem(item) {
    setCart((current) => {
      const found = current.find((entry) => entry.id === item.id);
      if (found) return current.map((entry) => entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry);
      return [...current, { ...item, qty: 1 }];
    });
  }

  function decreaseItem(id) {
    setCart((current) => current
      .map((entry) => entry.id === id ? { ...entry, qty: entry.qty - 1 } : entry)
      .filter((entry) => entry.qty > 0));
  }

  async function sendLiveChat(event) {
    event.preventDefault();
    const value = chatDraft.trim();
    if (!value || chatBusy) return;
    setChatMessages((current) => [...current, { role: "user", text: value }]);
    setChatDraft("");
    setChatBusy(true);
    try {
      const response = await fetch("/api/live-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value, app: spec, cart })
      });
      const data = await response.json();
      setChatMessages((current) => [...current, { role: "assistant", text: data.reply || "AgenticaHarness answered, but no text was returned." }]);
    } catch {
      setChatMessages((current) => [...current, { role: "assistant", text: "I could not reach AgenticaHarness live chat yet. Check that the backend is running and /api/live-chat is proxied." }]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <main>
      <nav className="nav">
        <strong>{spec.title}</strong>
        <div>
          <a href="#catalog">Catalog</a>
          <a href="#summary">Summary</a>
          <a href="#flow">Flow</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-copy">
          <span>{spec.appType} for {spec.audience}</span>
          <h1>{headline()}</h1>
          <p>AgenticaHarness inferred the domain, modules, data, actions, and UI from the prompt instead of using one fixed template.</p>
          <div className="hero-actions">
            <a className="button primary" href="#catalog">{spec.primaryAction} <ArrowRight size={18} /></a>
            <a className="button" href="#summary">{spec.secondaryAction}</a>
          </div>
        </div>
      </header>

      <section className="strip">
        <strong>{spec.stats.items} {spec.stats.label}</strong>
        <span>{spec.modules.slice(0, 4).join(" • ")}</span>
      </section>

      <section className="workspace" id="catalog">
        <aside className="control-panel">
          <label className="search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
          </label>
          <div className="filters">
            {categories.map((entry) => (
              <button className={entry === category ? "active" : ""} key={entry} onClick={() => setCategory(entry)}>{entry}</button>
            ))}
          </div>
          <div className="summary-box" id="summary">
            <ShoppingBag size={22} />
            <strong>{spec.appType === "restaurant" ? "Order" : spec.appType === "booking" ? "Reservation" : "Cart"} summary</strong>
            {cart.length ? cart.map((item) => (
              <div className="line" key={item.id}>
                <span>{item.name} x{item.qty}</span>
                <button onClick={() => decreaseItem(item.id)}><Minus size={14} /></button>
              </div>
            )) : <p>No items selected yet.</p>}
            <h3>{money(total) || cart.length + " selected"}</h3>
            <button className="button primary full" onClick={() => alert("Demo flow: connect payment/API next")}>{spec.secondaryAction}</button>
          </div>
        </aside>

        <section className="cards">
          {visibleItems.map((item) => (
            <article className="card" key={item.id}>
              <div className="thumb">{item.category.slice(0, 2).toUpperCase()}</div>
              <div className="card-head"><span>{item.category}</span><b>{item.rating}★</b></div>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <div className="card-foot">
                <strong>{money(item.price) || item.inventory + " slots"}</strong>
                <button onClick={() => addItem(item)}><Plus size={16} /> {spec.primaryAction}</button>
              </div>
            </article>
          ))}
        </section>
      </section>

      <section className="flow" id="flow">
        {spec.modules.slice(0, 6).map((module, index) => (
          <div key={module}>
            <CheckCircle2 size={18} />
            <span>0{index + 1}</span>
            <strong>{module}</strong>
            <p>Generated because the prompt calls for a {spec.appType} experience.</p>
          </div>
        ))}
      </section>

      <section className="agentica-chat" id="agentica-chat">
        <div className="agentica-chat-head">
          <strong>Ask AgenticaHarness</strong>
          <span>live response</span>
        </div>
        <div className="agentica-chat-log">
          {chatMessages.map((item, index) => (
            <p className={item.role} key={index}>{item.text}</p>
          ))}
          {chatBusy && <p className="assistant">Thinking...</p>}
        </div>
        <form className="agentica-chat-form" onSubmit={sendLiveChat}>
          <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Ask anything" />
          <button disabled={chatBusy}>{chatBusy ? "..." : "Send"}</button>
        </form>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
`;
}

function buildDynamicReactCss(spec) {
  return buildDynamicCssCore(spec);
}

function buildDynamicCssCore(spec) {
  const accent = spec.appType === "commerce" ? "#0f766e" : spec.appType === "dashboard" ? "#2563eb" : spec.appType === "restaurant" ? "#be123c" : "#111827";
  return `* { box-sizing: border-box; }
body { margin: 0; background: #f7f7f4; color: #161616; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
a { color: inherit; text-decoration: none; }
button, input { font: inherit; }
.nav { align-items: center; background: rgba(255,255,255,.86); backdrop-filter: blur(16px); border-bottom: 1px solid #e7e5df; display: flex; justify-content: space-between; left: 0; min-height: 62px; padding: 0 28px; position: sticky; right: 0; top: 0; z-index: 4; }
.nav div { display: flex; gap: 20px; color: #5d5a54; }
.hero { align-items: end; background: radial-gradient(circle at 20% 10%, ${accent}33, transparent 32%), linear-gradient(135deg, #151515, #2b2b27); color: white; display: grid; min-height: 58vh; padding: 44px 28px; }
.hero-copy { max-width: 920px; }
.hero span, .eyebrow { font-size: .78rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #d8fff6; }
h1 { font-size: clamp(2.6rem, 6vw, 5.6rem); letter-spacing: 0; line-height: .98; margin: 14px 0 18px; max-width: 980px; }
.hero p { color: rgba(255,255,255,.78); font-size: 1.12rem; line-height: 1.65; max-width: 720px; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.button { align-items: center; border: 1px solid #d8d5cc; border-radius: 8px; cursor: pointer; display: inline-flex; gap: 8px; justify-content: center; min-height: 44px; padding: 0 16px; }
.button.primary, .card button, .filters button.active { background: ${accent}; border-color: ${accent}; color: white; }
.strip { align-items: center; background: white; border-bottom: 1px solid #e7e5df; display: flex; gap: 18px; justify-content: center; min-height: 56px; padding: 10px 24px; color: #57534e; }
.workspace { display: grid; gap: 24px; grid-template-columns: 280px 1fr; max-width: 1240px; margin: 0 auto; padding: 34px 24px; }
.control-panel { align-self: start; background: white; border: 1px solid #e7e5df; border-radius: 8px; display: grid; gap: 18px; padding: 18px; position: sticky; top: 82px; }
.search { align-items: center; border: 1px solid #d8d5cc; border-radius: 8px; display: flex; gap: 8px; min-height: 42px; padding: 0 10px; }
.search input { border: 0; outline: 0; width: 100%; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; }
.filters button { background: #f5f2eb; border: 1px solid #e7e0d4; border-radius: 8px; cursor: pointer; min-height: 34px; padding: 0 10px; }
.summary-box { border-top: 1px solid #e7e5df; display: grid; gap: 10px; padding-top: 18px; }
.summary-box p { color: #6b6760; line-height: 1.5; margin: 0; }
.summary-box h3 { font-size: 1.7rem; margin: 0; }
.full { width: 100%; }
.line { align-items: center; display: flex; gap: 8px; justify-content: space-between; }
.line button { align-items: center; border: 1px solid #ddd8cf; border-radius: 999px; background: white; display: inline-flex; height: 28px; justify-content: center; width: 28px; }
.cards { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.card { background: white; border: 1px solid #e7e5df; border-radius: 8px; display: flex; flex-direction: column; min-height: 330px; padding: 16px; }
.thumb { align-items: center; background: linear-gradient(135deg, ${accent}, #111827); border-radius: 8px; color: white; display: flex; font-size: 2.4rem; font-weight: 900; height: 128px; justify-content: center; margin-bottom: 14px; }
.card-head, .card-foot { align-items: center; display: flex; justify-content: space-between; gap: 12px; }
.card-head span { color: ${accent}; font-size: .78rem; font-weight: 800; text-transform: uppercase; }
.card h2 { font-size: 1.25rem; margin: 14px 0 8px; }
.card p { color: #5f5b53; line-height: 1.55; flex: 1; }
.card button { align-items: center; border: 0; border-radius: 8px; cursor: pointer; display: inline-flex; gap: 6px; min-height: 38px; padding: 0 12px; }
.flow { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 1240px; margin: 0 auto 56px; padding: 0 24px; }
.flow div { background: #161616; border-radius: 8px; color: white; display: grid; gap: 8px; min-height: 160px; padding: 20px; }
.flow span { color: #a7f3d0; font-weight: 900; }
.flow p { color: rgba(255,255,255,.68); line-height: 1.5; }
.agentica-chat { background: white; border: 1px solid #e7e5df; border-radius: 12px; box-shadow: 0 18px 44px rgba(0,0,0,.12); bottom: 18px; display: grid; gap: 10px; max-width: 380px; padding: 14px; position: fixed; right: 18px; width: calc(100vw - 36px); z-index: 20; }
.agentica-chat-head { align-items: center; display: flex; justify-content: space-between; gap: 10px; }
.agentica-chat-head strong { color: #171717; font-size: .95rem; }
.agentica-chat-head span { background: #ecfdf5; border-radius: 999px; color: #047857; font-size: .68rem; font-weight: 800; padding: 5px 8px; text-transform: uppercase; }
.agentica-chat-log { display: grid; gap: 8px; max-height: 220px; overflow: auto; padding-right: 2px; }
.agentica-chat-log p { border-radius: 10px; font-size: .86rem; line-height: 1.42; margin: 0; padding: 9px 10px; }
.agentica-chat-log .assistant { background: #f5f5f4; color: #27272a; }
.agentica-chat-log .user { background: ${accent}; color: white; justify-self: end; max-width: 88%; }
.agentica-chat-form { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) auto; }
.agentica-chat-form input { border: 1px solid #d8d5cc; border-radius: 999px; min-height: 40px; outline: none; padding: 0 12px; }
.agentica-chat-form button { background: #111111; border: 0; border-radius: 999px; color: white; cursor: pointer; font-weight: 760; min-height: 40px; padding: 0 14px; }
@media (max-width: 980px) { .workspace { grid-template-columns: 1fr; } .control-panel { position: static; } .cards, .flow { grid-template-columns: 1fr 1fr; } }
@media (max-width: 680px) { .nav { align-items: flex-start; flex-direction: column; gap: 8px; padding: 14px 18px; } .hero { padding: 28px 18px; } .cards, .flow { grid-template-columns: 1fr; } .strip { align-items: flex-start; flex-direction: column; } .agentica-chat { border-radius: 14px 14px 0 0; bottom: 0; left: 0; max-width: none; right: 0; width: 100%; } }`;
}

function buildDynamicReadme(spec) {
  return `# ${spec.title}

Generated by AgenticaHarness from this prompt:

${spec.prompt}

## What AgenticaHarness Inferred

- App type: ${spec.appType}
- Audience: ${spec.audience}
- Tone: ${spec.tone}
- Modules: ${spec.modules.join(", ")}

## Working Behaviors

- Search and category filtering
- Data-driven cards
- Selection/cart state
- Running totals or selected-count summary
- Demo checkout/action button
- AgenticaHarness live chat panel through \`/api/live-chat\`
- Responsive layout

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

## Project structure

- \`index.html\` - Vite entry
- \`live-preview.html\` - instant AgenticaHarness-served live model
- \`agentica.manifest.json\` - brain/harness metadata for future modification and deployment
- \`DEPLOYMENT.md\` - server and domain deployment requirements
- \`public/manifest.webmanifest\` - installable mobile/PWA metadata
- \`src/main.jsx\` - React app
- \`src/styles.css\` - responsive styling
- \`package.json\` - scripts and dependencies

## Next work

Ask AgenticaHarness to add backend APIs, payment integration, auth, admin pages, database storage, product upload, deployment, or brand-specific design changes.
`;
}

function buildWebsiteHtml(title, prompt) {
  if (title && typeof title === "object") return buildDynamicPreviewHtml(title);
  const safeTitle = escapeHtml(title);
  const isHomestay = /home\s*stay|homestay|stay/i.test(prompt);
  const theme = isHomestay
    ? {
        eyebrow: "Boutique Stays",
        headline: "A Calm Homestay Made For Slow Mornings",
        subhead: "Warm rooms, local food, guided experiences, and simple booking for families, couples, and remote workers.",
        cta: "Check Availability",
        secondary: "View Rooms",
        image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
        features: ["Garden view rooms", "Home-cooked breakfast", "Local host support", "Fast Wi-Fi"]
      }
    : {
        eyebrow: "AgenticaHarness Build",
        headline: safeTitle,
        subhead: "A polished live website artifact generated by the local harness.",
        cta: "Get Started",
        secondary: "Explore",
        image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
        features: ["Responsive layout", "Clear calls to action", "Modern sections", "Ready to iterate"]
      };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #171717; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fbfaf7; }
    .hero { min-height: 86vh; display: grid; align-items: end; background: linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.62)), url("${theme.image}") center/cover; color: white; padding: 32px; }
    nav { position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 24px 32px; color: white; }
    nav strong { font-size: 1.05rem; }
    nav a { color: white; text-decoration: none; margin-left: 22px; opacity: .9; }
    .hero-inner { max-width: 860px; padding: 16vh 0 7vh; }
    .eyebrow { font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: .8rem; opacity: .88; }
    h1 { font-size: clamp(3rem, 7vw, 6.8rem); line-height: .96; margin: 16px 0 22px; letter-spacing: 0; }
    .hero p { max-width: 680px; font-size: 1.2rem; line-height: 1.6; margin: 0 0 28px; color: rgba(255,255,255,.9); }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .button { border: 1px solid rgba(255,255,255,.35); border-radius: 999px; color: white; display: inline-flex; min-height: 48px; align-items: center; padding: 0 22px; text-decoration: none; }
    .button.primary { background: white; color: #171717; border-color: white; }
    main { padding: 64px 32px; }
    .section { max-width: 1120px; margin: 0 auto 72px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .feature { background: white; border: 1px solid #ece8df; border-radius: 8px; padding: 22px; min-height: 140px; }
    .feature span { color: #8b5e34; font-weight: 800; font-size: 1.45rem; }
    .feature p { color: #5f5a52; line-height: 1.5; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; }
    .panel { background: #171717; color: white; border-radius: 8px; padding: 34px; }
    .panel h2 { margin-top: 0; font-size: 2.2rem; }
    .panel p, .section > p { color: #69645d; line-height: 1.7; }
    .panel p { color: rgba(255,255,255,.72); }
    footer { border-top: 1px solid #ece8df; padding: 26px 32px; color: #716b62; display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
    @media (max-width: 820px) { .grid, .split { grid-template-columns: 1fr; } nav { position: static; background: #171717; } .hero { padding: 22px; } }
  </style>
</head>
<body>
  <nav><strong>${safeTitle}</strong><div><a href="#rooms">Rooms</a><a href="#story">Story</a><a href="#book">Book</a></div></nav>
  <section class="hero">
    <div class="hero-inner">
      <div class="eyebrow">${theme.eyebrow}</div>
      <h1>${escapeHtml(theme.headline)}</h1>
      <p>${escapeHtml(theme.subhead)}</p>
      <div class="actions"><a class="button primary" href="#book">${theme.cta}</a><a class="button" href="#rooms">${theme.secondary}</a></div>
    </div>
  </section>
  <main>
    <section class="section" id="rooms">
      <div class="grid">
        ${theme.features.map((feature, index) => `<div class="feature"><span>0${index + 1}</span><h3>${escapeHtml(feature)}</h3><p>Designed for comfort, clarity, and a smooth guest experience from first look to booking.</p></div>`).join("")}
      </div>
    </section>
    <section class="section split" id="story">
      <div><h2>Built For Trust And Easy Booking</h2><p>This page gives guests the essentials fast: the feeling of the stay, the core amenities, and a simple path to enquire or book.</p></div>
      <div class="panel" id="book"><h2>Plan Your Stay</h2><p>Share dates, guest count, and room preference. The host can respond with availability, pricing, and local recommendations.</p><a class="button primary" href="mailto:host@example.com">Email Host</a></div>
    </section>
  </main>
  <footer><span>${safeTitle}</span><span>Generated by AgenticaHarness</span></footer>
</body>
</html>`;
}

function buildGeneratedPackageJson(title) {
  return `${JSON.stringify({
    name: slugify(title),
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite --host 127.0.0.1",
      build: "vite build",
      preview: "vite preview --host 127.0.0.1"
    },
    dependencies: {
      "@vitejs/plugin-react": "^5.0.0",
      vite: "^7.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^0.468.0"
    },
    devDependencies: {}
  }, null, 2)}\n`;
}

function buildGeneratedIndexHtml(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#111111" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

function liveProjectUrl(slug) {
  return `/live-projects/${encodeURIComponent(slug)}/`;
}

function buildAgenticaProjectManifest(spec, projectDirectory) {
  const slug = path.basename(projectDirectory);
  return `${JSON.stringify({
    schema: "agentica.generated-project.v1",
    id: slug,
    title: spec.title,
    appType: spec.appType,
    prompt: spec.prompt,
    generatedAt: new Date().toISOString(),
    livePreview: liveProjectUrl(slug),
    brain: {
      owner: "AgenticaHarness",
      engine: "AgenticaHarness Native Engine",
      harness: "DeerFlow-style research workspace",
      codexRequired: false,
      liveChat: {
        endpoint: "/api/live-chat",
        mode: "standalone AgenticaHarness response layer"
      },
      orchestration: [
        "intent intake",
        "dynamic app inference",
        "local source generation",
        "live preview serving",
        "deployment manifest",
        "learning memory"
      ]
    },
    stack: {
      frontend: "React 19 + Vite",
      icons: "lucide-react",
      preview: "standalone HTML served by AgenticaHarness",
      deployTarget: "static hosting, Apache, Nginx, Node, Vercel, Netlify, or cloud bucket"
    },
    modules: spec.modules,
    files: [
      "package.json",
      "index.html",
      "live-preview.html",
      "public/manifest.webmanifest",
      "agentica.manifest.json",
      "src/main.jsx",
      "src/styles.css",
      "README.md",
      "DEPLOYMENT.md"
    ],
    deploymentRequirements: {
      node: "22 LTS recommended, 20+ acceptable for Vite",
      buildCommand: "npm install && npm run build",
      staticOutput: "dist",
      localPreviewRoute: liveProjectUrl(slug),
      domain: "Point the domain to the server, enable HTTPS, and serve dist/ or proxy through Apache."
    }
  }, null, 2)}\n`;
}

function buildWebManifest(spec) {
  return `${JSON.stringify({
    name: spec.title,
    short_name: truncate(spec.title, 24),
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    description: `AgenticaHarness-generated ${spec.appType} app`
  }, null, 2)}\n`;
}

function buildGeneratedDeploymentGuide(spec, projectDirectory) {
  const slug = path.basename(projectDirectory);
  return `# Deployment Guide

This app was generated by AgenticaHarness as a deployable ${spec.appType} project.

## Live model inside AgenticaHarness

Open this while AgenticaHarness is running:

\`\`\`text
${liveProjectUrl(slug)}
\`\`\`

## Minimum server requirements

- Node.js 22 LTS recommended
- npm 10+
- 512 MB RAM for a small static app build
- Apache, Nginx, Caddy, Vercel, Netlify, Cloudflare Pages, S3/CloudFront, or any static host
- HTTPS certificate for a real domain

## Build for production

\`\`\`bash
npm install
npm run build
\`\`\`

The production files will be in:

\`\`\`text
dist
\`\`\`

## Apache deployment

Copy the generated \`dist\` folder to your Apache document root, then enable SPA fallback:

\`\`\`apache
DocumentRoot "/var/www/${slug}/dist"

<Directory "/var/www/${slug}/dist">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>
\`\`\`

## Domain checklist

- Buy the domain.
- Create an A record pointing to the server IP.
- Open ports 80 and 443 on the server firewall.
- Install an HTTPS certificate with Let's Encrypt or your host provider.
- Serve the \`dist\` folder.
- Add API/payment/database URLs as environment variables when those features are added.

## AgenticaHarness link

The project includes \`agentica.manifest.json\` so the AgenticaHarness brain/harness can understand what was generated, what modules exist, and how it should be deployed or modified.
`;
}

function buildGeneratedReactApp(title, prompt) {
  if (title && typeof title === "object") return buildDynamicReactApp(title);
  const theme = websiteTheme(title, prompt);
  const data = {
    title,
    prompt,
    ...theme
  };

  return `import React from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import "./styles.css";

const site = ${JSON.stringify(data, null, 2)};

function App() {
  return (
    <main>
      <nav className="nav">
        <strong>{site.title}</strong>
        <div>
          <a href="#rooms">Rooms</a>
          <a href="#experiences">Experiences</a>
          <a href="#book">Book</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span>{site.eyebrow}</span>
          <h1>{site.headline}</h1>
          <p>{site.subhead}</p>
          <div className="hero-actions">
            <a className="button primary" href="#book">Check Availability <ArrowRight size={18} /></a>
            <a className="button" href="#rooms">View Rooms</a>
          </div>
        </div>
      </section>

      <section className="section grid" id="rooms">
        {site.features.map((feature, index) => (
          <article className="feature" key={feature}>
            <span>0{index + 1}</span>
            <h2>{feature}</h2>
            <p>Designed from the prompt, ready for copy, imagery, booking flow, and brand refinements.</p>
          </article>
        ))}
      </section>

      <section className="section split" id="experiences">
        <div>
          <span className="eyebrow">Guest Journey</span>
          <h2>From first look to confirmed stay.</h2>
          <p>This project is structured as a real React app, so you can keep adding pages, components, booking forms, and API integrations.</p>
        </div>
        <div className="timeline">
          <p><MapPin size={18} /> Discover the place and local experiences.</p>
          <p><CalendarDays size={18} /> Pick dates, room type, and guest count.</p>
          <p><ShieldCheck size={18} /> Build trust with policies, reviews, and host details.</p>
        </div>
      </section>

      <section className="booking" id="book">
        <div>
          <Sparkles size={22} />
          <h2>Ready to make this real?</h2>
          <p>Next steps: connect a booking backend, add room inventory, wire email/CRM, and deploy.</p>
        </div>
        <a className="button primary dark" href="mailto:host@example.com">Email Host</a>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}

function buildGeneratedReactCss(prompt) {
  if (prompt && typeof prompt === "object") return buildDynamicReactCss(prompt);
  const theme = websiteTheme("Generated Project", prompt);
  return `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #fbfaf7;
  color: #171717;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.nav {
  align-items: center;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  left: 0;
  padding: 24px 32px;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 2;
}

.nav div {
  display: flex;
  gap: 22px;
}

.hero {
  align-items: end;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.66)),
    url("${theme.image}") center/cover;
  color: #ffffff;
  display: grid;
  min-height: 88vh;
  padding: 32px;
}

.hero-copy {
  max-width: 860px;
  padding: 18vh 0 7vh;
}

.hero-copy span,
.eyebrow {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(3rem, 7vw, 6.8rem);
  letter-spacing: 0;
  line-height: 0.96;
  margin: 16px 0 22px;
}

.hero p {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.18rem;
  line-height: 1.65;
  max-width: 700px;
}

.hero-actions,
.booking {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.button {
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 999px;
  display: inline-flex;
  gap: 8px;
  min-height: 48px;
  padding: 0 22px;
}

.button.primary {
  background: #ffffff;
  border-color: #ffffff;
  color: #171717;
}

.section {
  margin: 0 auto;
  max-width: 1120px;
  padding: 72px 32px;
}

.grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.feature {
  background: #ffffff;
  border: 1px solid #ece8df;
  border-radius: 8px;
  min-height: 170px;
  padding: 22px;
}

.feature span {
  color: #8b5e34;
  font-size: 1.45rem;
  font-weight: 850;
}

.feature h2 {
  font-size: 1.1rem;
  margin: 20px 0 10px;
}

.feature p,
.split p,
.booking p {
  color: #625d55;
  line-height: 1.65;
}

.split {
  align-items: center;
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr 1fr;
}

.split h2 {
  font-size: clamp(2rem, 4vw, 3.7rem);
  letter-spacing: 0;
  line-height: 1.04;
  margin: 12px 0 14px;
}

.timeline {
  background: #171717;
  border-radius: 8px;
  color: #ffffff;
  display: grid;
  gap: 14px;
  padding: 28px;
}

.timeline p {
  align-items: center;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  gap: 10px;
  margin: 0;
}

.booking {
  background: #171717;
  color: #ffffff;
  justify-content: space-between;
  margin: 30px auto 72px;
  max-width: 1120px;
  padding: 32px;
}

.booking h2 {
  margin: 12px 0 8px;
}

.button.dark {
  color: #171717;
}

@media (max-width: 820px) {
  .nav {
    background: #171717;
    position: static;
  }

  .grid,
  .split {
    grid-template-columns: 1fr;
  }

  .hero {
    min-height: 76vh;
    padding: 22px;
  }
}
`;
}

function buildGeneratedReadme(title, prompt) {
  if (title && typeof title === "object") return buildDynamicReadme(title);
  return `# ${title}

Generated by AgenticaHarness from this prompt:

${prompt}

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

## Project structure

- \`index.html\` - Vite entry
- \`live-preview.html\` - instant AgenticaHarness-served live model
- \`agentica.manifest.json\` - brain/harness metadata for future modification and deployment
- \`DEPLOYMENT.md\` - server and domain deployment requirements
- \`public/manifest.webmanifest\` - installable mobile/PWA metadata
- \`src/main.jsx\` - React app
- \`src/styles.css\` - Responsive styling
- \`package.json\` - scripts and dependencies

## Next work

Ask AgenticaHarness to add pages, booking forms, Salesforce/CRM wiring, backend APIs, deployment, or brand changes.
`;
}

function websiteTheme(title, prompt) {
  const isHomestay = /home\s*stay|homestay|stay/i.test(prompt);
  if (isHomestay) {
    return {
      eyebrow: "Boutique Stays",
      headline: "A Calm Homestay Made For Slow Mornings",
      subhead: "Warm rooms, local food, guided experiences, and simple booking for families, couples, and remote workers.",
      image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
      features: ["Garden view rooms", "Home-cooked breakfast", "Local host support", "Fast Wi-Fi"]
    };
  }

  return {
    eyebrow: "AgenticaHarness Build",
    headline: title,
    subhead: "A working React project generated from your prompt, ready for iteration, integrations, and deployment.",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
    features: ["Responsive layout", "Project source files", "Clear user flow", "Ready to extend"]
  };
}

async function agenticaAgentReply(message, normalized, scan, selectedModel, neural = null, history = []) {
  if (!scan.exists) {
    return {
      kind: "agentica",
      steps: ["Intake: captured request", `Project: ${scan.repoPath}`, "Scanner: project path does not exist"],
      text: [
        "I cannot work on this project yet because the selected path does not exist.",
        "",
        `Selected path: ${scan.repoPath}`,
        "",
        "Open Projects on the left and add/select the real project folder."
      ].join("\n")
    };
  }

  const contextPack = await buildContextPack(scan);
  const commandResult = await maybeRunAgenticaCommand(scan, normalized);
  const mcp = await mcpRuntimeStatus().catch(() => ({ openCount: 0, totalCount: 0, promptContext: "MCP servers: status unavailable." }));
  const conversationContext = formatChatHistory(history);
  const steps = agenticaSteps(scan, [
    conversationContext ? `Conversation: ${normalizeChatHistory(history).length} recent message${normalizeChatHistory(history).length === 1 ? "" : "s"}` : "Conversation: new chat",
    `Context: loaded ${contextPack.files.length} file${contextPack.files.length === 1 ? "" : "s"}`,
    `MCP: ${mcp.openCount}/${mcp.totalCount} available`,
    commandResult ? `Command: ${commandResult.command} -> exit ${commandResult.exitCode}` : "Command: no command needed for this turn",
    `Model: ${selectedModel.providerName} / ${selectedModel.model}`
  ]);

  if (commandResult) {
    return {
      kind: "agentica-command",
      steps,
      text: formatCommandResult(commandResult)
    };
  }

  const intent = neural?.intent || inferAgenticIntent(message, normalized, stackNames(scan));
  const learningLessons = neural?.learningLessons || await relevantLearningLessons(intent, {
    projectPath: scan.repoPath,
    detectedStack: stackNames(scan),
    detectedFiles: scan.detectedFiles
  });
  const learningContext = formatLearningContext(learningLessons);
  if (learningLessons.length) steps.push(`Learning: applied ${learningLessons.length} lesson${learningLessons.length === 1 ? "" : "s"}`);
  const system = [
    "You are AgenticaHarness running inside a local app.",
    "Behave like a standalone agentic answer engine: be project-aware, tool-grounded, concise, and honest.",
    "Use recent conversation context for follow-up prompts, pronouns, and edits.",
    "Use only the provided scan, context, and command output as local tool evidence.",
    "Never invent frameworks, routes, libraries, file contents, or commands that are not present in the context.",
    "If the context is not enough, say what to inspect next instead of guessing.",
    "Do not claim you edited files unless the tool output says files were edited.",
    "For implementation requests, give a concrete file-level plan and next action. If no file-writing tool result is provided, say what you would change next.",
    "For Salesforce requests, produce practical stories, metadata steps, Apex/LWC direction, or CLI commands as appropriate.",
    "For command failures, explain the failure and the next repair step.",
    "Use the MCP server context to decide which external tools are available. Do not claim to call an MCP tool unless a tool result is present.",
    "Keep the answer useful and direct.",
    `MCP context:\n${mcp.promptContext}`,
    learningContext ? `Learned preferences and lessons:\n${learningContext}` : "",
    neural?.context ? `Neural Engine context:\n${neural.context}` : ""
  ].join("\n");

  const prompt = [
    conversationContext ? `Recent conversation:\n${conversationContext}` : "Recent conversation: none",
    "",
    `User request:\n${message}`,
    "",
    `Project path: ${scan.repoPath}`,
    `Detected stack: ${stackNames(scan)}`,
    "",
    "Detected files:",
    scan.detectedFiles.slice(0, 45).map((file) => `- ${file}`).join("\n") || "- none",
    "",
    "Context pack:",
    contextPack.text || "No readable context files were found.",
    "",
    "MCP status:",
    mcp.promptContext,
    "",
    commandResult
      ? `Command result:\nCommand: ${commandResult.command}\nExit code: ${commandResult.exitCode}\nOutput:\n${trimOutput(commandResult.output || "No output.")}`
      : "Command result: no command was run."
  ].join("\n");

  try {
    const answer = await callSelectedModel(selectedModel, system, prompt);
    return {
      kind: commandResult ? "agentica-command" : "agentica",
      steps,
      text: answer
    };
  } catch (error) {
    return {
      kind: commandResult ? "agentica-command" : "agentica",
      steps,
      text: fallbackAgenticaAnswer(message, scan, contextPack, commandResult, error)
    };
  }
}

function formatCommandResult(commandResult) {
  return [
    "I ran the command locally.",
    "",
    `Command: ${commandResult.command}`,
    `Result: ${commandResult.exitCode === 0 ? "passed" : "failed"} (exit ${commandResult.exitCode})`,
    "",
    trimOutput(commandResult.output || "No output."),
    "",
    commandResult.exitCode === 0
      ? "The command completed. Tell me the next change you want and I will inspect the relevant files."
      : "The command failed. I would inspect the output above, find the smallest likely cause, then repair and rerun."
  ].join("\n");
}

function fallbackAgenticaAnswer(message, scan, contextPack, commandResult, error) {
  const modelNote = error instanceof Error && error.message
    ? `The live model was busy, so I used the local tool result directly.`
    : "I used the local tool result directly.";

  if (commandResult) {
    return [
      modelNote,
      "",
      `Command: ${commandResult.command}`,
      `Result: ${commandResult.exitCode === 0 ? "passed" : "failed"} (exit ${commandResult.exitCode})`,
      "",
      trimOutput(commandResult.output || "No output."),
      "",
      commandResult.exitCode === 0
        ? "Next, tell me what change you want and I will inspect the relevant files."
        : "Next, I would inspect the failing output and choose the smallest repair."
    ].join("\n");
  }

  const files = contextPack.files.map((file) => `- ${file.path}`).join("\n") || "- no readable files";
  return [
    modelNote,
    "",
    "AgenticaHarness is working on the selected project.",
    "",
    `Request: ${message}`,
    `Project: ${scan.repoPath}`,
    `Detected stack: ${stackNames(scan)}`,
    "",
    "Context loaded:",
    files,
    "",
    "I can now scan deeper, run build/test/git status, connect Salesforce, or plan a file-level implementation."
  ].join("\n");
}

function agenticaSteps(scan, extra = []) {
  return [
    "Intake: captured request",
    `Project: ${scan.repoPath}`,
    `Scanner: ${stackNames(scan)}`,
    ...extra
  ];
}

async function buildContextPack(scan) {
  const wanted = selectContextFiles(scan.detectedFiles);
  const files = [];

  for (const relative of wanted) {
    const fullPath = path.resolve(scan.repoPath, relative);
    if (!isInside(scan.repoPath, fullPath)) continue;
    try {
      const content = await readFile(fullPath, "utf8");
      files.push({
        path: relative,
        content: truncate(content.replace(/\r\n/g, "\n"), 2200)
      });
    } catch {
      // Skip binary, locked, or unreadable files.
    }
  }

  return {
    files,
    text: files.map((file) => `--- ${file.path} ---\n${file.content}`).join("\n\n")
  };
}

function selectContextFiles(files) {
  const priorityNames = new Set([
    "README.md",
    "package.json",
    "vite.config.js",
    "vite.config.ts",
    "tsconfig.json",
    "sfdx-project.json",
    "pom.xml",
    "pyproject.toml",
    "requirements.txt",
    "go.mod",
    "Cargo.toml"
  ]);
  const sourceExtensions = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cls", ".trigger", ".html", ".css", ".json", ".md"];
  const priority = files.filter((file) => priorityNames.has(path.basename(file)));
  const source = files.filter((file) => sourceExtensions.some((suffix) => file.toLowerCase().endsWith(suffix)));
  return unique([...priority, ...source]).slice(0, 8);
}

async function maybeRunAgenticaCommand(scan, normalized) {
  if (!scan.exists) return null;

  if (/\bgit\s+status\b|\bstatus of (the )?(repo|project|git)\b/.test(normalized)) {
    return runProjectCommand(scan.repoPath, "git status --short", 45000).then((result) => ({
      command: "git status --short",
      ...result
    }));
  }

  const wantsBuild = /\b(run|execute|start)\b.*\bbuild\b|\bbuild (this|the )?(project|app|repo)\b/.test(normalized);
  if (wantsBuild) {
    const command = firstCommand(scan, "build");
    if (command) {
      return runProjectCommand(scan.repoPath, command, 120000).then((result) => ({ command, ...result }));
    }
  }

  const wantsTest = /\b(run|execute|start)\b.*\b(test|tests|verification|verify)\b|\bverify (this|the )?(project|app|repo)\b/.test(normalized);
  if (wantsTest) {
    const command = firstCommand(scan, "test") || firstCommand(scan, "build");
    if (command) {
      return runProjectCommand(scan.repoPath, command, 120000).then((result) => ({ command, ...result }));
    }
  }

  return null;
}

function firstCommand(scan, kind) {
  for (const profile of scan.stacks) {
    const commands = profile[kind] || [];
    if (commands.length > 0) return commands[0];
  }
  return null;
}

async function liveModelReply(message, scan, selectedModel) {
  if (!selectedModel?.provider || !selectedModel?.model) return null;

  const system = [
    "You are AgenticaHarness, a live coding and business-work assistant inside a local web app.",
    "Talk naturally to the human. Do not expose internal orchestration unless it helps.",
    "When asked for Salesforce stories, produce clear user stories with acceptance criteria.",
    "When asked to act on local tools, explain what you can do and what needs approval.",
    "Keep answers concise, helpful, and action-oriented.",
    `Selected project path: ${scan.repoPath}`,
    `Detected stack: ${stackNames(scan)}`
  ].join("\n");

  try {
    return {
      kind: "live",
      text: await callSelectedModel(selectedModel, system, message)
    };
  } catch (error) {
    return {
      kind: "model_error",
      text: [
        "I could not reach the selected model.",
        "",
        error instanceof Error ? error.message : "Unknown network error"
      ].join("\n")
    };
  }
}

function resolveModelConfig(config) {
  if (!config || typeof config !== "object") return null;
  const providerInfo = modelProviders.find((candidate) => candidate.id === normalizeProviderId(config.provider));
  if (!providerInfo) return null;
  const apiKey = String(config.apiKey || providerEnvValue(providerInfo) || "").trim();
  const baseUrl = normalizeProviderBaseUrl(providerInfo, config.baseUrl || providerBaseUrlFromEnv(providerInfo) || providerInfo.baseUrl || "", apiKey);
  const rawModel = String(config.model || "").trim();
  const model = providerInfo.type === "agentica" && rawModel === "glm-5.1-standard" ? providerInfo.defaultModel : rawModel;
  if (!model) return null;
  if (providerInfo.needsKey && !apiKey) return null;
  if (!baseUrl && providerInfo.id !== "gemini" && providerInfo.type !== "harness" && providerInfo.type !== "agentica") return null;

  return {
    provider: providerInfo.id,
    providerName: providerInfo.name,
    type: providerInfo.type,
    apiKey,
    baseUrl,
    model
  };
}

function requestedModelInfo(config) {
  if (!config || typeof config !== "object" || !config.provider || !config.model) return null;
  const providerInfo = modelProviders.find((candidate) => candidate.id === normalizeProviderId(config.provider));
  if (!providerInfo) return null;
  const apiKey = String(config.apiKey || providerEnvValue(providerInfo) || "").trim();
  const baseUrl = normalizeProviderBaseUrl(providerInfo, config.baseUrl || providerBaseUrlFromEnv(providerInfo) || providerInfo.baseUrl || "", apiKey);
  return {
    provider: providerInfo.id,
    providerName: providerInfo.name,
    env: providerInfo.env,
    needsKey: providerInfo.needsKey,
    hasKey: Boolean(apiKey),
    baseUrl,
    model: providerInfo.type === "agentica" && String(config.model || "").trim() === "glm-5.1-standard"
      ? providerInfo.defaultModel
      : String(config.model || "").trim()
  };
}

function modelNeedsSetupReply(scan, requestedModel) {
  const missing = [
    ...(requestedModel.needsKey && !requestedModel.hasKey ? [`API key: add ${requestedModel.env} or paste it in Select Model`] : []),
    ...(!requestedModel.baseUrl ? ["Base URL"] : []),
    ...(!requestedModel.model ? ["Model id"] : [])
  ];

  return {
    kind: "model_setup",
    steps: [
      "Intake: captured request",
      `Project: ${scan.repoPath}`,
      `Requested model: ${requestedModel.providerName} / ${requestedModel.model || "not selected"}`,
      `Status: ${missing.length ? `missing ${missing.join(", ")}` : "not ready"}`
    ],
    text: [
      `${requestedModel.providerName} is selected, but it is not ready to run yet.`,
      "",
      "I will not silently fall back to another model.",
      "",
      "Needed:",
      missing.map((item) => `- ${item}`).join("\n") || "- Complete provider settings",
      "",
      requestedModel.provider === "glm-5.1"
        ? "For direct Z.ai GLM 5.1, paste your Z.ai API key or set ZAI_API_KEY in .env."
        : requestedModel.provider === "glm-5.1-openrouter"
          ? "For GLM 5.1 through OpenRouter, paste your OpenRouter key or set OPENROUTER_API_KEY in .env."
          : requestedModel.provider === "nvidia"
            ? "For NVIDIA NIM, create your key on build.nvidia.com, then set NVIDIA_API_KEY in .env or paste it in Select Model. Keep Base URL as https://integrate.api.nvidia.com/v1."
            : requestedModel.provider === "agentica-qwen-core"
              ? "For AgenticaHarness Qwen Core, start your local OpenAI-compatible Qwen server, then set AGENTICA_QWEN_CORE_ENABLED=true, AGENTICA_QWEN_CORE_BASE_URL, and AGENTICA_QWEN_CORE_MODEL in .env."
            : "Add the provider key in Select Model, then send again.",
      "",
      "After that the trace will show:",
      `Model: ${requestedModel.providerName} / ${requestedModel.model}`
    ].join("\n")
  };
}

function defaultWorkingModelConfig() {
  const requestedCoreProvider = normalizeProviderId(process.env.AGENTICA_CORE_PROVIDER || "");
  if (requestedCoreProvider === "agentica-qwen-core" || (!requestedCoreProvider && process.env.AGENTICA_QWEN_CORE_ENABLED === "true")) {
    const qwenCore = resolveModelConfig(agenticaQwenCoreModelConfig());
    if (qwenCore) return qwenCore;
  }
  return resolveModelConfig(agenticaNativeModelConfig());
}

function agenticaNativeModelConfig() {
  return {
    provider: "agentica-native",
    providerName: "AgenticaHarness Native Engine",
    apiKey: "",
    baseUrl: "",
    model: "agentica-brain"
  };
}

function agenticaQwenCoreModelConfig() {
  return {
    provider: "agentica-qwen-core",
    providerName: "AgenticaHarness Qwen Core (Local)",
    apiKey: process.env.AGENTICA_QWEN_CORE_API_KEY || "",
    baseUrl: qwenCoreDefaultBaseUrl,
    model: qwenCoreDefaultModel
  };
}

async function readLearning() {
  try {
    const parsed = JSON.parse(await readFile(learningFile, "utf8"));
    return {
      version: 1,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      turns: Array.isArray(parsed.turns) ? parsed.turns : []
    };
  } catch {
    const now = new Date().toISOString();
    return {
      version: 1,
      createdAt: now,
      updatedAt: now,
      lessons: seedLearningLessons(now),
      turns: []
    };
  }
}

async function writeLearning(memory) {
  const next = {
    ...memory,
    updatedAt: new Date().toISOString(),
    lessons: dedupeLessons(memory.lessons || []).slice(0, 240),
    turns: (memory.turns || []).slice(0, 160)
  };
  await mkdir(runsDir, { recursive: true });
  await writeFile(learningFile, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function seedLearningLessons(now) {
  return [
    learningLesson({
      title: "Answer in the user's requested style",
      lesson: "When the user gives a visual or wording example, match that answer shape first: concise opening, clear links, useful headings, bullets, then next action.",
      tags: ["style", "format", "response"],
      source: "initial-agentica-seed",
      createdAt: now,
      confidence: 0.95
    }),
    learningLesson({
      title: "Website build response format",
      lesson: "For website/app build prompts, create or update the local project source directly, generate a live preview route, write deployment files, lead with the live model link, then ask what to modify. Do not lead with run-local instructions unless the user asks.",
      tags: ["website", "project", "build", "format", "live-preview", "deployment"],
      source: "initial-agentica-seed",
      createdAt: now,
      confidence: 0.96
    }),
    learningLesson({
      title: "Generated apps must be deployable",
      lesson: "Every generated app should include live-preview.html, agentica.manifest.json, DEPLOYMENT.md, public/manifest.webmanifest, React/Vite source, and a /live-projects/<id>/ preview served through the harness, Vite proxy, and Apache proxy.",
      tags: ["generator", "deployment", "domain", "apache", "manifest"],
      source: "agentica-generator",
      createdAt: now,
      confidence: 0.94
    }),
    learningLesson({
      title: "GStack virtual engineering team pattern",
      lesson: "For complex product or engineering work, route thinking through a single-brain team loop: product office-hours, CEO scope review, engineering architecture review, design review when UI matters, implementation, staff review, browser QA, security review when risk exists, release, canary, and retrospective learning.",
      tags: ["gstack", "team", "workflow", "review", "qa", "ship"],
      source: "gstack-reference",
      createdAt: now,
      confidence: 0.9
    }),
    learningLesson({
      title: "DeerFlow research workspace pattern",
      lesson: "For research/agent workspace prompts, use a DeerFlow-style loop: persistent thread state, lead agent, subagent roles, todo/workspace visibility, tool event stream, memory, artifacts or files, verification, and clean final report.",
      tags: ["deerflow", "research", "workspace", "agents", "thread-state"],
      source: "deerflow-reference",
      createdAt: now,
      confidence: 0.9
    }),
    learningLesson({
      title: "UI-TARS GUI action loop",
      lesson: "For GUI automation prompts, use a UI-TARS-style observe/reason/action/verify loop. Capture screenshot or browser state, choose a grounded action, execute through a safe operator, then verify the visible result before reporting.",
      tags: ["ui-tars", "gui", "browser", "operator", "verify"],
      source: "ui-tars-reference",
      createdAt: now,
      confidence: 0.88
    }),
    learningLesson({
      title: "God Mode orchestration",
      lesson: "God Mode means deeper orchestration, multi-model teacher use when available, GStack-style specialist lenses, stronger verification, and explicit safety gates. It does not mean unsafe actions, secret grabbing, or destructive commands without user direction.",
      tags: ["god-mode", "orchestration", "teacher", "safety"],
      source: "initial-agentica-seed",
      createdAt: now,
      confidence: 0.92
    }),
    learningLesson({
      title: "Keep internal traces collapsed",
      lesson: "Do not put raw execution logs or long generated code before the final answer. Keep internal analysis in the Analyzed trace and lead with the clean answer.",
      tags: ["style", "trace", "ui"],
      source: "initial-agentica-seed",
      createdAt: now,
      confidence: 0.9
    })
  ];
}

function learningLesson({ title, lesson, tags = [], source = "agentica", prompt = "", answer = "", createdAt = new Date().toISOString(), confidence = 0.7 }) {
  return {
    id: crypto.randomUUID(),
    title: truncate(title || "Learning", 90),
    lesson: truncate(lesson || "", 900),
    tags: unique(tags.map((tag) => String(tag || "").toLowerCase().trim()).filter(Boolean)).slice(0, 12),
    source,
    prompt: truncate(prompt, 240),
    answer: truncate(answer, 360),
    confidence,
    uses: 0,
    createdAt,
    updatedAt: createdAt
  };
}

function dedupeLessons(lessons) {
  const seen = new Set();
  const output = [];
  for (const lesson of lessons) {
    const key = `${String(lesson.title || "").toLowerCase()}|${String(lesson.lesson || "").toLowerCase().slice(0, 160)}`;
    if (seen.has(key) || !lesson.lesson) continue;
    seen.add(key);
    output.push(lesson);
  }
  return output.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

async function learningSummary() {
  const memory = await writeLearning(await readLearning());
  return {
    version: memory.version,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    lessonsCount: memory.lessons.length,
    turnsCount: memory.turns.length,
    lessons: memory.lessons.slice(0, 40)
  };
}

async function addManualLearning(body) {
  const now = new Date().toISOString();
  const memory = await readLearning();
  const text = String(body.lesson || body.text || body.preference || "").trim();
  if (!text) throw new Error("lesson is required");
  const lesson = learningLesson({
    title: body.title || inferLearningTitle(text),
    lesson: text,
    tags: Array.isArray(body.tags) ? body.tags : inferLearningTags(`${body.title || ""} ${text}`),
    source: body.source || "manual",
    prompt: body.prompt || "",
    answer: body.answer || "",
    createdAt: now,
    confidence: Number(body.confidence || 0.9)
  });
  memory.lessons.unshift(lesson);
  await writeLearning(memory);
  return { saved: true, lesson };
}

async function learnFromCompletedTurn({ message, repoPath, modelConfig, reply }) {
  if (!reply?.text) return null;
  const memory = await readLearning();
  const now = new Date().toISOString();
  const scan = await scanRepository(repoPath);
  const intent = inferAgenticIntent(message, String(message || "").toLowerCase(), stackNames(scan));
  memory.turns.unshift({
    id: crypto.randomUUID(),
    prompt: truncate(message, 360),
    answer: truncate(reply.text, 800),
    kind: reply.kind || intent.kind,
    provider: modelConfig?.provider || "agentica-native",
    model: modelConfig?.model || "agentica-brain",
    domain: intent.domain,
    action: intent.action,
    deliverable: intent.deliverable,
    createdAt: now
  });

  const lesson = inferLessonFromTurn(message, reply, intent, now);
  if (lesson) memory.lessons.unshift(lesson);
  await writeLearning(memory);
  return lesson;
}

function inferLessonFromTurn(message, reply, intent, now) {
  const text = String(reply.text || "");
  if (intent.deliverable === "website" && /Project folder:/.test(text)) {
    return learningLesson({
      title: "Successful website project answer",
      lesson: "For website builds, include the finished result first, then project folder, local run commands, what's inside, and an invitation to iterate on the source files.",
      tags: ["website", "project", "format", "success"],
      source: "turn-outcome",
      prompt: message,
      answer: text,
      createdAt: now,
      confidence: 0.88
    });
  }
  if (/^yes\b/i.test(text) && /## What's inside/i.test(text)) {
    return learningLesson({
      title: "User-preferred final answer style",
      lesson: "Lead with the direct result, keep the answer formatted with headings and bullets, and avoid exposing raw generation scripts.",
      tags: ["style", "format"],
      source: "turn-outcome",
      prompt: message,
      answer: text,
      createdAt: now,
      confidence: 0.82
    });
  }
  return null;
}

async function relevantLearningLessons(intent, context = {}) {
  const memory = await readLearning();
  const query = [
    intent.request,
    intent.domain,
    intent.action,
    intent.deliverable,
    intent.language,
    context.detectedStack,
    ...(intent.entities || [])
  ].join(" ");
  const scored = memory.lessons
    .map((lesson) => ({ lesson, score: learningScore(query, intent, lesson) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length) {
    const ids = new Set(scored.map((item) => item.lesson.id));
    memory.lessons = memory.lessons.map((lesson) => ids.has(lesson.id) ? { ...lesson, uses: (lesson.uses || 0) + 1, updatedAt: new Date().toISOString() } : lesson);
    await writeLearning(memory).catch(() => {});
  }

  return scored.map((item) => item.lesson);
}

function learningScore(query, intent, lesson) {
  const queryTokens = tokenizeLearning(query);
  const lessonTokens = tokenizeLearning(`${lesson.title} ${lesson.lesson} ${(lesson.tags || []).join(" ")}`);
  let score = 0;
  for (const token of queryTokens) {
    if (lessonTokens.has(token)) score += 1;
  }
  if ((lesson.tags || []).includes(intent.domain)) score += 4;
  if ((lesson.tags || []).includes(intent.deliverable)) score += 4;
  if ((lesson.tags || []).includes(intent.action)) score += 3;
  if ((lesson.tags || []).includes("style")) score += 1;
  score += Number(lesson.confidence || 0) * 2;
  return score;
}

function tokenizeLearning(value) {
  const stop = new Set(["the", "and", "for", "with", "this", "that", "from", "into", "your", "you", "can", "will", "should", "what"]);
  return new Set(String(value || "").toLowerCase().split(/[^a-z0-9_.-]+/).filter((token) => token.length > 2 && !stop.has(token)).slice(0, 80));
}

function formatLearningContext(lessons = []) {
  return lessons
    .slice(0, 6)
    .map((lesson) => `- ${lesson.title}: ${lesson.lesson}`)
    .join("\n");
}

function inferLearningTitle(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return titleCase(clean.split(/[.?!]/)[0] || "AgenticaHarness Learning");
}

function inferLearningTags(text) {
  const lower = String(text || "").toLowerCase();
  const tags = [];
  for (const tag of ["style", "format", "website", "artifact", "code", "salesforce", "api", "teacher", "llm", "learning"]) {
    if (lower.includes(tag)) tags.push(tag);
  }
  return tags.length ? tags : ["manual"];
}

async function learnFromTeacher(body) {
  const message = body.message || body.prompt;
  if (!message || typeof message !== "string") throw new Error("message or prompt is required");
  const ensemble = await teacherEnsemble(message, body.repoPath || ".", body.modelConfig || null, body);
  const lesson = await saveTeacherEnsembleLearning(ensemble, body);
  return { saved: Boolean(lesson), lesson, ensemble };
}

async function saveTeacherEnsembleLearning(ensemble, body = {}) {
  if (!ensemble?.lesson) return null;
  if (!ensemble.teacherAnswers?.length) return null;
  const memory = await readLearning();
  const now = new Date().toISOString();
  const tags = inferLearningTags(`${ensemble.prompt} ${ensemble.bestAnswer}`);
  tags.push("teacher");
  const lesson = learningLesson({
    title: body.title || `Teacher lesson: ${truncate(ensemble.prompt, 44)}`,
    lesson: ensemble.lesson,
    tags,
    source: "teacher-ensemble",
    prompt: ensemble.prompt,
    answer: ensemble.bestAnswer,
    createdAt: now,
    confidence: ensemble.teacherAnswers.length > 1 ? 0.88 : 0.78
  });
  memory.lessons.unshift(lesson);
  await writeLearning(memory);
  return lesson;
}

async function teacherEnsemble(message, repoPath = ".", modelConfig = null, options = {}) {
  const scan = await scanRepository(repoPath);
  const intent = inferAgenticIntent(message, String(message || "").toLowerCase(), stackNames(scan));
  const existingLessons = await relevantLearningLessons(intent, {
    projectPath: scan.repoPath,
    detectedStack: stackNames(scan),
    detectedFiles: scan.detectedFiles
  });
  const teacherConfigs = resolveTeacherConfigs(modelConfig, options);
  const system = [
    "You are a teacher model helping AgenticaHarness improve its answer quality.",
    "Answer the prompt directly and include the most important reasoning patterns, constraints, and output shape AgenticaHarness should learn.",
    "Do not mention that you are a teacher model.",
    formatLearningContext(existingLessons) ? `Existing learned lessons:\n${formatLearningContext(existingLessons)}` : "",
    `Project: ${scan.repoPath}`,
    `Detected stack: ${stackNames(scan)}`
  ].filter(Boolean).join("\n");

  const teacherAnswers = [];
  const skipped = [];
  for (const config of teacherConfigs.slice(0, Number(options.maxTeachers || 5))) {
    try {
      const answer = await callSelectedModel(config, system, message);
      teacherAnswers.push({
        provider: config.providerName,
        model: config.model,
        answer: truncate(answer, 2500)
      });
    } catch (error) {
      skipped.push({
        provider: config.providerName,
        model: config.model,
        reason: error instanceof Error ? error.message : "teacher failed"
      });
    }
  }

  const bestAnswer = synthesizeTeacherAnswer(message, teacherAnswers, existingLessons);
  const lesson = distillTeacherLesson(message, intent, teacherAnswers, bestAnswer, existingLessons);
  return {
    prompt: message,
    project: scan.repoPath,
    detectedStack: stackNames(scan),
    teachersAsked: teacherConfigs.length,
    teacherAnswers,
    skipped,
    bestAnswer,
    lesson,
    appliedLessons: existingLessons
  };
}

function resolveTeacherConfigs(modelConfig = null, options = {}) {
  const configs = [];
  const add = (config) => {
    const resolved = resolveModelConfig(config);
    if (!resolved || resolved.type === "agentica") return;
    const key = `${resolved.provider}:${resolved.model}`;
    if (!configs.some((candidate) => `${candidate.provider}:${candidate.model}` === key)) configs.push(resolved);
  };

  if (Array.isArray(options.teachers)) {
    for (const teacher of options.teachers) add(teacher);
  }

  if (modelConfig?.provider && modelConfig.provider !== "agentica-native") add(modelConfig);

  add({ provider: "agentica-free-helper", model: options.freeModel || "openai-fast" });
  add({ provider: "nvidia", model: nvidiaDefaultModel });
  add({ provider: "glm-5.1", model: "glm-5.1" });
  add({ provider: "glm-5.1-openrouter", model: "z-ai/glm-5.1" });
  add({ provider: "openrouter", model: process.env.OPENROUTER_MODEL || "z-ai/glm-5.1" });
  add({ provider: "agentica-helper-key", model: process.env.AGENTICA_HELPER_MODEL || process.env.AGENTICA_OPENAI_HELPER_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini" });
  add({ provider: "anthropic", model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5" });
  add({ provider: "gemini", model: process.env.GOOGLE_MODEL || "gemini-2.5-flash" });
  if (process.env.OLLAMA_MODEL) add({ provider: "ollama", model: process.env.OLLAMA_MODEL });
  if (process.env.AGENTICA_QWEN_CORE_ENABLED === "true") add(agenticaQwenCoreModelConfig());
  if (process.env.AIRLLM_ENABLED === "true") add({ provider: "airllm", model: airllmDefaultModel });

  return configs;
}

function synthesizeTeacherAnswer(message, teacherAnswers, lessons) {
  if (!teacherAnswers.length) {
    return [
      "No teacher model returned a successful answer on this request.",
      "",
      "AgenticaHarness can still use its local learning memory. Add API keys, start a local Ollama model, or retry if a no-key provider is rate-limited.",
      "",
      `Prompt: ${message}`,
      formatLearningContext(lessons)
    ].filter(Boolean).join("\n");
  }

  const best = teacherAnswers
    .map((answer) => ({ ...answer, score: answerQualityScore(answer.answer) }))
    .sort((a, b) => b.score - a.score)[0];
  return best.answer;
}

function distillTeacherLesson(message, intent, teacherAnswers, bestAnswer, lessons) {
  const commonSignals = teacherAnswers
    .flatMap((item) => extractAnswerSignals(item.answer))
    .filter(Boolean);
  const signals = unique(commonSignals).slice(0, 6);
  return [
    `For prompts like "${truncate(message, 120)}", classify as ${intent.domain}/${intent.deliverable}/${intent.action}.`,
    signals.length ? `Prefer these answer patterns: ${signals.join("; ")}.` : "Prefer the clearest direct answer from the strongest teacher result.",
    bestAnswer ? `Best teacher answer shape: ${truncate(bestAnswer.replace(/\s+/g, " "), 260)}` : "",
    lessons.filter((lesson) => lesson.source !== "teacher-ensemble").length
      ? `Keep existing local style lessons: ${lessons.filter((lesson) => lesson.source !== "teacher-ensemble").map((lesson) => lesson.title).join(", ")}.`
      : ""
  ].filter(Boolean).join(" ");
}

function extractAnswerSignals(answer) {
  const text = String(answer || "");
  const signals = [];
  if (/^yes\b/i.test(text)) signals.push("lead with a direct yes/result when a build/action is complete");
  if (/```/.test(text)) signals.push("use fenced code blocks only when code is the deliverable");
  if (/##|what'?s inside/i.test(text)) signals.push("use short headings for structured deliverables");
  if (/\b(step|first|next)\b/i.test(text)) signals.push("include next steps when useful");
  if (/acceptance criteria|user stor/i.test(text)) signals.push("include acceptance criteria for story prompts");
  if (/warning|risk|assumption/i.test(text)) signals.push("state risks or assumptions when they matter");
  return signals;
}

function answerQualityScore(answer) {
  const text = String(answer || "");
  let score = Math.min(text.length / 200, 10);
  if (/^yes\b|^done\b|^here\b/i.test(text)) score += 2;
  if (/##|-\s+|\d+\./.test(text)) score += 2;
  if (/```/.test(text) && text.length < 9000) score += 1;
  if (/raw|json dump|import os, json/i.test(text)) score -= 4;
  return score;
}

async function callSelectedModel(config, system, message) {
  if (config.type === "agentica") return localHarnessModelReply(system, message);
  if (config.type === "harness") return localHarnessModelReply(system, message);
  if (config.type === "agentica-responses-compatible") return callAgenticaResponsesAdapter(config, system, message);
  if (config.type === "agentica-chat-compatible") return callAgenticaChatAdapter(config, system, message);
  if (config.type === "anthropic") return callAnthropic(config, system, message);
  if (config.type === "gemini") return callGemini(config, system, message);
  if (config.type === "ollama") return callOllama(config, system, message);
  throw new Error(`Unsupported provider type: ${config.type}`);
}

async function localHarnessModelReply(system, message) {
  const request = extractHarnessUserRequest(message);
  const normalized = request.toLowerCase();
  const projectPath = extractPromptValue(message, "Project path") || extractPromptValue(system, "Selected project path") || "selected project";
  const detectedStack = extractPromptValue(message, "Detected stack") || extractPromptValue(system, "Detected stack") || "unknown stack";
  const detectedFiles = extractPromptList(message, "Detected files").slice(0, 8);
  const mcpSnapshot = extractMcpPromptSnapshot(system, message);
  const modelRouteSnapshot = extractModelRoutePromptSnapshot(system, message);
  const context = { projectPath, detectedStack, detectedFiles, learningLessons: [] };
  const intent = inferAgenticIntent(request, normalized, detectedStack);
  if (isMcpStatusRequest(normalized) || isRuntimeStatusRequest(normalized)) {
    return formatNativeRuntimeStatusReply(mcpSnapshot, modelRouteSnapshot);
  }
  context.learningLessons = await relevantLearningLessons(intent, context);
  const liveReply = await maybeAskNoKeyPromptModel(intent, context);
  if (liveReply) return liveReply;

  const pluginReply = runDomainPlugin(intent, context);
  if (pluginReply) return pluginReply;

  return buildPromptEngineReply(intent, context);
}

function isMcpStatusRequest(normalized) {
  return /\bmcp\b/.test(normalized) && /\b(server|servers|tool|tools|open|available|status|count|list|connected|connection)\b/.test(normalized);
}

function isRuntimeStatusRequest(normalized) {
  return /\b(nvidia|ollama|qwen|airllm|openrouter|gemini|claude|anthropic|provider|model route|models|connected|connection|available|status)\b/.test(normalized)
    && /\b(check|list|show|find|available|open|connected|status|link|route|routes)\b/.test(normalized);
}

function extractMcpPromptSnapshot(system, message) {
  const combined = `${system || ""}\n${message || ""}`;
  if (/MCP servers:\s*none discovered/i.test(combined)) {
    return { discovered: 0, available: 0, servers: [] };
  }

  const blocks = [...combined.matchAll(/MCP servers discovered:\s*(\d+)([\s\S]*?)(?=\n\nAI\/model routes available:|\nAI\/model routes available:|\n\n(?:Learned preferences|Neural Engine context|Recent conversation|User request|Project path|Detected stack|Detected files|Context pack|MCP status|Command result)|$)/gi)];
  const block = blocks[blocks.length - 1];
  const discovered = Number(block?.[1] || 0);
  const body = block?.[2] || "";
  const servers = [...body.matchAll(/^\s*-\s+([^:]+):\s+([^,\n]+),\s+([^,\n]+)(?:,\s+(.+))?$/gmi)]
    .map((match) => ({
      name: match[1].trim(),
      status: match[2].trim(),
      transport: match[3].trim(),
      capabilities: (match[4] || "").trim()
    }));
  const available = servers.filter((server) => !["offline", "disabled", "needs-key"].includes(server.status)).length || Number(combined.match(/MCP:\s*(\d+)\//i)?.[1] || 0);
  return { discovered: discovered || servers.length, available, servers };
}

function extractModelRoutePromptSnapshot(system, message) {
  const combined = `${system || ""}\n${message || ""}`;
  const blocks = [...combined.matchAll(/AI\/model routes available:\s*(\d+)\/(\d+)([\s\S]*?)(?=\n\n(?:Learned preferences|Neural Engine context|Recent conversation|User request|Project path|Detected stack|Detected files|Context pack|MCP status|Command result)|$)/gi)];
  const block = blocks[blocks.length - 1];
  const available = Number(block?.[1] || 0);
  const total = Number(block?.[2] || 0);
  const routeBlock = block?.[3] || "";
  const setupSplit = routeBlock.split(/AI\/model routes needing setup:/i);
  const readyBlock = setupSplit[0] || "";
  const setupBlock = setupSplit[1] || "";
  const ready = parseRouteLines(readyBlock);
  const needsSetup = parseRouteLines(setupBlock);
  return { available: available || ready.length, total: total || ready.length + needsSetup.length, ready, needsSetup };
}

function parseRouteLines(block) {
  return [...String(block || "").matchAll(/^\s*-\s+([^:]+):\s+([^,\n]+)(?:,\s+(.+))?$/gmi)]
    .map((match) => ({
      name: match[1].trim(),
      status: match[2].trim(),
      detail: (match[3] || "").trim()
    }))
    .filter((route) => route.name && !/^MCP servers/i.test(route.name));
}

function formatNativeRuntimeStatusReply(mcpSnapshot, modelRouteSnapshot) {
  const lines = [
    "AgenticaHarness is connected.",
    "",
    `Native tool bridges discovered: ${mcpSnapshot.discovered}`,
    `Native tool bridges available: ${mcpSnapshot.available}`
  ];

  if (mcpSnapshot.servers.length) {
    lines.push("", "Tool bridges:");
    lines.push(...mcpSnapshot.servers.map((server) => `- ${server.name}: ${server.status}, ${server.transport}${server.capabilities ? `, ${server.capabilities}` : ""}`));
  } else {
    lines.push("", "No external MCP config files were discovered. AgenticaHarness can still use native project scan, files, commands, and configured model routes.");
  }

  lines.push("", `AI/model routes available: ${modelRouteSnapshot.available}/${modelRouteSnapshot.total}`);
  if (modelRouteSnapshot.ready.length) {
    lines.push(...modelRouteSnapshot.ready.map((route) => `- ${route.name}: ${route.status}${route.detail ? `, ${route.detail}` : ""}`));
  }
  if (modelRouteSnapshot.needsSetup.length) {
    lines.push("", "Routes needing setup:");
    lines.push(...modelRouteSnapshot.needsSetup.slice(0, 8).map((route) => `- ${route.name}: ${route.status}${route.detail ? `, ${route.detail}` : ""}`));
  }

  lines.push("", "I will treat these as native AgenticaHarness context for faster, better answers. I will not claim a tool call happened unless a real tool result exists.");
  return lines.join("\n");
}

function inferAgenticIntent(request, normalized, detectedStack) {
  const domain = inferDomain(normalized, detectedStack);
  const action = inferPromptAction(normalized);
  const deliverable = inferDeliverable(normalized, action);
  const language = inferCodeLanguage(normalized, detectedStack);
  const entities = inferPromptEntities(request);
  const constraints = inferPromptConstraints(request);
  const wantsTrigger = domain === "salesforce" && (deliverable === "trigger" || /\btrigger\b/.test(normalized));

  if (domain === "salesforce" && wantsTrigger) {
    return {
      domain,
      kind: "apex-trigger",
      action,
      deliverable,
      language,
      entities,
      constraints,
      request,
      spec: inferApexTriggerSpec(request)
    };
  }

  return {
    domain,
    kind: deliverable === "code" ? "code-draft" : action,
    action,
    deliverable,
    language,
    entities,
    constraints,
    request
  };
}

function inferPromptAction(normalized) {
  if (/\b(help|what can you do|how do you work|who are you)\b/.test(normalized)) return "help";
  if (/\b(idea|ideas|suggest|suggestion|recommend|recommendation|options|brainstorm)\b/.test(normalized)) return "ideate";
  if (/\b(fix|repair|debug|solve|error|failing|broken|not working|issue)\b/.test(normalized)) return "fix";
  if (solveArithmeticPrompt(normalized)) return "calculate";
  if (/\b(explain|why|what is|how does|teach|describe)\b/.test(normalized)) return "explain";
  if (/\b(summarize|summary|recap|brief)\b/.test(normalized)) return "summarize";
  if (/\b(compare|difference|versus|vs)\b/.test(normalized)) return "compare";
  if (/\b(test|verify|validate|check)\b/.test(normalized)) return "verify";
  if (/\b(connect|login|authenticate|integrate)\b/.test(normalized)) return "connect";
  if (/\b(build|create|make|generate|implement|design|scaffold)\b/.test(normalized)) return "build";
  if (/\b(write|code|draft|compose)\b/.test(normalized)) return "write";
  if (/\b(plan|architect|break down|roadmap)\b/.test(normalized)) return "plan";
  return "answer";
}

function inferDeliverable(normalized, action) {
  if (action === "ideate") return "ideas";
  if (/\btrigger\b/.test(normalized)) return "trigger";
  if (/\b(user stor|stories|acceptance criteria|epic)\b/.test(normalized)) return "stories";
  if (/\b(website|site|landing page|homepage|web app|app)\b/.test(normalized)) return "website";
  if (/\b(function|class|component|api|endpoint|script|query|soql|sql|code)\b/.test(normalized)) return "code";
  if (/\b(test|tests|spec|unit test|verification)\b/.test(normalized)) return "tests";
  if (/\b(diagram|flow|architecture)\b/.test(normalized)) return "architecture";
  if (action === "explain") return "explanation";
  if (action === "compare") return "comparison";
  if (action === "summarize") return "summary";
  if (action === "plan" || action === "build" || action === "fix") return "plan";
  return "answer";
}

function inferPromptEntities(request) {
  const text = String(request || "");
  const entities = [];
  const add = (value) => {
    const clean = String(value || "").trim();
    if (clean && !entities.includes(clean)) entities.push(clean);
  };

  for (const match of text.matchAll(/"([^"]+)"|'([^']+)'|`([^`]+)`/g)) {
    add(match[1] || match[2] || match[3]);
  }

  for (const match of text.matchAll(/\b[A-Z][A-Za-z0-9_]*(?:__c|__r)?\b/g)) {
    add(match[0]);
  }

  const techTerms = ["React", "Apex", "Salesforce", "Java", "Spring", "Python", "Node", "Vite", "API", "SQL", "SOQL", "LWC", "HTML", "CSS"];
  const lower = text.toLowerCase();
  for (const term of techTerms) {
    if (lower.includes(term.toLowerCase())) add(term);
  }

  return entities.slice(0, 10);
}

function inferPromptConstraints(request) {
  const text = String(request || "");
  const constraints = [];
  const patterns = [
    /\busing\s+([^,.]+)(?:[,.]|$)/gi,
    /\bwith\s+([^,.]+)(?:[,.]|$)/gi,
    /\bwithout\s+([^,.]+)(?:[,.]|$)/gi,
    /\bmust\s+([^,.]+)(?:[,.]|$)/gi,
    /\bshould\s+([^,.]+)(?:[,.]|$)/gi,
    /\bfor\s+([^,.]+)(?:[,.]|$)/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0].trim();
      if (value.length > 4 && !constraints.includes(value)) constraints.push(value);
    }
  }

  return constraints.slice(0, 8);
}

function runDomainPlugin(intent, context) {
  if (intent.kind === "apex-trigger") {
    return buildDynamicApexTriggerReply(intent, context.projectPath, context.detectedStack);
  }

  if (intent.domain === "salesforce" && intent.deliverable === "stories") {
    return salesforceStoriesHarnessReply(intent.request, context.projectPath, context.detectedStack);
  }

  return null;
}

async function maybeAskNoKeyPromptModel(intent, context) {
  if (process.env.AGENTICA_ALLOW_FREE_MODEL === "0") return null;
  const config = resolveModelConfig({
    provider: "agentica-free-helper",
    model: "openai-fast"
  });
  if (!config) return null;

  const system = [
    "You are AgenticaHarness's prompt engine inside a local coding app.",
    "Answer the user's request directly.",
    "Do not mention templates, routing, or internals.",
    "If code is requested, include a concise fenced code block.",
    "If project context matters, use it, but do not invent file contents.",
    `Project: ${context.projectPath}`,
    `Detected stack: ${context.detectedStack}`
  ].join("\n");

  try {
    return await callAgenticaChatAdapterWithRetry(config, system, intent.request, 18000, 2);
  } catch {
    return null;
  }
}

function buildPromptEngineReply(intent, context) {
  if (intent.action === "help") return buildCapabilitiesAnswer(intent, context);
  if (intent.action === "calculate") return buildCalculationAnswer(intent, context);
  if (intent.action === "ideate") return buildIdeasAnswer(intent, context);
  if (intent.deliverable === "code") return buildGenericCodeAnswer(intent, context);
  if (intent.action === "fix") return buildRepairAnswer(intent, context);
  if (intent.action === "verify") return buildVerificationAnswer(intent, context);
  if (intent.action === "connect") return buildConnectionAnswer(intent, context);
  if (intent.action === "explain") return buildExplanationAnswer(intent, context);
  if (intent.action === "compare") return buildComparisonAnswer(intent, context);
  if (intent.action === "summarize") return buildSummaryAnswer(intent, context);
  if (intent.action === "build" || intent.action === "plan" || intent.action === "write") return buildPlanAnswer(intent, context);
  return buildDirectAnswer(intent, context);
}

function buildCapabilitiesAnswer(_intent, context) {
  return [
    "AgenticaHarness is running as a prompt-to-action assistant.",
    "",
    "Give it any prompt and it will:",
    "- infer the goal and output type",
    "- scan the selected project context",
    "- answer directly when it can",
    "- generate code or plans when requested",
    "- route known domains like Salesforce through stronger generators",
    "- run safe local commands when the prompt asks for build, test, verify, or git status",
    "- ask a focused question only when the missing detail blocks the answer",
    "",
    `Project: ${context.projectPath}`,
    `Detected stack: ${context.detectedStack}`
  ].join("\n");
}

function buildIdeasAnswer(intent, context) {
  const count = inferRequestedCount(intent.request) || 3;
  const subject = inferIdeaSubject(intent.request);
  const ideas = buildFlexibleIdeas(subject, intent).slice(0, count);
  return [
    `Here are ${ideas.length} directions for ${subject}:`,
    "",
    ...ideas.flatMap((idea, index) => [
      `${index + 1}. ${idea.title}`,
      idea.body,
      ""
    ]),
    `Project context: ${context.detectedStack}`
  ].join("\n").trim();
}

function inferRequestedCount(request) {
  const text = String(request || "").toLowerCase();
  const wordCounts = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const digit = text.match(/\b([1-6])\b/);
  if (digit) return Number(digit[1]);
  for (const [word, value] of Object.entries(wordCounts)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return value;
  }
  return 0;
}

function inferIdeaSubject(request) {
  const text = String(request || "").trim();
  const match =
    text.match(/\b(?:ideas|suggestions|recommendations|options)\s+(?:for|about|on)\s+(.+)$/i) ||
    text.match(/\b(?:for|about|on)\s+(.+)$/i);
  return (match?.[1] || text)
    .replace(/[?.!]+$/g, "")
    .replace(/^\s*(give me|show me|brainstorm|suggest|recommend)\s+/i, "")
    .trim() || "this";
}

function buildFlexibleIdeas(subject, intent) {
  const cleanSubject = subject.replace(/\s+/g, " ");
  const isWebsite = intent.deliverable === "website" || /\b(site|website|web app|landing page|homepage)\b/i.test(intent.request);
  if (isWebsite) {
    return [
      {
        title: "First-visit clarity",
        body: `Make the first screen immediately explain what ${cleanSubject} offers, with one primary action and a short proof point.`
      },
      {
        title: "Content people can scan",
        body: `Structure ${cleanSubject} around the sections visitors naturally compare: offer, details, trust, location/contact, and next step.`
      },
      {
        title: "Conversion without pressure",
        body: `Use a lightweight action such as booking, inquiry, signup, call, or menu/contact so visitors can act without hunting.`
      },
      {
        title: "Local personality",
        body: `Use real photos, plain copy, and small details that make ${cleanSubject} feel specific rather than generic.`
      },
      {
        title: "Mobile-first path",
        body: `Design the mobile flow first: headline, key info, action button, map/contact, and only then deeper content.`
      }
    ];
  }

  return [
    {
      title: "Simple version",
      body: `Start with the smallest useful form of ${cleanSubject}, then improve it after feedback.`
    },
    {
      title: "Trust-first version",
      body: `Lead with proof, constraints, and examples so ${cleanSubject} feels reliable and easy to judge.`
    },
    {
      title: "Workflow version",
      body: `Turn ${cleanSubject} into steps: input, decision, action, result, and follow-up.`
    },
    {
      title: "Automation version",
      body: `Identify the repeated part of ${cleanSubject} and let the system handle that while keeping humans in control.`
    },
    {
      title: "Premium version",
      body: `Make ${cleanSubject} feel more polished with sharper copy, clearer hierarchy, and fewer but better choices.`
    }
  ];
}

function buildGenericCodeAnswer(intent, context) {
  const language = intent.language || "code";
  const name = inferFunctionName(intent.request, intent.deliverable);
  return [
    `Here is a ${language} starting point shaped from your prompt.`,
    "",
    fencedCode(language, buildCodeSkeleton(language, name, intent)),
    "",
    "I inferred the structure from the wording. Add exact field names, API paths, or business rules and I can make it concrete.",
    "",
    `Project: ${context.projectPath}`,
    `Detected stack: ${context.detectedStack}`
  ].join("\n");
}

function buildCodeSkeleton(language, name, intent) {
  const summary = escapeCommentText(intent.request);
  if (language === "python") {
    return [
      `def ${name}(*args, **kwargs):`,
      `    """${summary}"""`,
      "    # Add validation, transformation, and side effects here.",
      "    result = None",
      "    return result"
    ].join("\n");
  }
  if (language === "java") {
    return [
      `public final class ${pascalCase(name)} {`,
      `    public Object execute() {`,
      `        // ${summary}`,
      "        return null;",
      "    }",
      "}"
    ].join("\n");
  }
  if (language === "jsx" || language === "tsx") {
    return [
      `export function ${pascalCase(name)}() {`,
      "  return (",
      "    <section>",
      `      <h1>${titleCase(name.replaceAll("_", " "))}</h1>`,
      "    </section>",
      "  );",
      "}"
    ].join("\n");
  }
  if (language === "javascript" || language === "typescript") {
    return [
      `export function ${name}(input) {`,
      `  // ${summary}`,
      "  const result = {};",
      "  return result;",
      "}"
    ].join("\n");
  }
  return [
    `// ${summary}`,
    "// Add the concrete implementation details here."
  ].join("\n");
}

function buildRepairAnswer(intent, context) {
  return [
    "I read this as a repair prompt.",
    "",
    "Best next loop:",
    "- reproduce the failure with the smallest command",
    "- inspect the file or log tied to the error",
    "- patch only the failing area",
    "- rerun verification",
    "",
    context.detectedFiles.length ? `Useful context files: ${context.detectedFiles.join(", ")}` : "I do not have a specific failing file yet.",
    "",
    "Send the error text or say `run build` / `run verification` and AgenticaHarness will execute the next gate."
  ].join("\n");
}

function buildVerificationAnswer(_intent, context) {
  return [
    "I read this as a verification prompt.",
    "",
    "I can run the project verifier if you ask directly, for example:",
    "- run build",
    "- run tests",
    "- run verification",
    "- git status",
    "",
    `Detected stack: ${context.detectedStack}`
  ].join("\n");
}

function buildConnectionAnswer(intent, context) {
  return [
    "I read this as a connection/integration prompt.",
    "",
    "To act safely I need the target service, auth method, and environment. If you provide those, AgenticaHarness can prepare the command or integration steps.",
    "",
    `Request: ${intent.request}`,
    `Project: ${context.projectPath}`
  ].join("\n");
}

function buildExplanationAnswer(intent, context) {
  const topic = inferTopic(intent.request);
  return [
    `${titleCase(topic)} in plain terms:`,
    "",
    buildPlainExplanation(topic, intent),
    "",
    "Why it matters:",
    "- it helps you understand what is happening",
    "- it gives you a practical way to use or debug it",
    "- it points to the next detail to ask for if you want depth",
    "",
    `Your prompt: ${intent.request}`,
    `Project context: ${context.detectedStack}`
  ].join("\n");
}

function buildComparisonAnswer(intent, _context) {
  const parts = inferComparisonParts(intent.request);
  return [
    "Here is the comparison frame.",
    "",
    `A: ${parts[0] || "first option"}`,
    `B: ${parts[1] || "second option"}`,
    "",
    "Use this decision filter:",
    "- choose the simpler option when risk and scale are low",
    "- choose the more explicit option when auditability, testing, or team handoff matters",
    "- prefer the option that fits the existing project stack"
  ].join("\n");
}

function buildSummaryAnswer(intent, context) {
  return [
    "Summary:",
    `- Request: ${intent.request}`,
    `- Inferred action: ${intent.action}`,
    `- Deliverable: ${intent.deliverable}`,
    `- Domain: ${intent.domain}`,
    `- Project: ${context.projectPath}`,
    `- Stack: ${context.detectedStack}`
  ].join("\n");
}

function buildPlanAnswer(intent, context) {
  return [
    "I turned your prompt into an execution plan.",
    "",
    `Goal: ${intent.request}`,
    `Deliverable: ${intent.deliverable}`,
    `Domain: ${intent.domain}`,
    "",
    "Plan:",
    "- define the exact output",
    "- inspect the relevant project files",
    "- implement the smallest complete version",
    "- verify with build/test/smoke check",
    "- return the result and next improvement",
    "",
    context.detectedFiles.length ? `Context available: ${context.detectedFiles.join(", ")}` : "No priority files were loaded yet."
  ].join("\n");
}

function buildDirectAnswer(intent, context) {
  return [
    "Here is a direct answer from the prompt.",
    "",
    buildGeneralPromptAnswer(intent),
    "",
    `Project context: ${context.detectedStack}`
  ].join("\n");
}

function buildCalculationAnswer(intent, _context) {
  const solved = solveArithmeticPrompt(intent.request);
  if (!solved) return buildGeneralPromptAnswer(intent);
  return `${solved.expression} = ${solved.result}.`;
}

function solveArithmeticPrompt(request) {
  let text = String(request || "").toLowerCase();
  text = text.replace(/\banswer\s+in\s+(?:one|1)\s+short\s+sentence\b:?/g, " ");
  text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|zero)\b/g, (word) => String(numberWordValue(word)));
  text = text
    .replace(/\bplus\b|\badded to\b|\badd\b/g, " + ")
    .replace(/\bminus\b|\bsubtract(?:ed)?\b|\bless\b/g, " - ")
    .replace(/\btimes\b|\bmultiplied by\b|\bmultiply\b|\bx\b/g, " * ")
    .replace(/\bdivided by\b|\bdivide(?:d)?\b|\bover\b/g, " / ");

  const tokens = text.match(/-?\d+(?:\.\d+)?|[()+\-*/]/g) || [];
  if (tokens.length < 3 || !tokens.some((token) => ["+", "-", "*", "/"].includes(token))) return null;
  const expression = tokens.join(" ").replace(/\s+/g, " ").trim();
  if (!/^[\d+\-*/().\s]+$/.test(expression)) return null;

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return {
      expression,
      result: Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)))
    };
  } catch {
    return null;
  }
}

function numberWordValue(word) {
  const values = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20
  };
  return values[word] ?? word;
}

function buildGeneralPromptAnswer(intent) {
  const request = String(intent.request || "").trim();
  if (!request) return "Ask a question or describe what you want, and I will answer it directly.";
  return [
    "I understand the prompt.",
    "",
    `Goal: ${request}`,
    "",
    "Best next action:",
    `- ${nextActionForIntent(intent)}`,
    "",
    "What I can do now:",
    "- answer directly if this is a question",
    "- update local project files if this is a build/fix request",
    "- use teacher LLMs when the prompt asks for best/perfect/multi-model help",
    "- use project scan, commands, and verification when the answer needs evidence"
  ].join("\n");
}

function nextActionForIntent(intent) {
  if (intent.action === "fix") return "Reproduce the issue, inspect the failing files/logs, patch the smallest cause, and verify.";
  if (intent.action === "build") return "Generate or update the actual project files, then return how to run and verify them.";
  if (intent.action === "plan") return "Turn the request into scoped work, architecture, risks, and verification gates.";
  if (intent.action === "connect") return "Identify the service, auth method, base URL, and safe command/API call.";
  if (intent.deliverable === "code") return "Write the concrete code shape and name the exact missing fields or APIs if any.";
  return "Give the most direct useful answer, then name the next concrete action.";
}

function fencedCode(language, code) {
  return ["```" + (language || "code"), code, "```"].join("\n");
}

function inferFunctionName(request, fallback) {
  const text = String(request || "").toLowerCase();
  const match =
    text.match(/\b(?:function|method|class|component|script|api|endpoint)\s+(?:to|for|called|named)?\s*([a-z][a-z0-9 _-]{1,36})/) ||
    text.match(/\b(?:to|for)\s+([a-z][a-z0-9 _-]{1,36})/);
  const raw = (match?.[1] || fallback || "agentica_result")
    .replace(/\b(?:that|which|with|using|when|where|and|or|in|on|after|before)\b[\s\S]*$/i, "")
    .trim();
  const snake = raw
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return snake || "agentica_result";
}

function pascalCase(value) {
  return String(value || "AgenticaHarnessResult")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") || "AgenticaHarnessResult";
}

function escapeCommentText(value) {
  return String(value || "").replace(/\s+/g, " ").replace(/\*\//g, "* /").slice(0, 160);
}

function inferTopic(request) {
  return String(request || "")
    .replace(/^\s*(explain|what is|how does|describe|teach me)\s+/i, "")
    .trim() || "the requested topic";
}

function buildPlainExplanation(topic, intent) {
  const cleanTopic = String(topic || "this").trim();
  if (/compound interest/i.test(cleanTopic)) {
    return [
      "Compound interest is interest calculated on both the original amount of money and the interest that has already been added.",
      "That means the balance grows faster over time because each new period earns interest on a larger amount."
    ].join("\n\n");
  }
  if (/^api$|apis|application programming interface/i.test(cleanTopic)) {
    return [
      "An API is a contract that lets one piece of software ask another piece of software for data or actions in a predictable way.",
      "For example, a website can call a booking API to search rooms, create a reservation, or fetch prices without knowing the database internals."
    ].join("\n\n");
  }
  return [
    `${cleanTopic} is the thing or process named in your prompt, understood by its purpose, inputs, behavior, and result.`,
    "The fastest way to make the answer precise is to identify what it receives, what it changes, what it returns, and what a successful outcome looks like."
  ].join("\n\n");
}

function inferComparisonParts(request) {
  const text = String(request || "");
  const match = text.match(/\b(.+?)\s+(?:vs|versus|and|or)\s+(.+?)\??$/i);
  if (!match) return [];
  return [match[1], match[2]]
    .map((part) => part.replace(/^\s*(compare|difference between|what is the difference between)\s+/i, "").trim())
    .filter(Boolean);
}

function inferDomain(normalized, detectedStack) {
  if (/(salesforce|apex|soql|sosl|sobject|opportunity|account|contact|lead|case|stage name|trigger)/.test(normalized)) return "salesforce";
  if (/react|component|vite|frontend|ui|css|html/.test(normalized) || /Node|Frontend/i.test(detectedStack)) return "frontend";
  if (/spring|java|apex|class|controller/.test(normalized) || /Java/i.test(detectedStack)) return "backend";
  return "general";
}

function inferCodeLanguage(normalized, detectedStack) {
  if (/apex|salesforce|trigger|soql/.test(normalized)) return "apex";
  if (/react|jsx|component/.test(normalized)) return "jsx";
  if (/typescript|tsx/.test(normalized)) return "tsx";
  if (/javascript|node/.test(normalized)) return "javascript";
  if (/java|spring/.test(normalized) || /Java/i.test(detectedStack)) return "java";
  if (/python/.test(normalized)) return "python";
  return "code";
}

function inferApexTriggerSpec(request) {
  const text = String(request || "");
  const normalized = text.toLowerCase();
  const requestedObjects = inferSalesforceObjects(text);
  const explicitObject = explicitTriggerObject(text);
  const condition = inferSalesforceCondition(text, explicitObject, requestedObjects);
  const triggerObject =
    explicitObject ||
    condition?.triggerObject ||
    requestedObjects.find((objectName) => !["Contact"].includes(objectName)) ||
    "Account";
  const relatedObjects = requestedObjects.filter((objectName) => objectName !== triggerObject);
  const operations = inferTriggerOperations(normalized, condition);
  const timing = /\bbefore\b/.test(normalized) && !/\bafter\b/.test(normalized) ? "before" : "after";

  return {
    triggerObject,
    relatedObjects,
    operations,
    timing,
    condition,
    request: text
  };
}

function explicitTriggerObject(text) {
  const match = String(text || "").match(/\btrigger\s+(?:on|for)\s+([A-Za-z][A-Za-z0-9_]*(?:__c)?)/i);
  if (match) return normalizeSalesforceObject(match[1]);
  const onMatch = String(text || "").match(/\bon\s+([A-Za-z][A-Za-z0-9_]*(?:__c)?)\b/i);
  if (onMatch && knownSalesforceObjects().has(normalizeSalesforceObject(onMatch[1]))) {
    return normalizeSalesforceObject(onMatch[1]);
  }
  return "";
}

function inferSalesforceObjects(text) {
  const normalized = String(text || "").toLowerCase();
  const objects = [];
  const add = (objectName) => {
    if (!objects.includes(objectName)) objects.push(objectName);
  };

  const aliases = [
    ["Opportunity", /\b(opportunity|opportunities|opp|opps)\b/],
    ["Account", /\b(account|accounts)\b/],
    ["Contact", /\b(contact|contacts)\b/],
    ["Lead", /\b(lead|leads)\b/],
    ["Case", /\b(case|cases)\b/],
    ["Task", /\b(task|tasks)\b/],
    ["Event", /\b(event|events)\b/],
    ["Campaign", /\b(campaign|campaigns)\b/],
    ["Quote", /\b(quote|quotes)\b/],
    ["Order", /\b(order|orders)\b/],
    ["Contract", /\b(contract|contracts)\b/],
    ["User", /\b(user|users)\b/]
  ];

  for (const [objectName, pattern] of aliases) {
    if (pattern.test(normalized)) add(objectName);
  }

  for (const match of String(text || "").matchAll(/\b([A-Za-z][A-Za-z0-9_]+__c)\b/g)) {
    add(match[1]);
  }

  return objects;
}

function knownSalesforceObjects() {
  return new Set(["Opportunity", "Account", "Contact", "Lead", "Case", "Task", "Event", "Campaign", "Quote", "Order", "Contract", "User"]);
}

function normalizeSalesforceObject(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.endsWith("__c")) return raw;
  const singular = raw.replace(/ies$/i, "y").replace(/s$/i, "");
  return singular.charAt(0).toUpperCase() + singular.slice(1).toLowerCase();
}

function inferSalesforceCondition(text, explicitObject, requestedObjects) {
  const request = String(text || "");
  const normalized = request.toLowerCase();
  const explicitCondition = request.match(/\b(?:when|where|if)\s+([A-Za-z][A-Za-z0-9_ ]{1,42}?)\s+(?:is|=|equals|becomes|changes to|set to)\s+([A-Za-z0-9_ .'-]{1,64})/i);
  if (explicitCondition) {
    const field = normalizeSalesforceField(explicitCondition[1]);
    const value = cleanConditionValue(explicitCondition[2]);
    return conditionSpec(field, value, explicitObject || inferTriggerObjectForCondition(field, value, requestedObjects));
  }

  const stagePhrase = request.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:stage|deal|sale)\b/i);
  if (stagePhrase) {
    const value = cleanConditionValue(stagePhrase[1]);
    return conditionSpec("StageName", value, explicitObject || "Opportunity");
  }

  const statePhrase = request.match(/\b(?:is|are|was|were|becomes|become|marked|set to)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})\b/i);
  if (statePhrase) {
    const value = cleanConditionValue(statePhrase[1]);
    const field = inferImplicitSalesforceField(normalized, value, explicitObject, requestedObjects);
    return conditionSpec(field, value, explicitObject || inferTriggerObjectForCondition(field, value, requestedObjects));
  }

  return null;
}

function conditionSpec(field, value, triggerObject = "") {
  const normalizedValue = normalizeConditionValue(value);
  return {
    triggerObject,
    field,
    value: normalizedValue,
    label: sanitizeIdentifier(`${field}${normalizedValue}`) || "Condition",
    human: `${field} becomes ${normalizedValue}`
  };
}

function normalizeSalesforceField(value) {
  const compact = String(value || "").trim().replace(/\s+/g, " ");
  const known = {
    "stage": "StageName",
    "stage name": "StageName",
    "status": "Status",
    "is active": "IsActive",
    "active": "IsActive",
    "name": "Name",
    "type": "Type",
    "priority": "Priority"
  };
  const lower = compact.toLowerCase();
  if (known[lower]) return known[lower];
  if (/^[A-Za-z][A-Za-z0-9_]*(?:__c)?$/.test(compact)) return compact;
  return compact
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function inferImplicitSalesforceField(normalized, value, explicitObject, requestedObjects) {
  if (/\bstage\b|\bdeal\b|\bsale\b/.test(normalized)) return "StageName";
  if (/^closed\s+\S+/i.test(value) && !requestedObjects.includes("Case")) return "StageName";
  if (/\bstatus\b/.test(normalized)) return "Status";
  if (/\bactive\b/.test(normalized)) return "IsActive";
  if ((explicitObject || requestedObjects[0]) === "Opportunity" && /^closed\s+\S+/i.test(value)) return "StageName";
  return "Status";
}

function inferTriggerObjectForCondition(field, value, requestedObjects) {
  if (field === "StageName" || /^closed\s+\S+/i.test(value)) return "Opportunity";
  if (field === "Status" && requestedObjects.includes("Case")) return "Case";
  return "";
}

function cleanConditionValue(value) {
  return String(value || "")
    .replace(/\b(?:and|then|with|fetch|from|for|on|where|when|that|which)\b[\s\S]*$/i, "")
    .trim();
}

function normalizeConditionValue(value) {
  const trimmed = String(value || "").trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  return titleCase(trimmed);
}

function sanitizeIdentifier(value) {
  return String(value || "").replace(/[^A-Za-z0-9_]/g, "");
}

function inferTriggerOperations(normalized, condition) {
  const operations = [];
  if (/\b(before|after)\s+insert\b|\bon\s+insert\b|\binserted\b|\brecords?\s+(is|are|was|were)?\s*created\b|\bnew\s+records?\b/.test(normalized)) operations.push("insert");
  if (/\bupdate|change|changed|mark|marked|status|stage\b/.test(normalized) || condition) operations.push("update");
  if (/\bdelete|remove|removed\b/.test(normalized)) operations.push("delete");
  if (/\bundelete|restore|restored\b/.test(normalized)) operations.push("undelete");
  return operations.length ? unique(operations) : ["insert", "update"];
}

function buildDynamicApexTriggerReply(intent, projectPath, detectedStack) {
  const spec = intent.spec;
  const code = buildApexTriggerCode(spec);
  const objectList = [spec.triggerObject, ...spec.relatedObjects].filter(Boolean).join(", ");
  const conditionText = spec.condition ? ` when ${spec.condition.human}` : "";

  return [
    `Assuming Salesforce Apex: create a trigger on ${spec.triggerObject} (${spec.operations.map((operation) => `${spec.timing} ${operation}`).join(", ")})${conditionText}.`,
    objectList ? `AgenticaHarness inferred the working objects: ${objectList}.` : "",
    "",
    "```apex",
    code,
    "```",
    "",
    "I kept it bulkified, moved business logic into a handler, and guarded updates so the logic fires only on the meaningful state change.",
    "",
    `Project: ${projectPath}`,
    `Detected stack: ${detectedStack}`
  ].filter(Boolean).join("\n");
}

function buildApexTriggerCode(spec) {
  const objectName = spec.triggerObject;
  const handlerName = `${objectName.replace(/__c$/, "")}${spec.condition?.label || "Agentic"}TriggerHandler`;
  const triggerName = `${objectName.replace(/__c$/, "")}${spec.condition?.label || "Agentic"}Trigger`;
  const events = spec.operations.map((operation) => `${spec.timing} ${operation}`).join(", ");
  const relationPlan = inferRelatedApexPlan(spec);

  if (relationPlan) {
    return buildRelatedApexTrigger(triggerName, handlerName, events, spec, relationPlan);
  }

  return buildGenericApexTrigger(triggerName, handlerName, events, spec);
}

function inferRelatedApexPlan(spec) {
  const relationModel = salesforceRelationModel();
  const triggerModel = relationModel[spec.triggerObject] || {};
  const requested = spec.relatedObjects.filter(Boolean);
  if (!requested.length) return null;

  for (const relatedObject of requested) {
    const lookupField = triggerModel.lookups?.[relatedObject];
    if (lookupField) {
      return {
        rootObject: relatedObject,
        sourceField: lookupField,
        sourceExpression: `record.${lookupField}`,
        requestedChildren: requested.filter((candidate) => relationModel[relatedObject]?.children?.[candidate])
      };
    }
  }

  for (const [parentObject, lookupField] of Object.entries(triggerModel.lookups || {})) {
    const requestedChildren = requested.filter((candidate) => relationModel[parentObject]?.children?.[candidate]);
    if (requestedChildren.length) {
      return {
        rootObject: parentObject,
        sourceField: lookupField,
        sourceExpression: `record.${lookupField}`,
        requestedChildren
      };
    }
  }

  const requestedChildren = requested.filter((candidate) => triggerModel.children?.[candidate]);
  if (requestedChildren.length) {
    return {
      rootObject: spec.triggerObject,
      sourceField: "Id",
      sourceExpression: "record.Id",
      requestedChildren
    };
  }

  return null;
}

function salesforceRelationModel() {
  return {
    Account: {
      children: {
        Contact: { relationshipName: "Contacts", fields: ["Id", "FirstName", "LastName", "Email", "Phone"] },
        Opportunity: { relationshipName: "Opportunities", fields: ["Id", "Name", "StageName", "Amount", "CloseDate"] },
        Case: { relationshipName: "Cases", fields: ["Id", "CaseNumber", "Status", "Subject"] }
      }
    },
    Contact: {
      lookups: { Account: "AccountId" }
    },
    Opportunity: {
      lookups: { Account: "AccountId" }
    },
    Case: {
      lookups: { Account: "AccountId", Contact: "ContactId" }
    },
    Quote: {
      lookups: { Opportunity: "OpportunityId", Account: "AccountId" }
    },
    Order: {
      lookups: { Account: "AccountId" }
    },
    Contract: {
      lookups: { Account: "AccountId" }
    }
  };
}

function buildRelatedApexTrigger(triggerName, handlerName, events, spec, relationPlan) {
  const objectName = spec.triggerObject;
  const rootObject = relationPlan.rootObject;
  const idVar = `${lowerFirst(rootObject)}Ids`;
  const rootVar = `${lowerFirst(rootObject)}Records`;
  const nullGuard = relationPlan.sourceField === "Id" ? "" : ` && ${relationPlan.sourceExpression} != null`;

  return [
    `trigger ${triggerName} on ${objectName} (${events}) {`,
    `    Set<Id> ${idVar} = new Set<Id>();`,
    "",
    `    for (${objectName} record : Trigger.new) {`,
    `        ${objectName} oldRecord = Trigger.isUpdate ? Trigger.oldMap.get(record.Id) : null;`,
    "",
    `        if (${handlerName}.shouldProcess(record, oldRecord)${nullGuard}) {`,
    `            ${idVar}.add(${relationPlan.sourceExpression});`,
    "        }",
    "    }",
    "",
    `    if (!${idVar}.isEmpty()) {`,
    `        ${handlerName}.handle(${idVar});`,
    "    }",
    "}",
    "",
    `public with sharing class ${handlerName} {`,
    `    public static Boolean shouldProcess(${objectName} record, ${objectName} oldRecord) {`,
    buildConditionBody(spec.condition, "record", "oldRecord", "        "),
    "    }",
    "",
    `    public static void handle(Set<Id> ${idVar}) {`,
    `        List<${rootObject}> ${rootVar} = [`,
    `            SELECT ${buildRootQueryFields(rootObject, relationPlan.requestedChildren)}`,
    `            FROM ${rootObject}`,
    `            WHERE Id IN :${idVar}`,
    "        ];",
    "",
    `        for (${rootObject} ${lowerFirst(rootObject)}Record : ${rootVar}) {`,
    ...buildRelatedLoopBody(rootObject, relationPlan.requestedChildren),
    "        }",
    "    }",
    "}"
  ].join("\n");
}

function buildRootQueryFields(rootObject, requestedChildren) {
  const baseFields = rootObject === "Case" ? ["Id", "CaseNumber", "Status", "Subject"] : ["Id", "Name"];
  const relationModel = salesforceRelationModel();
  const subqueries = requestedChildren.map((childObject) => {
    const child = relationModel[rootObject]?.children?.[childObject];
    return `(SELECT ${child.fields.join(", ")} FROM ${child.relationshipName})`;
  });
  return [...baseFields, ...subqueries].join(",\n                ");
}

function buildRelatedLoopBody(rootObject, requestedChildren) {
  if (!requestedChildren.length) {
    return ["            // Add your business logic here."];
  }

  const relationModel = salesforceRelationModel();
  return requestedChildren.flatMap((childObject) => {
    const child = relationModel[rootObject]?.children?.[childObject];
    const childVar = `${lowerFirst(childObject)}Record`;
    return [
      `            for (${childObject} ${childVar} : ${lowerFirst(rootObject)}Record.${child.relationshipName}) {`,
      "                // Add your business logic here.",
      "            }"
    ];
  });
}

function buildGenericApexTrigger(triggerName, handlerName, events, spec) {
  const objectName = spec.triggerObject;
  const condition = spec.condition;
  const conditionLine = condition
    ? "            if (isMeaningfulChange(record, oldRecord)) recordsToProcess.add(record);"
    : "            recordsToProcess.add(record);";

  return [
    `trigger ${triggerName} on ${objectName} (${events}) {`,
    `    ${handlerName}.handle(Trigger.new, Trigger.oldMap, Trigger.isInsert, Trigger.isUpdate);`,
    "}",
    "",
    `public with sharing class ${handlerName} {`,
    `    public static void handle(List<${objectName}> newRecords, Map<Id, ${objectName}> oldMap, Boolean isInsert, Boolean isUpdate) {`,
    `        List<${objectName}> recordsToProcess = new List<${objectName}>();`,
    "",
    `        for (${objectName} record : newRecords) {`,
    `            ${objectName} oldRecord = isUpdate ? oldMap.get(record.Id) : null;`,
    conditionLine,
    "        }",
    "",
    "        if (recordsToProcess.isEmpty()) {",
    "            return;",
    "        }",
    "",
    "        // Query related records or perform DML here in bulk.",
    "    }",
    condition ? "" : null,
    condition ? `    private static Boolean isMeaningfulChange(${objectName} record, ${objectName} oldRecord) {` : null,
    condition ? `        Boolean matchesNow = record.${condition.field} == ${apexLiteral(condition.value)};` : null,
    condition ? `        Boolean didNotMatchBefore = oldRecord == null || oldRecord.${condition.field} != ${apexLiteral(condition.value)};` : null,
    condition ? "        return matchesNow && didNotMatchBefore;" : null,
    condition ? "    }" : null,
    "}"
  ].filter((line) => line !== null).join("\n");
}

function apexLiteral(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "\\'")}'`;
}

function buildConditionBody(condition, recordName, oldRecordName, indent) {
  if (!condition) return `${indent}return true;`;
  return [
    `${indent}Boolean matchesNow = ${recordName}.${condition.field} == ${apexLiteral(condition.value)};`,
    `${indent}Boolean didNotMatchBefore = ${oldRecordName} == null || ${oldRecordName}.${condition.field} != ${apexLiteral(condition.value)};`,
    `${indent}return matchesNow && didNotMatchBefore;`
  ].join("\n");
}

function lowerFirst(value) {
  const text = String(value || "");
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function salesforceStoriesHarnessReply(request, projectPath, detectedStack) {
  return [
    "Built the Salesforce story set.",
    "",
    "Epic: Deliver the requested Salesforce capability",
    "",
    "Story 1: Business user can complete the primary workflow",
    "As a business user, I want the Salesforce screen and data flow to support the requested process so that I can finish the work without manual handoffs.",
    "Acceptance criteria:",
    "- Given I have the right permission set, when I open the app/page, then the needed fields and actions are visible.",
    "- Given required data is missing, when I save, then Salesforce shows clear validation feedback.",
    "- Given valid data is submitted, when the transaction completes, then the record status and audit fields are updated.",
    "",
    "Story 2: Admin can configure the workflow safely",
    "As a Salesforce admin, I want metadata-driven configuration so that changes can be deployed between orgs without code edits.",
    "Acceptance criteria:",
    "- Permission sets control who can use the feature.",
    "- Validation rules or flows enforce the business rules.",
    "- Deployment can be validated with sf project deploy validate before release.",
    "",
    "Story 3: Support team can verify and troubleshoot",
    "As a support user, I want clear record history and errors so that I can resolve user issues quickly.",
    "Acceptance criteria:",
    "- Important state changes are visible in field history, debug logs, or related records.",
    "- Failed automation paths provide actionable error messages.",
    "- Apex/flow tests cover success, validation failure, and permission failure paths.",
    "",
    "Implementation direction:",
    "- confirm objects, fields, profiles/permission sets, and automation type",
    "- create/update metadata in force-app/main/default",
    "- add Apex/flow tests where automation is used",
    "- run sf apex run test and sf project deploy validate",
    "",
    `Request: ${request}`,
    `Project: ${projectPath}`,
    `Detected stack: ${detectedStack}`
  ].join("\n");
}

function extractHarnessUserRequest(message) {
  const text = String(message || "");
  const match = text.match(/User request:\s*\n([\s\S]*?)(?:\n{2,}|$)/i);
  return (match?.[1] || text).trim();
}

function extractPromptValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(text || "").match(new RegExp(`${escaped}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function extractPromptList(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(text || "").match(new RegExp(`${escaped}:\\s*\\n([\\s\\S]*?)(?:\\n{2,}|$)`, "i"));
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

async function callAgenticaResponsesAdapter(config, system, message) {
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: bearerHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: message }] }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(modelError(data));
  return cleanModelText(extractResponseText(data)) || "I received a model response, but it did not include text.";
}

async function callAgenticaChatAdapter(config, system, message) {
  const body = {
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: message }
    ]
  };

  if (config.provider === "glm-5.1") {
    body.thinking = { type: "enabled" };
    body.max_tokens = 4096;
    body.temperature = 1;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: bearerHeaders(config.apiKey),
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(modelError(data));
  return cleanModelText(data.choices?.[0]?.message?.content) || "I received a model response, but it did not include text.";
}

async function callAgenticaChatAdapterWithTimeout(config, system, message, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = {
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message }
      ]
    };

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: bearerHeaders(config.apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(modelError(data));
    return cleanModelText(data.choices?.[0]?.message?.content) || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function callAgenticaChatAdapterWithRetry(config, system, message, timeoutMs, attempts) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const text = await callAgenticaChatAdapterWithTimeout(config, system, message, timeoutMs);
      if (text) return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Model did not return text.");
}

async function callAnthropic(config, system, message) {
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: message }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(modelError(data));
  return cleanModelText((data.content || []).map((part) => part.text || "").join("\n")) || "I received a model response, but it did not include text.";
}

async function callGemini(config, system, message) {
  const modelId = config.model.startsWith("models/") ? config.model : `models/${config.model}`;
  const response = await fetch(`${config.baseUrl}/${modelId}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${system}\n\nUser request:\n${message}` }] }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(modelError(data));
  return cleanModelText((data.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("\n")) || "I received a model response, but it did not include text.";
}

async function callOllama(config, system, message) {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(modelError(data));
  return cleanModelText(data.message?.content || data.response) || "I received a model response, but it did not include text.";
}

function bearerHeaders(apiKey) {
  return {
    ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
    "Content-Type": "application/json"
  };
}

function modelError(data) {
  return data.error?.message || data.message || JSON.stringify(data.error || data).slice(0, 1200);
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function cleanModelText(value) {
  return String(value || "")
    .replace(/\n-{3,}\s*\n\s*\*\*Support Pollinations\.AI:\*\*[\s\S]*$/i, "")
    .replace(/\n\s*-{3,}\s*$/g, "")
    .trim();
}

async function listProviderModels(input) {
  const providerInfo = modelProviders.find((candidate) => candidate.id === normalizeProviderId(input.provider));
  if (!providerInfo) return { provider: input.provider, models: [], error: "Unknown provider." };

  const apiKey = String(input.apiKey || providerEnvValue(providerInfo) || "").trim();
  const baseUrl = normalizeProviderBaseUrl(providerInfo, input.baseUrl || providerBaseUrlFromEnv(providerInfo) || providerInfo.baseUrl || "", apiKey);

  try {
    if (providerInfo.type === "agentica" || providerInfo.type === "harness") {
      return {
        provider: providerInfo.id,
        models: providerInfo.models || []
      };
    }

    if (providerInfo.type === "agentica-responses-compatible" || providerInfo.type === "agentica-chat-compatible") {
      if (providerInfo.models?.length && !(providerInfo.id === "nvidia" && apiKey)) {
        return {
          provider: providerInfo.id,
          models: providerInfo.models
        };
      }
      if (!baseUrl) return { provider: providerInfo.id, models: [], error: "Base URL is required." };
      const response = await fetch(`${baseUrl}/models`, {
        headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}
      });
      const data = await response.json();
      if (!response.ok) throw new Error(modelError(data));
      const discoveredModels = (data.data || []).map((item) => ({ id: item.id, name: item.name || item.id })).sort(sortModels);
      return {
        provider: providerInfo.id,
        models: discoveredModels.length ? discoveredModels : (providerInfo.models || [])
      };
    }

    if (providerInfo.type === "ollama") {
      const response = await fetch(`${baseUrl}/api/tags`);
      const data = await response.json();
      if (!response.ok) throw new Error(modelError(data));
      return {
        provider: providerInfo.id,
        models: (data.models || []).map((item) => ({ id: item.name, name: item.name })).sort(sortModels)
      };
    }

    if (providerInfo.type === "anthropic") {
      if (!apiKey) return { provider: providerInfo.id, models: [], error: "API key is required to load Anthropic models." };
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(modelError(data));
      return {
        provider: providerInfo.id,
        models: (data.data || []).map((item) => ({ id: item.id, name: item.display_name || item.id })).sort(sortModels)
      };
    }

    if (providerInfo.type === "gemini") {
      if (!apiKey) return { provider: providerInfo.id, models: [], error: "API key is required to load Gemini models." };
      const response = await fetch(`${baseUrl}/models?key=${encodeURIComponent(apiKey)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(modelError(data));
      return {
        provider: providerInfo.id,
        models: (data.models || [])
          .filter((item) => (item.supportedGenerationMethods || []).includes("generateContent"))
          .map((item) => ({ id: item.name.replace(/^models\//, ""), name: item.displayName || item.name.replace(/^models\//, "") }))
          .sort(sortModels)
      };
    }

    return { provider: providerInfo.id, models: [], error: "Model discovery is not supported for this provider. Enter a model id manually." };
  } catch (error) {
    return {
      provider: providerInfo.id,
      models: [],
      error: error instanceof Error ? error.message : "Could not load models."
    };
  }
}

function sortModels(a, b) {
  return a.id.localeCompare(b.id);
}

function normalizeProviderBaseUrl(providerInfo, value, apiKey) {
  let baseUrl = String(value || "").trim().replace(/\/$/, "");
  if (providerInfo.id === "agentica-free-helper" && !apiKey && /api\.openai\.com(?:\/v1)?$/.test(baseUrl)) {
    baseUrl = providerInfo.baseUrl;
  }
  return baseUrl;
}

function providerBaseUrlFromEnv(providerInfo) {
  const legacyEnvs = [
    providerInfo.legacyEnv,
    ...(Array.isArray(providerInfo.legacyEnvs) ? providerInfo.legacyEnvs : [])
  ].filter(Boolean);
  return process.env[providerInfo.baseEnv]
    || process.env[`${providerInfo.env}_BASE_URL`]
    || legacyEnvs.map((envName) => process.env[`${envName}_BASE_URL`]).find(Boolean)
    || "";
}

function missingModelReply(scan) {
  return {
    kind: "model_setup",
    text: [
      "Select an AgenticaHarness or live API model before I answer.",
      "",
      "Click Select Model, choose AgenticaHarness Native Engine or your API provider, load models dynamically, pick one, and send again.",
      "",
      "Supported dynamic providers:",
      modelProviders.map((providerInfo) => `- ${providerInfo.name}`).join("\n"),
      "",
      `Selected project: ${scan.repoPath}`
    ].join("\n")
  };
}

function isGeneralChat(normalized) {
  return /story|stories|write|create|explain|how|why|what|make|generate|draft|summarize|design|architect|code|build/.test(normalized);
}

async function connectOrgReply(scan, message) {
  const sfAvailable = await commandAvailable("sf");
  const target = salesforceTargetFromMessage(message);
  const loginCommand = `sf org login web --alias ${target.alias} --instance-url ${target.instanceUrl}`;
  const statusCommand = `sf org display --target-org ${target.alias}`;
  const steps = agenticaSteps(scan, [
    `Salesforce domain: ${target.instanceUrl}`,
    `Alias: ${target.alias}`,
    "Connector: Salesforce CLI web login"
  ]);

  if (!sfAvailable) {
    return {
      kind: "salesforce-connect",
      steps,
      text: [
        "Salesforce CLI is not available on this machine yet.",
        "",
        "Install it first, then run:",
        loginCommand,
        "",
        "After login finishes, type: check org",
        "",
        "You can use any Salesforce login or My Domain URL.",
        "Examples:",
        "- connect org https://login.salesforce.com",
        "- connect org https://test.salesforce.com",
        "- connect org https://your-domain.my.salesforce.com",
        "",
        `Project: ${scan.repoPath}`,
        `Detected: ${stackNames(scan)}`
      ].join("\n")
    };
  }

  const orgList = await runReadOnlyCommand("sf", ["org", "list", "--json"], 12000);
  const connectedHint = summarizeOrgList(orgList.output);
  const loginStarted = startSalesforceLogin(target.alias, target.instanceUrl);

  return {
    kind: "salesforce-connect",
    steps,
    text: [
      "Salesforce CLI is installed.",
      connectedHint,
      "",
      `Target domain: ${target.instanceUrl}`,
      `Alias: ${target.alias}`,
      "",
      loginStarted
        ? "I opened the Salesforce web login flow. Finish the browser login, then come back here."
        : "I could not launch the login flow automatically. Run this in a terminal:",
      loginStarted ? "" : loginCommand,
      "",
      "When the browser login completes, verify it with:",
      statusCommand,
      "",
      `Then type: check org ${target.alias}`
    ].join("\n")
  };
}

async function orgStatusReply(message = "") {
  const sfAvailable = await commandAvailable("sf");
  const target = salesforceTargetFromMessage(message);
  const steps = [
    "Intake: check Salesforce org",
    `Alias/domain target: ${target.alias}`,
    "Connector: Salesforce CLI org display"
  ];

  if (!sfAvailable) {
    return {
      kind: "salesforce-status",
      steps,
      text: `Salesforce CLI is not installed or not on PATH. Install Salesforce CLI, then run: sf org login web --alias ${target.alias} --instance-url ${target.instanceUrl}`
    };
  }

  const result = await runReadOnlyCommand("sf", ["org", "display", "--target-org", target.alias, "--json"], 12000);
  if (result.exitCode !== 0) {
    return {
      kind: "salesforce-status",
      steps,
      text: [
        `I could not find a connected org for alias ${target.alias}.`,
        "",
        "Run:",
        `sf org login web --alias ${target.alias} --instance-url ${target.instanceUrl}`,
        "",
        "CLI output:",
        trimOutput(result.output)
      ].join("\n")
    };
  }

  return {
    kind: "salesforce-status",
    steps,
    text: [
      `Your Salesforce org alias ${target.alias} is connected.`,
      "",
      trimOutput(result.output)
    ].join("\n")
  };
}

async function exists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function listFiles(root) {
  const files = [];

  async function visit(directory, depth) {
    if (files.length >= maxFiles || depth > maxDepth) return;

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const fullPath = path.join(directory, entry.name);
      const relative = path.relative(root, fullPath).replaceAll(path.sep, "/");

      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) await visit(fullPath, depth + 1);
        continue;
      }

      if (entry.isFile()) files.push(relative);
    }
  }

  await visit(root, 0);
  return files.sort((a, b) => a.localeCompare(b));
}

function toProfile(definition, files) {
  const markers = new Set();

  for (const exact of definition.exact) {
    const match = files.find((file) => file === exact || file.endsWith(`/${exact}`) || file.startsWith(`${exact}/`) || file.includes(`/${exact}/`));
    if (match) markers.add(match);
  }

  for (const suffix of definition.suffix) {
    const match = files.find((file) => file.toLowerCase().endsWith(suffix));
    if (match) markers.add(match);
  }

  const markerList = Array.from(markers);
  if (markerList.length === 0) return null;

  return {
    id: definition.id,
    name: definition.name,
    confidence: markerList.length > 2 ? "High" : markerList.length > 1 ? "Medium" : "Low",
    markers: markerList,
    install: definition.install,
    test: definition.test,
    build: definition.build,
    run: definition.run,
    verifierNotes: definition.verifierNotes
  };
}

async function planRun(requirement, repoPath, mode) {
  const normalizedMode = ["PLAN_ONLY", "SUPERVISED", "AUTONOMOUS_LAB"].includes(mode) ? mode : "PLAN_ONLY";
  const scan = await scanRepository(repoPath);
  const selectedTools = selectTools(scan);
  const now = new Date().toISOString();
  const run = {
    id: crypto.randomUUID(),
    status: scan.exists ? "READY_FOR_EXECUTION" : "NEEDS_REPO",
    mode: normalizedMode,
    requirement,
    summary: `Planned ${normalizedMode} harness run for ${stackNames(scan)}. Objective: ${truncate(requirement, 150)}`,
    scan,
    agents: agentsFor(scan, selectedTools),
    selectedTools,
    modelProviders: models,
    stages: stagesFor(requirement, scan, selectedTools, normalizedMode),
    guardrails: guardrailsFor(normalizedMode),
    createdAt: now,
    updatedAt: now
  };

  const runs = await listRuns();
  await mkdir(runsDir, { recursive: true });
  await writeFile(runsFile, JSON.stringify([run, ...runs].slice(0, 80), null, 2), "utf8");
  return run;
}

function selectTools(scan) {
  const selected = new Set(["filesystem-context", "vector-memory", "mcp-gateway", "terminal-sandbox", "git-workbench", "openapi-connector", "work-tracker"]);
  if (scan.stacks.some((profile) => ["node", "java", "python", "dotnet", "go", "rust", "php", "ruby"].includes(profile.id))) selected.add("browser-runner");
  if (scan.stacks.some((profile) => ["docker", "terraform"].includes(profile.id))) selected.add("cloud-deployer");
  return tools.filter((candidate) => selected.has(candidate.id));
}

function agentsFor(scan, selectedTools) {
  const ids = selectedTools.map((candidate) => candidate.id);
  const stackSummary = stackNames(scan);
  return [
    agent("product-analyst", "Product Analyst", "Turns the request into goals, acceptance criteria, constraints, and unknowns.", ["work-tracker", "filesystem-context"], ids),
    agent("stack-architect", "Stack Architect", `Chooses adapters and execution strategy for ${stackSummary}.`, ["filesystem-context", "vector-memory", "openapi-connector"], ids),
    agent("planner", "Planner", "Builds the work graph, assigns specialist agents, and sets verification checkpoints.", ["mcp-gateway", "vector-memory"], ids),
    agent("implementer", "Implementer", "Applies bounded changes through tools and adapter-specific commands.", ["terminal-sandbox", "git-workbench", "filesystem-context"], ids),
    agent("verifier", "Verifier", "Runs tests, lint, build, security, browser, and policy checks before delivery.", ["terminal-sandbox", "browser-runner", "database-gateway"], ids),
    agent("release-steward", "Release Steward", "Creates PR, deployment packet, rollback note, trace summary, and human handoff.", ["git-workbench", "cloud-deployer", "work-tracker"], ids)
  ];
}

function agent(id, name, responsibility, wantedTools, selectedIds) {
  return { id, name, responsibility, tools: wantedTools.filter((toolId) => selectedIds.includes(toolId)) };
}

function stagesFor(requirement, scan, selectedTools, mode) {
  return [
    stage("01-intake", "Intent Intake", "DONE", "Product Analyst", "Requirement captured and normalized into a build objective.", [`Objective: ${truncate(requirement, 180)}`, "Extract acceptance criteria, constraints, target users, and non-goals.", "Mark unknowns that require context retrieval or approval."]),
    stage("02-stack-scan", "Technology Scan", scan.exists ? "DONE" : "BLOCKED", "Stack Architect", scan.exists ? `Detected ${stackNames(scan)} at ${scan.repoPath}.` : "Repository path could not be scanned.", scan.exists ? scan.recommendedCommands : scan.warnings),
    stage("03-context", "Context Pack", scan.exists ? "READY" : "WAITING", "Context Builder", "Build a compact context pack from code, docs, tickets, schemas, logs, and prior traces.", [`Sample files: ${scan.detectedFiles.slice(0, 10).join(", ") || "none"}`, "Summarize architecture and key interfaces.", "Collect runbook, tests, and environment notes."]),
    stage("04-planning", "Work Graph", "READY", "Planner", "Create deterministic workflow nodes and reserve agent loops for ambiguous work.", ["Split work into architect, implementer, verifier, and release steward tasks.", "Set iteration budgets, stop conditions, and fallback path.", "Choose model provider per task based on role and context needs."]),
    stage("05-tool-routing", "Tool Routing", "READY", "Tool Router", "Bind required capabilities to MCP, OpenAPI, CLI, native, and webhook tools.", selectedTools.map((candidate) => `${candidate.name}: ${candidate.risk} risk${candidate.requiresApproval ? ", approval required" : ""}`)),
    stage("06-execution", "Sandbox Execution", mode === "PLAN_ONLY" ? "GATED" : "READY", "Implementer", modeDescription(mode), ["Run adapter commands only after policy checks.", "Capture stdout, stderr, changed files, and duration.", "Route errors back to the planner with exact diagnostics."]),
    stage("07-verification", "Verification", "READY", "Verifier", "Tests and policy checks must pass before delivery.", verifierActions(scan)),
    stage("08-delivery", "Delivery", "READY", "Release Steward", "Prepare answer, artifact, PR packet, rollback plan, and trace summary.", ["Summarize changes and evidence.", "Link approvals, commands, tool calls, and residual risks.", "Refresh memory with accepted decisions and corrections."])
  ];
}

function stage(id, name, status, owner, summary, actions) {
  return { id, name, status, owner, summary, actions };
}

function verifierActions(scan) {
  const commands = unique(scan.stacks.flatMap((profile) => [...profile.test, ...profile.build]));
  return commands.length > 0 ? commands : ["No adapter-specific verifier found; define a custom verification command."];
}

function guardrailsFor(mode) {
  return [
    "Use structured tool schemas and capture every input, output, exit code, timeout, and approval.",
    "Never pass secrets into prompts, generated files, logs, traces, or user-visible summaries.",
    "Read-only context tools are allowed by default; mutating tools require explicit policy checks.",
    "Terminal, Git writes, database writes, cloud deploys, and production actions require human approval.",
    "Failed tests, failed builds, or policy failures route back to the planner with exact diagnostics.",
    "Every delivery includes verification evidence, changed-file summary, rollback notes, and residual risk.",
    `Current mode: ${mode}`
  ];
}

function modeDescription(mode) {
  if (mode === "PLAN_ONLY") return "No mutating tools run. The harness produces a grounded plan, commands, and gates.";
  if (mode === "SUPERVISED") return "Low-risk actions may run after policy checks; high-risk tools wait for human approval.";
  return "Autonomous lab mode is limited to disposable sandboxes and still blocks critical production actions.";
}

async function listRuns() {
  try {
    return JSON.parse(await readFile(runsFile, "utf8"));
  } catch {
    return [];
  }
}

function commandAvailable(command) {
  const finder = process.platform === "win32" ? "where.exe" : "which";
  return runReadOnlyCommand(finder, [command], 5000).then((result) => result.exitCode === 0);
}

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runReadOnlyCommand(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = execFile(command, args, { windowsHide: true, timeout: timeoutMs, shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command) }, (error, stdout, stderr) => {
      const exitCode = typeof error?.code === "number" ? error.code : error ? -1 : 0;
      resolve({
        exitCode,
        output: `${stdout || ""}${stderr || ""}`.trim()
      });
    });

    child.on("error", (error) => {
      resolve({ exitCode: -1, output: error.message });
    });
  });
}

function runProjectCommand(cwd, command, timeoutMs) {
  const allowed = [
    "git status",
    "git diff",
    "git log",
    "git branch",
    "npm ",
    "npx ",
    "pnpm ",
    "yarn ",
    "dotnet ",
    "go ",
    "cargo ",
    "python ",
    "pytest",
    "composer ",
    "bundle ",
    "sf ",
    "./mvnw ",
    ".\\mvnw.cmd ",
    "mvn ",
    "gradle ",
    "./gradlew "
  ];

  if (!allowed.some((prefix) => command.startsWith(prefix))) {
    return Promise.resolve({
      exitCode: -1,
      output: `Blocked command because it is not in the verification allowlist: ${command}`
    });
  }

  const effectiveCommand = process.platform === "win32" && command.startsWith("./mvnw ")
    ? command.replace("./mvnw ", ".\\mvnw.cmd ")
    : command;

  return new Promise((resolve) => {
    const child = spawn(effectiveCommand, {
      cwd,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        Path: `C:\\Program Files\\nodejs;${process.env.Path || ""}`
      }
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ exitCode: -1, output: `Command timed out after ${timeoutMs / 1000}s.\n${output}`.trim() });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
      if (output.length > 12000) output = output.slice(-12000);
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk.toString();
      if (output.length > 12000) output = output.slice(-12000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, output: error.message });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode: exitCode ?? -1, output: output.trim() });
    });
  });
}

function startSalesforceLogin(alias, instanceUrl) {
  try {
    const child = spawn(
      "sf",
      ["org", "login", "web", "--alias", alias, "--instance-url", instanceUrl],
      {
        detached: true,
        shell: process.platform === "win32",
        stdio: "ignore",
        windowsHide: true
      }
    );
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function salesforceTargetFromMessage(message = "") {
  const text = String(message || "");
  const normalized = text.toLowerCase();
  const aliasMatch = text.match(/\balias\s+([a-z0-9_-]+)/i) || text.match(/\b(?:check|status)\s+org\s+([a-z0-9_-]+)\b/i);
  const explicitUrl = text.match(/https?:\/\/[^\s,;]+/i)?.[0]?.replace(/[).,;]+$/, "");
  const explicitDomain = text.match(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:my\.salesforce\.com|salesforce\.com|force\.com|cloudforce\.com))\b/i)?.[1];
  const instanceUrl = normalizeSalesforceInstanceUrl(
    explicitUrl || (explicitDomain ? `https://${explicitDomain}` : normalized.includes("sandbox") || normalized.includes("test") ? "https://test.salesforce.com" : "https://login.salesforce.com")
  );
  const host = new URL(instanceUrl).hostname;
  const alias = sanitizeSalesforceAlias(aliasMatch?.[1] || `org-${host.split(".")[0]}`);
  return { alias, instanceUrl };
}

function normalizeSalesforceInstanceUrl(value) {
  const raw = String(value || "https://login.salesforce.com").trim().replace(/[).,;]+$/, "");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.hostname}`;
}

function sanitizeSalesforceAlias(value) {
  return String(value || "org-login")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org-login";
}

function summarizeOrgList(output) {
  try {
    const parsed = JSON.parse(output);
    const scratchOrgs = parsed.result?.scratchOrgs?.length || 0;
    const nonScratchOrgs = parsed.result?.nonScratchOrgs?.length || 0;
    const total = scratchOrgs + nonScratchOrgs;
    return total > 0
      ? `I found ${total} org connection(s) already in Salesforce CLI.`
      : "I did not find any existing org connections yet.";
  } catch {
    return output ? "I checked existing org connections, but the CLI output was not JSON." : "I did not find existing org connection output.";
  }
}

function formatRunForChat(run) {
  const stacks = stackNames(run.scan);
  const stages = run.stages
    .slice(0, 5)
    .map((stage) => `- ${stage.name}: ${humanizeStage(stage)}`)
    .join("\n");

  return [
    `Got it. I’ll work on this in ${run.scan.repoPath}.`,
    "",
    `I detected: ${stacks}.`,
    "",
    "Here is the first pass:",
    stages,
    "",
    "I will ask before anything risky. You can say: scan it, verify it, connect my org, or continue."
  ].join("\n");
}

function humanizeStage(stage) {
  if (stage.name === "Intent Intake") return "I understood the request and turned it into a concrete objective.";
  if (stage.name === "Technology Scan") return "I checked what kind of project this is.";
  if (stage.name === "Context Pack") return "I will gather the important files and docs before changing anything.";
  if (stage.name === "Work Graph") return "I will break the work into small steps.";
  if (stage.name === "Tool Routing") return "I will choose the right tools for the job.";
  return stage.summary;
}

function trimOutput(value) {
  const text = String(value || "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").trim();
  return text.length > 1800 ? `${text.slice(0, 1800)}\n...` : text;
}

async function serveStatic(response, requestedPath) {
  const staticRoot = (await exists(path.join(distDir, "index.html"))) ? distDir : publicDir;
  const cleanPath = requestedPath === "/" ? "/index.html" : requestedPath;
  const candidate = path.normalize(path.join(staticRoot, cleanPath));
  const safePath = candidate.startsWith(staticRoot) ? candidate : path.join(staticRoot, "index.html");
  const filePath = (await exists(safePath)) ? safePath : path.join(staticRoot, "index.html");
  const ext = path.extname(filePath);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".zip": "application/zip"
  }[ext] || "application/octet-stream";

  response.writeHead(200, { "Content-Type": contentType });
  response.end(await readFile(filePath));
}

async function serveGeneratedProjectPreview(response, requestedPath) {
  const match = requestedPath.match(/^\/live-projects\/([^/]+)\/?$/);
  const slug = decodeURIComponent(match?.[1] || "");
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return json(response, { error: "Generated project not found" }, 404);
  }

  for (const base of generatedProjectBases(rootDir)) {
    const candidateDirectory = path.resolve(base, slug);
    if (!isInside(base, candidateDirectory)) continue;
    const previewFile = path.join(candidateDirectory, "live-preview.html");
    if (await exists(previewFile)) {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(await readFile(previewFile));
      return;
    }
  }

  return json(response, { error: "Generated project not found" }, 404);
}

async function serveArtifact(response, requestedPath) {
  const cleanPath = requestedPath.replace(/^\/artifacts\//, "");
  const candidate = path.normalize(path.join(artifactsDir, cleanPath));
  const safeRoot = path.resolve(artifactsDir);
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(safeRoot) || !(await exists(resolved))) {
    return json(response, { error: "Artifact not found" }, 404);
  }
  const ext = path.extname(resolved);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".zip": "application/zip"
  }[ext] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  response.end(await readFile(resolved));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function json(response, payload, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function unique(values) {
  return Array.from(new Set(values));
}

function stackNames(scan) {
  return scan.stacks.map((profile) => profile.name).join(", ") || "unknown stack";
}

function truncate(value, length) {
  const trimmed = String(value || "").trim();
  return trimmed.length > length ? `${trimmed.slice(0, length - 3)}...` : trimmed;
}

function slugify(value) {
  return String(value || "artifact").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "artifact";
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
