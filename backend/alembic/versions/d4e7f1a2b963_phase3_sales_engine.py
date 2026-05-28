"""phase3_sales_engine

Revision ID: d4e7f1a2b963
Revises: b1e9f3c2a8d4
Create Date: 2026-05-13 00:00:00.000000

 migration: cashier_sessions, branch_counters, carts, cart_items,
orders, order_items, payments, refunds, refund_items, receipts.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d4e7f1a2b963"
down_revision: Union[str, None] = "b1e9f3c2a8d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. cashier_sessions
    op.create_table(
        "cashier_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cashier_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("opening_balance", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("closing_balance", sa.Numeric(12, 4), nullable=True),
        sa.Column("expected_balance", sa.Numeric(12, 4), nullable=True),
        sa.Column("actual_balance", sa.Numeric(12, 4), nullable=True),
        sa.Column("discrepancy_amount", sa.Numeric(12, 4), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="OPEN"),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE",
            name="fk_cashier_sessions_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["branches.id"], ondelete="CASCADE",
            name="fk_cashier_sessions_branch_id_branches",
        ),
        sa.ForeignKeyConstraint(
            ["cashier_user_id"], ["users.id"], ondelete="CASCADE",
            name="fk_cashier_sessions_cashier_user_id_users",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cashier_sessions_tenant_id", "cashier_sessions", ["tenant_id"])
    op.create_index("ix_cashier_sessions_branch_id", "cashier_sessions", ["branch_id"])
    op.create_index("ix_cashier_sessions_cashier_user_id", "cashier_sessions", ["cashier_user_id"])
    op.create_index("ix_cashier_sessions_status", "cashier_sessions", ["status"])
    op.create_index("ix_cashier_sessions_opened_at", "cashier_sessions", ["opened_at"])
    # Partial unique index: only one OPEN session per cashier per branch
    op.create_index(
        "uq_cashier_session_open",
        "cashier_sessions",
        ["cashier_user_id", "branch_id"],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'"),
    )

    # 2. branch_counters
    op.create_table(
        "branch_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("receipt_seq", sa.Integer(), nullable=False, server_default="0"),
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
        sa.ForeignKeyConstraint(
            ["branch_id"], ["branches.id"], ondelete="CASCADE",
            name="fk_branch_counters_branch_id_branches",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("branch_id", name="uq_branch_counters_branch_id"),
    )
    op.create_index("ix_branch_counters_branch_id", "branch_counters", ["branch_id"])

    # 3. carts
    op.create_table(
        "carts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cashier_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE",
            name="fk_carts_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["branches.id"], ondelete="CASCADE",
            name="fk_carts_branch_id_branches",
        ),
        sa.ForeignKeyConstraint(
            ["cashier_session_id"], ["cashier_sessions.id"], ondelete="SET NULL",
            name="fk_carts_cashier_session_id_cashier_sessions",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_carts_tenant_id", "carts", ["tenant_id"])
    op.create_index("ix_carts_branch_id", "carts", ["branch_id"])
    op.create_index("ix_carts_cashier_session_id", "carts", ["cashier_session_id"])
    op.create_index("ix_carts_created_at", "carts", ["created_at"])

    # 4. cart_items
    op.create_table(
        "cart_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cart_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("discount_amount", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(500), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["cart_id"], ["carts.id"], ondelete="CASCADE",
            name="fk_cart_items_cart_id_carts",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], ondelete="CASCADE",
            name="fk_cart_items_product_id_products",
        ),
        sa.ForeignKeyConstraint(
            ["variant_id"], ["product_variants.id"], ondelete="CASCADE",
            name="fk_cart_items_variant_id_product_variants",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cart_items_cart_id", "cart_items", ["cart_id"])
    op.create_index("ix_cart_items_product_id", "cart_items", ["product_id"])

    # 5. orders
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cashier_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("order_number", sa.String(50), nullable=False),
        sa.Column("order_status", sa.String(50), nullable=False, server_default="PENDING"),
        sa.Column("payment_status", sa.String(50), nullable=False, server_default="PENDING"),
        sa.Column("subtotal", sa.Numeric(12, 4), nullable=False),
        sa.Column("tax_amount", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("discount_amount", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("refunded_amount", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE",
            name="fk_orders_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["branches.id"], ondelete="CASCADE",
            name="fk_orders_branch_id_branches",
        ),
        sa.ForeignKeyConstraint(
            ["cashier_session_id"], ["cashier_sessions.id"], ondelete="RESTRICT",
            name="fk_orders_cashier_session_id_cashier_sessions",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL",
            name="fk_orders_created_by_users",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_orders_tenant_id", "orders", ["tenant_id"])
    op.create_index("ix_orders_branch_id", "orders", ["branch_id"])
    op.create_index("ix_orders_order_number", "orders", ["order_number"], unique=True)
    op.create_index("ix_orders_cashier_session_id", "orders", ["cashier_session_id"])
    op.create_index("ix_orders_payment_status", "orders", ["payment_status"])
    op.create_index("ix_orders_order_status", "orders", ["order_status"])
    op.create_index("ix_orders_completed_at", "orders", ["completed_at"])
    op.create_index("ix_orders_branch_created_at", "orders", ["branch_id", "created_at"])

    # 6. order_items
    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("variant_name", sa.String(200), nullable=True),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_cost_snapshot", sa.Numeric(12, 4), nullable=True),
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=False, server_default="0"),
        sa.Column("discount_amount", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("subtotal", sa.Numeric(12, 4), nullable=False),
        sa.Column("total", sa.Numeric(12, 4), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], ondelete="CASCADE",
            name="fk_order_items_order_id_orders",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], ondelete="RESTRICT",
            name="fk_order_items_product_id_products",
        ),
        sa.ForeignKeyConstraint(
            ["variant_id"], ["product_variants.id"], ondelete="RESTRICT",
            name="fk_order_items_variant_id_product_variants",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_index("ix_order_items_product_id", "order_items", ["product_id"])
    op.create_index("ix_order_items_variant_id", "order_items", ["variant_id"])

    # 7. payments
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("payment_status", sa.String(50), nullable=False, server_default="PAID"),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_by", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], ondelete="CASCADE",
            name="fk_payments_order_id_orders",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE",
            name="fk_payments_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["processed_by"], ["users.id"], ondelete="SET NULL",
            name="fk_payments_processed_by_users",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payments_order_id", "payments", ["order_id"])
    op.create_index("ix_payments_tenant_id", "payments", ["tenant_id"])
    op.create_index("ix_payments_payment_method", "payments", ["payment_method"])
    op.create_index("ix_payments_payment_status", "payments", ["payment_status"])
    op.create_index("ix_payments_paid_at", "payments", ["paid_at"])
    op.create_index("ix_payments_processed_by", "payments", ["processed_by"])

    # 8. refunds
    op.create_table(
        "refunds",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refund_number", sa.String(50), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("refund_type", sa.String(20), nullable=False, server_default="PARTIAL"),
        sa.Column("amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("processed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], ondelete="RESTRICT",
            name="fk_refunds_order_id_orders",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE",
            name="fk_refunds_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["processed_by"], ["users.id"], ondelete="SET NULL",
            name="fk_refunds_processed_by_users",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_refunds_order_id", "refunds", ["order_id"])
    op.create_index("ix_refunds_tenant_id", "refunds", ["tenant_id"])
    op.create_index("ix_refunds_refund_number", "refunds", ["refund_number"], unique=True)
    op.create_index("ix_refunds_processed_by", "refunds", ["processed_by"])
    op.create_index("ix_refunds_processed_at", "refunds", ["processed_at"])

    # 9. refund_items
    op.create_table(
        "refund_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refund_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("stock_movement_id", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["refund_id"], ["refunds.id"], ondelete="CASCADE",
            name="fk_refund_items_refund_id_refunds",
        ),
        sa.ForeignKeyConstraint(
            ["order_item_id"], ["order_items.id"], ondelete="RESTRICT",
            name="fk_refund_items_order_item_id_order_items",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], ondelete="RESTRICT",
            name="fk_refund_items_product_id_products",
        ),
        sa.ForeignKeyConstraint(
            ["variant_id"], ["product_variants.id"], ondelete="RESTRICT",
            name="fk_refund_items_variant_id_product_variants",
        ),
        sa.ForeignKeyConstraint(
            ["stock_movement_id"], ["stock_movements.id"], ondelete="SET NULL",
            name="fk_refund_items_stock_movement_id_stock_movements",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_refund_items_refund_id", "refund_items", ["refund_id"])
    op.create_index("ix_refund_items_order_item_id", "refund_items", ["order_item_id"])
    op.create_index("ix_refund_items_product_id", "refund_items", ["product_id"])

    # 10. receipts
    op.create_table(
        "receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receipt_number", sa.String(50), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 4), nullable=False),
        sa.Column("tax_amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("discount_amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("amount_paid", sa.Numeric(12, 4), nullable=False),
        sa.Column("change_amount", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("cashier_name", sa.String(200), nullable=False),
        sa.Column("branch_name", sa.String(200), nullable=False),
        sa.Column("tenant_name", sa.String(200), nullable=False),
        sa.Column("payment_methods", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("items_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], ondelete="RESTRICT",
            name="fk_receipts_order_id_orders",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE",
            name="fk_receipts_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["branches.id"], ondelete="CASCADE",
            name="fk_receipts_branch_id_branches",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_receipts_order_id", "receipts", ["order_id"], unique=True)
    op.create_index("ix_receipts_tenant_id", "receipts", ["tenant_id"])
    op.create_index("ix_receipts_branch_id", "receipts", ["branch_id"])
    op.create_index("ix_receipts_receipt_number", "receipts", ["receipt_number"], unique=True)
    op.create_index("ix_receipts_issued_at", "receipts", ["issued_at"])
    op.create_index("ix_receipts_branch_issued_at", "receipts", ["branch_id", "issued_at"])


def downgrade() -> None:
    op.drop_table("receipts")
    op.drop_table("refund_items")
    op.drop_table("refunds")
    op.drop_table("payments")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("cart_items")
    op.drop_table("carts")
    op.drop_table("branch_counters")
    op.drop_table("cashier_sessions")
