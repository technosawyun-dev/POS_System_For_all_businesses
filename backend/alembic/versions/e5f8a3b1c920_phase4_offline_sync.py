"""phase4_offline_sync

Adds device registration and offline sync tables:
  - pos_devices
  - sync_checkpoints
  - sync_operations

Revision ID: e5f8a3b1c920
Revises: d4e7f1a2b963
Create Date: 2026-05-13 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e5f8a3b1c920"
down_revision: str = "d4e7f1a2b963"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pos_devices
    op.create_table(
        "pos_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_uuid", sa.String(100), nullable=False),
        sa.Column("device_name", sa.String(200), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("app_version", sa.String(50), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE", name="fk_pos_devices_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE", name="fk_pos_devices_branch_id_branches"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL", name="fk_pos_devices_created_by_users"),
        sa.PrimaryKeyConstraint("id", name="pk_pos_devices"),
        sa.UniqueConstraint("tenant_id", "device_uuid", name="uq_pos_devices_tenant_device"),
    )
    op.create_index("ix_pos_devices_tenant_id", "pos_devices", ["tenant_id"])
    op.create_index("ix_pos_devices_branch_id", "pos_devices", ["branch_id"])
    op.create_index("ix_pos_devices_last_seen_at", "pos_devices", ["last_seen_at"])
    op.create_index("ix_pos_devices_is_active", "pos_devices", ["is_active"])

    # sync_checkpoints
    op.create_table(
        "sync_checkpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_sync_version", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["device_id"], ["pos_devices.id"], ondelete="CASCADE", name="fk_sync_checkpoints_device_id_pos_devices"),
        sa.PrimaryKeyConstraint("id", name="pk_sync_checkpoints"),
        sa.UniqueConstraint("device_id", "entity_type", name="uq_sync_checkpoints_device_entity"),
    )
    op.create_index("ix_sync_checkpoints_device_id", "sync_checkpoints", ["device_id"])

    # sync_operations
    op.create_table(
        "sync_operations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation_uuid", sa.String(100), nullable=False),
        sa.Column("operation_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("result_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("operation_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'PENDING'")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["pos_devices.id"], ondelete="CASCADE", name="fk_sync_operations_device_id_pos_devices"),
        sa.PrimaryKeyConstraint("id", name="pk_sync_operations"),
        sa.UniqueConstraint("tenant_id", "operation_uuid", name="uq_sync_operations_tenant_op"),
    )
    op.create_index("ix_sync_operations_tenant_id", "sync_operations", ["tenant_id"])
    op.create_index("ix_sync_operations_device_id", "sync_operations", ["device_id"])
    op.create_index("ix_sync_operations_branch_id", "sync_operations", ["branch_id"])
    op.create_index("ix_sync_operations_status", "sync_operations", ["status"])
    op.create_index("ix_sync_operations_operation_uuid", "sync_operations", ["operation_uuid"])
    op.create_index("ix_sync_operations_processed_at", "sync_operations", ["processed_at"])
    op.create_index("ix_sync_operations_tenant_updated_at", "sync_operations", ["tenant_id", "updated_at"])


def downgrade() -> None:
    op.drop_table("sync_operations")
    op.drop_table("sync_checkpoints")
    op.drop_table("pos_devices")
