"""phase7_procurement

Adds procurement tables:
  - po_counters           (per-tenant PO number sequence)
  - gr_counters           (per-tenant goods receipt number sequence)
  - purchase_orders
  - purchase_order_items
  - goods_receipts
  - goods_receipt_items
  - supplier_payables
  - supplier_payments

Revision ID: a7c4e2f8b157
Revises: f6a9c2e8b451
Create Date: 2026-05-21 01:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a7c4e2f8b157"
down_revision: str = "f6a9c2e8b451"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # po_counters
    op.create_table(
        "po_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_po_counters_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_po_counters"),
        sa.UniqueConstraint("tenant_id", name="uq_po_counters_tenant_id"),
    )

    # gr_counters
    op.create_table(
        "gr_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_gr_counters_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_gr_counters"),
        sa.UniqueConstraint("tenant_id", name="uq_gr_counters_tenant_id"),
    )

    # purchase_orders
    op.create_table(
        "purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("po_number", sa.String(20), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="DRAFT"),
        sa.Column("order_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expected_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("subtotal", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("discount_amount", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("tax_amount", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("total_amount", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_purchase_orders_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE",
                                name="fk_purchase_orders_branch_id_branches"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="RESTRICT",
                                name="fk_purchase_orders_supplier_id_suppliers"),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL",
                                name="fk_purchase_orders_approved_by_users"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL",
                                name="fk_purchase_orders_created_by_users"),
        sa.PrimaryKeyConstraint("id", name="pk_purchase_orders"),
        sa.UniqueConstraint("tenant_id", "po_number", name="uq_purchase_orders_tenant_po_number"),
    )
    op.create_index("ix_purchase_orders_tenant_id", "purchase_orders", ["tenant_id"])
    op.create_index("ix_purchase_orders_branch_id", "purchase_orders", ["branch_id"])
    op.create_index("ix_purchase_orders_supplier_id", "purchase_orders", ["supplier_id"])
    op.create_index("ix_purchase_orders_status", "purchase_orders", ["status"])
    op.create_index("ix_purchase_orders_po_number", "purchase_orders", ["po_number"])

    # purchase_order_items
    op.create_table(
        "purchase_order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ordered_quantity", sa.Numeric(15, 4), nullable=False),
        sa.Column("received_quantity", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("unit_cost", sa.Numeric(15, 4), nullable=False),
        sa.Column("line_total", sa.Numeric(15, 4), nullable=False),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"], ondelete="CASCADE",
                                name="fk_purchase_order_items_purchase_order_id_purchase_orders"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT",
                                name="fk_purchase_order_items_product_id_products"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="RESTRICT",
                                name="fk_purchase_order_items_variant_id_product_variants"),
        sa.PrimaryKeyConstraint("id", name="pk_purchase_order_items"),
    )
    op.create_index("ix_purchase_order_items_purchase_order_id", "purchase_order_items", ["purchase_order_id"])
    op.create_index("ix_purchase_order_items_product_id", "purchase_order_items", ["product_id"])

    # goods_receipts
    op.create_table(
        "goods_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receipt_number", sa.String(20), nullable=False),
        sa.Column("receipt_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="RECEIVED"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_goods_receipts_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE",
                                name="fk_goods_receipts_branch_id_branches"),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"], ondelete="CASCADE",
                                name="fk_goods_receipts_purchase_order_id_purchase_orders"),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"], ondelete="SET NULL",
                                name="fk_goods_receipts_received_by_users"),
        sa.PrimaryKeyConstraint("id", name="pk_goods_receipts"),
        sa.UniqueConstraint("tenant_id", "receipt_number", name="uq_goods_receipts_tenant_receipt_number"),
    )
    op.create_index("ix_goods_receipts_tenant_id", "goods_receipts", ["tenant_id"])
    op.create_index("ix_goods_receipts_branch_id", "goods_receipts", ["branch_id"])
    op.create_index("ix_goods_receipts_purchase_order_id", "goods_receipts", ["purchase_order_id"])
    op.create_index("ix_goods_receipts_status", "goods_receipts", ["status"])

    # goods_receipt_items
    op.create_table(
        "goods_receipt_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("goods_receipt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purchase_order_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("received_quantity", sa.Numeric(15, 4), nullable=False),
        sa.Column("unit_cost", sa.Numeric(15, 4), nullable=False),
        sa.Column("line_total", sa.Numeric(15, 4), nullable=False),
        sa.ForeignKeyConstraint(["goods_receipt_id"], ["goods_receipts.id"], ondelete="CASCADE",
                                name="fk_goods_receipt_items_goods_receipt_id_goods_receipts"),
        sa.ForeignKeyConstraint(["purchase_order_item_id"], ["purchase_order_items.id"], ondelete="RESTRICT",
                                name="fk_gri_purchase_order_item_id_poi"),
        sa.PrimaryKeyConstraint("id", name="pk_goods_receipt_items"),
    )
    op.create_index("ix_goods_receipt_items_goods_receipt_id", "goods_receipt_items", ["goods_receipt_id"])
    op.create_index("ix_goods_receipt_items_purchase_order_item_id", "goods_receipt_items", ["purchase_order_item_id"])

    # supplier_payables
    op.create_table(
        "supplier_payables",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_amount", sa.Numeric(15, 4), nullable=False),
        sa.Column("paid_amount", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("remaining_amount", sa.Numeric(15, 4), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="OPEN"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_supplier_payables_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="RESTRICT",
                                name="fk_supplier_payables_supplier_id_suppliers"),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"], ondelete="CASCADE",
                                name="fk_supplier_payables_purchase_order_id_purchase_orders"),
        sa.PrimaryKeyConstraint("id", name="pk_supplier_payables"),
        sa.UniqueConstraint("purchase_order_id", name="uq_supplier_payables_purchase_order_id"),
    )
    op.create_index("ix_supplier_payables_tenant_id", "supplier_payables", ["tenant_id"])
    op.create_index("ix_supplier_payables_supplier_id", "supplier_payables", ["supplier_id"])
    op.create_index("ix_supplier_payables_status", "supplier_payables", ["status"])

    # supplier_payments
    op.create_table(
        "supplier_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_payable_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=False),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("amount", sa.Numeric(15, 4), nullable=False),
        sa.Column("payment_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="CONFIRMED"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_supplier_payments_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="RESTRICT",
                                name="fk_supplier_payments_supplier_id_suppliers"),
        sa.ForeignKeyConstraint(["supplier_payable_id"], ["supplier_payables.id"], ondelete="CASCADE",
                                name="fk_supplier_payments_supplier_payable_id_supplier_payables"),
        sa.ForeignKeyConstraint(["recorded_by"], ["users.id"], ondelete="SET NULL",
                                name="fk_supplier_payments_recorded_by_users"),
        sa.PrimaryKeyConstraint("id", name="pk_supplier_payments"),
    )
    op.create_index("ix_supplier_payments_tenant_id", "supplier_payments", ["tenant_id"])
    op.create_index("ix_supplier_payments_supplier_id", "supplier_payments", ["supplier_id"])
    op.create_index("ix_supplier_payments_supplier_payable_id", "supplier_payments", ["supplier_payable_id"])
    op.create_index("ix_supplier_payments_status", "supplier_payments", ["status"])


def downgrade() -> None:
    op.drop_table("supplier_payments")
    op.drop_table("supplier_payables")
    op.drop_table("goods_receipt_items")
    op.drop_table("goods_receipts")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    op.drop_table("gr_counters")
    op.drop_table("po_counters")
