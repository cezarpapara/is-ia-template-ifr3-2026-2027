import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.integration
BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def migration_database(test_engine):
    schema = f"migration_{uuid4().hex}"
    with test_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    url = test_engine.url.update_query_dict({"options": f"-csearch_path={schema}"})
    engine = create_engine(url)
    yield engine
    engine.dispose()
    with test_engine.begin() as connection:
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))


def migrate(engine, command, revision):
    return subprocess.run(
        [sys.executable, "-m", "alembic", command, revision], cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": engine.url.render_as_string(hide_password=False)},
        capture_output=True, text=True, timeout=30,
    )


def test_fresh_migrations_constraints_indexes_and_downgrade(migration_database):
    engine = migration_database
    result = migrate(engine, "upgrade", "head")
    assert result.returncode == 0, result.stderr
    inspector = inspect(engine)
    names = {constraint["name"] for constraint in inspector.get_check_constraints("incident")}
    assert {"ck_incident_severity", "ck_incident_status", "ck_incident_closed_postmortem"} <= names
    assert "ck_service_tier" in {item["name"] for item in inspector.get_check_constraints("service")}
    assert "ix_incident_service_id" in {item["name"] for item in inspector.get_indexes("incident")}
    assert "ix_incident_update_incident_id" in {item["name"] for item in inspector.get_indexes("incident_update")}
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM service")) == 3
        assert connection.scalar(text("SELECT count(*) FROM incident")) == 4
    for invalid in ("severity = 4", "status = 'unknown'", "status = 'inchis', severity = 1, postmortem = NULL",
                    "status = 'inchis', severity = 1, postmortem = E'\\n\\t '"):
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(text(f"UPDATE incident SET {invalid} WHERE id = 1"))
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("UPDATE service SET tier = 4 WHERE id = 1"))
    assert migrate(engine, "downgrade", "0003").returncode == 0
    assert inspect(engine).get_check_constraints("incident") == []
    assert migrate(engine, "upgrade", "head").returncode == 0


def test_migration_rejects_invalid_existing_data_without_rewriting(migration_database):
    engine = migration_database
    assert migrate(engine, "upgrade", "0003").returncode == 0
    with engine.begin() as connection:
        connection.execute(text("UPDATE incident SET severity = 9 WHERE id = 1"))
    result = migrate(engine, "upgrade", "head")
    assert result.returncode != 0
    assert "0004" in result.stderr and "invalid" in result.stderr.lower()
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT severity FROM incident WHERE id = 1")) == 9
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0003"
