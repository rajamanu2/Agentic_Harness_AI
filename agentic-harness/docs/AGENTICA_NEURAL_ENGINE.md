# Agentica Neural Engine And Learning Layer

This document explains the new Agentica learning architecture: how internal agents work as one brain, how other LLMs can be used as teacher models, and how Agentica stores lessons for future prompts.

## Goal

Agentica should not behave like separate agents arguing with each other. It should behave like one neural engine:

```text
Prompt
  -> Intent Agent
  -> Context Agent
  -> Learning Agent
  -> Teacher Router
  -> Quality Agent
  -> Delivery Agent
  -> One final answer
```

Each agent contributes a signal, but the user sees one synchronized response.

## Where It Is Implemented

Main backend file:

```text
server.mjs
```

Main functions:

```text
runNeuralEngine()
withNeuralSteps()
teacherEnsemble()
learnFromTeacher()
saveTeacherEnsembleLearning()
relevantLearningLessons()
learnFromCompletedTurn()
```

Learning memory file:

```text
agentic-harness/.harness/learning.json
```

Open-source web learner:

```text
agentic-harness/scripts/open-source-learner.mjs
```

## Neural Engine Agents

### Intent Agent

Classifies the prompt:

```text
domain / deliverable / action
```

Examples:

```text
general / explanation / explain
salesforce / trigger / write
general / website / build
```

### Context Agent

Scans the selected project and reports:

- selected project path
- detected stack
- sampled files
- available build/test commands

### Learning Agent

Searches `.harness/learning.json` and pulls the most relevant lessons for the current prompt.

Example learned lesson:

```text
For website/app builds, create or update local project source directly. Include project folder, run commands, what's inside, and next source-file iteration. Use preview/download artifacts only when the user explicitly asks for them.
```

### Teacher Router

Finds configured LLM providers and can ask them for teacher answers.

Supported helper/provider shapes already routed by Agentica:

- Agentica responses-compatible helper API
- Agentica chat-compatible helper API
- NVIDIA NIM through the Agentica chat-compatible route
- OpenRouter Chat Completions
- Z.ai GLM through the Agentica chat-compatible route
- Anthropic Messages API
- Gemini generateContent
- Ollama local chat API
- Agentica Qwen Core local OpenAI-compatible chat API
- AirLLM 2.11.0 through the local Agentica-compatible bridge

### Quality Agent

Scores confidence using:

- project exists
- stack detected
- lessons matched
- teacher models available
- specific deliverable detected

### Delivery Agent

Returns one final answer in the user-preferred style.

## New API Endpoints

### Get Learning Memory

```http
GET /api/learning
```

Returns saved lessons, turn count, and learning metadata.

### Add Manual Learning

```http
POST /api/learning
```

Body:

```json
{
  "title": "Answer style",
  "lesson": "Always lead with the finished result before showing steps.",
  "tags": ["style", "format"]
}
```

### Learn From Teacher Models

```http
POST /api/learning/teach
```

Body:

```json
{
  "message": "Explain APIs in one paragraph",
  "repoPath": ".."
}
```

This asks teacher models, distills the best lesson, and saves it.

### Teacher Ensemble Without Manual Save

```http
POST /api/teacher-ensemble
```

Body:

```json
{
  "message": "Explain APIs in one paragraph",
  "repoPath": ".."
}
```

This returns:

- teacher answers
- skipped/failed teachers
- best answer
- distilled lesson

## Continuous Open-Source Learning

The harness can also learn from public open-source release feeds without calling teacher LLMs.

Run one pass:

```bash
npm run learn:web:once
```

Keep learning until stopped:

```bash
npm run learn:web
```

Stop or inspect it:

```bash
npm run learn:web:stop
npm run learn:web:status
```

The learner writes compact lessons into `.harness/learning.json` and its run state into `.harness/open-source-learning.json`. Feed content is treated as untrusted web intelligence: Agentica stores summaries and source links, but still verifies code, tests, security impact, and compatibility before adopting behavior.

## How Teacher Models Are Selected

Agentica checks configured providers in this order:

```text
1. Explicit teachers from request body
2. The currently selected non-Agentica model
3. Free no-key Agentica helper route
4. NVIDIA NIM if NVIDIA_API_KEY exists
5. Z.ai GLM if ZAI_API_KEY exists
6. OpenRouter if OPENROUTER_API_KEY exists
7. Agentica helper key if AGENTICA_HELPER_API_KEY exists
8. Anthropic if ANTHROPIC_API_KEY exists
9. Gemini if GOOGLE_API_KEY exists
10. Ollama if OLLAMA_MODEL is set
11. Agentica Qwen Core if AGENTICA_QWEN_CORE_ENABLED=true
12. AirLLM if AIRLLM_ENABLED=true, or if AirLLM is the currently selected non-Agentica model
```

