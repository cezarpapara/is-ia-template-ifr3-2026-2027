"""Tests only touch the explicitly supplied, disposable PostgreSQL database."""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_DATABASE_URL:
    test_url = make_url(TEST_DATABASE_URL)
    if test_url.get_backend_name() != "postgresql" or not (test_url.database or "").endswith("_test"):
        raise RuntimeError("TEST_DATABASE_URL must point to a disposable PostgreSQL database ending in _test.")
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Incident, Service  # noqa: E402


@pytest.fixture(scope="session")
def test_engine():
    if not TEST_DATABASE_URL:
        pytest.skip("Set TEST_DATABASE_URL to run PostgreSQL integration tests.")
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(test_engine):
    with test_engine.begin() as connection:
        connection.execute(text("TRUNCATE incident_update, incident, service RESTART IDENTITY CASCADE"))
    return sessionmaker(bind=test_engine, expire_on_commit=False, autoflush=False)


@pytest.fixture
def db(session_factory):
    with session_factory() as session:
        yield session


@pytest.fixture
def db_session(db):
    return db


@pytest.fixture
def client(session_factory):
    def override_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def service(db):
    item = Service(name="checkout", owner="Platforma", tier=1)
    db.add(item)
    db.commit()
    return item


@pytest.fixture
def incident(db, service):
    item = Incident(title="Latenta", severity=2, service_id=service.id, status="deschis")
    db.add(item)
    db.commit()
    return item
