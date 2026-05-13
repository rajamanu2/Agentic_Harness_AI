# AirLLM 2.11.0 Local Model Setup

AirLLM is a local Python inference runtime, not a hosted API. Agentica uses it through a small local Agentica-compatible bridge:

```text
Agentica UI -> Node backend -> http://127.0.0.1:4891/v1/chat/completions -> AirLLM 2.11.0
```

## Install AirLLM

Use a Python environment with the right GPU/CUDA or Apple Silicon setup for the model you want to run.

```powershell
cd "C:\Users\rajam\OneDrive\Documents\New project\agentic-harness"
python -m venv .venv-airllm
.\.venv-airllm\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-airllm.txt
```

AirLLM 2.11.0 is pinned in:

```text
requirements-airllm.txt
```

PyPI lists `airllm` latest version `2.11.0`, released September 21, 2024.

## Configure The Model

Edit `.env`:

```text
AIRLLM_BASE_URL=http://127.0.0.1:4891/v1
AIRLLM_MODEL=Qwen/Qwen-7B
AIRLLM_ENABLED=false
```

Set `AIRLLM_MODEL` to any Hugging Face model AirLLM supports and your machine can run. Some gated models also require Hugging Face authentication.

## Start The Bridge

```powershell
cd "C:\Users\rajam\OneDrive\Documents\New project\agentic-harness"
.\.venv-airllm\Scripts\Activate.ps1
python .\scripts\airllm-openai-bridge.py
```

Then open Agentica, choose:

```text
AirLLM 2.11.0 (Local)
```

The provider is exposed to Agentica as an Agentica-compatible chat provider at:

```text
http://127.0.0.1:4891/v1
```

## Teacher Mode

AirLLM is not used as a teacher model by default because loading a local model can be slow and heavy. To include it in teacher ensemble prompts, set:

```text
AIRLLM_ENABLED=true
```

Then restart the Agentica Node backend.
