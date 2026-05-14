from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import SyncOperationStatus
from app.db.base import Base

if TYPE_CHECKING:
    from app.devices.models import PosDevice


class SyncCheckpoint(Base):
    """
    Tracks the last successful sync position per (device, entity_type).
    Used by the pull endpoint to return only changed records.
    """

    __tablename__ = "sync_checkpoints"
    __table_args__ = (
        UniqueConstraint("device_id", "entity_type", name="uq_sync_checkpoints_device_entity"),
        Index("ix_sync_checkpoints_device_id", "device_id"),
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pos_devices.id", ondelete="CASCADE"),
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_sync_version: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    device: Mapped[PosDevice] = relationship(
        "PosDevice", back_populates="checkpoints", lazy="noload"
    )

    def __repr__(self) -> str:
        return (
            f"<SyncCheckpoint device={self.device_id} "
            f"entity={self.entity_type} at={self.last_synced_at}>"
        )


class SyncOperation(Base):
    """
    Journal of offline operations pushed from devices.
    operation_uuid is device-generated; uniqueness enforced per tenant.

    Status lifecycle:
      PENDING → PROCESSING → COMPLETED
                           → FAILED (retryable via Celery)

    result_snapshot stores the serialised response so identical replays
    return the cached result without re-executing business logic.
    """

    __tablename__ = "sync_operations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "operation_uuid", name="uq_sync_operations_tenant_op"),
        Index("ix_sync_operations_tenant_id", "tenant_id"),
        Index("ix_sync_operations_device_id", "device_id"),
        Index("ix_sync_operations_branch_id", "branch_id"),
        Index("ix_sync_operations_status", "status"),
        Index("ix_sync_operations_operation_uuid", "operation_uuid"),
        Index("ix_sync_operations_processed_at", "processed_at"),
        Index("ix_sync_operations_tenant_updated_at", "tenant_id", "updated_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pos_devices.id", ondelete="CASCADE"),
        nullable=False,
    )
    operation_uuid: Mapped[str] = mapped_column(String(100), nullable=False)
    operation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    result_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    operation_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=SyncOperationStatus.PENDING
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    device: Mapped[PosDevice] = relationship(
        "PosDevice", back_populates="sync_operations", lazy="noload"
    )

    def __repr__(self) -> str:
        return (
            f"<SyncOperation op={self.operation_type} uuid={self.operation_uuid} "
            f"status={self.status}>"
        )
