import httpx
import pytest

from app.services import llm


def response(payload=None, status=200, content=None):
    options = {"content": content} if content is not None else {"json": payload}
    return httpx.Response(status, request=httpx.Request("GET", "http://ollama.test"), **options)


@pytest.mark.parametrize("payload", [None, [], {}, {"models": None}, {"models": {}},
                                      {"models": [None]}, {"models": [{}]},
                                      {"models": [{"name": 7}]}, {"models": [{"name": " "}]}])
def test_list_models_rejects_malformed_success(monkeypatch, payload):
    monkeypatch.setattr(llm.httpx, "get", lambda *a, **kw: response(payload))
    with pytest.raises(llm.LLMError) as error:
        llm.list_models()
    assert error.value.status_code == 502


@pytest.mark.parametrize("method,call", [("get", llm.list_models), ("post", lambda: llm.chat([]))])
def test_invalid_json_is_controlled_protocol_error(monkeypatch, method, call):
    monkeypatch.setattr(llm.httpx, method, lambda *a, **kw: response(content=b"not json"))
    with pytest.raises(llm.LLMError) as error:
        call()
    assert error.value.status_code == 502


@pytest.mark.parametrize("payload", [None, [], {}, {"message": None}, {"message": []},
                                      {"message": {}}, {"message": {"content": 2}},
                                      {"message": {"content": " "}}, {"message": {"content": "x"}, "error": "bad"}])
def test_chat_rejects_malformed_success(monkeypatch, payload):
    monkeypatch.setattr(llm.httpx, "post", lambda *a, **kw: response(payload))
    with pytest.raises(llm.LLMError) as error:
        llm.chat([])
    assert error.value.status_code == 502


def test_valid_models_and_model_aliases(monkeypatch):
    monkeypatch.setattr(llm.httpx, "get", lambda *a, **kw: response({"models": [{"name": "qwen:latest"}]}))
    assert llm.list_models() == ["qwen:latest"]
    assert llm.is_downloaded("qwen", ["qwen:latest"])
    assert llm.is_downloaded("qwen:latest", ["qwen:latest"])
    assert not llm.is_downloaded("missing", [])
    monkeypatch.setattr(llm.httpx, "get", lambda *a, **kw: response({"models": []}))
    assert llm.list_models() == []


def test_chat_sends_correct_contract(monkeypatch):
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return response({"message": {"content": "answer"}})

    monkeypatch.setattr(llm.httpx, "post", post)
    messages = [{"role": "user", "content": "question"}]
    assert llm.chat(messages, model="sample", json_format=True) == "answer"
    assert calls[0][1]["json"] == {"model": "sample", "messages": messages, "stream": False, "format": "json"}
    assert calls[0][1]["timeout"] == llm.CHAT_TIMEOUT
    llm.chat(messages)
    assert "format" not in calls[1][1]["json"]


@pytest.mark.parametrize("exception", [httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ReadError])
@pytest.mark.parametrize("method,call", [("get", llm.list_models), ("post", lambda: llm.chat([]))])
def test_transport_errors_are_available_as_controlled_errors(monkeypatch, exception, method, call):
    def fail(*args, **kwargs):
        raise exception("connection failed")

    monkeypatch.setattr(llm.httpx, method, fail)
    with pytest.raises(llm.LLMError) as error:
        call()
    assert error.value.status_code == 503


@pytest.mark.parametrize("payload", [None, [], {}, {"error": []}, {"error": "private upstream details"}])
def test_chat_http_error_payload_does_not_crash_or_leak(monkeypatch, payload):
    monkeypatch.setattr(llm.httpx, "post", lambda *a, **kw: response(payload, status=500))
    with pytest.raises(llm.LLMError) as error:
        llm.chat([])
    assert error.value.status_code == 503
    assert "500" in str(error.value)
    assert "private upstream details" not in str(error.value)


def test_missing_model_is_actionable(monkeypatch):
    monkeypatch.setattr(llm.httpx, "post", lambda *a, **kw: response(content=b"invalid", status=404))
    with pytest.raises(llm.LLMError, match="ollama pull missing"):
        llm.chat([], model="missing")


def test_list_http_failure_is_controlled(monkeypatch):
    monkeypatch.setattr(llm.httpx, "get", lambda *a, **kw: response([], status=500))
    with pytest.raises(llm.LLMError, match="500"):
        llm.list_models()
