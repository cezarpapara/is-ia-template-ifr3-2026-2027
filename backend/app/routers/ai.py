import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Task
from app.schemas import AiStatus, ChatRequest, ChatResponse, SubtasksResponse
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
SUBTASKS_PROMPT = (
    "Esti un asistent pentru managementul proiectelor software. "
    "Imparte sarcina primita in 3-5 subsarcini concrete, scurte, in limba romana. "
    'Raspunde DOAR cu JSON de forma: {"subtasks": ["subsarcina 1", "subsarcina 2", "subsarcina 3"]}'
)


# POST /api/ai/tasks/{id}/subtasks - modelul propune subsarcini (nu se salveaza in baza de date)
@router.post("/tasks/{task_id}/subtasks", response_model=SubtasksResponse)
def ai_subtasks(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Sarcina {task_id} nu exista.")

    text = f"Proiect: {task.project.name}\nSarcina: {task.title}"
    if task.description:
        text += f"\nDescriere: {task.description}"
    messages = [
        {"role": "system", "content": SUBTASKS_PROMPT},
        {"role": "user", "content": text},
    ]

    try:
        answer = llm.chat(messages, json_format=True)
    except llm.LLMError as error:
        raise HTTPException(status_code=503, detail=str(error))

    subtasks = parse_subtasks(answer)
    if not subtasks:
        raise HTTPException(status_code=502, detail="Modelul nu a raspuns in formatul cerut. Incercati din nou.")
    return SubtasksResponse(task_id=task_id, subtasks=subtasks)


def parse_subtasks(answer: str) -> list[str]:
    """Extrage lista de subsarcini din raspunsul JSON al modelului.

    Modelele mici nu respecta mereu formatul, asa ca acceptam si variante apropiate:
    {"subtasks": ["a", "b"]}, ["a", "b"] sau {"subtasks": [{"title": "a"}, ...]}.
    """
    try:
        data = json.loads(answer)
    except json.JSONDecodeError:
        return []

    if isinstance(data, dict):
        # prima valoare de tip lista din obiect (de obicei cheia "subtasks")
        data = next((value for value in data.values() if isinstance(value, list)), [])
    if not isinstance(data, list):
        return []

    subtasks = []
    for item in data:
        if isinstance(item, dict):
            item = next((value for value in item.values() if isinstance(value, str)), "")
        if isinstance(item, str) and item.strip():
            subtasks.append(item.strip())
    return subtasks[:5]
