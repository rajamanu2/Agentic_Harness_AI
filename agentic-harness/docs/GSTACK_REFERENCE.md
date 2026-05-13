# GStack Reference For Agentica

Source repo:

```text
C:\Users\rajam\OneDrive\Documents\New project\.runtime\external\gstack
```

Upstream:

```text
https://github.com/garrytan/gstack
```

Revision inspected:

```text
5d4fe7df
```

License:

```text
MIT
```

## What Was Learned

GStack is a virtual engineering team workflow. The useful Agentica pattern is not to copy files into every answer, but to route complex work through specialist checks as one synchronized brain.

Core loop:

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

Specialist roles Agentica should emulate:

- Product office-hours: clarify the real pain, not only the literal feature.
- CEO/founder review: challenge scope and find the stronger product wedge.
- Engineering review: lock data flow, architecture, edge cases, and tests.
- Design review: catch weak UI, poor hierarchy, copy issues, and AI slop.
- Staff review: find bugs that pass happy-path checks.
- QA: use a real browser and verify the user flow.
- Security: use OWASP/STRIDE style checks when risk exists.
- Release: run tests, document, ship, and monitor.
- Learn: save what worked so future prompts improve.

## Files Inspected

Important top-level references:

- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `SKILL.md`
- `package.json`
- `LICENSE`
- `USING_GBRAIN_WITH_GSTACK.md`

GStack includes 746 tracked files in the cloned reference checkout, including many `SKILL.md` workflows.

## Install Status

The repo is cloned locally. Full gstack setup is not complete because the setup script requires:

- Git Bash or MSYS
- Bun 1.0+

Git Bash exists at:

```text
C:\Program Files\Git\bin\bash.exe
```

Bun was not found on PATH during inspection.

After Bun is installed, the upstream setup path inspected during development is:

```powershell
cd "C:\Users\rajam\OneDrive\Documents\New project\.runtime\external\gstack"
& "C:\Program Files\Git\bin\bash.exe" .\setup --host agentica --no-prefix --quiet
```

## Agentica Integration Decision

Agentica should use the GStack ideas as an orchestration layer:

- Normal prompts: answer directly and use local project context.
- Build/fix prompts: change real project files and verify.
- Complex/live-soon prompts: activate the virtual team loop and teacher LLM layer.
- UI prompts: run design and QA checks before saying done.
- Release prompts: include tests, docs, deployment notes, and canary checks.

This keeps Agentica independent while learning from the GStack engineering-team model.
