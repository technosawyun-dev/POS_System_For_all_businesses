from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.user import User


class ResellerAssignment(Base):
    __tablename__ = "reseller_assignments"
    __table_args__ = (
        UniqueConstraint("reseller_id", "tenant_id", name="uq_reseller_tenant"),
    )

    reseller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    allowed_branch_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    restricted_permissions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    access_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    access_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    assigned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    reseller: Mapped[User] = relationship("User", foreign_keys=[reseller_id])
    tenant: Mapped[Tenant] = relationship("Tenant")
    assigned_by: Mapped[User | None] = relationship("User", foreign_keys=[assigned_by_id])

    def is_access_valid(self) -> bool:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        if self.access_starts_at and now < self.access_starts_at:
            return False
        if self.access_expires_at and now > self.access_expires_at:
            return False
        return self.is_active

    def __repr__(self) -> str:
        return f"<ResellerAssignment reseller={self.reseller_id} tenant={self.tenant_id}>"
