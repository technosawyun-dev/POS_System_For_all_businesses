"""phase2_products_inventory_suppliers

Revision ID: 445699a818db
Revises: 684f62e12684
Create Date: 2026-05-08 03:40:00.000000

Creates: categories, brands, products, product_variants, variant_attributes,
variant_values, product_price_history, suppliers, supplier_contacts,
branch_inventory, stock_movements, inventory_adjustments,
inventory_adjustment_items, inventory_transfers, inventory_transfer_items.

This was originally a stub (the DDL was applied by hand during the initial
deployment session and never captured). Reconstructed here from the current
ORM models in app/models/product.py, app/models/inventory.py and
app/models/supplier.py, with columns/indexes/constraints added by later
migrations excluded:
  - products.discount_* columns            -> w4x5y6z7a8b9
  - ix_products_name_trgm (pg_trgm)         -> v3w4x5y6z7a8
  - ix_products_tenant_active               -> b1e9f3c2a8d4
  - ix_suppliers_tenant_status              -> b1e9f3c2a8d4
  - branch_inventory quantity CHECKs        -> b1e9f3c2a8d4
  - ix_branch_inventory_last_movement       -> b1e9f3c2a8d4
  - ix_branch_inventory_tenant_product      -> i4j8k2l6m9n3
  - ck_stock_movements_quantity_positive    -> b1e9f3c2a8d4
  - ix_stock_movements_actor_date           -> b1e9f3c2a8d4
  - ix_stock_movements_tenant_created_at,
    ix_stock_movements_tenant_type_created_at -> i4j8k2l6m9n3
  - ix_inv_adj_actor_date                   -> b1e9f3c2a8d4

FKs to users.id on stock_movements.actor_user_id, inventory_adjustments.actor_user_id,
inventory_transfers.requested_by_id and product_price_history.changed_by_id are created
here as ON DELETE SET NULL — a8b9c0d1e2f3 later corrects these (together with a
nullable=False contradiction) to ON DELETE RESTRICT.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "445699a818db"
down_revision: Union[str, None] = "684f62e12684"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _std_columns() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    # categories
    op.create_table(
        "categories",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_categories_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], ondelete="SET NULL",
                                name="fk_categories_parent_id_categories"),
        sa.PrimaryKeyConstraint("id", name="pk_categories"),
        sa.UniqueConstraint("tenant_id", "slug", "parent_id", name="uq_categories_tenant_slug_parent"),
    )
    op.create_index("ix_categories_tenant_id", "categories", ["tenant_id"])
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"])

    # brands
    op.create_table(
        "brands",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_brands_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_brands"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_brands_tenant_slug"),
    )
    op.create_index("ix_brands_tenant_id", "brands", ["tenant_id"])

    # products
    op.create_table(
        "products",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("brand_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("barcode", sa.String(100), nullable=True),
        sa.Column("qr_code", sa.String(255), nullable=True),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("cost_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("selling_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("sync_version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_products_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL",
                                name="fk_products_category_id_categories"),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="SET NULL",
                                name="fk_products_brand_id_brands"),
        sa.PrimaryKeyConstraint("id", name="pk_products"),
    )
    op.create_index("ix_products_tenant_id", "products", ["tenant_id"])
    op.create_index("ix_products_category_id", "products", ["category_id"])
    op.create_index("ix_products_brand_id", "products", ["brand_id"])
    op.create_index("ix_products_slug", "products", ["slug"])
    op.create_index("ix_products_barcode", "products", ["barcode"])
    op.create_index("ix_products_sku", "products", ["sku"])
    op.create_index("ix_products_product_type", "products", ["product_type"])
    op.create_index("ix_products_is_active", "products", ["is_active"])
    op.create_index(
        "uq_products_tenant_sku", "products", ["tenant_id", "sku"],
        unique=True, postgresql_where=sa.text("sku IS NOT NULL AND is_deleted = false"),
    )
    op.create_index(
        "uq_products_tenant_barcode", "products", ["tenant_id", "barcode"],
        unique=True, postgresql_where=sa.text("barcode IS NOT NULL AND is_deleted = false"),
    )

    # product_variants
    op.create_table(
        "product_variants",
        *_std_columns(),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("barcode", sa.String(100), nullable=True),
        sa.Column("cost_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("selling_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE",
                                name="fk_product_variants_product_id_products"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_product_variants_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_product_variants"),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])
    op.create_index("ix_product_variants_tenant_id", "product_variants", ["tenant_id"])
    op.create_index("ix_product_variants_barcode", "product_variants", ["barcode"])
    op.create_index("ix_product_variants_sku", "product_variants", ["sku"])
    op.create_index(
        "uq_variants_tenant_sku", "product_variants", ["tenant_id", "sku"],
        unique=True, postgresql_where=sa.text("sku IS NOT NULL AND is_deleted = false"),
    )
    op.create_index(
        "uq_variants_tenant_barcode", "product_variants", ["tenant_id", "barcode"],
        unique=True, postgresql_where=sa.text("barcode IS NOT NULL AND is_deleted = false"),
    )

    # variant_attributes
    op.create_table(
        "variant_attributes",
        *_std_columns(),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE",
                                name="fk_variant_attributes_product_id_products"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_variant_attributes_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_variant_attributes"),
    )
    op.create_index("ix_variant_attributes_product_id", "variant_attributes", ["product_id"])

    # variant_values
    op.create_table(
        "variant_values",
        *_std_columns(),
        sa.Column("attribute_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value", sa.String(100), nullable=False),
        sa.ForeignKeyConstraint(["attribute_id"], ["variant_attributes.id"], ondelete="CASCADE",
                                name="fk_variant_values_attribute_id_variant_attributes"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE",
                                name="fk_variant_values_variant_id_product_variants"),
        sa.PrimaryKeyConstraint("id", name="pk_variant_values"),
    )
    op.create_index("ix_variant_values_attribute_id", "variant_values", ["attribute_id"])
    op.create_index("ix_variant_values_variant_id", "variant_values", ["variant_id"])

    # product_price_history
    op.create_table(
        "product_price_history",
        *_std_columns(),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("price_type", sa.String(20), nullable=False),
        sa.Column("old_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("new_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("changed_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE",
                                name="fk_product_price_history_product_id_products"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE",
                                name="fk_product_price_history_variant_id_product_variants"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_product_price_history_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_product_price_history_changed_by_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_product_price_history"),
    )
    op.create_index("ix_price_history_product_id", "product_price_history", ["product_id"])
    op.create_index("ix_price_history_tenant_id", "product_price_history", ["tenant_id"])
    op.create_index("ix_price_history_created_at", "product_price_history", ["created_at"])

    # suppliers
    op.create_table(
        "suppliers",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_suppliers_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_suppliers"),
        sa.UniqueConstraint("tenant_id", "code", name="uq_suppliers_tenant_code"),
    )
    op.create_index("ix_suppliers_tenant_id", "suppliers", ["tenant_id"])
    op.create_index("ix_suppliers_status", "suppliers", ["status"])

    # supplier_contacts
    op.create_table(
        "supplier_contacts",
        *_std_columns(),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("position", sa.String(100), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE",
                                name="fk_supplier_contacts_supplier_id_suppliers"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_supplier_contacts_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_supplier_contacts"),
    )
    op.create_index("ix_supplier_contacts_supplier_id", "supplier_contacts", ["supplier_id"])
    op.create_index("ix_supplier_contacts_tenant_id", "supplier_contacts", ["tenant_id"])

    # branch_inventory
    op.create_table(
        "branch_inventory",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity_on_hand", sa.Numeric(12, 4), nullable=False),
        sa.Column("quantity_reserved", sa.Numeric(12, 4), nullable=False),
        sa.Column("reorder_point", sa.Numeric(12, 4), nullable=True),
        sa.Column("reorder_quantity", sa.Numeric(12, 4), nullable=True),
        sa.Column("sync_version", sa.Integer(), nullable=False),
        sa.Column("last_movement_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_branch_inventory_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE",
                                name="fk_branch_inventory_branch_id_branches"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE",
                                name="fk_branch_inventory_product_id_products"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE",
                                name="fk_branch_inventory_variant_id_product_variants"),
        sa.PrimaryKeyConstraint("id", name="pk_branch_inventory"),
    )
    op.create_index("ix_branch_inventory_tenant_id", "branch_inventory", ["tenant_id"])
    op.create_index("ix_branch_inventory_branch_id", "branch_inventory", ["branch_id"])
    op.create_index("ix_branch_inventory_product_id", "branch_inventory", ["product_id"])
    op.create_index("ix_branch_inventory_variant_id", "branch_inventory", ["variant_id"])
    op.create_index("ix_branch_inventory_branch_product", "branch_inventory", ["branch_id", "product_id"])
    op.create_index(
        "uq_branch_inv_no_variant", "branch_inventory", ["branch_id", "product_id"],
        unique=True, postgresql_where=sa.text("variant_id IS NULL"),
    )
    op.create_index(
        "uq_branch_inv_with_variant", "branch_inventory", ["branch_id", "product_id", "variant_id"],
        unique=True, postgresql_where=sa.text("variant_id IS NOT NULL"),
    )

    # stock_movements
    op.create_table(
        "stock_movements",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("movement_type", sa.String(50), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("previous_quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("new_quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("reference_type", sa.String(100), nullable=True),
        sa.Column("reference_id", sa.String(255), nullable=True),
        sa.Column("unit_cost", sa.Numeric(12, 4), nullable=True),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_stock_movements_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE",
                                name="fk_stock_movements_branch_id_branches"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE",
                                name="fk_stock_movements_product_id_products"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE",
                                name="fk_stock_movements_variant_id_product_variants"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_stock_movements_actor_user_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_stock_movements"),
    )
    op.create_index("ix_stock_movements_tenant_branch", "stock_movements", ["tenant_id", "branch_id"])
    op.create_index("ix_stock_movements_product_id", "stock_movements", ["product_id"])
    op.create_index("ix_stock_movements_variant_id", "stock_movements", ["variant_id"])
    op.create_index("ix_stock_movements_movement_type", "stock_movements", ["movement_type"])
    op.create_index("ix_stock_movements_created_at", "stock_movements", ["created_at"])
    op.create_index("ix_stock_movements_reference", "stock_movements", ["reference_type", "reference_id"])
    op.create_index("ix_stock_movements_actor", "stock_movements", ["actor_user_id"])

    # inventory_adjustments
    op.create_table(
        "inventory_adjustments",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("adjustment_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_inventory_adjustments_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE",
                                name="fk_inventory_adjustments_branch_id_branches"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_inventory_adjustments_actor_user_id_users"),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_inventory_adjustments_approved_by_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_inventory_adjustments"),
    )
    op.create_index("ix_inv_adj_tenant_branch", "inventory_adjustments", ["tenant_id", "branch_id"])
    op.create_index("ix_inv_adj_status", "inventory_adjustments", ["status"])
    op.create_index("ix_inv_adj_created_at", "inventory_adjustments", ["created_at"])
    op.create_index("ix_inv_adj_actor", "inventory_adjustments", ["actor_user_id"])

    # inventory_adjustment_items
    op.create_table(
        "inventory_adjustment_items",
        *_std_columns(),
        sa.Column("adjustment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity_change", sa.Numeric(12, 4), nullable=False),
        sa.Column("quantity_before", sa.Numeric(12, 4), nullable=False),
        sa.Column("quantity_after", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_cost", sa.Numeric(12, 4), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("stock_movement_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["adjustment_id"], ["inventory_adjustments.id"], ondelete="CASCADE",
                                name="fk_inv_adj_items_adjustment_id_inv_adj"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE",
                                name="fk_inventory_adjustment_items_product_id_products"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE",
                                name="fk_inventory_adjustment_items_variant_id_product_variants"),
        sa.ForeignKeyConstraint(["stock_movement_id"], ["stock_movements.id"], ondelete="SET NULL",
                                name="fk_inventory_adjustment_items_stock_movement_id_stock_movements"),
        sa.PrimaryKeyConstraint("id", name="pk_inventory_adjustment_items"),
    )
    op.create_index("ix_inv_adj_items_adjustment_id", "inventory_adjustment_items", ["adjustment_id"])
    op.create_index("ix_inv_adj_items_product_id", "inventory_adjustment_items", ["product_id"])

    # inventory_transfers
    op.create_table(
        "inventory_transfers",
        *_std_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cancel_reason", sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_inventory_transfers_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["from_branch_id"], ["branches.id"], ondelete="CASCADE",
                                name="fk_inventory_transfers_from_branch_id_branches"),
        sa.ForeignKeyConstraint(["to_branch_id"], ["branches.id"], ondelete="CASCADE",
                                name="fk_inventory_transfers_to_branch_id_branches"),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_inventory_transfers_requested_by_id_users"),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_inventory_transfers_approved_by_id_users"),
        sa.ForeignKeyConstraint(["cancelled_by_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_inventory_transfers_cancelled_by_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_inventory_transfers"),
    )
    op.create_index("ix_inv_transfer_tenant_id", "inventory_transfers", ["tenant_id"])
    op.create_index("ix_inv_transfer_from_branch", "inventory_transfers", ["from_branch_id"])
    op.create_index("ix_inv_transfer_to_branch", "inventory_transfers", ["to_branch_id"])
    op.create_index("ix_inv_transfer_status", "inventory_transfers", ["status"])
    op.create_index("ix_inv_transfer_created_at", "inventory_transfers", ["created_at"])

    # inventory_transfer_items
    op.create_table(
        "inventory_transfer_items",
        *_std_columns(),
        sa.Column("transfer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity_requested", sa.Numeric(12, 4), nullable=False),
        sa.Column("quantity_transferred", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_cost", sa.Numeric(12, 4), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(["transfer_id"], ["inventory_transfers.id"], ondelete="CASCADE",
                                name="fk_inventory_transfer_items_transfer_id_inventory_transfers"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE",
                                name="fk_inventory_transfer_items_product_id_products"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE",
                                name="fk_inventory_transfer_items_variant_id_product_variants"),
        sa.PrimaryKeyConstraint("id", name="pk_inventory_transfer_items"),
    )
    op.create_index("ix_inv_transfer_items_transfer_id", "inventory_transfer_items", ["transfer_id"])
    op.create_index("ix_inv_transfer_items_product_id", "inventory_transfer_items", ["product_id"])


def downgrade() -> None:
    op.drop_table("inventory_transfer_items")
    op.drop_table("inventory_transfers")
    op.drop_table("inventory_adjustment_items")
    op.drop_table("inventory_adjustments")
    op.drop_table("stock_movements")
    op.drop_table("branch_inventory")
    op.drop_table("supplier_contacts")
    op.drop_table("suppliers")
    op.drop_table("product_price_history")
    op.drop_table("variant_values")
    op.drop_table("variant_attributes")
    op.drop_table("product_variants")
    op.drop_table("products")
    op.drop_table("brands")
    op.drop_table("categories")
