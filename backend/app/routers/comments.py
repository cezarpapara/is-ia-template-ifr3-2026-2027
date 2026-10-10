from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Comment
from app.routers.tasks import get_task_or_404
from app.schemas import CommentCreate, CommentRead

router = APIRouter(prefix="/tasks/{task_id}/comments", tags=["Comentarii"])


# GET /api/tasks/{task_id}/comments - comentariile unei sarcini (404 daca sarcina nu exista)
@router.get("", response_model=list[CommentRead])
def list_comments(task_id: int, db: Session = Depends(get_db)):
    get_task_or_404(task_id, db)
    query = select(Comment).where(Comment.task_id == task_id).order_by(Comment.id)
    return db.scalars(query).all()


# POST /api/tasks/{task_id}/comments - adauga un comentariu la sarcina (raspuns 201)
@router.post("", response_model=CommentRead, status_code=201)
def create_comment(task_id: int, data: CommentCreate, db: Session = Depends(get_db)):
    get_task_or_404(task_id, db)
    comment = Comment(task_id=task_id, **data.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
