from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Schemele Pydantic descriu datele care intra si ies prin API.
# FastAPI le foloseste pentru validare automata (eroare 422) si pentru Swagger (/docs).

# Statusurile permise pentru un incident (diagrama de stari a incidentului)
IncidentStatus = Literal["deschis", "confirmat", "in_lucru", "rezolvat", "inchis"]


# ---------- Servicii ----------

class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["api-gateway"])
    description: str | None = Field(default=None, examples=["Punctul de intrare pentru cererile externe."])
    owner: str = Field(min_length=1, max_length=100, examples=["Echipa Platforma"])
    tier: int = Field(default=2, ge=1, le=3)


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    owner: str
    tier: int
    created_at: datetime
    open_incident_count: int = 0


# ---------- Incidente ----------

# Un incident nou porneste mereu din starea "deschis", deci statusul nu se trimite la creare
class IncidentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200, examples=["Latenta mare pe /checkout"])
    description: str | None = None
    severity: int = Field(default=2, ge=1, le=3)
    service_id: int


# La modificare toate campurile sunt optionale: se trimit doar cele care se schimba
class IncidentPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    severity: int | None = Field(default=None, ge=1, le=3)
    status: IncidentStatus | None = Field(default=None, examples=["confirmat"])
    postmortem: str | None = None


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    severity: int
    status: IncidentStatus
    postmortem: str | None
    opened_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    service_id: int


# ---------- Cronologia incidentului ----------

class IncidentUpdateCreate(BaseModel):
    text: str = Field(min_length=1, examples=["Am facut rollback la versiunea 1.4.2."])
    author: str = Field(min_length=1, max_length=100, examples=["Ion Popescu"])


class IncidentUpdateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    author: str
    created_at: datetime
    incident_id: int


# ---------- Inteligenta artificiala (Ollama) ----------

class AiStatus(BaseModel):
    ollama: Literal["disponibil", "indisponibil"]
    model: str
    models: list[str]
    detalii: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, examples=["Ce este un postmortem fara vinovati?"])
    system: str | None = Field(default=None, examples=["Raspunde scurt, in limba romana."])


class ChatResponse(BaseModel):
    model: str
    answer: str


class PostmortemDraft(BaseModel):
    incident_id: int
    cauza: str
    impact: str
    actiuni: list[str]
