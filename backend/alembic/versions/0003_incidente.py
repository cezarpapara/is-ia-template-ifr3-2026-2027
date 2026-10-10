"""incidente: inlocuieste tabelele de exemplu (project, task, comment) cu service, incident si incident_update

Revision ID: 0003
Revises: 6991746e2527
Create Date: 2026-10-10 14:00:00

"""
from datetime import datetime, timedelta, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Identificatorii migrarii (Alembic ii foloseste pentru ordinea migrarilor)
revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "6991746e2527"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Sterge tabelele de exemplu din template si creeaza tabelele proiectului, cu date de exemplu."""
    op.drop_table("comment")
    op.drop_table("task")
    op.drop_table("project")

    service = op.create_table(
        "service",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner", sa.String(length=100), nullable=False),
        sa.Column("tier", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    incident = op.create_table(
        "incident",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("postmortem", sa.Text(), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("service_id", sa.Integer(), sa.ForeignKey("service.id", ondelete="CASCADE"), nullable=False),
    )

    incident_update = op.create_table(
        "incident_update",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incident.id", ondelete="CASCADE"), nullable=False),
    )

    # Date de exemplu: incidente in stari diferite (deschis, in_lucru, rezolvat, inchis),
    # ca sa se vada regulile din diagrama de stari
    connection = op.get_bind()

    def add_service(name, description, owner, tier):
        return connection.execute(
            sa.insert(service)
            .values(name=name, description=description, owner=owner, tier=tier)
            .returning(service.c.id)
        ).scalar_one()

    def add_incident(**values):
        return connection.execute(sa.insert(incident).values(**values).returning(incident.c.id)).scalar_one()

    gateway = add_service("api-gateway", "Punctul de intrare pentru toate cererile externe.", "Echipa Platformă", 1)
    payments = add_service("plati-online", "Procesarea plăților cu cardul.", "Echipa Plăți", 1)
    emails = add_service("notificari-email", "Trimiterea e-mailurilor către clienți.", "Echipa Comunicare", 3)

    now = datetime.now(timezone.utc)
    hours = lambda n: now - timedelta(hours=n)  # noqa: E731

    latency = add_incident(
        title="Latență mare (p95 peste 2 s) pe /checkout", severity=2, status="in_lucru",
        opened_at=hours(3), acknowledged_at=hours(2.8), service_id=gateway,
    )
    payment_errors = add_incident(
        title="Plăți respinse cu eroarea 502", severity=1, status="rezolvat",
        description="Aproximativ 30% din plăți eșuau la procesatorul de carduri.",
        opened_at=hours(26), acknowledged_at=hours(25.9), resolved_at=hours(24), service_id=payments,
    )
    add_incident(
        title="E-mailurile de confirmare întârzie 10 minute", severity=3, status="deschis",
        opened_at=hours(0.5), service_id=emails,
    )
    add_incident(
        title="Certificat TLS expirat pe staging", severity=2, status="inchis",
        opened_at=hours(72), acknowledged_at=hours(71.9), resolved_at=hours(71), service_id=gateway,
        postmortem="Cauza: reînnoirea automată a certificatului era dezactivată pe staging.\n"
                   "Impact: testele de integrare au eșuat timp de o oră.\n"
                   "Acțiuni: reînnoire automată activată; alertă cu 14 zile înainte de expirare.",
    )

    op.bulk_insert(
        incident_update,
        [
            {"text": "Alertă p95 > 2 s pe /checkout, confirmată de on-call.", "author": "Ana Ionescu",
             "created_at": hours(2.8), "incident_id": latency},
            {"text": "Cauza probabilă: pool-ul de conexiuni către baza de date este epuizat.", "author": "Ana Ionescu",
             "created_at": hours(2), "incident_id": latency},
            {"text": "Procesatorul de carduri răspunde cu 502 după ultima lansare.", "author": "Mihai Pop",
             "created_at": hours(25.5), "incident_id": payment_errors},
            {"text": "Rollback la versiunea 3.7.1; plățile funcționează din nou.", "author": "Mihai Pop",
             "created_at": hours(24), "incident_id": payment_errors},
        ],
    )


def downgrade() -> None:
    """Revine la tabelele de exemplu din template (fara datele lor)."""
    op.drop_table("incident_update")
    op.drop_table("incident")
    op.drop_table("service")

    op.create_table(
        "project",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "task",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("project.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_table(
        "comment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("task.id", ondelete="CASCADE"), nullable=False),
    )
