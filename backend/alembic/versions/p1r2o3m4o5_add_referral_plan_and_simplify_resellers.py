"""add referral plan and simplify resellers

Revision ID: p1r2o3m4o5
Revises: h3i7j2k9l1m4
Create Date: 2026-05-28 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "p1r2o3m4o5"
down_revision: str = "i4j8k2l6m9n3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_referral_plan column to subscription_plans
    op.add_column(
        "subscription_plans",
        sa.Column(
            "is_referral_plan",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("subscription_plans", "is_referral_plan")
