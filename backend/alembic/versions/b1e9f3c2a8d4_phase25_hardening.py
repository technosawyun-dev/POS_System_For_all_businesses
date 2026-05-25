"""phase2.5_hardening

Revision ID: b1e9f3c2a8d4
Revises: 445699a818db
Create Date: 2026-05-08 12:00:00.000000

Changes:
- idempotency_keys table for mutation endpoint deduplication
- Additional composite indexes for hot query paths
- CHECK constraints for data integrity (quantities >= 0)
- Index on stock_movements.created_at for time-range queries
- Index on branch_inventory.last_movement_at for stale-stock detection
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b1e9f3c2a8d4"
down_revision: Union[str, None] = "445699a818db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Idempotency Keys
    # Stores completed idempotent request responses to prevent double-execution.
    # Redis is the hot path; this table is the durable fallback.
    op.create_table(
        "idempotency_keys",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("tenant_id", sa.UUID(), nullable=True),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column("request_path", sa.String(500), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="processing"),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("response_body", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_idempotency_keys"),
        sa.UniqueConstraint(
            "tenant_id",
            "idempotency_key",
            name="uq_idempotency_keys_tenant_key",
        ),
    )
    op.create_index(
        "ix_idempotency_keys_tenant_key",
        "idempotency_keys",
        ["tenant_id", "idempotency_key"],
    )
    op.create_index(
        "ix_idempotency_keys_expires_at",
        "idempotency_keys",
        ["expires_at"],
    )

    # 2. Additional performance indexes

    # Products: tenant + active status for listing queries
    op.create_index(
        "ix_products_tenant_active",
        "products",
        ["tenant_id", "is_active"],
        postgresql_where=sa.text("is_deleted = false"),
    )

    # Branch inventory: last_movement_at for stale-stock reports
    op.create_index(
        "ix_branch_inventory_last_movement",
        "branch_inventory",
        ["tenant_id", "last_movement_at"],
    )

    # Stock movements: actor + created_at for audit queries
    op.create_index(
        "ix_stock_movements_actor_date",
        "stock_movements",
        ["actor_user_id", "created_at"],
    )

    # Inventory adjustments: actor + created_at
    op.create_index(
        "ix_inv_adj_actor_date",
        "inventory_adjustments",
        ["actor_user_id", "created_at"],
    )

    # Suppliers: tenant + status for active-supplier lookups
    op.create_index(
        "ix_suppliers_tenant_status",
        "suppliers",
        ["tenant_id", "status"],
        postgresql_where=sa.text("is_deleted = false"),
    )

    # 3. Check constraints for quantity integrity
    # Prevents negative quantity_on_hand at the DB level (belt + suspenders).
    # The service layer enforces this first, but this is the final guard.
    op.create_check_constraint(
        "ck_branch_inventory_quantity_non_negative",
        "branch_inventory",
        "quantity_on_hand >= 0",
    )
    op.create_check_constraint(
        "ck_branch_inventory_reserved_non_negative",
        "branch_inventory",
        "quantity_reserved >= 0",
    )

    # Stock movement quantity must always be positive
    op.create_check_constraint(
        "ck_stock_movements_quantity_positive",
        "stock_movements",
        "quantity > 0",
    )


def downgrade() -> None:
    # Remove check constraints
    op.drop_constraint(
        "ck_stock_movements_quantity_positive",
        "stock_movements",
        type_="check",
    )
    op.drop_constraint(
        "ck_branch_inventory_reserved_non_negative",
        "branch_inventory",
        type_="check",
    )
    op.drop_constraint(
        "ck_branch_inventory_quantity_non_negative",
        "branch_inventory",
        type_="check",
    )

    # Remove additional indexes
    op.drop_index("ix_suppliers_tenant_status", table_name="suppliers")
    op.drop_index("ix_inv_adj_actor_date", table_name="inventory_adjustments")
    op.drop_index("ix_stock_movements_actor_date", table_name="stock_movements")
    op.drop_index("ix_branch_inventory_last_movement", table_name="branch_inventory")
    op.drop_index("ix_products_tenant_active", table_name="products")

    # Remove idempotency table
    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_tenant_key", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
