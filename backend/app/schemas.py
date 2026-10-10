from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Schemele Pydantic descriu datele care intra si ies prin API.
# FastAPI le foloseste pentru validare automata (eroare 422) si pentru Swagger (/docs).

# Statusurile permise pentru o sarcina
TaskStatus = Literal["de_facut", "in_lucru", "finalizat"]


# ---------- Proiecte ----------

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["Magazin online"])
    description: str | None = Field(default=None, examples=["Proiectul echipei 1"])


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    task_count: int = 0


# ---------- Sarcini ----------

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200, examples=["Diagrama cazurilor de utilizare"])
    description: str | None = None
    status: TaskStatus = "de_facut"
    priority: int = Field(default=2, ge=1, le=3)
    project_id: int


# La modificare toate campurile sunt optionale: se trimit doar cele care se schimba
class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus | None = Field(default=None, examples=["in_lucru"])
    priority: int | None = Field(default=None, ge=1, le=3)
    project_id: int | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: int
    created_at: datetime
    project_id: int


# ---------- Comentarii ----------

class CommentCreate(BaseModel):
    text: str = Field(min_length=1, examples=["Am terminat schita diagramei de clase."])
    author: str = Field(min_length=1, max_length=100, examples=["Ion Popescu"])


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    author: str
    created_at: datetime
    task_id: int


# ---------- Inteligenta artificiala (Ollama) ----------

class AiStatus(BaseModel):
    ollama: Literal["disponibil", "indisponibil"]
    model: str
    models: list[str]
    detalii: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, examples=["Ce este o diagrama de clase UML?"])
    system: str | None = Field(default=None, examples=["Raspunde scurt, in limba romana."])


class ChatResponse(BaseModel):
    model: str
    answer: str


class SubtasksResponse(BaseModel):
    task_id: int
    subtasks: list[str]
