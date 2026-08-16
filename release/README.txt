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

On first launch, select or sign in to an LLM provider before starting an agent task.
External systems such as Salesforce, AWS, n8n, and Kubernetes use their own
authenticated CLI or runtime connection. ForgeOS does not embed credentials.
ForgeOS connection discovery reports readiness and available targets without
returning secrets or access tokens.

The current local artifacts are unsigned. Windows may display a publisher warning.
Public distribution requires a Windows code-signing certificate and a signed update feed.

SHA-256:
854E375BBD93DCBE9EFD584D31D1D6B20FB2F967EA592EFD70957B09BF81FC43  ForgeOS_0.0.13_x64_en-US.msi
A3F55245F58E2848E0655CB70FE4B90E2D34451543209D941D96E95FA880F4F0  ForgeOS_0.0.13_x64-setup.exe
2F85052F62BA39BEBEE85E244B07A45D68C5F438DE384CA5B41742457A19D417  forgeos.exe
E4B150ED689A1D44A790AEFEEA3880D32BB7DC51D8256386A3691BA04648CF70  runtime/forgeos-control-plane.jar
