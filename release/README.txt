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
External systems such as Salesforce, AWS, n8n, and Kubernetes use their own
authenticated CLI or runtime connection. ForgeOS does not embed credentials.
ForgeOS connection discovery reports readiness and available targets without
returning secrets or access tokens.

The current local artifacts are unsigned. Windows may display a publisher warning.
Public distribution requires a Windows code-signing certificate and a signed update feed.

SHA-256:
EB07E279D0C5AE764545411987BA9538C01331E61B43FF220429DE8E706C5616  ForgeOS_0.0.13_x64_en-US.msi
9C8042659CB75FB4AA9BEB7D5A700DF0A3916BDE60A442ED6686ED8B96E634E1  ForgeOS_0.0.13_x64-setup.exe
D0315F33C295C1F187943022D0EF767193E72E0C479716B2E8A6034648794C9F  forgeos.exe
E4B150ED689A1D44A790AEFEEA3880D32BB7DC51D8256386A3691BA04648CF70  runtime/forgeos-control-plane.jar
