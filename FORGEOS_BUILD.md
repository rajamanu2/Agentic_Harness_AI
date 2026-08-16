# ForgeOS Distribution

ForgeOS is a downstream distribution of the complete Apache-2.0 ForgeOS platform, combined with the repository's existing Agentica intelligence service and Spring control plane.

## Included runtime

- Tauri 2 native desktop shell and Bun sidecar
- Next.js 16 and React 19 desktop UI
- VS Code extension client
- Bun/TypeScript CLI and headless execution
- Shared SDK packages for schemas, UI, provider adapters, agents, core runtime, and public SDK
- SQLite persistence, session replay, checkpoints, Git worktrees, MCP, ACP, gRPC/Protobuf, browser automation, schedules, telemetry, and plugin loading
- ForgeOS policy hooks, SHA-256 evidence chains, repository scanning, durable learning, teacher ensemble, Salesforce validation, Jira, and Harness delivery integration

Upstream ForgeOS package names are intentionally retained inside the implementation where changing them would break protocol or package compatibility. All distributed product surfaces use the ForgeOS name. The original license and notices remain in `forgeos-platform/`.

## Build

Requirements: Node 22+, Bun 1.3.13, Rust stable, Windows WebView2, and the MSVC linker toolchain.

```powershell
cd forgeos-platform
npx --yes bun@1.3.13 install --frozen-lockfile
npx --yes bun@1.3.13 run forgeos:build
npx --yes bun@1.3.13 -F '@forgeos/code' build:binary
```

Windows artifacts are emitted under:

```text
forgeos-platform/apps/examples/desktop-app/src-tauri/target/release/bundle/msi/
forgeos-platform/apps/examples/desktop-app/src-tauri/target/release/bundle/nsis/
```

## Run

The launcher starts the intelligence service, Spring control plane, and native desktop:

```powershell
.\scripts\start-forgeos.ps1
```

Use `-SkipServices` when the services are already running, or `-Development` for the Tauri development runtime.

Provider keys, Salesforce authentication, Jira credentials, Harness credentials, signing keys, and release tokens are supplied at runtime. None are hard-coded.

## Release automation

`.github/workflows/forgeos-windows-release.yml` reproduces the build on a clean GitHub Windows runner, tests the engine and control plane, creates the private runtime, checks Rust formatting/compilation, builds MSI/NSIS artifacts, records SHA-256 hashes, and uploads the result as a workflow artifact.

`.github/workflows/forgeos-cross-platform.yml` runs the same self-contained architecture on native Windows, Ubuntu, and Apple-silicon macOS runners. Each job compiles its platform-specific engine, creates a private Java runtime, builds native Tauri packages, records hashes, and uploads a platform-specific artifact. Generated runtimes are excluded from Git and recreated on each runner.

The workflow creates a draft GitHub release only when manually dispatched with `publish`. Authenticode signing runs only when the protected `WINDOWS_SIGNING_PFX` and `WINDOWS_SIGNING_PASSWORD` secrets are configured. Tauri update signatures use the protected `TAURI_SIGNING_PRIVATE_KEY` secrets.

Local release verification:

```powershell
.\scripts\verify-release.ps1
```
