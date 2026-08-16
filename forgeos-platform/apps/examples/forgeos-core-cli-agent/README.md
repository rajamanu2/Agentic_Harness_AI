# ForgeOS Core CLI Agent

An interactive terminal chat agent powered by the `ForgeOSCore` runtime. This example is similar in spirit to [`cli-agent`](../cli-agent), but uses stateful ForgeOSCore sessions and built-in runtime tools instead of the stateless `Agent` class, to leverage ForgeOS's internal agent harness.

## Getting started

Install dependencies:

```bash
bun install
bun run build:sdk
```

Set an API key:

```bash
export FORGEOS_API_KEY="sk_..."
```

Run:

```bash
bun dev
```

Type any message at the `you:` prompt to see a streaming response. Type `exit` to quit.

## Optional model configuration

The example defaults to ForgeOS's gateway provider and Claude Sonnet:

```bash
export FORGEOS_PROVIDER_ID="forgeos"
export FORGEOS_MODEL_ID="anthropic/claude-sonnet-4.6"
```

## What it does

- Creates a local `ForgeOSCore` runtime with `ForgeOSCore.create()`
- Starts one interactive session with `forgeos.start()`
- Sends each user turn with `forgeos.send({ sessionId, prompt })`
- Streams `agent_event` text to stdout as the assistant responds
- Logs tool calls and tool results inline
- Uses ForgeOSCore's built-in tools instead of defining custom tools
- Calls `forgeos.stop()` and `forgeos.dispose()` during shutdown

## Concepts demonstrated

- Stateful sessions with `ForgeOSCore`
- Multi-turn conversation using a single `sessionId`
- `CoreSessionEvent` subscription via `forgeos.subscribe()`
- Built-in runtime tools (`read_files`, `search_codebase`, `run_commands`, etc.)
- Basic tool policies: file reads/search are auto-approved, other tools request approval

## Notes

Use this example when you want the full ForgeOSCore runtime with sessions, persistence, and built-in tools. For the smallest possible SDK example, see [quickstart](../quickstart). For the lightweight stateless runtime, see [cli-agent](../cli-agent).
