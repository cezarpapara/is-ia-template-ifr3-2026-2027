from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.services import llm

router = APIRouter(prefix="/ai", tags=["Inteligență artificială"])


class ChatRequest(BaseModel):
    message: str
    model: str | None = None


@router.get("/status")
def ai_status():
    try:
        installed_models = llm.list_models()
        return {
            "status": "ok",
            "ollama": "disponibil",
            "model": settings.OLLAMA_MODEL,
            "models": installed_models,
            "modele_disponibile": installed_models,
            "detalii": "Modelul este pregatit pentru generare."
        }
    except Exception as err:
        return {
            "status": "indisponibil",
            "ollama": "indisponibil",
            "model": settings.OLLAMA_MODEL,
            "models": [],
            "modele_disponibile": [],
            "detalii": f"Eroare de conexiune la Ollama: {err}"
        }


@router.get("/models")
def get_available_models():
    """Returneaza lista tuturor modelelor instalate in Ollama."""
    return {"models": llm.list_models()}


@router.post("/chat")
def ai_chat(req: ChatRequest):
    try:
        reply = llm.chat(
            messages=[{"role": "user", "content": req.message}],
            model=req.model
        )
        return {"reply": reply, "used_model": req.model or settings.OLLAMA_MODEL}
    except llm.LLMError as err:
        raise HTTPException(status_code=503, detail=str(err))
