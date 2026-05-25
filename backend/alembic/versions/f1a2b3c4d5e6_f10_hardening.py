"""F10 hardening: unique partial index for active trial plan

Revision ID: f1a2b3c4d5e6
Revises: e1f7a9c3b286
Create Date: 2026-05-23 12:00:00.000000

Ensures at the database level that only one subscription_plans row can have
both is_trial = TRUE and is_active = TRUE simultaneously.
"""
from __future__ import annotations

from alembic import op

revision = "f1a2b3c4d5e6"
down_revision = "e1f7a9c3b286"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Partial unique index: at most one row where both flags are true
    op.execute(
        """
        CREATE UNIQUE INDEX uq_subscription_plans_single_active_trial
        ON subscription_plans (is_trial)
        WHERE is_trial = TRUE AND is_active = TRUE
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_subscription_plans_single_active_trial")
