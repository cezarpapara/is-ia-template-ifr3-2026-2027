"""Real PostgreSQL locks protect lifecycle decisions across independent sessions."""
import time
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Barrier

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import Incident, IncidentUpdate, Service
from app.routers.incident_updates import create_update
from app.routers.incidents import delete_incident, update_incident
from app.routers.services import create_service
from app.schemas import IncidentPatch, IncidentUpdateCreate, ServiceCreate

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("operation", ["patch", "delete", "timeline"])
def test_mutation_waits_for_lock_and_rechecks_latest_state(test_engine, session_factory, db, incident, operation):
    incident.status = "deschis" if operation == "delete" else "rezolvat"
    incident.postmortem = "Reviewed postmortem"
    db.commit()
    incident_id = incident.id
    ready = Queue()

    def mutate():
        with session_factory() as session:
            # Un obiect citit anterior trebuie reincarcat dupa obtinerea lock-ului.
            cached = session.get(Incident, incident_id)
            assert cached is not None
            ready.put(session.scalar(text("SELECT pg_backend_pid()")))
            try:
                if operation == "patch":
                    update_incident(incident_id, IncidentPatch(title="Late edit"), session)
                elif operation == "delete":
                    delete_incident(incident_id, session)
                else:
                    create_update(incident_id, IncidentUpdateCreate(text="Late update", author="Ana"), session)
                return 200
            except HTTPException as error:
                return error.status_code

    with session_factory() as locking_session, ThreadPoolExecutor(max_workers=1) as pool:
        locked = locking_session.scalar(select(Incident).where(Incident.id == incident_id).with_for_update())
        future = pool.submit(mutate)
        worker_pid = ready.get(timeout=5)
        waiting = False
        try:
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline and not future.done():
                with test_engine.connect() as observer:
                    waiting = observer.scalar(text(
                        "SELECT wait_event_type = 'Lock' FROM pg_stat_activity WHERE pid = :pid"
                    ), {"pid": worker_pid})
                if waiting:
                    break
                time.sleep(0.01)
            locked.status = "confirmat" if operation == "delete" else "inchis"
        finally:
            locking_session.commit()
        result = future.result(timeout=5)
    assert waiting, "Mutation must wait on the incident row before reading lifecycle state."
    assert result == 409
    db.expire_all()
    saved = db.get(Incident, incident_id)
    assert saved is not None and saved.title == "Latenta"
    assert db.scalar(select(func.count()).select_from(IncidentUpdate)) == 0


def test_simultaneous_service_creation_returns_one_conflict(test_engine, session_factory):
    barrier = Barrier(2)

    class RacingSession(Session):
        def scalar(self, statement, *args, **kwargs):
            value = super().scalar(statement, *args, **kwargs)
            barrier.wait(timeout=5)
            return value

    def create():
        with RacingSession(bind=test_engine, expire_on_commit=False) as session:
            try:
                create_service(ServiceCreate(name="same-name", owner="team"), session)
                return 201
            except HTTPException as error:
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: create(), range(2)))
    assert sorted(results) == [201, 409]
    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Service)) == 1
