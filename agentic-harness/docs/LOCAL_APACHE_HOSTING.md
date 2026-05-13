# Agentica Local Apache Hosting Guide

This document explains how Agentica is built, how the local app works, and how Apache serves it so other people on the same network can open it in their browser.

## What This App Is

Agentica is a local web app with three main pieces:

- React frontend: the chat UI, prompt box, project picker, and rendered answers.
- Node backend: the Agentica API, prompt engine, project scanner, local project builder, and optional legacy artifact server.
- Apache server: the local production web server that exposes the built frontend to your network and proxies API calls to Node.

The running app uses `Agentica Native Engine / agentica-brain` by default and does not require any development assistant after deployment.

## Important Local URLs

Development URL:

```text
http://127.0.0.1:5174/
```

Node API URL:

```text
http://127.0.0.1:8797/
```

Apache hosted URL on this machine:

```text
http://127.0.0.1:8088/
```

LAN URL for other people on the same Wi-Fi/network:

```text
http://192.168.1.6:8088/
```

The LAN IP can change if the Wi-Fi/router changes. To find the current IP:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object IPAddress,InterfaceAlias
```

## Folder Layout

Main project:

```text
C:\Users\rajam\OneDrive\Documents\New project\agentic-harness
```

Important files:

```text
agentic-harness/
  server.mjs
  agentica-cli.mjs
  package.json
  vite.config.js
  src/client/main.jsx
  src/client/styles.css
  scripts/start-agentica-server.ps1
  docs/LOCAL_APACHE_HOSTING.md
