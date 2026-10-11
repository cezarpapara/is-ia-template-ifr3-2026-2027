"""Constrangeri de integritate si indexuri pentru incidente.

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

CONSTRAINTS = (
    ("service", "ck_service_tier", "tier BETWEEN 1 AND 3"),
    ("incident", "ck_incident_severity", "severity BETWEEN 1 AND 3"),
    ("incident", "ck_incident_status", "status IN ('deschis', 'confirmat', 'in_lucru', 'rezolvat', 'inchis')"),
    ("incident", "ck_incident_closed_postmortem",
     "status <> 'inchis' OR severity = 3 OR (postmortem IS NOT NULL AND postmortem ~ '[^[:space:]]')"),
)


def upgrade() -> None:
    connection = op.get_bind()
    # Nu corectam automat istoricul: oprirea lasa datele si versiunea neschimbate.
    for table, name, condition in CONSTRAINTS:
        invalid_ids = connection.execute(sa.text(
            f"SELECT id FROM {table} WHERE NOT ({condition}) ORDER BY id LIMIT 10"
        )).scalars().all()
        if invalid_ids:
            raise RuntimeError(
                f"0004: invalid existing rows for {name}: ids={invalid_ids}. "
                "Review and correct these rows before retrying the migration."
            )
    for table, name, condition in CONSTRAINTS:
        op.create_check_constraint(name, table, condition)
    op.create_index("ix_incident_service_id", "incident", ["service_id"])
    op.create_index("ix_incident_update_incident_id", "incident_update", ["incident_id"])


def downgrade() -> None:
    op.drop_index("ix_incident_update_incident_id", table_name="incident_update")
    op.drop_index("ix_incident_service_id", table_name="incident")
    for table, name, _ in reversed(CONSTRAINTS):
        op.drop_constraint(name, table, type_="check")
