import httpx
from dataclasses import dataclass

from app.config import settings


class LLMError(Exception):
    """Exceptie ridicata cand serviciul LLM nu raspunde sau da eroare."""


@dataclass
class LLMResult:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    duration_ms: int = 0
    gen_seconds: float = 0.0  # timpul de generare propriu-zis (pentru tokeni/secunda)


def is_cloud(model: str) -> bool:
    return model.lower().startswith("gemini")


def list_models() -> list[dict]:
    """Modelele instalate pe serverul Ollama, cu detalii (marime, parametri, cuantizare)."""
    try:
        response = httpx.get(f"{settings.OLLAMA_URL}/api/tags", timeout=5.0)
        response.raise_for_status()
    except httpx.HTTPError as err:
        raise LLMError(f"Nu s-a putut contacta serverul Ollama: {err}")
    result = []
    for m in response.json().get("models", []):
        d = m.get("details", {})
        result.append({
            "name": m["name"],
            "size_bytes": m.get("size", 0),
            "parameter_size": d.get("parameter_size"),
            "quantization": d.get("quantization_level"),
            "family": d.get("family"),
            "provider": "ollama",
        })
    if settings.GEMINI_API_KEY:
        result.append({"name": "gemini-2.5-flash", "size_bytes": 0, "parameter_size": None,
                       "quantization": None, "family": "gemini", "provider": "cloud"})
    return result


def loaded_models() -> list[dict]:
    """Modelele aflate acum in memorie (Ollama /api/ps). Lista goala daca Ollama nu raspunde."""
    try:
        response = httpx.get(f"{settings.OLLAMA_URL}/api/ps", timeout=3.0)
        response.raise_for_status()
        return [
            {"name": m["name"], "size_bytes": m.get("size", 0),
             "vram_bytes": m.get("size_vram", 0), "expires_at": m.get("expires_at")}
            for m in response.json().get("models", [])
        ]
    except (httpx.HTTPError, ValueError):
        return []


def unload(model: str) -> None:
    """Scoate modelul din memorie (keep_alive = 0)."""
    try:
        httpx.post(f"{settings.OLLAMA_URL}/api/generate",
                   json={"model": model, "keep_alive": 0}, timeout=15.0).raise_for_status()
    except httpx.HTTPError as err:
        raise LLMError(f"Nu s-a putut elibera modelul: {err}")


def generate(messages: list[dict], model: str, json_mode: bool = False) -> LLMResult:
    """Trimite mesajele la Ollama (sau la Gemini) si intoarce textul plus metricile."""
    if is_cloud(model):
        return _gemini(messages, model)

    payload = {"model": model, "messages": messages, "stream": False}
    if json_mode:
        payload["format"] = "json"
    try:
        # Pe procesor, modelele mari pot gandi minute in sir: timeout generos la citire
        response = httpx.post(f"{settings.OLLAMA_URL}/api/chat", json=payload,
                              timeout=httpx.Timeout(1800.0, connect=5.0))
    except httpx.HTTPError as err:
        raise LLMError(f"Nu s-a putut contacta serverul Ollama: {err}")
    if response.status_code != 200:
        raise LLMError(f"Ollama a returnat status {response.status_code}: {response.text[:300]}")
    data = response.json()
    return LLMResult(
        text=data["message"]["content"],
        prompt_tokens=data.get("prompt_eval_count", 0),
        completion_tokens=data.get("eval_count", 0),
        duration_ms=int(data.get("total_duration", 0) / 1_000_000),
        gen_seconds=data.get("eval_duration", 0) / 1_000_000_000,
    )


def _gemini(messages: list[dict], model: str) -> LLMResult:
    if not settings.GEMINI_API_KEY:
        raise LLMError("Cheia GEMINI_API_KEY nu este configurata (backend/.env).")
    import time
    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = "\n\n".join(f"[{m['role']}] {m['content']}" for m in messages)
        started = time.time()
        res = client.models.generate_content(model=model, contents=prompt)
        elapsed = time.time() - started
        usage = getattr(res, "usage_metadata", None)
        return LLMResult(
            text=res.text or "",
            prompt_tokens=getattr(usage, "prompt_token_count", 0) or 0,
            completion_tokens=getattr(usage, "candidates_token_count", 0) or 0,
            duration_ms=int(elapsed * 1000),
            gen_seconds=elapsed,
        )
    except Exception as err:
        raise LLMError(f"Eroare la apelul Gemini API: {err}")
