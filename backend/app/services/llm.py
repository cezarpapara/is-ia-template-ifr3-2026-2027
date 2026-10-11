import re
import time
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


_GEMINI_NAME = re.compile(r"^gemini-\d+(\.\d+)?-(flash-lite|flash|pro)(-preview)?$")
_gemini_cache: dict = {"at": 0.0, "names": []}


def gemini_models() -> list[str]:
    """Modelele Gemini disponibile cheii tale: din GEMINI_MODELS (.env) sau citite de la API (cache 5 min)."""
    if not settings.GEMINI_API_KEY:
        return []
    if settings.GEMINI_MODELS:
        return settings.GEMINI_MODELS
    if time.time() - _gemini_cache["at"] < 300 and _gemini_cache["names"]:
        return _gemini_cache["names"]
    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        names = sorted({
            m.name.removeprefix("models/")
            for m in client.models.list()
            if "generateContent" in (m.supported_actions or [])
        })
        names = [n for n in names if _GEMINI_NAME.match(n)]
    except Exception:
        names = []
    names = names or ["gemini-2.5-flash", "gemini-2.5-pro"]  # plasa de siguranta
    _gemini_cache.update(at=time.time(), names=names)
    return names


def list_models() -> list[dict]:
    """Modelele locale (Ollama) cu detalii, plus cele Gemini (daca exista cheie). Fiecare sursa e independenta."""
    result, ollama_error = [], None
    try:
        response = httpx.get(f"{settings.OLLAMA_URL}/api/tags", timeout=5.0)
        response.raise_for_status()
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
    except httpx.HTTPError as err:
        ollama_error = f"Nu s-a putut contacta serverul Ollama: {err}"
    for name in gemini_models():
        result.append({"name": name, "size_bytes": 0, "parameter_size": None,
                       "quantization": None, "family": "gemini", "provider": "cloud"})
    if ollama_error and not result:
        raise LLMError(ollama_error)
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
        return _gemini(messages, model, json_mode)

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


def _gemini(messages: list[dict], model: str, json_mode: bool = False) -> LLMResult:
    if not settings.GEMINI_API_KEY:
        raise LLMError("Cheia GEMINI_API_KEY nu este configurata (backend/.env).")
    try:
        from google import genai
        from google.genai import errors, types

        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system") or None
        contents = "\n\n".join(m["content"] for m in messages if m["role"] != "system")
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json" if json_mode else None,
        )
        client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=types.HttpOptions(timeout=300_000))
        started = time.time()
        res = client.models.generate_content(model=model, contents=contents, config=config)
        elapsed = time.time() - started
    except LLMError:
        raise
    except Exception as err:
        raise LLMError(_gemini_error(err, model))
    if not res.text:
        raise LLMError("Gemini nu a returnat text (posibil blocat de filtrele de siguranta).")
    usage = getattr(res, "usage_metadata", None)
    # tokenii de "gandire" ai modelelor 2.5 se platesc si dureaza: ii numaram impreuna cu raspunsul
    out_tokens = (getattr(usage, "candidates_token_count", 0) or 0) + (getattr(usage, "thoughts_token_count", 0) or 0)
    return LLMResult(
        text=res.text,
        prompt_tokens=getattr(usage, "prompt_token_count", 0) or 0,
        completion_tokens=out_tokens,
        duration_ms=int(elapsed * 1000),
        gen_seconds=elapsed,
    )


def _gemini_error(err: Exception, model: str) -> str:
    code = getattr(err, "code", None)
    if code == 429:
        return "Limita Gemini a fost depasita (cota sau cereri pe minut). Incearca mai tarziu sau alt model."
    if code in (401, 403) or "API key" in str(err):
        return "Cheia Gemini este invalida sau nu are drepturi (verifica GEMINI_API_KEY in backend/.env)."
    if code == 404:
        return f"Modelul {model} nu exista pentru cheia ta Gemini."
    return f"Eroare la apelul Gemini ({code or type(err).__name__}): {str(getattr(err, 'message', err))[:300]}"
