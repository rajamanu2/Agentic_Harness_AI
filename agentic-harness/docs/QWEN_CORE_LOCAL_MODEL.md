# Agentica Qwen Core Local Model

Agentica can use a local Qwen model as its own core model through an OpenAI-compatible local server. This is meant for large quantized model files such as a 20GB GGUF, not for hard-coded prompt templates.

## Is The 20GB Qwen File Useful?

Yes, if it is a compatible quantized Qwen model file and your machine can load it.

Best fit:

- private local chat and coding
- offline or near-offline Agentica core reasoning
- teacher-model learning inside the Agentica neural engine
- generated app/code reviews before calling hosted APIs

Important limits:

- A 20GB model file still needs more than 20GB usable memory because the runtime needs KV cache, buffers, and app memory.
- 32GB system RAM is the practical minimum; 64GB is better for smoother use.
- GPU VRAM improves speed, but CPU-only can work slowly if the server supports it.
- MoE models use fewer active parameters per token, but the quantized model weights still need to be loaded.

## Current Agentica Wiring

Provider id:

```text
agentica-qwen-core
```

Default local API:

```text
http://127.0.0.1:11434/v1
```

Default model id:

```text
agentica-qwen-core
```

Environment:

```text
AGENTICA_CORE_PROVIDER=agentica-qwen-core
AGENTICA_QWEN_CORE_ENABLED=true
AGENTICA_QWEN_CORE_BASE_URL=http://127.0.0.1:11434/v1
AGENTICA_QWEN_CORE_MODEL=agentica-qwen-core
AGENTICA_QWEN_CORE_API_KEY=
```

Keep these disabled until the local model server is actually running:

```text
AGENTICA_CORE_PROVIDER=agentica-native
AGENTICA_QWEN_CORE_ENABLED=false
```

## Option A: Run Through Ollama

Use this when your model file is a GGUF and you want the easiest local OpenAI-compatible route.

Create a `Modelfile` next to your downloaded model:

```text
FROM C:\path\to\your\qwen-model.gguf
PARAMETER num_ctx 32768
PARAMETER temperature 0.7
PARAMETER top_p 0.8
SYSTEM You are Agentica Qwen Core, the private local reasoning model inside Agentica. Answer directly, use tools only through Agentica, and produce practical output.
```

Create the local model:

```powershell
ollama create agentica-qwen-core -f C:\path\to\Modelfile
ollama serve
```

Then set:

```text
AGENTICA_CORE_PROVIDER=agentica-qwen-core
AGENTICA_QWEN_CORE_ENABLED=true
AGENTICA_QWEN_CORE_BASE_URL=http://127.0.0.1:11434/v1
AGENTICA_QWEN_CORE_MODEL=agentica-qwen-core
```

## Option B: Run Through llama.cpp

Use this when you want to point directly at the GGUF file with `llama-server`.

Example:

```powershell
llama-server -m C:\path\to\your\qwen-model.gguf --host 127.0.0.1 --port 8080 -c 32768
```

Then set:

```text
AGENTICA_CORE_PROVIDER=agentica-qwen-core
AGENTICA_QWEN_CORE_ENABLED=true
AGENTICA_QWEN_CORE_BASE_URL=http://127.0.0.1:8080/v1
AGENTICA_QWEN_CORE_MODEL=local-model
```

If your server exposes a different model name under `/v1/models`, use that exact id.

## How Agentica Uses It

When enabled, Agentica can use Qwen Core in three ways:

- as the default core when no other model is selected
- as a selectable model in the Select AI Model popover
- as a teacher in God Mode and learning runs

If the local Qwen server is not reachable, Agentica reports the model error. It does not silently pretend the local model answered.

## Recommended Model Choices

For general local brain behavior:

```text
Qwen/Qwen3-30B-A3B
```

For coding and agent/tool behavior:

```text
Qwen/Qwen3-Coder-30B-A3B-Instruct
```

For the user-mentioned Qwen 3.6 local file:

```text
Qwen3.6-35B-A3B
```

The model id in Agentica must match what your local server exposes. If you imported the file into Ollama as `agentica-qwen-core`, use `agentica-qwen-core`.

## Validation

After starting the local model server and restarting Agentica:

```powershell
curl http://127.0.0.1:11434/v1/models
```

Then in Agentica:

1. Open Select AI Model.
2. Choose `Agentica Qwen Core (Local)`.
3. Use model id `agentica-qwen-core`.
4. Send a normal prompt.

Expected trace:

```text
Model: Agentica Qwen Core (Local) / agentica-qwen-core
```

