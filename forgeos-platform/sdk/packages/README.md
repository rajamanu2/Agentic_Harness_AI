# Packages Overview

This directory is the single documentation source for package-level responsibilities.

- High-level package roles: this file (`packages/README.md`)
- Package interaction and runtime flows: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Package Responsibilities

| Package | Primary responsibility | Typical consumers | Internal deps |
| --- | --- | --- | --- |
| `@forgeos/shared` | Cross-package shared primitives (path resolution, session common types, indexing helpers) | `@forgeos/agents`, `@forgeos/core`, apps | None |
| `@forgeos/llms` | Model catalog + provider settings schema + handler creation SDK | `@forgeos/agents`, `@forgeos/core`, apps | None |
| `@forgeos/agents` | Stateless agent runtime loop (tools, hooks, extensions, teams, streaming) | `@forgeos/core`, apps | `@forgeos/llms`, `@forgeos/shared` |
| `@forgeos/core` | Stateful runtime orchestration (runtime composition, session lifecycle/storage, local and hub runtime services, hub discovery and client helpers) | CLI/Desktop apps | `@forgeos/agents`, `@forgeos/llms`, `@forgeos/shared` |
| `@forgeos/ui` | Internal framework-neutral web theme, Tailwind adapter, and optional base styles | ForgeOS web apps | None |

## How Packages Work Together

1. `@forgeos/llms` defines model/provider capabilities and builds concrete handlers.
2. `@forgeos/agents` runs the agent loop on top of those handlers and tool execution primitives.
3. `@forgeos/core` composes runtime behavior with persistent sessions/storage and local or hub-backed runtime services.
4. `@forgeos/core` hub services orchestrate scheduled runtime execution, execution history, and schedule command handling.
5. `@forgeos/core/hub` exposes discovery, the detached hub daemon, and session-oriented client APIs (`HubSessionClient`, `HubUIClient`) when hosts need a shared daemon.
6. `@forgeos/shared` provides the shared contracts and path/session primitives used across the stack.

## Practical Boundary Rules

- Put provider/model schema, cataloging, and handler wiring in `@forgeos/llms`.
- Put loop/tool/hook/team execution behavior in `@forgeos/agents`.
- Put persistence, session lifecycle, and runtime assembly in `@forgeos/core`.
- Put scheduled execution and schedule persistence in `@forgeos/core` hub services.
- Put hub discovery, attach flows, and session-oriented client adapters in `@forgeos/core/hub`.
- Put cross-package utility types and path/session constants in `@forgeos/shared`.
- Put remote-config schemas, materialization, telemetry normalization, and blob upload primitives in `@forgeos/shared/remote-config`.
- Put shared web tokens and visual foundations in `@forgeos/ui`; keep fonts,
  shell layout, and product-specific animation with each consuming app.

## Runtime Entry Points

- Node-oriented imports exist where packages expose a distinct Node alias.
- `@forgeos/core` itself is now the Node/runtime-oriented entry point for host/session services.
- Browser entry points still exist in packages that intentionally publish a browser surface, but `@forgeos/core` no longer does.

## Notes for Doc Consolidation

Nested package `README.md` and `ARCHITECTURE.md` files can be reduced or removed after references are updated to point here.
