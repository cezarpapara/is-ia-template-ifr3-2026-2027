from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.models import Incident
from app.routers.services import create_service
from app.schemas import ServiceCreate


def test_service_creation_duplicates_and_open_counts(client, db, service):
    response = client.post("/api/services", json={"name": " email ", "owner": " Team ", "tier": 3})
    assert response.status_code == 201
    assert (response.json()["name"], response.json()["owner"]) == ("email", "Team")
    assert client.post("/api/services", json={"name": " email ", "owner": "Team"}).status_code == 409
    for status in ("deschis", "rezolvat", "inchis"):
        db.add(Incident(title=status, status=status, severity=3, service_id=service.id))
    db.commit()
    services = client.get("/api/services").json()
    assert [item["open_incident_count"] for item in services] == [2, 0]


def test_concurrent_unique_violation_is_controlled_conflict():
    db = Mock()
    db.scalar.return_value = None
    error = Mock(sqlstate="23505")
    db.commit.side_effect = IntegrityError("INSERT", {}, error)
    with pytest.raises(HTTPException) as raised:
        create_service(ServiceCreate(name="same", owner="team"), db)
    assert raised.value.status_code == 409
    db.rollback.assert_called_once()


def test_other_integrity_error_is_not_reported_as_duplicate():
    db = Mock()
    db.scalar.return_value = None
    db.commit.side_effect = IntegrityError("INSERT", {}, Mock(sqlstate="23514"))
    with pytest.raises(IntegrityError):
        create_service(ServiceCreate(name="same", owner="team"), db)
    db.rollback.assert_called_once()
