import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResourceSample
from app.services import system, worker

router = APIRouter(prefix="/system", tags=["Server"])


def with_worker() -> dict:
    return {**system.latest(), "worker": worker.state}


# GET /api/system/stats - ultima masuratoare (CPU, RAM, modele incarcate, starea worker-ului)
@router.get("/stats")
def stats():
    return with_worker()


# GET /api/system/stream - Server-Sent Events: o masuratoare noua la 2 secunde
@router.get("/stream")
async def stream(request: Request):
    async def events():
        while not await request.is_disconnected():
            yield f"data: {json.dumps(with_worker())}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# GET /api/system/history?minutes=60 - esantioanele salvate in baza de date
@router.get("/history")
def history(minutes: int = 60, db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(minutes=min(max(minutes, 1), 1440))
    rows = db.scalars(select(ResourceSample).where(ResourceSample.ts >= since).order_by(ResourceSample.ts)).all()
    return [{"ts": r.ts.isoformat(), "cpu": r.cpu, "ram_percent": r.ram_percent, "ram_used_mb": r.ram_used_mb} for r in rows]
