from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Schemele Pydantic descriu datele care intra si ies prin API.
# FastAPI le foloseste pentru validare automata (eroare 422) si pentru Swagger (/docs).

# Statusurile permise pentru un incident (diagrama de stari a incidentului)
IncidentStatus = Literal["deschis", "confirmat", "in_lucru", "rezolvat", "inchis"]

# Limite comune pentru formulare si pentru contextul trimis modelului local.
TEXT_LIMIT = 10_000
POSTMORTEM_LIMIT = 20_000


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


# ---------- Servicii ----------

class ServiceCreate(InputModel):
    name: str = Field(min_length=1, max_length=100, examples=["api-gateway"])
    description: str | None = Field(default=None, max_length=TEXT_LIMIT, examples=["Punctul de intrare pentru cererile externe."])
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
class IncidentCreate(InputModel):
    title: str = Field(min_length=1, max_length=200, examples=["Latenta mare pe /checkout"])
    description: str | None = Field(default=None, max_length=TEXT_LIMIT)
    severity: int = Field(default=2, ge=1, le=3)
    service_id: int = Field(gt=0)


# La modificare toate campurile sunt optionale: se trimit doar cele care se schimba
class IncidentPatch(InputModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=TEXT_LIMIT)
    severity: int | None = Field(default=None, ge=1, le=3)
    status: IncidentStatus | None = Field(default=None, examples=["confirmat"])
    postmortem: str | None = Field(default=None, max_length=POSTMORTEM_LIMIT)

    @field_validator("title", "severity", "status")
    @classmethod
    def required_when_supplied(cls, value):
        # Campurile omise raman neschimbate; numai description/postmortem accepta null.
        if value is None:
            raise ValueError("Campul nu poate fi null atunci cand este trimis.")
        return value


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

class IncidentUpdateCreate(InputModel):
    text: str = Field(min_length=1, max_length=TEXT_LIMIT, examples=["Am facut rollback la versiunea 1.4.2."])
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


class ChatRequest(InputModel):
    message: str = Field(min_length=1, max_length=TEXT_LIMIT, examples=["Ce este un postmortem fara vinovati?"])
    system: str | None = Field(default=None, max_length=4_000, examples=["Raspunde scurt, in limba romana."])


class ChatResponse(BaseModel):
    model: str
    answer: str


class PostmortemDraft(BaseModel):
    incident_id: int
    cauza: str
    impact: str
    actiuni: list[str]
