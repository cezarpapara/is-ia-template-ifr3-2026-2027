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


# ---------- Scriptorium: agenda, istoric, memorie ----------

JobStatus = Literal["queued", "running", "done", "failed", "cancelled"]


class JobCreate(BaseModel):
    prompt: str = Field(min_length=1, examples=["Explica pe scurt ce este o diagrama de secventa."])
    title: str | None = Field(default=None, max_length=200)
    system: str | None = None
    # Mai multe modele = comparatie: se creeaza cate un job pentru fiecare, cu acelasi group_id
    models: list[str] = Field(default=["auto"], min_length=1, max_length=20)
    priority: int = Field(default=2, ge=1, le=3)
    scheduled_at: datetime | None = None
    use_memory: bool = True


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    prompt: str
    system: str | None
    model: str
    model_used: str | None
    status: JobStatus
    priority: int
    scheduled_at: datetime | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    result: str | None
    error: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    duration_ms: int | None
    tokens_per_s: float | None
    use_memory: bool
    memory_hits: int
    group_id: str | None


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    pinned: bool = False


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=500)
    pinned: bool | None = None


class MemoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    pinned: bool
    source_job_id: int | None
    created_at: datetime
