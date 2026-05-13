# AgenticaHarness Project Work Documentation

Updated: May 13, 2026

## 1. Project Overview

AgenticaHarness is the standalone agentic AI harness inside this workspace. It is separate from the older Salesforce Command Center modules at the repository root.

The goal of AgenticaHarness is to provide a clean chat-first assistant that can:

- answer like a modern AI chat app
- remember recent conversation context
- scan and understand a selected local project
- route prompts through model providers
- generate deployable React/Vite apps from prompts
- serve live previews of generated apps
- expose safe project commands such as scan, build, test, verify, and git status
- keep learning memory and teacher-model routes for stronger answers
- run locally without Codex after deployment

## 2. Main Workspace Structure

The repository contains these main areas:

| Path | Purpose |
| --- | --- |
| `agentic-harness/` | Main AgenticaHarness standalone app: React UI, Node backend, model routing, generated app pipeline, learning memory, and deployment docs. |
| `agentica-projects/` | Generated apps created by AgenticaHarness from user prompts. |
| `backend/` | Older Java/Spring Boot Salesforce Command Center backend. |
| `desktop/` | Older Electron/React desktop shell for Salesforce Command Center. |
| `salesforce/` | Salesforce placeholder/project area. |
| `prompts/` | Agent prompt notes/placeholders. |
| `scripts/` | Root-level helper scripts for validation and PR workflows. |

The active user-facing project for this phase is:

```text
agentic-harness/
```

## 3. Work Completed

### 3.1 Product Name And Branding

The visible app name was corrected to:

```text
AgenticaHarness
```

The active UI and browser title were corrected so they show the right product name everywhere.

Updated areas include:

- `agentic-harness/index.html`
- `agentic-harness/src/client/main.jsx`
- `agentic-harness/src/client/styles.css`
- provider names and backend response text in `agentic-harness/server.mjs`
- package name in `agentic-harness/package.json`
- lockfile package name in `agentic-harness/package-lock.json`

Important current source values:

```jsx
const BRAND_NAME = "AgenticaHarness";
const ENGINE_NAME = "AgenticaHarness";
```

### 3.2 Clean Chat-First UI

The UI was changed from a busy blueprint/feature-heavy screen into a simpler chat surface.

Current visible UI includes:

- top header with project drawer button
- centered AgenticaHarness brand
- model selector button
- home screen heading: `AgenticaHarness`
- prompt box: `Message AgenticaHarness`
- project selector pill
- model selector pill
- send button
- chat transcript view after the first message
- assistant avatar
- user message bubble
- assistant response text
- copy and edit buttons on user messages
- generated app action buttons when a live preview is created

The active rendered component is:

```jsx
<CleanApp />
```

The older blueprint component still exists in `main.jsx`, but the React root renders `CleanApp`, so the clean chat UI is the active app.

### 3.3 Chat Behavior Like Modern AI Apps

The chat flow was improved so follow-up prompts work more like ChatGPT, Gemini, or Claude.

Frontend changes:

- sends the latest user message
- sends recent conversation history
- keeps messages in React state
- shows a loading/thinking state
- shows errors in the chat if the request fails
- supports editing a previous user message back into the prompt box
- supports copying user messages

Backend changes:

- `/api/chat` now accepts `history`
- recent history is normalized by `normalizeChatHistory`
- conversation context is formatted by `formatChatHistory`
- `chatReplyWithLearning` and `chatReply` accept history
- `agenticaAgentReply` uses recent conversation context in its prompt

Relevant backend functions:

```text
normalizeChatHistory()
formatChatHistory()
chatReplyWithLearning()
chatReply()
agenticaAgentReply()
```

### 3.4 Backend API Work

The Node backend in `server.mjs` owns the AgenticaHarness runtime.

Important endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Health check and runtime identity. |
| `GET /api/blueprint` | Harness blueprint. |
| `GET /api/tools` | Tool registry. |
| `GET /api/models` | Model map. |
| `GET /api/model-providers` | UI provider list. |
| `GET /api/model-status` | Provider/model status. |
| `GET /api/deerflow-workspace` | DeerFlow-style workspace state. |
| `POST /api/provider-models` | Load/list models for a selected provider. |
| `GET /api/learning` | Learning memory summary. |
| `POST /api/learning` | Add learning memory manually. |
| `POST /api/learning/teach` | Teach AgenticaHarness from an external answer. |
| `POST /api/teacher-ensemble` | Ask configured teacher models and distill a lesson. |
| `POST /api/scan` | Scan a selected repository. |
| `POST /api/chat` | Main chat endpoint. |
| `POST /api/live-chat` | Embedded chat endpoint for generated live apps. |
| `POST /api/agentica` | Native AgenticaHarness API route. |
| `GET /api/runs` | List previous runs. |
| `POST /api/runs` | Create a plan/run record. |
| `GET /api/runs/:id` | Inspect a run. |
| `GET /live-projects/:id/` | Serve generated app live preview. |
| `GET /artifacts/...` | Serve legacy artifacts. |

