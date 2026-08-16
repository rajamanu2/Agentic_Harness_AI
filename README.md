# ForgeOS

An extensible agent operating system built on the ForgeOS platform stack, with repository intelligence, durable learning, policy-controlled execution, evidence chains, Jira, Salesforce, Harness, provider routing, and desktop workflows.

The complete downstream platform is in `forgeos-platform/`. Build and operation instructions are documented in [FORGEOS_BUILD.md](FORGEOS_BUILD.md); the service bridge is documented in [FORGEOS_AGENTICA_INTEGRATION.md](FORGEOS_AGENTICA_INTEGRATION.md).

Verified Windows binaries are available in `release/`; see [BUILD_VERIFICATION.md](BUILD_VERIFICATION.md) for build coverage and SHA-256 hashes.

## Modules

- `desktop/` Electron + React + TypeScript app
- `backend/` Java 21 + Spring Boot API
- `salesforce/` placeholder for the Salesforce DX repository
- `scripts/` Salesforce validation and PR helper scripts
- `prompts/` agent prompt placeholders

## Run The Backend

```bash
cd backend
./mvnw spring-boot:run
```

On Windows PowerShell:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The API starts on `http://localhost:8080`.

Opening `http://localhost:8080/` redirects to the local desktop UI URL. Override it with `DESKTOP_UI_URL` if needed.

## Run The Desktop App

```bash
cd desktop
npm install
npm run dev
```

The React dev server runs on `http://127.0.0.1:5173` and Electron opens the desktop shell.

## MVP API

- `GET /api/system/hello`
- `GET /api/org/status`
- `GET /api/org/changes`
- `POST /api/org/scan/run`
- `GET /api/org/scan/latest`
- `GET /api/org/scan/history`
- `GET /api/logs`
- `POST /api/codex/run`
- `POST /api/delivery/run`
- `GET /api/delivery/{id}/status`
- `POST /api/deployment/validate`
- `POST /api/jira/story`
- `GET /api/ai/provider`
- `POST /api/ai/chat`
- `POST /api/ai/orchestrator/plan`
- `POST /api/ai/harness/run`

## Configuration

Copy `.env.example` values into your shell environment or configure them in your deployment environment.

No secrets are hard-coded. Jira, Salesforce, GitHub, GLM, Harness, and Codex integration points use placeholders until credentials and local CLIs are configured.

Required local tools for full integration:

- Salesforce CLI: `sf org login web --alias dev-sandbox --instance-url https://test.salesforce.com`
- Codex CLI: `npm install -g @openai/codex`
- GitHub CLI: `gh auth login`
- Jira Cloud API token in `JIRA_API_TOKEN`

### GLM 5.1 Model Gateway

The backend is wired for an OpenAI-compatible GLM provider. It runs in placeholder mode until `AI_API_KEY` is set.

```bash
AI_PROVIDER=glm
AI_MODEL=glm-5.1
AI_BASE_URL=https://api.z.ai/api/paas/v4
AI_API_KEY=your_glm_or_gateway_key
```

Use `GET /api/ai/provider` to verify whether the model is configured.

### Salesforce Login Domains

Use `SALESFORCE_LOGIN_URL` for sandbox, production, or a Salesforce My Domain URL:

```bash
SALESFORCE_LOGIN_URL=https://test.salesforce.com
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_LOGIN_URL=https://your-domain.my.salesforce.com
```

The desktop connection card lets you edit the login URL before copying the CLI login command.

### Harness

Harness is wired through a custom trigger URL and remains placeholder-only until configured:

```bash
HARNESS_TRIGGER_URL=https://app.harness.io/gateway/pipeline/api/webhook/custom/...
HARNESS_API_KEY=your_harness_api_key
```

The delivery workflow includes a Harness Engineer step and can trigger a configured Harness pipeline for sandbox validation or release.

## Database

The backend uses an H2 in-memory database by default so the MVP starts without PostgreSQL. For PostgreSQL, set:

```bash
DATABASE_URL=jdbc:postgresql://localhost:5432/salesforce_command_center
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_DRIVER=org.postgresql.Driver
JPA_DDL_AUTO=validate
```

Apply `backend/src/main/resources/db/schema.sql` to create the audit, scan, AI task, and approval tables.

## Safety Rule

The app is AI-controlled for analysis, coding, scanning, validation, and recommendations. Risky org changes and production deployment require human approval.
