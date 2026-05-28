"""phase11 referral commission wallet

Revision ID: h3i7j2k9l1m4
Revises: g2h5k8m1n3p6
Create Date: 2026-05-28 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "h3i7j2k9l1m4"
down_revision: str = "g2h5k8m1n3p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. reseller_referral_codes
    op.create_table(
        "reseller_referral_codes",
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
        sa.Column("reseller_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(
            ["reseller_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_reseller_referral_codes_reseller_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reseller_referral_codes"),
        sa.UniqueConstraint("code", name="uq_reseller_referral_codes_code"),
    )
    op.create_index(
        "ix_reseller_referral_codes_reseller_id_is_active",
        "reseller_referral_codes",
        ["reseller_id", "is_active"],
    )
    # Functional unique index for case-insensitive uniqueness
    op.create_index(
        "uq_reseller_referral_codes_lower_code",
        "reseller_referral_codes",
        [sa.text("LOWER(code)")],
        unique=True,
    )

    # 2. tenant_referrals
    op.create_table(
        "tenant_referrals",
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
        sa.Column("reseller_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("referral_code_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("referral_code_snapshot", sa.String(64), nullable=False),
        sa.Column(
            "referred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_paid_subscription_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="RESTRICT",
            name="fk_tenant_referrals_tenant_id_tenants",
        ),
        sa.ForeignKeyConstraint(
            ["reseller_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_tenant_referrals_reseller_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["referral_code_id"],
            ["reseller_referral_codes.id"],
            ondelete="SET NULL",
            name="fk_tenant_referrals_referral_code_id_reseller_referral_codes",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tenant_referrals"),
        sa.UniqueConstraint("tenant_id", name="uq_tenant_referrals_tenant_id"),
    )
    op.create_index(
        "ix_tenant_referrals_reseller_id_locked_at",
        "tenant_referrals",
        ["reseller_id", "locked_at"],
    )

    # 3. reseller_wallets
    op.create_table(
        "reseller_wallets",
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
        sa.Column("reseller_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "available_balance",
            sa.Numeric(20, 6),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "locked_balance",
            sa.Numeric(20, 6),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "pending_balance",
            sa.Numeric(20, 6),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "total_paid_out",
            sa.Numeric(20, 6),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("currency_code", sa.String(10), nullable=False, server_default="MMK"),
        sa.Column(
            "commission_rate_pct",
            sa.Numeric(8, 4),
            nullable=False,
            server_default=sa.text("10.0000"),
        ),
        sa.Column(
            "min_payout_amount",
            sa.Numeric(20, 6),
            nullable=False,
            server_default=sa.text("10000.000000"),
        ),
        sa.ForeignKeyConstraint(
            ["reseller_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_reseller_wallets_reseller_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reseller_wallets"),
        sa.UniqueConstraint("reseller_id", name="uq_reseller_wallets_reseller_id"),
        sa.CheckConstraint(
            "available_balance >= -999999999",
            name="ck_reseller_wallets_available_balance_min",
        ),
        sa.CheckConstraint(
            "locked_balance >= 0",
            name="ck_reseller_wallets_locked_balance_non_negative",
        ),
        sa.CheckConstraint(
            "total_paid_out >= 0",
            name="ck_reseller_wallets_total_paid_out_non_negative",
        ),
        sa.CheckConstraint(
            "commission_rate_pct >= 0 AND commission_rate_pct <= 100",
            name="ck_reseller_wallets_commission_rate_pct_range",
        ),
    )

    # 4. reseller_wallet_transactions  (immutable ledger)
    op.create_table(
        "reseller_wallet_transactions",
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
        sa.Column("reseller_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("transaction_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(20, 6), nullable=False),
        sa.Column("balance_before", sa.Numeric(20, 6), nullable=False),
        sa.Column("balance_after", sa.Numeric(20, 6), nullable=False),
        sa.Column("currency_code", sa.String(10), nullable=False, server_default="MMK"),
        sa.Column("reference_type", sa.String(100), nullable=True),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["reseller_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_reseller_wallet_transactions_reseller_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["wallet_id"],
            ["reseller_wallets.id"],
            ondelete="RESTRICT",
            name="fk_reseller_wallet_transactions_wallet_id_reseller_wallets",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_reseller_wallet_transactions_created_by_user_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reseller_wallet_transactions"),
        sa.CheckConstraint(
            "amount > 0",
            name="ck_reseller_wallet_transactions_amount_positive",
        ),
    )
    op.create_index(
        "ix_reseller_wallet_transactions_wallet_id_created_at",
        "reseller_wallet_transactions",
        ["wallet_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_reseller_wallet_transactions_reseller_id_type_created_at",
        "reseller_wallet_transactions",
        ["reseller_id", "transaction_type", sa.text("created_at DESC")],
    )
    # Partial unique index — prevents double-crediting for the same payment proof
    op.create_index(
        "uq_wallet_tx_commission_earned",
        "reseller_wallet_transactions",
        ["wallet_id", "reference_type", "reference_id"],
        unique=True,
        postgresql_where=sa.text("transaction_type = 'COMMISSION_EARNED'"),
    )
    # Partial unique index — prevents double-reversal for the same reference
    op.create_index(
        "uq_wallet_tx_commission_reversal",
        "reseller_wallet_transactions",
        ["wallet_id", "reference_type", "reference_id"],
        unique=True,
        postgresql_where=sa.text("transaction_type = 'COMMISSION_REVERSAL'"),
    )

    # 5. reseller_payout_requests
    op.create_table(
        "reseller_payout_requests",
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
        sa.Column("reseller_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(20, 6), nullable=False),
        sa.Column("currency_code", sa.String(10), nullable=False, server_default="MMK"),
        sa.Column("status", sa.String(50), nullable=False, server_default="PENDING"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("payout_method", sa.String(100), nullable=True),
        sa.Column("payout_reference", sa.String(255), nullable=True),
        sa.Column("payout_notes", sa.Text(), nullable=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["reseller_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_reseller_payout_requests_reseller_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["wallet_id"],
            ["reseller_wallets.id"],
            ondelete="RESTRICT",
            name="fk_reseller_payout_requests_wallet_id_reseller_wallets",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_reseller_payout_requests_reviewed_by_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reseller_payout_requests"),
        sa.CheckConstraint(
            "amount > 0",
            name="ck_reseller_payout_requests_amount_positive",
        ),
    )
    op.create_index(
        "ix_reseller_payout_requests_reseller_id_status",
        "reseller_payout_requests",
        ["reseller_id", "status"],
    )
    op.create_index(
        "ix_reseller_payout_requests_status_requested_at",
        "reseller_payout_requests",
        ["status", sa.text("requested_at DESC")],
    )

    # 6. reseller_payout_request_items
    op.create_table(
        "reseller_payout_request_items",
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
        sa.Column("payout_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("wallet_transaction_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(20, 6), nullable=False),
        sa.ForeignKeyConstraint(
            ["payout_request_id"],
            ["reseller_payout_requests.id"],
            ondelete="CASCADE",
            name="fk_rpri_payout_request_id",
        ),
        sa.ForeignKeyConstraint(
            ["wallet_transaction_id"],
            ["reseller_wallet_transactions.id"],
            ondelete="RESTRICT",
            name="fk_rpri_wallet_transaction_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reseller_payout_request_items"),
        sa.UniqueConstraint(
            "payout_request_id",
            "wallet_transaction_id",
            name="uq_reseller_payout_request_items_request_transaction",
        ),
        sa.CheckConstraint(
            "amount > 0",
            name="ck_reseller_payout_request_items_amount_positive",
        ),
    )

    # 7. referral_campaigns
    op.create_table(
        "referral_campaigns",
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
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("discount_type", sa.String(50), nullable=False),
        sa.Column("discount_value", sa.Numeric(20, 6), nullable=False),
        sa.Column("currency_code", sa.String(10), nullable=False, server_default="MMK"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_referral_campaigns_created_by_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_referral_campaigns"),
        sa.CheckConstraint(
            "discount_value > 0",
            name="ck_referral_campaigns_discount_value_positive",
        ),
    )
    op.create_index(
        "ix_referral_campaigns_is_active_starts_at_ends_at",
        "referral_campaigns",
        ["is_active", "starts_at", "ends_at"],
    )

    # 8. referral_campaign_codes
    op.create_table(
        "referral_campaign_codes",
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
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("referral_code_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["campaign_id"],
            ["referral_campaigns.id"],
            ondelete="CASCADE",
            name="fk_referral_campaign_codes_campaign_id_referral_campaigns",
        ),
        sa.ForeignKeyConstraint(
            ["referral_code_id"],
            ["reseller_referral_codes.id"],
            ondelete="CASCADE",
            name="fk_rcc_referral_code_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_referral_campaign_codes"),
        sa.UniqueConstraint(
            "campaign_id",
            "referral_code_id",
            name="uq_referral_campaign_codes_campaign_code",
        ),
    )

    # 9. reseller_notes
    op.create_table(
        "reseller_notes",
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
        sa.Column("reseller_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["reseller_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_reseller_notes_reseller_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_reseller_notes_created_by_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reseller_notes"),
    )
    op.create_index(
        "ix_reseller_notes_reseller_id_created_at",
        "reseller_notes",
        ["reseller_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_reseller_notes_reseller_id_created_at", table_name="reseller_notes")
    op.drop_table("reseller_notes")

    op.drop_table("referral_campaign_codes")

    op.drop_index(
        "ix_referral_campaigns_is_active_starts_at_ends_at",
        table_name="referral_campaigns",
    )
    op.drop_table("referral_campaigns")

    op.drop_table("reseller_payout_request_items")

    op.drop_index(
        "ix_reseller_payout_requests_status_requested_at",
        table_name="reseller_payout_requests",
    )
    op.drop_index(
        "ix_reseller_payout_requests_reseller_id_status",
        table_name="reseller_payout_requests",
    )
    op.drop_table("reseller_payout_requests")

    op.drop_index(
        "uq_wallet_tx_commission_reversal",
        table_name="reseller_wallet_transactions",
    )
    op.drop_index(
        "uq_wallet_tx_commission_earned",
        table_name="reseller_wallet_transactions",
    )
    op.drop_index(
        "ix_reseller_wallet_transactions_reseller_id_type_created_at",
        table_name="reseller_wallet_transactions",
    )
    op.drop_index(
        "ix_reseller_wallet_transactions_wallet_id_created_at",
        table_name="reseller_wallet_transactions",
    )
    op.drop_table("reseller_wallet_transactions")

    op.drop_table("reseller_wallets")

    op.drop_index(
        "ix_tenant_referrals_reseller_id_locked_at",
        table_name="tenant_referrals",
    )
    op.drop_table("tenant_referrals")

    op.drop_index(
        "uq_reseller_referral_codes_lower_code",
        table_name="reseller_referral_codes",
    )
    op.drop_index(
        "ix_reseller_referral_codes_reseller_id_is_active",
        table_name="reseller_referral_codes",
    )
    op.drop_table("reseller_referral_codes")
