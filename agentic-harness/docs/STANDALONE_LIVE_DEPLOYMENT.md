# Standalone Live Deployment

Agentica is designed to run without Codex after deployment.

Codex is only the builder used during development. The live system is:

- Agentica React UI
- Agentica Node backend
- Agentica Native Engine
- optional Agentica Qwen Core local model route
- Agentica learning memory
- Agentica generated-project live preview route
- optional helper model/API providers

## Runtime Contract

Agentica owns the runtime.

```text
codexRequired=false
owner=Agentica
```

You can verify this after starting the server:

```bash
curl http://127.0.0.1:8797/api/health
```

## Production Build

```bash
npm install
npm run build
npm start
```

By default the backend listens on:

```text
127.0.0.1:8797
```

This is correct when Apache/Nginx/Caddy is the public web server.

## Direct Public Node Hosting

If you want Node itself to listen publicly:

Windows PowerShell:

```powershell
$env:AGENTICA_HOST="0.0.0.0"
$env:PORT="8797"
$env:AGENTICA_RUNTIME="production"
npm start
```

Linux:

```bash
AGENTICA_HOST=0.0.0.0 PORT=8797 AGENTICA_RUNTIME=production npm start
```

For real domains, use a reverse proxy with HTTPS instead of exposing Node directly.

## Apache Domain Shape

Apache should:

- serve `dist/` as the frontend
- proxy `/api/` to `http://127.0.0.1:8797/api/`
- proxy `/live-projects/` to `http://127.0.0.1:8797/live-projects/`
- proxy legacy `/artifacts/` to `http://127.0.0.1:8797/artifacts/`
- rewrite all other app routes to `index.html`

The local Windows script already does this:

```powershell
.\scripts\start-agentica-server.ps1
```

## Domain Checklist

1. Buy the domain.
2. Point DNS A record to the server IP.
3. Open ports `80` and `443`.
4. Install HTTPS certificate.
5. Build Agentica with `npm run build`.
6. Start the Agentica backend with `npm start`.
7. Configure Apache/Nginx/Caddy reverse proxy.
8. Visit `/api/health` and confirm `codexRequired` is `false`.
9. Build an app from the Agentica UI and open its `/live-projects/<id>/` route.

## Optional Helper Models

Agentica runs without external keys through the native engine. Helper APIs can improve answers but are not required:

- NVIDIA NIM
- Agentica Qwen Core local model
- AirLLM local bridge
- OpenRouter
- Anthropic
- Gemini
- Ollama
- OpenAI-compatible helper APIs

Agentica remains the owner of the workflow either way.