If a teacher model fails or rate-limits, Agentica reports it under `Skipped` and does not save a teacher lesson unless at least one teacher answered successfully.

## How To Configure Teacher Models

Use environment variables in `.env` or the Select Model UI.

OpenRouter:

```text
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=z-ai/glm-5.1
```

NVIDIA NIM:

```text
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/llama-3.1-nemotron-ultra-253b-v1
```

Create or copy the key from build.nvidia.com while signed in to your NVIDIA account. Agentica reads the key from `.env` or the Select Model UI. The hosted NIM chat route is Agentica-compatible, so Agentica calls:

```text
https://integrate.api.nvidia.com/v1/chat/completions
```

Agentica Qwen Core:

```text
AGENTICA_CORE_PROVIDER=agentica-qwen-core
AGENTICA_QWEN_CORE_ENABLED=true
AGENTICA_QWEN_CORE_BASE_URL=http://127.0.0.1:11434/v1
AGENTICA_QWEN_CORE_MODEL=agentica-qwen-core
```

Use this only after Ollama, llama.cpp, LM Studio, or another OpenAI-compatible local server is already serving the Qwen model. See `docs/QWEN_CORE_LOCAL_MODEL.md`.

Agentica helper key:

```text
AGENTICA_HELPER_API_KEY=...
AGENTICA_HELPER_MODEL=gpt-4.1-mini
```

Anthropic:

```text
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Gemini:

```text
GOOGLE_API_KEY=...
GOOGLE_MODEL=gemini-2.5-flash
```

Ollama:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1
```

AirLLM:

```text
AIRLLM_BASE_URL=http://127.0.0.1:4891/v1
AIRLLM_MODEL=Qwen/Qwen-7B
AIRLLM_ENABLED=false
```

AirLLM runs locally through `scripts/airllm-openai-bridge.py`. See `docs/AIRLLM_LOCAL_MODEL.md`.

## Prompt Trigger For Teacher Ensemble

The normal chat route automatically uses the teacher ensemble when the prompt asks for it, using language like:

```text
use other llm models and get the best answer for ...
learn from other models ...
fetch all LLM and make the perfect answer ...
```

Otherwise, Agentica uses the fast local Neural Engine and saved lessons to avoid slow responses.

## Why It Is Fast

Teacher models are not called for every normal prompt. That keeps everyday answers fast.

For normal prompts:

```text
Agentica Neural Engine + local learning memory
```

For teacher prompts:

```text
Agentica Neural Engine + configured teacher LLMs + lesson distillation
```

## Example Flow

Prompt:

```text
use other llm models and get the best answer for: explain APIs in one paragraph
```

Flow:

```text
Neural Engine: agents synchronized as one brain
Intent Agent: general/explanation/explain
Context Agent: project scanned
Learning Agent: matching lessons applied
Teacher Router: teacher models called
Quality Agent: confidence target selected
Delivery Agent: one synchronized response
```

Result:

- best teacher answer returned
- teacher model list shown
- distilled lesson saved
- future API prompts improve from that lesson

## Current Limitation

Agentica can only learn from LLMs that are configured and reachable. If no API key or local model is available, it still uses local learning memory but cannot get a true external teacher answer.

## Summary

Agentica now has a local neural-style coordination layer. Internal agents produce signals, teacher LLMs can provide external answers, the quality layer chooses the best result, and the learning layer saves distilled lessons into `.harness/learning.json` for future prompts.

## GStack Team Pattern

Agentica also stores the GStack virtual engineering team pattern as a reference for complex work:

```text
Product office-hours -> CEO scope review -> engineering review -> design review -> implementation -> staff review -> browser QA -> security review -> release -> canary -> learning
```

This is used as an orchestration idea, not as copied code. See:

```text
docs/GSTACK_REFERENCE.md
```

## God Mode

God Mode is Agentica's deep orchestration mode. It is not unsafe unlimited access.

When enabled, Agentica adds:

- GStack-style product, CEO, engineering, design, QA, security, release, and learning lenses
- teacher LLM/API escalation for complex prompts or explicit best/multi-model requests
- stronger verification thinking before saying work is complete
- safety gates for destructive commands, secrets, and deployment actions

Simple informational prompts still get local Agentica answers. Teacher models are reserved for work that benefits from extra reasoning or outside model opinions.
