"""drop campaign tables

Revision ID: q2s3t4u5v6
Revises: p1r2o3m4o5
Create Date: 2026-05-28 01:00:00.000000
"""
from __future__ import annotations

from alembic import op

revision = "q2s3t4u5v6"
down_revision = "p1r2o3m4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("referral_campaign_codes")
    op.drop_table("referral_campaigns")


def downgrade() -> None:
    op.create_table(
        "referral_campaigns",
        op.Column("id", op.f("UUID"), primary_key=True, server_default=op.f("gen_random_uuid()")),
        op.Column("name", op.f("VARCHAR(255)"), nullable=False),
        op.Column("description", op.f("TEXT"), nullable=True),
        op.Column("discount_type", op.f("VARCHAR(50)"), nullable=False),
        op.Column("discount_value", op.f("NUMERIC(20,6)"), nullable=False),
        op.Column("currency_code", op.f("VARCHAR(10)"), nullable=False, server_default="MMK"),
        op.Column("starts_at", op.f("TIMESTAMPTZ"), nullable=True),
        op.Column("ends_at", op.f("TIMESTAMPTZ"), nullable=True),
        op.Column("is_active", op.f("BOOLEAN"), nullable=False, server_default="true"),
        op.Column("created_by", op.f("UUID"), nullable=False),
        op.Column("created_at", op.f("TIMESTAMPTZ"), nullable=False, server_default="now()"),
        op.Column("updated_at", op.f("TIMESTAMPTZ"), nullable=False, server_default="now()"),
    )
    op.create_table(
        "referral_campaign_codes",
        op.Column("id", op.f("UUID"), primary_key=True, server_default=op.f("gen_random_uuid()")),
        op.Column("campaign_id", op.f("UUID"), nullable=False),
        op.Column("referral_code_id", op.f("UUID"), nullable=False),
        op.Column("created_at", op.f("TIMESTAMPTZ"), nullable=False, server_default="now()"),
    )
