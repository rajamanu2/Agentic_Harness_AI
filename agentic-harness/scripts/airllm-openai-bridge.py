import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.getenv("AIRLLM_HOST", "127.0.0.1")
PORT = int(os.getenv("AIRLLM_PORT", "4891"))
MODEL_ID = os.getenv("AIRLLM_MODEL", "Qwen/Qwen-7B")
MAX_LENGTH = int(os.getenv("AIRLLM_MAX_LENGTH", "2048"))
MAX_NEW_TOKENS = int(os.getenv("AIRLLM_MAX_NEW_TOKENS", "256"))

_MODEL = None


def load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    try:
        from airllm import AutoModel
    except Exception as exc:
        raise RuntimeError("airllm is not installed. Run: python -m pip install -r requirements-airllm.txt") from exc
    _MODEL = AutoModel.from_pretrained(MODEL_ID)
    return _MODEL


def messages_to_prompt(messages):
    parts = []
    for message in messages or []:
        role = message.get("role", "user")
        content = message.get("content", "")
        if isinstance(content, list):
            content = "\n".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
        parts.append(f"{role.upper()}: {content}")
    parts.append("ASSISTANT:")
    return "\n".join(parts)


def generate_text(messages, max_new_tokens):
    model = load_model()
    prompt = messages_to_prompt(messages)
    tokens = model.tokenizer(
        [prompt],
        return_tensors="pt",
        return_attention_mask=False,
        truncation=True,
        max_length=MAX_LENGTH,
        padding=False,
    )
    input_ids = tokens["input_ids"]
    try:
        import torch

        if torch.cuda.is_available():
            input_ids = input_ids.cuda()
    except Exception:
        pass
    output = model.generate(
        input_ids,
        max_new_tokens=max_new_tokens,
        use_cache=True,
        return_dict_in_generate=True,
    )
    text = model.tokenizer.decode(output.sequences[0], skip_special_tokens=True)
    if text.startswith(prompt):
        text = text[len(prompt):]
    return text.strip()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_json(200, {"ok": True})

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            self.send_json(200, {"status": "ok", "provider": "airllm", "model": MODEL_ID})
            return
        if self.path.rstrip("/") == "/v1/models":
            self.send_json(200, {"object": "list", "data": [{"id": MODEL_ID, "object": "model", "created": 0, "owned_by": "airllm"}]})
            return
        self.send_json(404, {"error": {"message": "Not found"}})

    def do_POST(self):
        if self.path.rstrip("/") != "/v1/chat/completions":
            self.send_json(404, {"error": {"message": "Not found"}})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            messages = body.get("messages", [])
            max_new_tokens = int(body.get("max_tokens") or body.get("max_new_tokens") or MAX_NEW_TOKENS)
            text = generate_text(messages, max_new_tokens)
            self.send_json(200, {
                "id": f"airllm-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": MODEL_ID,
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": text},
                    "finish_reason": "stop",
                }],
            })
        except Exception as exc:
            self.send_json(500, {"error": {"message": str(exc), "type": exc.__class__.__name__}})

    def log_message(self, fmt, *args):
        print(f"[airllm] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    print(f"AirLLM OpenAI bridge running on http://{HOST}:{PORT}/v1")
    print(f"Model: {MODEL_ID}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
