"""phase8_subscriptions

Adds subscription & billing tables:
  - subscription_plans
  - plan_entitlements
  - tenant_subscriptions
  - subscription_histories
  - payment_proofs

Revision ID: b8d5e3f9c072
Revises: a7c4e2f8b157
Create Date: 2026-05-21 02:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b8d5e3f9c072"
down_revision: str = "a7c4e2f8b157"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # subscription_plans
    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("billing_cycle", sa.String(20), nullable=False, server_default="MONTHLY"),
        sa.Column("price", sa.Numeric(15, 4), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("trial_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.PrimaryKeyConstraint("id", name="pk_subscription_plans"),
        sa.UniqueConstraint("name", name="uq_subscription_plans_name"),
        sa.UniqueConstraint("code", name="uq_subscription_plans_code"),
    )
    op.create_index("ix_subscription_plans_code", "subscription_plans", ["code"])
    op.create_index("ix_subscription_plans_is_active", "subscription_plans", ["is_active"])

    # plan_entitlements
    op.create_table(
        "plan_entitlements",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feature_code", sa.String(100), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("limit_value", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"], ondelete="CASCADE",
                                name="fk_plan_entitlements_plan_id_subscription_plans"),
        sa.PrimaryKeyConstraint("id", name="pk_plan_entitlements"),
        sa.UniqueConstraint("plan_id", "feature_code", name="uq_plan_entitlements_plan_feature"),
    )
    op.create_index("ix_plan_entitlements_plan_id", "plan_entitlements", ["plan_id"])

    # tenant_subscriptions
    op.create_table(
        "tenant_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="TRIAL"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_renew", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_tenant_subscriptions_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"], ondelete="RESTRICT",
                                name="fk_tenant_subscriptions_plan_id_subscription_plans"),
        sa.PrimaryKeyConstraint("id", name="pk_tenant_subscriptions"),
        sa.UniqueConstraint("tenant_id", name="uq_tenant_subscriptions_tenant_id"),
    )
    op.create_index("ix_tenant_subscriptions_tenant_id", "tenant_subscriptions", ["tenant_id"])
    op.create_index("ix_tenant_subscriptions_plan_id", "tenant_subscriptions", ["plan_id"])
    op.create_index("ix_tenant_subscriptions_status", "tenant_subscriptions", ["status"])
    op.create_index("ix_tenant_subscriptions_expires_at", "tenant_subscriptions", ["expires_at"])

    # subscription_histories
    op.create_table(
        "subscription_histories",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("change_type", sa.String(50), nullable=False),
        sa.Column("old_plan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("new_plan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("old_status", sa.String(50), nullable=True),
        sa.Column("new_status", sa.String(50), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_subscription_histories_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["subscription_id"], ["tenant_subscriptions.id"], ondelete="CASCADE",
                                name="fk_subscription_histories_subscription_id_tenant_subscriptions"),
        sa.ForeignKeyConstraint(["old_plan_id"], ["subscription_plans.id"], ondelete="SET NULL",
                                name="fk_subscription_histories_old_plan_id_subscription_plans"),
        sa.ForeignKeyConstraint(["new_plan_id"], ["subscription_plans.id"], ondelete="SET NULL",
                                name="fk_subscription_histories_new_plan_id_subscription_plans"),
        sa.ForeignKeyConstraint(["changed_by_user_id"], ["users.id"], ondelete="SET NULL",
                                name="fk_subscription_histories_changed_by_user_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_subscription_histories"),
    )
    op.create_index("ix_subscription_histories_tenant_id", "subscription_histories", ["tenant_id"])
    op.create_index("ix_subscription_histories_subscription_id", "subscription_histories", ["subscription_id"])

    # payment_proofs
    op.create_table(
        "payment_proofs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(15, 4), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("proof_file_url", sa.String(500), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE",
                                name="fk_payment_proofs_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["subscription_id"], ["tenant_subscriptions.id"], ondelete="CASCADE",
                                name="fk_payment_proofs_subscription_id_tenant_subscriptions"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL",
                                name="fk_payment_proofs_reviewed_by_users"),
        sa.PrimaryKeyConstraint("id", name="pk_payment_proofs"),
    )
    op.create_index("ix_payment_proofs_tenant_id", "payment_proofs", ["tenant_id"])
    op.create_index("ix_payment_proofs_subscription_id", "payment_proofs", ["subscription_id"])
    op.create_index("ix_payment_proofs_status", "payment_proofs", ["status"])


def downgrade() -> None:
    op.drop_table("payment_proofs")
    op.drop_table("subscription_histories")
    op.drop_table("tenant_subscriptions")
    op.drop_table("plan_entitlements")
    op.drop_table("subscription_plans")
