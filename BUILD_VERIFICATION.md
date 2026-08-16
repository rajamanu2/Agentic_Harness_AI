# ForgeOS Build Verification

Verified on Windows x64 on 2026-08-16.

## Passed

- ForgeOS shared schemas and persistence package
- ForgeOS React UI package and generated theme contract
- ForgeOS multi-provider LLM gateway
- ForgeOS stateless agent runtime
- ForgeOS core runtime, SDK, plugin loader, MCP/ACP, checkpoints, worktrees, schedules, and session persistence
- ForgeOS CLI production build
- ForgeOS VS Code TypeScript, compatibility, protobuf, webview, lint, and production extension build
- ForgeOS Next.js desktop webview and compiled Bun sidecar
- ForgeOS Tauri/Rust release build
- Windows MSI and NSIS installer generation
- Spring control-plane boot test: 1 test, 0 failures, 0 errors
- Existing Node/Vite intelligence app production build
- Existing Electron control-center production build
- Bundled `forgeos-core-bridge` auto-discovery through `@forgeos/core`
- Native `forgeos.exe` smoke launch remained alive for the verification window
- Universal adapter registry: 5 mixed-stack fixtures, 1 custom workspace adapter, and 23 built-in adapters passed
- Rebuilt Spring control-plane executable JAR copied into `release/runtime/forgeos-control-plane.jar`
- Release executable smoke launch remained alive for 12 seconds and was then stopped cleanly
- Source launcher now performs duplicate detection, health waits, persistent PID recording, and persistent service logging
- Standalone universal engine compiled and live-tested without Node or Bun: 23 adapters reported
- Private Java runtime built and live-tested without the developer JDK
- Desktop lifecycle now starts and stops the embedded universal engine and control plane
- Final release-directory test passed simultaneously: desktop alive, engine healthy, control plane healthy
- Runtime connection center passed: 6 provider states, Salesforce/AWS/Kubernetes/n8n/Git discovery, and no access-token or API-key fields returned
- Reusable `scripts/verify-release.ps1` passed against the release directory
- GitHub Windows clean-runner workflow parses successfully and builds/tests/packages artifacts with an explicit publish gate
- Authenticode signing is conditionally enabled by `WINDOWS_SIGNING_PFX` and `WINDOWS_SIGNING_PASSWORD` secrets
- Cross-platform native packaging matrix added for Windows x64, Ubuntu Linux, and macOS ARM64; both workflow YAML files parse successfully
- Generated embedded runtimes are ignored by Git and rebuilt independently for each target operating system
- Source and filename scan found no legacy product name outside legally retained Apache license attribution
- New sessions default to the locally installed Ollama `qwen2.5-coder:7b` model, avoiding hosted-provider quota and authorization requirements

## Windows release hashes

```text
68271D10BCBDDE6C89881C576F6FCA55C57CFA4C0A9B2F8D9CD1A5BEE2364BA7  ForgeOS_0.0.13_x64_en-US.msi
B3BC62BAED962CF7B2FAAB60FDFAD1A9352F4C0FF49E7F05B84B056DCC11A850  ForgeOS_0.0.13_x64-setup.exe
DF36F96380BCA449023930B0F4793E2A1ACCAC9B9B124934C81D3149C4429211  forgeos.exe
E4B150ED689A1D44A790AEFEEA3880D32BB7DC51D8256386A3691BA04648CF70  runtime/forgeos-control-plane.jar
```

These are unsigned local release artifacts. Public distribution should add a Windows code-signing certificate and release-feed signing key. Provider credentials and external-system authentication remain runtime configuration and are not embedded in the binaries.
