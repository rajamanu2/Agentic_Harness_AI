# DeerFlow And UI-TARS Reference Map

Agentica now keeps a DeerFlow-style research workspace layer alongside the existing chat brain.

## References Cloned

- DeerFlow: `C:\Users\rajam\OneDrive\Documents\New project\.runtime\external\deer-flow`
- UI-TARS: `C:\Users\rajam\OneDrive\Documents\New project\.runtime\external\UI-TARS`
- Agent TARS / UI-TARS Desktop: `C:\Users\rajam\OneDrive\Documents\New project\.runtime\external\UI-TARS-desktop`

## What We Borrowed

DeerFlow contributes the workspace shape:

- persistent thread state
- lead agent orchestration
- visible todos, artifacts/files, exports, and token/use state
- subagent execution as background work
- middleware-style memory, guardrails, sandbox, file search, and tool handling

UI-TARS contributes the GUI action loop:

- observe the screen or browser state
- reason over visible UI
- emit a grounded mouse/keyboard/browser action
- execute through a safe operator
- verify the visible result

Agent TARS Desktop contributes the product pattern:

- event stream for tool execution
- hybrid browser control through DOM plus visual grounding
- local/remote computer or browser operator model
- real-time status display

## What Is Live In Agentica

- `GET /api/deerflow-workspace`
- Chat response path for DeerFlow, UI-TARS, research workspace, single-brain, and neural-engine prompts
- Compact live workspace panel in the chat UI
- Flow states: Observe, Plan, Research, Act, Verify, Report
- Agent map: Lead, Researcher, Coder, Browser, QA, Memory, GUI Operator
- Learning seeds for DeerFlow workspace behavior and UI-TARS GUI action behavior

## Current Mapping

| DeerFlow / TARS Concept | Agentica Mapping |
| --- | --- |
| Lead agent | `chatReply` + `runNeuralEngine` |
| Thread state | active project, message stream, learning file, selected model, workspace API |
| Subagents | Lead, Researcher, Coder, Browser, QA, Memory, GUI Operator roles |
| Tool event stream | current analyzed trace; next layer is true streaming events |
| Todo list | workspace flow panel now; durable per-thread todo state next |
| Artifacts | local project files by default; old artifact route remains only for legacy/explicit previews |
| Memory | `.harness/learning.json` |
| GUI agent | browser-runner now; UI-TARS-style grounded executor planned |
| Model routing | Agentica Native, NVIDIA NIM, AirLLM, OpenRouter, Ollama, and Agentica-compatible helper providers |

## Next Build Layers

1. Add true streaming events for each agent/tool step.
2. Add durable thread records with todos, files, model route, and verification result.
3. Add a browser operator state machine using observe/action/verify.
4. Add MCP discovery and mounted tool cards in the workspace panel.
5. Add a subagent job queue with concurrency limits and cancellation.
