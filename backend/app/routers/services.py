from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
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
    return [
        ServiceRead.model_validate(service).model_copy(update={"open_incident_count": open_count})
        for service, open_count in db.execute(query)
    ]


# POST /api/services - adauga un serviciu (409 daca numele exista deja)
@router.post("", response_model=ServiceRead, status_code=201)
def create_service(data: ServiceCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Service).where(Service.name == data.name))
    if existing:
        raise HTTPException(status_code=409, detail=f"Exista deja un serviciu cu numele '{data.name}'.")

    service = Service(**data.model_dump())
    db.add(service)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        # Doua cereri pot trece simultan de verificarea de mai sus; unicitatea decide in DB.
        if getattr(error.orig, "sqlstate", None) == "23505":
            raise HTTPException(
                status_code=409, detail=f"Exista deja un serviciu cu numele '{data.name}'."
            ) from error
        raise
    db.refresh(service)
    return service
