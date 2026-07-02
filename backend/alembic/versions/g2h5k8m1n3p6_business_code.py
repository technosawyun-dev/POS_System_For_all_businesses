"""Add business_code to tenants for staff login

Revision ID: g2h5k8m1n3p6
Revises: f1a2b3c4d5e6
Create Date: 2026-05-25 17:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "g2h5k8m1n3p6"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres forbids a DEFAULT expression from referencing another column of the
    # same table (id here), so this has to be add-nullable -> backfill -> set-not-null
    # rather than a single server_default. md5(id) is unique per tenant and needs no extension.
    op.add_column(
        "tenants",
        sa.Column("business_code", sa.String(20), nullable=True),
    )
    op.execute(
        "UPDATE tenants SET business_code = upper(substr(md5(id::text), 1, 8)) "
        "WHERE business_code IS NULL"
    )
    op.alter_column("tenants", "business_code", nullable=False)
    op.create_unique_constraint("uq_tenants_business_code", "tenants", ["business_code"])
    op.create_index("ix_tenants_business_code", "tenants", ["business_code"])


def downgrade() -> None:
    op.drop_index("ix_tenants_business_code", table_name="tenants")
    op.drop_constraint("uq_tenants_business_code", "tenants", type_="unique")
    op.drop_column("tenants", "business_code")
