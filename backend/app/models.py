from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Modelele (entitatile) aplicatiei. Fiecare clasa = un tabel din baza de date.
# Dupa orice modificare aici, creati o migrare noua (vezi README / indrumarul).


class Project(Base):
    __tablename__ = "project"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relatie 1-n: un proiect are mai multe sarcini; stergerea proiectului sterge si sarcinile
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )


class Task(Base):
    __tablename__ = "task"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    # Valori permise: de_facut, in_lucru, finalizat (verificate in schemas.py)
    status: Mapped[str] = mapped_column(String(20), default="de_facut")
    # 1 = mica, 2 = medie, 3 = mare
    priority: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"))

    project: Mapped[Project] = relationship(back_populates="tasks")


# ======================= Scriptorium: agenda, istoric, memorie =======================

class Job(Base):
    """O sarcina pentru modelul de limbaj. Agenda = joburile queued/running;
    istoricul = joburile done/failed/cancelled (acelasi tabel, alt status)."""

    __tablename__ = "job"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    prompt: Mapped[str] = mapped_column(Text)
    system: Mapped[str | None] = mapped_column(Text)
    # Modelul cerut ("auto" = il alege worker-ul dupa memoria libera) si cel folosit efectiv
    model: Mapped[str] = mapped_column(String(100))
    model_used: Mapped[str | None] = mapped_column(String(100))
    # queued, running, done, failed, cancelled (regulile tranzitiilor: services/job_states.py)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    # 1 = mica, 2 = medie, 3 = mare
    priority: Mapped[int] = mapped_column(Integer, default=2)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    tokens_per_s: Mapped[float | None] = mapped_column(Float)
    use_memory: Mapped[bool] = mapped_column(Boolean, default=True)
    memory_hits: Mapped[int] = mapped_column(Integer, default=0)
    # Joburile create odata pentru mai multe modele (comparatie) au acelasi group_id
    group_id: Mapped[str | None] = mapped_column(String(32), index=True)


class MemoryItem(Base):
    """Un fapt retinut din joburile procesate; se reinjecteaza in joburile viitoare."""

    __tablename__ = "memory_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    source_job_id: Mapped[int | None] = mapped_column(ForeignKey("job.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ResourceSample(Base):
    """Esantion de CPU/RAM, salvat la ~10 secunde (pentru graficul de istoric)."""

    __tablename__ = "resource_sample"

    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    cpu: Mapped[float] = mapped_column(Float)
    ram_percent: Mapped[float] = mapped_column(Float)
    ram_used_mb: Mapped[int] = mapped_column(Integer)
