"""phase_f10_registration

Adds public registration support:
  - is_trial column on subscription_plans (marks the trial plan)
  - is_public column on subscription_plans (marks plans visible on pricing page)

Revision ID: e1f7a9c3b286
Revises: d0e6f2a3b485
Create Date: 2026-05-23 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "e1f7a9c3b286"
down_revision: str = "d0e6f2a3b485"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "subscription_plans",
        sa.Column("is_trial", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "subscription_plans",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index(
        "ix_subscription_plans_is_trial", "subscription_plans", ["is_trial"]
    )
    op.create_index(
        "ix_subscription_plans_is_public", "subscription_plans", ["is_public"]
    )


def downgrade() -> None:
    op.drop_index("ix_subscription_plans_is_public", table_name="subscription_plans")
    op.drop_index("ix_subscription_plans_is_trial", table_name="subscription_plans")
    op.drop_column("subscription_plans", "is_public")
    op.drop_column("subscription_plans", "is_trial")
