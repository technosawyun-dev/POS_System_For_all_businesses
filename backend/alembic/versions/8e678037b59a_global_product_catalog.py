"""global_product_catalog

Revision ID: 8e678037b59a
Revises: c1d2e3f4a5b6
Create Date: 2026-07-04 00:00:00.000000

Adds global_product_catalog: a cross-tenant, barcode-keyed table holding only
Name/Description/Category-name/Brand-name. Any tenant creating or editing a
product with a given barcode overwrites this entry (last write wins), so other
tenants scanning the same barcode later can autofill those four fields. Not
tenant-scoped by design — everything else about a product (price, SKU, stock,
tax, etc.) stays private to each tenant and is never stored here.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "8e678037b59a"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "global_product_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("barcode", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_name", sa.String(255), nullable=True),
        sa.Column("brand_name", sa.String(255), nullable=True),
        sa.Column("created_by_tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by_tenant_id"], ["tenants.id"], ondelete="SET NULL",
            name="fk_global_product_catalog_created_by_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_tenant_id"], ["tenants.id"], ondelete="SET NULL",
            name="fk_global_product_catalog_updated_by_tenant_id_tenants",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_global_product_catalog"),
        sa.UniqueConstraint("barcode", name="uq_global_product_catalog_barcode"),
    )
    op.create_index("ix_global_product_catalog_barcode", "global_product_catalog", ["barcode"])


def downgrade() -> None:
    op.drop_table("global_product_catalog")
