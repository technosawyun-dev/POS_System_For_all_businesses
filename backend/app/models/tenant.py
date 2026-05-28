from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import TenantStatus
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.branch import Branch, BranchSettings
    from app.models.user import User


class Tenant(Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    business_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=TenantStatus.TRIAL)

    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)

    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="UTC")
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="MMK")
    locale: Mapped[str] = mapped_column(String(20), nullable=False, default="en-US")

    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_tenants_owner_id_users"),
        nullable=True,
        index=True,
    )

    subscription_plan: Mapped[str] = mapped_column(String(100), nullable=False, default="trial")
    subscription_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    settings: Mapped[TenantSettings | None] = relationship(
        "TenantSettings", back_populates="tenant", uselist=False, cascade="all, delete-orphan"
    )
    branches: Mapped[list[Branch]] = relationship("Branch", back_populates="tenant")
    users: Mapped[list[User]] = relationship(
        "User", back_populates="tenant", foreign_keys="User.tenant_id"
    )

    def __repr__(self) -> str:
        return f"<Tenant id={self.id} name={self.name} status={self.status}>"


class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    features_enabled: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    business_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tax_rate: Mapped[float | None] = mapped_column(nullable=True)
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    extra_settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="settings")

    def __repr__(self) -> str:
        return f"<TenantSettings tenant_id={self.tenant_id}>"
