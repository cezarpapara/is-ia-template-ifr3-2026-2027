import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job
from app.schemas import JobCreate, JobRead, JobStatus
from app.services.job_states import can_transition, transition_error

router = APIRouter(prefix="/jobs", tags=["Agenda și istoric"])

ACTIVE = ("queued", "running")


def get_job_or_404(job_id: int, db: Session) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Jobul {job_id} nu exista.")
    return job


def check_transition(job: Job, new: str) -> None:
    if not can_transition(job.status, new):
        raise HTTPException(status_code=400, detail=transition_error(job.status, new))


# GET /api/jobs?scope=active|history&status=&limit= - agenda (active) sau istoricul (history)
@router.get("", response_model=list[JobRead])
def list_jobs(scope: str | None = None, status: JobStatus | None = None, limit: int = 100, db: Session = Depends(get_db)):
    query = select(Job)
    if scope == "active":
        query = query.where(Job.status.in_(ACTIVE)).order_by(Job.status.desc(), Job.priority.desc(), Job.id)
    elif scope == "history":
        query = query.where(Job.status.not_in(ACTIVE)).order_by(Job.finished_at.desc().nullslast(), Job.id.desc())
    else:
        query = query.order_by(Job.id.desc())
    if status:
        query = query.where(Job.status == status)
    return db.scalars(query.limit(min(limit, 500))).all()


# GET /api/jobs/stats - numere pe status si viteza medie pe model (din istoric)
@router.get("/stats")
def job_stats(db: Session = Depends(get_db)):
    by_status = dict(db.execute(select(Job.status, func.count()).group_by(Job.status)).all())
    rows = db.execute(
        select(Job.model_used, func.count(), func.avg(Job.tokens_per_s), func.avg(Job.duration_ms))
        .where(Job.status == "done", Job.model_used.is_not(None))
        .group_by(Job.model_used)
    ).all()
    models = {name: {"jobs": n, "avg_tokens_per_s": round(tps, 2) if tps else None,
                     "avg_duration_ms": int(ms) if ms else None} for name, n, tps, ms in rows}
    return {"by_status": by_status, "models": models}


# POST /api/jobs - adauga in agenda (un job per model; mai multe modele = comparatie)
@router.post("", response_model=list[JobRead], status_code=201)
def create_jobs(data: JobCreate, db: Session = Depends(get_db)):
    models = list(dict.fromkeys(data.models))  # fara duplicate, pastrand ordinea
    group_id = uuid.uuid4().hex if len(models) > 1 else None
    title = (data.title or data.prompt).strip().splitlines()[0][:80]
    scheduled = data.scheduled_at
    if scheduled and scheduled.tzinfo is None:
        scheduled = scheduled.replace(tzinfo=timezone.utc)
    jobs = [
        Job(title=title, prompt=data.prompt, system=data.system, model=m, priority=data.priority,
            scheduled_at=scheduled, use_memory=data.use_memory, group_id=group_id)
        for m in models
    ]
    db.add_all(jobs)
    db.commit()
    for job in jobs:
        db.refresh(job)
    return jobs


# GET /api/jobs/{id}
@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, db: Session = Depends(get_db)):
    return get_job_or_404(job_id, db)


# POST /api/jobs/{id}/cancel - anuleaza (400 daca jobul e deja terminat)
@router.post("/{job_id}/cancel", response_model=JobRead)
def cancel_job(job_id: int, db: Session = Depends(get_db)):
    job = get_job_or_404(job_id, db)
    check_transition(job, "cancelled")
    job.status, job.finished_at = "cancelled", datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job


# POST /api/jobs/{id}/requeue - il pune din nou in agenda (rezultatul vechi se sterge)
@router.post("/{job_id}/requeue", response_model=JobRead)
def requeue_job(job_id: int, db: Session = Depends(get_db)):
    job = get_job_or_404(job_id, db)
    check_transition(job, "queued")
    job.status = "queued"
    job.result = job.error = job.model_used = None
    job.started_at = job.finished_at = None
    job.prompt_tokens = job.completion_tokens = job.duration_ms = job.tokens_per_s = None
    job.memory_hits = 0
    db.commit()
    db.refresh(job)
    return job


# DELETE /api/jobs/{id} - sterge din istoric (409 cat timp ruleaza)
@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = get_job_or_404(job_id, db)
    if job.status == "running":
        raise HTTPException(status_code=409, detail="Jobul ruleaza acum; anuleaza-l mai intai.")
    db.delete(job)
    db.commit()
    return Response(status_code=204)
