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
External systems such as Salesforce, AWS, n8n, and Kubernetes use their own
authenticated CLI or runtime connection. ForgeOS does not embed credentials.
ForgeOS connection discovery reports readiness and available targets without
returning secrets or access tokens.

The current local artifacts are unsigned. Windows may display a publisher warning.
Public distribution requires a Windows code-signing certificate and a signed update feed.

SHA-256:
68271D10BCBDDE6C89881C576F6FCA55C57CFA4C0A9B2F8D9CD1A5BEE2364BA7  ForgeOS_0.0.13_x64_en-US.msi
B3BC62BAED962CF7B2FAAB60FDFAD1A9352F4C0FF49E7F05B84B056DCC11A850  ForgeOS_0.0.13_x64-setup.exe
DF36F96380BCA449023930B0F4793E2A1ACCAC9B9B124934C81D3149C4429211  forgeos.exe
E4B150ED689A1D44A790AEFEEA3880D32BB7DC51D8256386A3691BA04648CF70  runtime/forgeos-control-plane.jar
