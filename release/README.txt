ForgeOS 0.0.13 - Windows x64

Recommended installation:
  ForgeOS_0.0.13_x64-setup.exe

Enterprise MSI installation:
  ForgeOS_0.0.13_x64_en-US.msi

Portable smoke-test executable:
  forgeos.exe
  Keep code-sidecar.exe and the adjacent resources directory with the executable.

The installer includes the ForgeOS desktop sidecar, universal engine, adapter
registry, control plane, and a private Java runtime. Users do not need Node,
Bun, Rust, Java, or the source repository.

New sessions use the free local Ollama qwen2.5-coder:7b model by default. This
does not require a hosted-provider account, API key, quota, or authorization.
Ollama must be running with that model installed. Hosted providers remain optional.
ForgeOS preloads the quality-first 7B model during desktop startup and keeps it
resident to avoid repeated cold-load delays. Long chat code wraps vertically.
When an agent starts a localhost web application and reports its URL, ForgeOS
opens it in the integrated live preview with reload and external-open controls.
Settings includes a dedicated API Keys tab for built-in and custom providers.
Its dry check validates configuration and discovers models without generating
tokens. Ollama models are discovered locally. Active chats remain alive while
the user switches sessions or opens Settings, and reattach when selected again.
Each active task has a persistent evidence panel with its real outcome, source,
changed files, captured verification checks, and SHA-256 replay integrity.
The first-party agentic bridge and skill are installed globally before the
desktop sidecar starts, so every opened workspace can use the bundled scanner,
23 technology adapters, planning, learning, policy, and evidence services.
External systems such as Salesforce, AWS, n8n, and Kubernetes use their own
authenticated CLI or runtime connection. ForgeOS does not embed credentials.
ForgeOS connection discovery reports readiness and available targets without
returning secrets or access tokens.

The current local artifacts are unsigned. Windows may display a publisher warning.
Public distribution requires a Windows code-signing certificate and a signed update feed.

SHA-256:
E2ADA6AAC3012689E8112ACAD0BBE0FB9F32F1F48BD99362BADB5079131B84A3  ForgeOS_0.0.13_x64_en-US.msi
42090FA64457C167EF033FFC07A867FA2E452F7B22AE70E3FD0C8100968FB9D1  ForgeOS_0.0.13_x64-setup.exe
2481BE61066FF9939F049BFF017AE171902DC7B952EBCCC05EF1A9EB175C7C28  forgeos.exe
666C9C03107CEFFECF297D35BB95CD99B5B6A71EFC207C2573A29AEBF2F15558  code-sidecar.exe
E4B150ED689A1D44A790AEFEEA3880D32BB7DC51D8256386A3691BA04648CF70  runtime/forgeos-control-plane.jar
