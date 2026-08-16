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
External systems such as Salesforce, AWS, n8n, and Kubernetes use their own
authenticated CLI or runtime connection. ForgeOS does not embed credentials.
ForgeOS connection discovery reports readiness and available targets without
returning secrets or access tokens.

The current local artifacts are unsigned. Windows may display a publisher warning.
Public distribution requires a Windows code-signing certificate and a signed update feed.

SHA-256:
8F34E35FB5C8779247B2BE4AE1E9AC0B7A84A966AB5537A3A877AF2EE860C359  ForgeOS_0.0.13_x64_en-US.msi
75569393BF930590C7E23D2B962412D5B2604D628CCB53FF49DCD2E424E44531  ForgeOS_0.0.13_x64-setup.exe
4AB7B29F7F80BCC293430CCBCB5B6B914B57FA014853864410EA0E7CC43B57AC  forgeos.exe
E4B150ED689A1D44A790AEFEEA3880D32BB7DC51D8256386A3691BA04648CF70  runtime/forgeos-control-plane.jar
