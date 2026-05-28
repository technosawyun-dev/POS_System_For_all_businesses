"""phase5_customers

Adds customer management tables:
  - customer_counters  (per-tenant sequential code generator)
  - customers
  - customer_contacts
  - customer_notes
  - customer_ledger

Revision ID: f6a9c2e8b451
Revises: e5f8a3b1c920
Create Date: 2026-05-21 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f6a9c2e8b451"
down_revision: str = "e5f8a3b1c920"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # customer_counters
    op.create_table(
        "customer_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_customer_counters_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_customer_counters"),
        sa.UniqueConstraint("tenant_id", name="uq_customer_counters_tenant_id"),
    )

    # customers
    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("credit_limit", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("current_balance", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_customers_tenant_id_tenants"),
        sa.PrimaryKeyConstraint("id", name="pk_customers"),
        sa.UniqueConstraint("tenant_id", "customer_code", name="uq_customers_tenant_code"),
        sa.UniqueConstraint("tenant_id", "phone", name="uq_customers_tenant_phone"),
    )
    op.create_index("ix_customers_tenant_id", "customers", ["tenant_id"])
    op.create_index("ix_customers_phone", "customers", ["phone"])
    op.create_index("ix_customers_customer_code", "customers", ["customer_code"])
    op.create_index("ix_customers_is_active", "customers", ["is_active"])

    # customer_contacts
    op.create_table(
        "customer_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contact_name", sa.String(255), nullable=False),
        sa.Column("contact_phone", sa.String(50), nullable=False),
        sa.Column("contact_relationship", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE",
                                name="fk_customer_contacts_customer_id_customers"),
        sa.PrimaryKeyConstraint("id", name="pk_customer_contacts"),
    )
    op.create_index("ix_customer_contacts_customer_id", "customer_contacts", ["customer_id"])

    # customer_notes
    op.create_table(
        "customer_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE",
                                name="fk_customer_notes_customer_id_customers"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_customer_notes_created_by_user_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_customer_notes"),
    )
    op.create_index("ix_customer_notes_customer_id", "customer_notes", ["customer_id"])
    op.create_index("ix_customer_notes_created_by", "customer_notes", ["created_by_user_id"])

    # customer_ledger
    op.create_table(
        "customer_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(15, 4), nullable=False),
        sa.Column("balance_before", sa.Numeric(15, 4), nullable=False),
        sa.Column("balance_after", sa.Numeric(15, 4), nullable=False),
        sa.Column("reference_type", sa.String(100), nullable=True),
        sa.Column("reference_id", sa.String(255), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE",
                                name="fk_customer_ledger_customer_id_customers"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_customer_ledger_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_customer_ledger_created_by_user_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_customer_ledger"),
    )
    op.create_index("ix_customer_ledger_customer_id", "customer_ledger", ["customer_id"])
    op.create_index("ix_customer_ledger_tenant_id", "customer_ledger", ["tenant_id"])
    op.create_index("ix_customer_ledger_entry_type", "customer_ledger", ["entry_type"])
    op.create_index("ix_customer_ledger_created_at", "customer_ledger", ["created_at"])
    op.create_index("ix_customer_ledger_reference", "customer_ledger", ["reference_type", "reference_id"])


def downgrade() -> None:
    op.drop_table("customer_ledger")
    op.drop_table("customer_notes")
    op.drop_table("customer_contacts")
    op.drop_table("customers")
    op.drop_table("customer_counters")
