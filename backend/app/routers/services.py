from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Incident, Service
from app.schemas import ServiceCreate, ServiceRead

router = APIRouter(prefix="/services", tags=["Servicii"])


# GET /api/services - lista serviciilor, fiecare cu numarul de incidente care nu sunt inchise
@router.get("", response_model=list[ServiceRead])
def list_services(db: Session = Depends(get_db)):
    open_incident = and_(Incident.service_id == Service.id, Incident.status != "inchis")
    query = (
        select(Service, func.count(Incident.id))
        .outerjoin(Incident, open_incident)
        .group_by(Service.id)
        .order_by(Service.id)
    )
    result = []
    for service, open_count in db.execute(query):
        item = ServiceRead.model_validate(service)
        item.open_incident_count = open_count
        result.append(item)
    return result


# POST /api/services - adauga un serviciu (409 daca numele exista deja)
@router.post("", response_model=ServiceRead, status_code=201)
def create_service(data: ServiceCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Service).where(Service.name == data.name))
    if existing:
        raise HTTPException(status_code=409, detail=f"Exista deja un serviciu cu numele '{data.name}'.")

    service = Service(**data.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service
