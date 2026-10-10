from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Task
from app.schemas import TaskCreate, TaskRead, TaskStatus, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Sarcini"])


# Functie ajutatoare: gaseste sarcina sau raspunde cu 404
def get_task_or_404(task_id: int, db: Session) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Sarcina {task_id} nu exista.")
    return task


def check_project_exists(project_id: int, db: Session) -> None:
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail=f"Proiectul {project_id} nu exista.")


# Tranzitiile permise intre statusuri (diagrama de stari a sarcinii)
ALLOWED_TRANSITIONS = {
    "de_facut": {"in_lucru"},
    "in_lucru": {"de_facut", "finalizat"},
    "finalizat": {"in_lucru"},
}


# Raspunde cu 400 daca sarcina nu poate trece din statusul curent in cel nou
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


# GET /api/tasks?project_id=1&status=de_facut - lista sarcinilor (filtrele sunt optionale)
@router.get("", response_model=list[TaskRead])
def list_tasks(project_id: int | None = None, status: TaskStatus | None = None, db: Session = Depends(get_db)):
    query = select(Task).order_by(Task.id)
    if project_id is not None:
        query = query.where(Task.project_id == project_id)
    if status is not None:
        query = query.where(Task.status == status)
    return db.scalars(query).all()


# GET /api/tasks/{id} - o sarcina
@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    return get_task_or_404(task_id, db)


# POST /api/tasks - creeaza o sarcina (404 daca proiectul nu exista)
@router.post("", response_model=TaskRead, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    check_project_exists(data.project_id, db)
    task = Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


# PATCH /api/tasks/{id} - modifica doar campurile trimise (ex. {"status": "finalizat"})
@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = get_task_or_404(task_id, db)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "project_id" in changes:
        check_project_exists(changes["project_id"], db)
    if "status" in changes:
        check_transition(task.status, changes["status"])

    for field, value in changes.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


# DELETE /api/tasks/{id} - sterge sarcina (raspuns 204, fara continut)
@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = get_task_or_404(task_id, db)
    db.delete(task)
    db.commit()
    return Response(status_code=204)
