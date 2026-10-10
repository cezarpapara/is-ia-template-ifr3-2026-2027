import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Incident
from app.schemas import AiStatus, ChatRequest, ChatResponse, PostmortemDraft
from app.services import llm

router = APIRouter(prefix="/ai", tags=["Inteligenta artificiala"])


# GET /api/ai/status - este pornit Ollama? este descarcat modelul?
# Nu da eroare daca Ollama lipseste: raspunde cu "indisponibil" si explicatia.
@router.get("/status", response_model=AiStatus)
def ai_status():
    model = settings.ollama_model
    try:
        models = llm.list_models()
    except llm.LLMError as error:
        return AiStatus(ollama="indisponibil", model=model, models=[], detalii=str(error))

    if llm.is_downloaded(model, models):
        details = f"Modelul '{model}' este descarcat si poate fi folosit."
    else:
        details = f"Ollama ruleaza, dar modelul '{model}' nu este descarcat. Rulati: ollama pull {model}"
    return AiStatus(ollama="disponibil", model=model, models=models, detalii=details)


# POST /api/ai/chat - o intrebare catre model, raspunsul vine ca text
@router.post("/chat", response_model=ChatResponse)
def ai_chat(data: ChatRequest):
    messages = []
    if data.system:
        messages.append({"role": "system", "content": data.system})
    messages.append({"role": "user", "content": data.message})

    try:
        answer = llm.chat(messages)
    except llm.LLMError as error:
        raise HTTPException(status_code=503, detail=str(error))
    return ChatResponse(model=settings.ollama_model, answer=answer)


# Instructiunile pentru model: ce trebuie sa faca si in ce format sa raspunda
POSTMORTEM_PROMPT = (
    "Esti un inginer SRE care scrie postmortem-uri fara vinovati (blameless), in limba romana. "
    "Pe baza incidentului si a cronologiei lui, scrie un draft scurt: cauza, impactul asupra "
    "utilizatorilor si 2-4 actiuni concrete care previn repetarea incidentului. "
    'Raspunde DOAR cu JSON de forma: {"cauza": "...", "impact": "...", "actiuni": ["actiune 1", "actiune 2"]}'
)


# POST /api/ai/incidents/{id}/postmortem - modelul propune un draft de postmortem (nu se salveaza)
@router.post("/incidents/{incident_id}/postmortem", response_model=PostmortemDraft)
def ai_postmortem(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incidentul {incident_id} nu exista.")

    messages = [
        {"role": "system", "content": POSTMORTEM_PROMPT},
        {"role": "user", "content": describe_incident(incident)},
    ]
    try:
        answer = llm.chat(messages, json_format=True)
    except llm.LLMError as error:
        raise HTTPException(status_code=503, detail=str(error))

    draft = parse_postmortem(answer)
    if draft is None:
        raise HTTPException(status_code=502, detail="Modelul nu a raspuns in formatul cerut. Incercati din nou.")
    return PostmortemDraft(incident_id=incident_id, **draft)


def describe_incident(incident: Incident) -> str:
    """Textul trimis modelului: datele incidentului si cronologia lui (orele sunt in UTC, ca in baza de date)."""
    lines = [
        f"Serviciu: {incident.service.name} (responsabil: {incident.service.owner})",
        f"Incident: {incident.title}",
        f"Severitate: SEV{incident.severity}",
        f"Deschis la: {incident.opened_at:%Y-%m-%d %H:%M} UTC",
    ]
    if incident.description:
        lines.append(f"Descriere: {incident.description}")
    if incident.resolved_at:
        lines.append(f"Rezolvat la: {incident.resolved_at:%Y-%m-%d %H:%M} UTC")
    if incident.updates:
        lines.append("Cronologie:")
        lines += [
            f"- {update.created_at:%Y-%m-%d %H:%M} UTC, {update.author}: {update.text}" for update in incident.updates
        ]
    return "\n".join(lines)


def parse_postmortem(answer: str) -> dict | None:
    """Extrage cauza, impactul si actiunile din raspunsul JSON al modelului.

    Modelele nu respecta mereu formatul exact, asa ca acceptam si actiuni scrise ca un singur text
    sau ca obiecte ({"actiune": "..."}). Fara cauza si impact, raspunsul nu este folosibil.
    """
    try:
        data = json.loads(answer)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None

    cause, impact, actions = data.get("cauza"), data.get("impact"), data.get("actiuni")
    if not isinstance(cause, str) or not cause.strip() or not isinstance(impact, str) or not impact.strip():
        return None
    if isinstance(actions, str):
        actions = [actions]
    if not isinstance(actions, list):
        actions = []

    clean = []
    for item in actions:
        if isinstance(item, dict):
            item = next((value for value in item.values() if isinstance(value, str)), "")
        if isinstance(item, str) and item.strip():
            clean.append(item.strip())
    return {"cauza": cause.strip(), "impact": impact.strip(), "actiuni": clean[:5]}
