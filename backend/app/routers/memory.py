from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MemoryItem
from app.schemas import MemoryCreate, MemoryRead, MemoryUpdate

router = APIRouter(prefix="/memory", tags=["Memorie"])


def get_item_or_404(item_id: int, db: Session) -> MemoryItem:
    item = db.get(MemoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Amintirea {item_id} nu exista.")
    return item


# GET /api/memory?q= - amintirile, cele fixate primele
@router.get("", response_model=list[MemoryRead])
def list_memory(q: str | None = None, db: Session = Depends(get_db)):
    query = select(MemoryItem).order_by(MemoryItem.pinned.desc(), MemoryItem.id.desc())
    if q:
        query = query.where(MemoryItem.content.ilike(f"%{q}%"))
    return db.scalars(query.limit(500)).all()


# POST /api/memory - adauga manual o amintire
@router.post("", response_model=MemoryRead, status_code=201)
def add_memory(data: MemoryCreate, db: Session = Depends(get_db)):
    item = MemoryItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# PATCH /api/memory/{id} - editeaza textul sau fixeaza/defixeaza
@router.patch("/{item_id}", response_model=MemoryRead)
def update_memory(item_id: int, data: MemoryUpdate, db: Session = Depends(get_db)):
    item = get_item_or_404(item_id, db)
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


# DELETE /api/memory/{id}
@router.delete("/{item_id}", status_code=204)
def delete_memory(item_id: int, db: Session = Depends(get_db)):
    db.delete(get_item_or_404(item_id, db))
    db.commit()
    return Response(status_code=204)
