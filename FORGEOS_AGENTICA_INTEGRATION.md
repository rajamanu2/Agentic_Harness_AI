# ForgeOS: ForgeOS Platform Integration

This repository now exposes its domain capabilities directly to any ForgeOS host that supports workspace plugins.

## Runtime composition

```text
ForgeOS clients (Desktop / VS Code / CLI / ACP)
                    |
             @forgeos/core agent loop
                    |
       ForgeOS workspace plugin
          /                         \
 ForgeOS Intelligence :8787  ForgeOS Control Plane :8080
 scanner / neural engine     Salesforce / Jira / Harness
 learning / teachers         audit / risk / approvals
          \                         /
       hash-chained workspace evidence
```

## Added native tools

- `agentica_status`
- `agentica_scan`
- `agentica_neural_plan`
- `agentica_teacher_ensemble`
- `agentica_learn`
- `agentica_learning_memory`
- `salesforce_org_status`
- `salesforce_org_scan`
- `salesforce_validate`
- `delivery_plan`

The plugin discovers service locations from `AGENTICA_BASE_URL` and `COMMAND_CENTER_BASE_URL`. It contains no API keys or model defaults.

## Advanced safety and evidence

Every ForgeOS run creates `.forgeos/evidence/<run-id>/events.jsonl`. Events are SHA-256 chained and include hashes of tool inputs and results rather than raw secrets. A policy hook blocks direct non-dry-run Salesforce deployment commands and routes validation through the explicit tool.

## Local startup

Start the existing services:

```powershell
cd agentic-harness
npm install
npm start
```

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Then open this repository in the ForgeOS downstream desktop, VS Code extension, or CLI. Its ForgeOS-derived runtime auto-discovers `.forgeos/plugins` and `.forgeos/skills` from the workspace.

## Technology decision

ForgeOS is the product and downstream distribution. ForgeOS supplies the reusable open-source agent/client foundation; the existing Agentica engine is retained internally as a specialist planning, learning, generated-app, and Salesforce service. The bridge avoids duplicating provider gateways, IDE clients, terminal execution, session persistence, MCP/ACP, and multi-agent machinery while preserving the capabilities already built here.
