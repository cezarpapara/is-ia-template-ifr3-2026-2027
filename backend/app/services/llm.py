import httpx
from app.config import settings


class LLMError(Exception):
    """Exceptie ridicata cand serviciul LLM nu raspunde sau da eroare."""
    pass


def list_models() -> list[str]:
    """Interogheaza Ollama si returneaza toate modelele instalate pe server."""
    try:
        response = httpx.get(f"{settings.OLLAMA_URL}/api/tags", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            return [model["name"] for model in data.get("models", [])]
    except Exception:
        pass
    return [settings.OLLAMA_MODEL]


def chat(messages: list[dict], model: str | None = None, response_format: str | None = None) -> str:
    """Trimite mesajele catre Ollama sau catre Gemini daca este cerut explicit."""
    selected_model = model or settings.OLLAMA_MODEL

    if "gemini" in selected_model.lower():
        if not settings.GEMINI_API_KEY:
            raise LLMError("Cheia GEMINI_API_KEY nu este configurata in .env.")
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = "\n".join([m.get("content", "") for m in messages])
            res = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            return res.text
        except Exception as err:
            raise LLMError(f"Eroare la apelul Gemini API: {err}")

    payload = {
        "model": selected_model,
        "messages": messages,
        "stream": False
    }
    if response_format:
        payload["format"] = response_format

    try:
        response = httpx.post(f"{settings.OLLAMA_URL}/api/chat", json=payload, timeout=120.0)
        if response.status_code != 200:
            raise LLMError(f"Ollama a returnat status {response.status_code}: {response.text}")
        return response.json()["message"]["content"]
    except httpx.RequestError as err:
        raise LLMError(f"Nu s-a putut contacta serverul Ollama: {err}")
