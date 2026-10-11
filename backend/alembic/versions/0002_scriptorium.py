"""scriptorium: job (agenda + istoric), memory_item, resource_sample

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-12 09:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("system", sa.Text(), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("model_used", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("tokens_per_s", sa.Float(), nullable=True),
        sa.Column("use_memory", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("memory_hits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("group_id", sa.String(length=32), nullable=True),
    )
    op.create_index("ix_job_group_id", "job", ["group_id"])
    op.create_index("ix_job_status", "job", ["status"])

    op.create_table(
        "memory_item",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source_job_id", sa.Integer(), sa.ForeignKey("job.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "resource_sample",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cpu", sa.Float(), nullable=False),
        sa.Column("ram_percent", sa.Float(), nullable=False),
        sa.Column("ram_used_mb", sa.Integer(), nullable=False),
    )
    op.create_index("ix_resource_sample_ts", "resource_sample", ["ts"])


def downgrade() -> None:
    op.drop_table("resource_sample")
    op.drop_table("memory_item")
    op.drop_table("job")
