from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services import llm

router = APIRouter(prefix="/models", tags=["Modele"])


# GET /api/models - modelele de pe server, cu marime si cu starea "incarcat in memorie"
@router.get("")
def get_models():
    try:
        models = llm.list_models()
    except llm.LLMError as err:
        raise HTTPException(status_code=503, detail=str(err))
    loaded = {m["name"]: m for m in llm.loaded_models()}
    for m in models:
        m["loaded"] = m["name"] in loaded
    return {"models": models, "gemini_configured": bool(settings.GEMINI_API_KEY)}


# POST /api/models/{name}/unload - elibereaza memoria ocupata de un model
@router.post("/{name:path}/unload", status_code=204)
def unload_model(name: str):
    try:
        llm.unload(name)
    except llm.LLMError as err:
        raise HTTPException(status_code=503, detail=str(err))