### 3.5 Model Provider Routing

AgenticaHarness supports multiple model routes.

Configured provider entries include:

- AgenticaHarness Native Engine
- AgenticaHarness Qwen Core local route
- AgenticaHarness Free Helper Route
- NVIDIA NIM Helper
- AirLLM local bridge
- GLM 5.1 via Z.ai
- GLM 5.1 via OpenRouter
- AgenticaHarness Helper Key
- OpenRouter Helper
- Anthropic
- Gemini
- Ollama
- Custom AgenticaHarness-compatible helper

The default local model route is:

```text
AgenticaHarness Native Engine / agentica-brain
```

Qwen local-core support is configured through:

```text
AGENTICA_QWEN_CORE_ENABLED=true
AGENTICA_QWEN_CORE_BASE_URL=http://127.0.0.1:11434/v1
AGENTICA_QWEN_CORE_MODEL=agentica-qwen-core
```

### 3.6 Project Scanner And Local Context

AgenticaHarness scans selected project folders and detects stack markers for:

- Node / TypeScript / frontend
- Python
- Java / JVM
- .NET
- Go
- Rust
- PHP / Composer
- Ruby
- Salesforce DX
- Docker / Compose
- Terraform / IaC

The scanner builds a compact context pack from important files such as:

- `README.md`
- `package.json`
- `vite.config.js`
- `vite.config.ts`
- `tsconfig.json`
- `sfdx-project.json`
- `pom.xml`
- `requirements.txt`
- source files such as `.js`, `.jsx`, `.ts`, `.tsx`, `.java`, `.py`, `.css`, `.html`, `.md`

This is used by the chat backend so responses are grounded in the selected project.

### 3.7 Safe Command Runner

AgenticaHarness can run selected local commands when the prompt explicitly asks for them.

Examples:

- `git status`
- `run build`
- `run tests`
- `run verification`

The backend chooses commands from the detected stack profile and records the result into the response.

Current philosophy:

- safe read/verification commands can run
- risky changes remain gated
- deployment and destructive operations require explicit direction

### 3.8 Generated App Pipeline

AgenticaHarness can generate app projects into `agentica-projects`.

Generated projects include:

- `package.json`
- `index.html`
- `live-preview.html`
- `agentica.manifest.json`
- `DEPLOYMENT.md`
- `README.md`
- `public/manifest.webmanifest`
- `src/main.jsx`
- `src/styles.css`

The backend can infer app type from prompts, including:

- ecommerce / store
- booking / rental
- dashboard
- restaurant
- education
- portfolio
- SaaS
- generic website

Generated previews are served through:

```text
/live-projects/<project-id>/
```

### 3.9 Embedded Live Chat In Generated Apps

Generated live apps include an embedded AgenticaHarness chat panel.

The live chat sends:

- user message
- app title
- app type
- current app metadata
- selection/cart context when present

It calls:

```text
POST /api/live-chat
```

This lets generated apps ask AgenticaHarness for changes, business guidance, and next build steps.

### 3.10 Learning Memory And Teacher Models

AgenticaHarness has a local learning layer.

Primary memory file:

```text
agentic-harness/.harness/learning.json
```

The learning layer can store:

- completed-turn lessons
- manual lessons
- teacher-model distilled lessons
- open-source learning summaries

Teacher routes can use configured external or local models to improve answer quality. If no external model is reachable, AgenticaHarness still uses local prompt-engine and learning memory.

### 3.11 Open-Source Learning Scripts

The project includes open-source learning scripts:

```bash
npm run learn:web:once
npm run learn:web
npm run learn:web:status
npm run learn:web:stop
```

The learner stores compact summaries and source links. It does not execute downloaded code or train weights.

### 3.12 Deployment And Local Hosting

Development UI:

```text
http://127.0.0.1:5174/
```

During this work, the cleaned UI was also verified on:

```text
http://127.0.0.1:5188/
```

Node API backend:

```text
http://127.0.0.1:8797/
```

Apache/LAN hosting target:

```text
http://127.0.0.1:8088/
```

