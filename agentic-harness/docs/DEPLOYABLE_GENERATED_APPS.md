# Deployable Generated Apps

Agentica generated apps now follow a live-model pipeline instead of an instruction-only pipeline.

## What Happens On A Build Prompt

When a user asks for a website, web app, store, restaurant app, dashboard, booking app, or portal, Agentica should:

1. infer the app type, audience, data, modules, and actions from the prompt
2. write real source files into `agentica-projects/<project-id>`
3. write a standalone live preview at `live-preview.html`
4. serve that preview through `/live-projects/<project-id>/`
5. write `agentica.manifest.json` so the brain/harness knows what was generated
6. write `DEPLOYMENT.md` with server and domain requirements
7. answer with the live model link first, then ask what to modify

## Generated Project Files

- `package.json`
- `index.html`
- `live-preview.html`
- `public/manifest.webmanifest`
- `agentica.manifest.json`
- `DEPLOYMENT.md`
- `README.md`
- `src/main.jsx`
- `src/styles.css`

## Live Preview Route

The backend serves generated previews from:

```text
/live-projects/<project-id>/
```

Vite proxies that route during development. Apache proxies that route for LAN/domain hosting.

## Server Requirements

Minimum:

- Node.js 22 LTS recommended
- npm 10+
- Apache, Nginx, Caddy, Vercel, Netlify, Cloudflare Pages, S3/CloudFront, or any static host
- HTTPS certificate for a real domain
- Open ports 80 and 443 for public hosting

Build command:

```bash
npm install
npm run build
```

Production output:

```text
dist
```

## Domain Deployment Shape

For a purchased domain:

1. point the domain A record to the server IP
2. serve the Agentica app through Apache or another reverse proxy
3. proxy `/api/`, `/live-projects/`, and legacy `/artifacts/` to the Agentica backend
4. serve each generated app's `dist` folder directly when it is ready for independent hosting
5. add backend/payment/database environment variables when the generated app grows beyond static UI

## Brain/Harness Link

`agentica.manifest.json` is the link between a generated app and the Agentica brain. It records:

- prompt
- app type
- modules
- generated files
- live preview route
- deploy target
- harness orchestration notes

That lets later prompts modify the existing app instead of pretending to rebuild from scratch.
