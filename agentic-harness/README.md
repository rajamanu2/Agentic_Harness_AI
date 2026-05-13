# Universal Agentic Harness

A standalone MVP for harness-engineered agentic AI. It is intentionally separate from the existing Salesforce command center.

The app gives you:

- A technology scanner for Node, Python, Java, .NET, Go, Rust, PHP, Ruby, Salesforce DX, Docker, and Terraform markers
- A reusable orchestration blueprint: intake, scan, context, planning, tool routing, execution, verification, delivery, observability
- A tool registry for MCP, OpenAPI, CLI, native, webhook, Git, browser, terminal, database, cloud, and memory tools
- A model gateway map owned by Agentica Native, with optional helper routes for NVIDIA NIM, AirLLM 2.11.0, Agentica-compatible APIs, Anthropic, Gemini, Azure, Ollama, and OpenRouter
- Optional Agentica Qwen Core mode for running a local Qwen GGUF/quantized model through Ollama, llama.cpp, or another OpenAI-compatible local server
- A planner that produces gated stages, agents, commands, guardrails, and verification steps for any scanned repo
- A React control surface for scanning a repo and planning a harness run

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5174`.

The local Agentica API currently runs on `http://127.0.0.1:8797` when started for Apache hosting.

## Open-Source Web Learning

AgenticaHarness can keep its local learning memory warm from public open-source release feeds. This does not execute downloaded code or train model weights; it saves compact, verified-later lessons into:

```text
agentic-harness/.harness/learning.json
```

Run one learning pass:

```bash
npm run learn:web:once
```

Keep learning until you stop it:

```bash
npm run learn:web
```

Check or stop the learner:

```bash
npm run learn:web:status
npm run learn:web:stop
```

Default sources include OpenAI Agents SDK, LangChain, LangGraph, Microsoft AutoGen, CrewAI, LlamaIndex, and Model Context Protocol release feeds.

For the full local Apache setup, including LAN access for other browsers, see:

```text
docs/LOCAL_APACHE_HOSTING.md
```

For the Neural Engine, learning memory, and teacher-LLM tooling, see:

```text
docs/AGENTICA_NEURAL_ENGINE.md
```

For AirLLM 2.11.0 local model setup, see:

```text
docs/AIRLLM_LOCAL_MODEL.md
```

For Qwen local-core setup with a large local model file, see:

```text
docs/QWEN_CORE_LOCAL_MODEL.md
```

For the GStack engineering-team reference and integration notes, see:

```text
docs/GSTACK_REFERENCE.md
```

For the DeerFlow-style research workspace and UI-TARS/Agent TARS reference map, see:

```text
docs/DEERFLOW_TARS_REFERENCE.md
```

For generated apps that are live-previewed and ready for server/domain deployment, see:

```text
docs/DEPLOYABLE_GENERATED_APPS.md
```

For the embedded chat/response layer inside generated live models, see:

```text
docs/AGENTICA_LIVE_CHAT.md
```

For running Agentica live without Codex, see:

```text
docs/STANDALONE_LIVE_DEPLOYMENT.md
```

For the full work log and project documentation of what has been built so far, see:

```text
docs/PROJECT_WORK_DOCUMENTATION.md
```

On Windows, if `npm` is not on PATH in a shell, use:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

## API

- `GET /api/health`
- `GET /api/blueprint`
- `GET /api/tools`
- `GET /api/models`
- `GET /api/deerflow-workspace`
- `GET /live-projects/:id/`
- `POST /api/scan`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/:id`

## Safety

This MVP defaults to `PLAN_ONLY`. It does not execute mutating tools automatically. The design keeps terminal, Git writes, database writes, cloud deploys, and production actions behind approval gates.

## Next Build Steps

1. Add MCP server discovery and live tool schema import.
2. Add model-provider calls for planner and verifier agents.
3. Add a sandbox command runner with allowlists, timeouts, and approval records.
4. Add vector indexing for code/docs/tickets.
5. Add patch generation, verifier repair loops, and PR creation.
