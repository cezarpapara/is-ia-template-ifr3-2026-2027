from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from app import database
from app.routers.health import health


def test_health_and_docs_redirect(client):
    assert client.get("/api/health").json()["database"] == "conectata"
    assert client.get("/", follow_redirects=False).headers["location"] == "/docs"


def test_health_hides_database_errors():
    db = Mock()
    db.execute.side_effect = OperationalError("SELECT 1", {}, Exception("private connection data"))
    with pytest.raises(HTTPException) as raised:
        health(db)
    assert raised.value.status_code == 503
    assert "private" not in raised.value.detail


@pytest.mark.parametrize("failed", [False, True])
def test_database_dependency_always_closes_session(monkeypatch, failed):
    session = Mock()
    monkeypatch.setattr(database, "SessionLocal", lambda: session)
    dependency = database.get_db()
    assert next(dependency) is session
    if failed:
        with pytest.raises(RuntimeError):
            dependency.throw(RuntimeError("request failed"))
    else:
        dependency.close()
    session.close.assert_called_once()
