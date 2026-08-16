# ForgeOS Universal Technology Adapters

ForgeOS discovers technology from repository evidence at runtime. It does not select a stack from a folder name or a fixed project template.

## Built-in coverage

The current registry covers Node.js/TypeScript, React, Angular, Next.js, Vue, Svelte, MERN, n8n, AWS, Terraform/OpenTofu, Kubernetes, Docker, Salesforce DX, Python, Java/JVM, .NET, Go, Rust, mobile projects, JavaScript animation, Motion/Framer Motion, Three.js/WebGL 3D, and Web Components.

Detection uses file markers, source suffixes, and dependency data collected from package manifests. Composite stacks can require all dependencies; for example, MERN is identified only when React, Express, and Mongoose are present.

Public website inspection is available through `POST /api/scan-website`. It fetches current public HTML, reports only matched evidence, blocks local/private-network targets, limits the response size, and warns when minification or server rendering makes detection uncertain.

## Add any technology without changing ForgeOS

Add `.forgeos/adapters.json` or `forgeos.adapters.json` to a workspace:

```json
{
  "adapters": [
    {
      "id": "my-runtime",
      "name": "My Runtime",
      "files": ["my-runtime.toml"],
      "suffixes": [".my"],
      "dependencies": ["my-runtime-sdk"],
      "websiteSignatures": ["my-runtime-client"],
      "install": ["my-runtime install"],
      "test": ["my-runtime test"],
      "build": ["my-runtime build"],
      "run": ["my-runtime run"],
      "verifierNotes": ["Describe environment-specific checks here."]
    }
  ]
}
```

Workspace definitions override a built-in adapter with the same ID. Commands are recommendations until a user asks ForgeOS to execute them under the active approval policy.

## Runtime connections

External targets are runtime inputs, never embedded aliases:

- Salesforce: authenticated org and explicit target alias/username, metadata scope, test level, and deployment authorization.
- AWS: authenticated account/role, region, stack, and reviewed change set.
- n8n: instance URL and credential references; secrets do not belong in workflow JSON.
- Kubernetes: selected context and namespace.

ForgeOS separates discovery, planning, execution, verification, and evidence. A story is complete only after the requested implementation and relevant checks pass; production deployment remains a separately authorized action.

## APIs and native tools

- `GET /api/adapters`: built-in registry and extension locations.
- `GET /api/connections`: secret-safe provider, org, cloud, automation, cluster, and Git discovery.
- `POST /api/scan`: repository and package-manifest discovery.
- `POST /api/scan-website`: live public website discovery.
- `forgeos_adapters`, `forgeos_scan`, and `forgeos_scan_website`: native ForgeOS tools exposed by the core bridge.

Run `npm run test:adapters` in the engine workspace to verify mixed-stack and custom-adapter discovery.
