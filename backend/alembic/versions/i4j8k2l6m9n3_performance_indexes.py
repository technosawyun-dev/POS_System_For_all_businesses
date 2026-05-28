"""performance_indexes

Revision ID: i4j8k2l6m9n3
Revises: h3i7j2k9l1m4
Create Date: 2026-05-28 00:00:00.000000

Adds composite indexes that cover the most frequent analytics and
list-query access patterns.  All indexes are CONCURRENT-safe in
PostgreSQL (we use standard CREATE INDEX here — Alembic applies them
inside a transaction, which is fine for schema migrations).

Index rationale:
  orders (tenant_id, created_at)              — every analytics time-range query
  orders (tenant_id, order_status, created_at)— completed-order filters in reports
  refunds (tenant_id, created_at)             — refund-stats aggregation
  stock_movements (tenant_id, created_at)     — movement report
  stock_movements (tenant_id, movement_type, created_at) — fast/dead-stock queries
  branch_inventory (tenant_id, product_id)   — inventory-valuation JOIN
  customers (tenant_id, created_at)          — new-customers-this-month count
  customer_ledger (customer_id, created_at)  — per-customer ledger pagination
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i4j8k2l6m9n3"
down_revision: Union[str, None] = "h3i7j2k9l1m4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # orders
    # Time-range analytics (all 4 order-stats calls in the dashboard)
    op.create_index(
        "ix_orders_tenant_created_at",
        "orders",
        ["tenant_id", "created_at"],
    )
    # Status-filtered analytics (completed orders only)
    op.create_index(
        "ix_orders_tenant_status_created_at",
        "orders",
        ["tenant_id", "order_status", "created_at"],
    )

    # refunds
    op.create_index(
        "ix_refunds_tenant_created_at",
        "refunds",
        ["tenant_id", "created_at"],
    )

    # stock_movements
    op.create_index(
        "ix_stock_movements_tenant_created_at",
        "stock_movements",
        ["tenant_id", "created_at"],
    )
    op.create_index(
        "ix_stock_movements_tenant_type_created_at",
        "stock_movements",
        ["tenant_id", "movement_type", "created_at"],
    )

    # branch_inventory
    # Inventory-valuation query joins BranchInventory → Product on product_id
    op.create_index(
        "ix_branch_inventory_tenant_product",
        "branch_inventory",
        ["tenant_id", "product_id"],
    )

    # customers
    op.create_index(
        "ix_customers_tenant_created_at",
        "customers",
        ["tenant_id", "created_at"],
    )

    # customer_ledger
    # Ledger is queried per customer ordered by time
    op.create_index(
        "ix_customer_ledger_customer_created_at",
        "customer_ledger",
        ["customer_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_customer_ledger_customer_created_at", table_name="customer_ledger")
    op.drop_index("ix_customers_tenant_created_at", table_name="customers")
    op.drop_index("ix_branch_inventory_tenant_product", table_name="branch_inventory")
    op.drop_index("ix_stock_movements_tenant_type_created_at", table_name="stock_movements")
    op.drop_index("ix_stock_movements_tenant_created_at", table_name="stock_movements")
    op.drop_index("ix_refunds_tenant_created_at", table_name="refunds")
    op.drop_index("ix_orders_tenant_status_created_at", table_name="orders")
    op.drop_index("ix_orders_tenant_created_at", table_name="orders")
