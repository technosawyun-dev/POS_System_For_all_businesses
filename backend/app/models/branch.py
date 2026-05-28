from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import BranchStatus
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.user import User, UserBranchAssignment


class Branch(Base):
    __tablename__ = "branches"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=BranchStatus.ACTIVE, index=True
    )

    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_branches_manager_id_users"),
        nullable=True,
        index=True,
    )

    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="UTC")
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="MMK")

    is_main_branch: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="branches")
    manager: Mapped[User | None] = relationship("User", foreign_keys=[manager_id])
    settings: Mapped[BranchSettings | None] = relationship(
        "BranchSettings", back_populates="branch", uselist=False, cascade="all, delete-orphan"
    )
    user_assignments: Mapped[list[UserBranchAssignment]] = relationship(
        "UserBranchAssignment", back_populates="branch"
    )

    def __repr__(self) -> str:
        return f"<Branch id={self.id} name={self.name} tenant={self.tenant_id}>"


class BranchSettings(Base):
    __tablename__ = "branch_settings"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    opening_hours: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    receipt_header: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_footer: Mapped[str | None] = mapped_column(Text, nullable=True)

    extra_settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    branch: Mapped[Branch] = relationship("Branch", back_populates="settings")

    def __repr__(self) -> str:
        return f"<BranchSettings branch_id={self.branch_id}>"
