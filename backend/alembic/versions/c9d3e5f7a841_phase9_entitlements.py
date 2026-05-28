"""phase9_entitlements

Adds entitlement override table:
  - tenant_entitlement_overrides

Revision ID: c9d3e5f7a841
Revises: b8d5e3f9c072
Create Date: 2026-05-21 03:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c9d3e5f7a841"
down_revision: str = "b8d5e3f9c072"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_entitlement_overrides",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feature_code", sa.String(100), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=True),
        sa.Column("limit_value", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
            name="fk_tenant_entitlement_overrides_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_tenant_entitlement_overrides_created_by_user_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tenant_entitlement_overrides"),
        sa.UniqueConstraint(
            "tenant_id",
            "feature_code",
            name="uq_tenant_entitlement_overrides_tenant_feature",
        ),
    )
    op.create_index(
        "ix_tenant_entitlement_overrides_tenant_id",
        "tenant_entitlement_overrides",
        ["tenant_id"],
    )
    op.create_index(
        "ix_tenant_entitlement_overrides_feature_code",
        "tenant_entitlement_overrides",
        ["feature_code"],
    )


def downgrade() -> None:
    op.drop_table("tenant_entitlement_overrides")
