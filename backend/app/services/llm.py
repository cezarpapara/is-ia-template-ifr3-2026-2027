import httpx

from app.config import settings

# Apeluri catre Ollama (LLM local), prin API-ul lui HTTP:
#   GET  /api/tags -> modelele descarcate
#   POST /api/chat -> o conversatie cu modelul
# Documentatie: https://github.com/ollama/ollama/blob/main/docs/api.md

# Cat asteptam raspunsul (in secunde). Pe procesor, un model mic poate raspunde in 10-60 s;
# la primul apel modelul se incarca in memorie si dureaza mai mult.
STATUS_TIMEOUT = 5
CHAT_TIMEOUT = 180


class LLMError(Exception):
    """503 pentru indisponibilitate; 502 pentru un protocol Ollama invalid."""

    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def _invalid_response() -> LLMError:
    return LLMError("Ollama a trimis un raspuns invalid. Incercati din nou.", status_code=502)


def _response_object(response: httpx.Response) -> dict:
    try:
        data = response.json()
    except (ValueError, UnicodeDecodeError) as error:
        raise _invalid_response() from error
    if not isinstance(data, dict) or "error" in data:
        raise _invalid_response()
    return data


def _not_running_message() -> str:
    return (
        f"Ollama nu raspunde la {settings.ollama_url}. "
        "Verificati ca Ollama este instalat si pornit pe calculator (comanda: ollama serve)."
    )


def _not_downloaded_message(model: str) -> str:
    return f"Modelul '{model}' nu este descarcat. Rulati pe calculator: ollama pull {model}"


def list_models() -> list[str]:
    """Intoarce numele modelelor descarcate in Ollama (ex. ["qwen2.5:1.5b"])."""
    try:
        response = httpx.get(f"{settings.ollama_url}/api/tags", timeout=STATUS_TIMEOUT)
        response.raise_for_status()
    except (httpx.ConnectError, httpx.ConnectTimeout):
        raise LLMError(_not_running_message())
    except httpx.TimeoutException:
        raise LLMError(f"Ollama nu a raspuns in {STATUS_TIMEOUT} secunde.")
    except httpx.HTTPStatusError as error:
        raise LLMError(f"Ollama a raspuns cu eroarea {error.response.status_code}.")
    except httpx.HTTPError:
        raise LLMError(_not_running_message())

    models = _response_object(response).get("models")
    if not isinstance(models, list) or any(
        not isinstance(item, dict)
        or not isinstance(item.get("name"), str)
        or not item["name"].strip()
        for item in models
    ):
        raise _invalid_response()
    return [item["name"] for item in models]


def is_downloaded(model: str, models: list[str]) -> bool:
    """Ollama adauga ":latest" cand nu se scrie versiunea (llama3.2 -> llama3.2:latest)."""
    return model in models or f"{model}:latest" in models


def chat(messages: list[dict], model: str | None = None, json_format: bool = False) -> str:
    """Trimite mesajele catre model si intoarce textul raspunsului.

    messages: lista de forma [{"role": "system" | "user" | "assistant", "content": "..."}]
    json_format: True -> modelul este obligat sa raspunda cu JSON valid
    """
    model = model or settings.ollama_model
    payload = {"model": model, "messages": messages, "stream": False}
    if json_format:
        payload["format"] = "json"

    try:
        response = httpx.post(f"{settings.ollama_url}/api/chat", json=payload, timeout=CHAT_TIMEOUT)
    except (httpx.ConnectError, httpx.ConnectTimeout):
        raise LLMError(_not_running_message())
    except httpx.TimeoutException:
        raise LLMError(
            f"Modelul '{model}' nu a raspuns in {CHAT_TIMEOUT} secunde. "
            "Incercati o intrebare mai scurta sau un model mai mic."
        )
    except httpx.HTTPError:
        raise LLMError(_not_running_message())

    # 404 = modelul cerut nu exista local
    if response.status_code == 404:
        raise LLMError(_not_downloaded_message(model))
    if response.status_code != 200:
        # Corpul erorii este date externe: poate fi HTML/JSON arbitrar sau contine date interne.
        raise LLMError(f"Ollama a raspuns cu eroarea {response.status_code}.")

    message = _response_object(response).get("message")
    if not isinstance(message, dict):
        raise _invalid_response()
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise _invalid_response()
    return content