```

Runtime folders created outside the app:

```text
C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24
C:\Users\rajam\OneDrive\Documents\New project\.runtime-logs
```

Generated websites are written here:

```text
C:\Users\rajam\OneDrive\Documents\New project\agentica-projects
```

Optional preview artifacts, when explicitly requested, are served from:

```text
C:\Users\rajam\OneDrive\Documents\New project\agentic-harness\.harness\artifacts
```

## How The App Is Built

The frontend is built with Vite and React.

Build command:

```powershell
cd "C:\Users\rajam\OneDrive\Documents\New project\agentic-harness"
npm run build
```

That creates:

```text
agentic-harness/dist/index.html
agentic-harness/dist/assets/*.js
agentic-harness/dist/assets/*.css
```

Apache serves this `dist` folder. It does not serve the React source files directly.

## How Requests Flow

When someone opens the Apache URL:

```text
Browser -> Apache :8088 -> dist/index.html and assets
```

When they send a prompt:

```text
Browser -> Apache :8088/api/chat -> Node backend :8797/api/chat
```

When Agentica creates a website preview:

```text
Browser -> Apache :8088/artifacts/... -> Node backend :8797/artifacts/...
```

Simple flow:

```text
Person's browser
  |
  v
Apache on port 8088
  |-- serves React build from dist/
  |-- proxies /api/* to Node on 8797
  |-- proxies /artifacts/* to Node on 8797
  v
Node Agentica backend
```

## How The Node Backend Works

The backend file is:

```text
server.mjs
```

It provides these important endpoints:

```text
GET  /api/health
GET  /api/model-providers
POST /api/chat
POST /api/agentica
POST /api/provider-models
GET  /artifacts/*
```

The chat path does this:

1. Receives the prompt from the UI.
2. Scans the selected project folder.
3. Chooses Agentica Native Engine by default.
4. Detects intent, such as answer, explain, build website, code, fix, or Salesforce trigger.
5. Creates or updates local project files when the prompt asks for a website/app.
6. Returns a clean Agentica-style response to the UI with live model, project folder, and next modification action.

Live model providers use the same Node backend whether the app is opened through Vite or Apache. Add provider keys to:

```text
C:\Users\rajam\OneDrive\Documents\New project\agentic-harness\.env
```

For NVIDIA NIM:

```text
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/llama-3.1-nemotron-ultra-253b-v1
```

After changing `.env`, restart the Node backend or rerun:

```powershell
.\scripts\start-agentica-server.ps1
```

For website prompts, Agentica writes:

```text
package.json
index.html
src/main.jsx
src/styles.css
README.md
```

Normal chat no longer depends on preview artifact links. The source project is the main result.

## How Apache Is Set Up

Apache is installed as a portable runtime in:

```text
C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24
```

The Agentica Apache config is:

```text
C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24\conf\agentica-httpd.conf
```

The important Apache settings are:

```apache
Listen 0.0.0.0:8088
DocumentRoot "C:/Users/rajam/OneDrive/Documents/New project/agentic-harness/dist"

ProxyPass "/api/" "http://127.0.0.1:8797/api/"
ProxyPassReverse "/api/" "http://127.0.0.1:8797/api/"

ProxyPass "/artifacts/" "http://127.0.0.1:8797/artifacts/"
ProxyPassReverse "/artifacts/" "http://127.0.0.1:8797/artifacts/"
```

Why this matters:

- `Listen 0.0.0.0:8088` lets other devices on the network reach the server.
- `DocumentRoot` points Apache to the production React build.
- `ProxyPass /api/` forwards chat/API requests to the Node backend.
- `ProxyPass /artifacts/` remains for optional explicit preview/download files and older links.

## Start Everything

Use this script:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\rajam\OneDrive\Documents\New project\agentic-harness\scripts\start-agentica-server.ps1"
```

The script does this:

1. Builds the React app with `npm run build`.
2. Starts the Node backend on port `8797`.
3. Writes/updates the Apache config.
4. Tests the Apache config.
5. Starts Apache on port `8088`.
6. Prints the LAN URL.

Expected final URL:

```text
http://192.168.1.6:8088/
```

## Start Manually

If you want to start it manually:

```powershell
cd "C:\Users\rajam\OneDrive\Documents\New project\agentic-harness"
npm run build
$env:PORT = "8797"
Start-Process -FilePath "node.exe" -ArgumentList @("server.mjs") -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

Start Apache:

```powershell
$apache = "C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24\bin\httpd.exe"
$conf = "C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24\conf\agentica-httpd.conf"
Start-Process -FilePath $apache -ArgumentList @("-f", $conf) -WorkingDirectory "C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24" -WindowStyle Hidden
```

## Stop Servers

Stop Node backend on `8797`:

```powershell
$pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 8797 } |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($id in $pids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
```

Stop Apache on `8088`:

```powershell
$pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 8088 } |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($id in $pids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
```

## Verify It Is Working

Check ports:

```powershell
netstat -ano | findstr ":8797 :8088"
```

Check Node API:

```powershell
Invoke-RestMethod http://127.0.0.1:8797/api/health
```

Check Apache:

```powershell
Invoke-WebRequest http://127.0.0.1:8088/ -UseBasicParsing
```

Check Apache to Node proxy:

```powershell
Invoke-RestMethod http://127.0.0.1:8088/api/health
```

Check LAN:

```powershell
Invoke-WebRequest http://192.168.1.6:8088/ -UseBasicParsing
```

## Windows Firewall

If other people cannot open:

```text
http://192.168.1.6:8088/
```

but it works on your own machine, Windows Firewall is probably blocking inbound traffic.

The rule needed:

```text
Allow inbound TCP port 8088
```

Command, run PowerShell as Administrator:

```powershell
netsh advfirewall firewall add rule name="Agentica Apache 8088" dir=in action=allow protocol=TCP localport=8088
```

Without administrator permissions, this command will fail with:

```text
The requested operation requires elevation.
```

## Common Problems

### Page opens but prompts do not answer

Check the Node backend:

```powershell
Invoke-RestMethod http://127.0.0.1:8797/api/health
```

If it fails, restart the server script.

### Other people cannot open it

Check:

- They are on the same Wi-Fi/network.
- They use `http://192.168.1.6:8088/`, not `127.0.0.1`.
- Windows Firewall allows inbound TCP `8088`.
- Your laptop is awake and connected to the network.

### The app goes blank after clicking prompt

This was fixed by replacing direct browser `crypto.randomUUID()` usage with a safe fallback in:

```text
src/client/main.jsx
```

After any frontend fix, rebuild:

```powershell
npm run build
```

Then hard refresh the browser:

```text
Ctrl+F5
```

### Apache does not start

Validate config:

```powershell
& "C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24\bin\httpd.exe" -t -f "C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24\conf\agentica-httpd.conf"
```

Read Apache logs:

```powershell
Get-Content "C:\Users\rajam\OneDrive\Documents\New project\.runtime\apache-full\Apache24\logs\agentica-error.log" -Tail 100
```

### Port is already used

Check who owns a port:

```powershell
netstat -ano | findstr ":8088"
```

Then inspect the process:

```powershell
Get-Process -Id <PID>
```

## Local vs Public Hosting

This Apache setup is local network hosting.

It works for:

- Your browser on the same computer.
- Other devices on the same Wi-Fi/network.

It does not automatically make the app public on the internet. For public hosting you would need one of these:

- A real cloud server.
- Router port forwarding.
- A tunnel service.
- A domain and HTTPS setup.

## Current Recommended Workflow

During development:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5174/
```

For local network sharing:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\rajam\OneDrive\Documents\New project\agentic-harness\scripts\start-agentica-server.ps1"
```

Open from another device:

```text
http://192.168.1.6:8088/
```

## Summary

Agentica is built as a React frontend plus Node backend. Apache serves the compiled frontend from `dist` and proxies dynamic API requests to the Node backend. This makes the app reachable from other browsers on the same local network while keeping the answer engine and local project builder running on your machine.
