from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DevicePlatform
from app.db.base import Base

if TYPE_CHECKING:
    from app.sync.models import SyncCheckpoint, SyncOperation


class PosDevice(Base):
    """
    Registered POS device (tablet, mobile, desktop).
    Scoped per branch within a tenant. device_uuid is device-generated
    and must be unique per tenant.
    """

    __tablename__ = "pos_devices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "device_uuid", name="uq_pos_devices_tenant_device"),
        Index("ix_pos_devices_tenant_id", "tenant_id"),
        Index("ix_pos_devices_branch_id", "branch_id"),
        Index("ix_pos_devices_last_seen_at", "last_seen_at"),
        Index("ix_pos_devices_is_active", "is_active"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
    )
    device_uuid: Mapped[str] = mapped_column(String(100), nullable=False)
    device_name: Mapped[str] = mapped_column(String(200), nullable=False)
    platform: Mapped[str] = mapped_column(
        String(50), nullable=False, default=DevicePlatform.ANDROID
    )
    app_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    checkpoints: Mapped[list[SyncCheckpoint]] = relationship(
        "SyncCheckpoint", back_populates="device", cascade="all, delete-orphan", lazy="noload"
    )
    sync_operations: Mapped[list[SyncOperation]] = relationship(
        "SyncOperation", back_populates="device", cascade="all, delete-orphan", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<PosDevice {self.device_name} uuid={self.device_uuid} platform={self.platform}>"
