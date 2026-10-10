from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import IncidentUpdate
from app.routers.incidents import check_not_closed, get_incident_or_404
from app.schemas import IncidentUpdateCreate, IncidentUpdateRead

router = APIRouter(prefix="/incidents/{incident_id}/updates", tags=["Cronologie"])


# GET /api/incidents/{incident_id}/updates - cronologia incidentului, in ordinea adaugarii (404 daca nu exista)
@router.get("", response_model=list[IncidentUpdateRead])
def list_updates(incident_id: int, db: Session = Depends(get_db)):
    get_incident_or_404(incident_id, db)
    query = select(IncidentUpdate).where(IncidentUpdate.incident_id == incident_id).order_by(IncidentUpdate.id)
    return db.scalars(query).all()


# POST /api/incidents/{incident_id}/updates - adauga o actualizare (raspuns 201; 409 daca incidentul este inchis)
@router.post("", response_model=IncidentUpdateRead, status_code=201)
def create_update(incident_id: int, data: IncidentUpdateCreate, db: Session = Depends(get_db)):
    check_not_closed(get_incident_or_404(incident_id, db))
    update = IncidentUpdate(incident_id=incident_id, **data.model_dump())
    db.add(update)
    db.commit()
    db.refresh(update)
    return update