The Apache setup serves the built frontend and proxies:

```text
/api/          -> http://127.0.0.1:8797/api/
/artifacts/    -> http://127.0.0.1:8797/artifacts/
/live-projects/ -> http://127.0.0.1:8797/live-projects/
```

Windows startup helper:

```text
agentic-harness/scripts/start-agentica-server.ps1
```

## 4. Important Files Changed Or Created

### Frontend

```text
agentic-harness/src/client/main.jsx
agentic-harness/src/client/styles.css
agentic-harness/index.html
```

Key frontend changes:

- visible app name set to `AgenticaHarness`
- clean chat UI created
- active renderer changed to `CleanApp`
- recent chat history sent with each request
- prompt box, header, project drawer, and model picker refined
- final CSS overrides added so old blueprint styling does not win over the clean chat layout

### Backend

```text
agentic-harness/server.mjs
```

Key backend changes:

- AgenticaHarness branding in runtime text
- model provider names updated
- `/api/chat` accepts recent chat history
- history is passed into the answer prompt
- generated app text and live-chat text updated to AgenticaHarness

### Package Metadata

```text
agentic-harness/package.json
agentic-harness/package-lock.json
```

Key package changes:

- package name changed to `agenticaharness`
- description updated for AgenticaHarness
- scripts include dev, build, start, preview, CLI, and web-learning commands

### Documentation

Existing docs include:

```text
docs/LOCAL_APACHE_HOSTING.md
docs/AGENTICA_NEURAL_ENGINE.md
docs/AIRLLM_LOCAL_MODEL.md
docs/QWEN_CORE_LOCAL_MODEL.md
docs/GSTACK_REFERENCE.md
docs/DEERFLOW_TARS_REFERENCE.md
docs/DEPLOYABLE_GENERATED_APPS.md
docs/AGENTICA_LIVE_CHAT.md
docs/STANDALONE_LIVE_DEPLOYMENT.md
docs/ARCHITECTURE.md
```

This full work document was added as:

```text
docs/PROJECT_WORK_DOCUMENTATION.md
```

## 5. Current Verified State

The following were verified during the work:

- `AgenticaHarness` appears in the browser title.
- `AgenticaHarness` appears in the header.
- `AgenticaHarness` appears in the main heading.
- Prompt placeholder says `Message AgenticaHarness`.
- A basic chat message `hello` returned an assistant response.
- `server.mjs` syntax check passed.
- JSX parse check passed.
- A full Vite build was attempted but hung in this OneDrive-backed local environment, so browser verification was used instead.

Known dev-server verification URL:

```text
http://127.0.0.1:5188/
```

## 6. Current Known Notes

1. The clean active app is rendered by `CleanApp`.
2. The older blueprint `App` still exists in `main.jsx` and can be removed later to reduce file size.
3. Some older documentation still uses the shorter name `Agentica` because it describes the underlying engine history. The active product name is `AgenticaHarness`.
4. The generated manifest file remains named `agentica.manifest.json` for compatibility with existing generated apps.
5. Full production build should be re-tested after moving out of OneDrive or after clearing any local file lock/dev-server issues.

## 7. How To Run

From:

```text
C:\Users\rajam\OneDrive\Documents\New project\agentic-harness
```

Install dependencies:

```powershell
npm install
```

Run dev mode:

```powershell
npm run dev
```

If port `5174` is busy, run Vite on another port:

```powershell
node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5188
```

Run backend only:

```powershell
$env:PORT='8797'
npm start
```

Start Apache/local live hosting:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-agentica-server.ps1
```

## 8. Suggested Next Steps

Recommended next cleanup:

1. Remove the old unused blueprint `App` component from `src/client/main.jsx`.
2. Remove old blueprint-only CSS blocks after confirming `CleanApp` is the only UI.
3. Update older docs from `Agentica` to `AgenticaHarness` where they refer to the product instead of legacy engine internals.
4. Re-run `npm run build` outside OneDrive or after stopping stale Node/Vite processes.
5. Add a small smoke test for:
   - page title
   - prompt input
   - `/api/chat`
   - first assistant response
6. Add persistent thread storage if you want conversations to remain after refresh.
7. Add streaming response events for a more ChatGPT/Gemini/Claude-like feel.

## 9. Short Summary

We turned the project into a cleaner AgenticaHarness chat app with local project awareness, model routing, generated-app support, live previews, learning memory, and a standalone backend. The UI is now centered around chat, and the backend now supports conversation history so follow-up prompts behave more naturally.
