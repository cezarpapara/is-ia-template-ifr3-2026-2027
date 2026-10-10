from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Modelele (entitatile) aplicatiei: gestionarea incidentelor pentru serviciile unei echipe on-call.
# Fiecare clasa = un tabel din baza de date.
# Dupa orice modificare aici, creati o migrare noua (vezi README / indrumarul).


class Service(Base):
    __tablename__ = "service"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    # Echipa responsabila de serviciu
    owner: Mapped[str] = mapped_column(String(100))
    # 1 = critic, 2 = important, 3 = intern
    tier: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relatie 1-n: un serviciu are mai multe incidente; stergerea serviciului sterge si incidentele
    incidents: Mapped[list["Incident"]] = relationship(
        back_populates="service", cascade="all, delete-orphan", passive_deletes=True
    )


class Incident(Base):
    __tablename__ = "incident"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    # 1 = SEV1 (critic), 2 = SEV2 (major), 3 = SEV3 (minor)
    severity: Mapped[int] = mapped_column(Integer, default=2)
    # Valori permise: deschis, confirmat, in_lucru, rezolvat, inchis (verificate in schemas.py)
    status: Mapped[str] = mapped_column(String(20), default="deschis")
    # Analiza de dupa incident; obligatorie la inchiderea unui incident SEV1 sau SEV2
    postmortem: Mapped[str | None] = mapped_column(Text)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    service_id: Mapped[int] = mapped_column(ForeignKey("service.id", ondelete="CASCADE"))

    service: Mapped[Service] = relationship(back_populates="incidents")
    # Relatie 1-n: cronologia incidentului (stearsa odata cu incidentul)
    updates: Mapped[list["IncidentUpdate"]] = relationship(
        back_populates="incident",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="IncidentUpdate.id",
    )


class IncidentUpdate(Base):
    __tablename__ = "incident_update"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    author: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    incident_id: Mapped[int] = mapped_column(ForeignKey("incident.id", ondelete="CASCADE"))

    incident: Mapped[Incident] = relationship(back_populates="updates")
