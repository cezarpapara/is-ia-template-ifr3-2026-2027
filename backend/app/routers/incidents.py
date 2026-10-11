from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Incident, Service
from app.schemas import IncidentCreate, IncidentPatch, IncidentRead, IncidentStatus

router = APIRouter(prefix="/incidents", tags=["Incidente"])

# Tranzitiile permise intre statusuri (diagrama de stari a incidentului)
ALLOWED_TRANSITIONS = {
    "deschis": {"confirmat"},
    "confirmat": {"in_lucru"},
    "in_lucru": {"rezolvat"},
    "rezolvat": {"in_lucru", "inchis"},
    "inchis": set(),
}

# Severitatile pentru care inchiderea cere un postmortem completat (SEV1 si SEV2)
POSTMORTEM_REQUIRED = {1, 2}


# Functie ajutatoare: gaseste incidentul sau raspunde cu 404
def get_incident_or_404(incident_id: int, db: Session, *, for_update: bool = False) -> Incident:
    query = select(Incident).where(Incident.id == incident_id)
    if for_update:
        # Lock-ul ramane pana la commit/rollback. Reincarca si obiectele deja citite in sesiune.
        query = query.with_for_update().execution_options(populate_existing=True)
    incident = db.scalar(query)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incidentul {incident_id} nu exista.")
    return incident


def check_service_exists(service_id: int, db: Session) -> None:
    if db.get(Service, service_id) is None:
        raise HTTPException(status_code=404, detail=f"Serviciul {service_id} nu exista.")


# Starea "inchis" este finala: incidentul nu se mai modifica (raspuns 409)
def check_not_closed(incident: Incident) -> None:
    if incident.status == "inchis":
        raise HTTPException(
            status_code=409, detail=f"Incidentul {incident.id} este inchis si nu mai poate fi modificat."
        )


# Raspunde cu 400 daca incidentul nu poate trece din statusul curent in cel nou
def check_transition(current: str, new: str) -> None:
    if new == current:
        return
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tranzitie nepermisa: din '{current}' nu se poate trece "
                f"in '{new}'. Din '{current}' se poate trece doar in: "
                f"{', '.join(sorted(allowed))}."
            ),
        )


# Conditia de garda a tranzitiei rezolvat -> inchis: SEV1 si SEV2 au nevoie de postmortem
def check_can_close(severity: int, postmortem: str | None) -> None:
    if severity in POSTMORTEM_REQUIRED and not (postmortem or "").strip():
        raise HTTPException(
            status_code=400,
            detail=(
                f"Un incident SEV{severity} nu se poate inchide fara postmortem. "
                "Completati postmortem-ul, apoi inchideti incidentul."
            ),
        )


# Dupa rezolvare severitatea nu se mai schimba: altfel un SEV1 coborat la SEV3 s-ar inchide fara postmortem
def check_severity_change(incident: Incident, changes: dict) -> None:
    if incident.status == "rezolvat" and changes.get("severity", incident.severity) != incident.severity:
        raise HTTPException(
            status_code=400,
            detail="Severitatea nu se mai poate schimba dupa rezolvare. Redeschideti incidentul (in_lucru) mai intai.",
        )


# Actiunile tranzitiilor: momentul confirmarii, al rezolvarii si redeschiderea
def status_changes(current: str, new: str) -> dict:
    now = datetime.now(timezone.utc)
    if new == "confirmat":
        return {"status": new, "acknowledged_at": now}
    if new == "rezolvat":
        return {"status": new, "resolved_at": now}
    if new == "in_lucru" and current == "rezolvat":
        return {"status": new, "resolved_at": None}
    return {"status": new}


# GET /api/incidents?service_id=1&status=deschis&severity=1 - lista incidentelor, cele noi primele
@router.get("", response_model=list[IncidentRead])
def list_incidents(
    service_id: int | None = None,
    status: IncidentStatus | None = None,
    severity: int | None = Query(default=None, ge=1, le=3),
    db: Session = Depends(get_db),
):
    query = select(Incident).order_by(Incident.id.desc())
    if service_id is not None:
        query = query.where(Incident.service_id == service_id)
    if status is not None:
        query = query.where(Incident.status == status)
    if severity is not None:
        query = query.where(Incident.severity == severity)
    return db.scalars(query).all()


# GET /api/incidents/{id} - un incident
@router.get("/{incident_id}", response_model=IncidentRead)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    return get_incident_or_404(incident_id, db)


# POST /api/incidents - raporteaza un incident; porneste din starea "deschis" (404 daca serviciul nu exista)
@router.post("", response_model=IncidentRead, status_code=201)
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    check_service_exists(data.service_id, db)
    incident = Incident(**data.model_dump(), status="deschis")
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


# PATCH /api/incidents/{id} - modifica doar campurile trimise (ex. {"status": "confirmat"})
@router.patch("/{incident_id}", response_model=IncidentRead)
def update_incident(incident_id: int, data: IncidentPatch, db: Session = Depends(get_db)):
    incident = get_incident_or_404(incident_id, db, for_update=True)
    check_not_closed(incident)
    changes = data.model_dump(exclude_unset=True)
    check_severity_change(incident, changes)
    new_status = changes.get("status")
    if new_status is not None:
        check_transition(incident.status, new_status)
        if new_status == "inchis":
            check_can_close(changes.get("severity", incident.severity), changes.get("postmortem", incident.postmortem))

    if new_status is not None and new_status != incident.status:
        changes = {**changes, **status_changes(incident.status, new_status)}
    if changes:
        db.execute(update(Incident).where(Incident.id == incident_id).values(**changes))
    db.commit()
    db.refresh(incident)
    return incident


# DELETE /api/incidents/{id} - doar un incident "deschis" (raportat din greseala) se poate sterge (raspuns 204)
@router.delete("/{incident_id}", status_code=204)
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = get_incident_or_404(incident_id, db, for_update=True)
    if incident.status != "deschis":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Doar un incident deschis (raportat din greseala) se poate sterge. "
                f"Incidentul {incident_id} este '{incident.status}'."
            ),
        )
    db.delete(incident)
    db.commit()
    return Response(status_code=204)
