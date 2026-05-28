from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.reseller_finance.models.wallet import ResellerWallet


class ResellerReferralCode(Base):
    """
    A unique referral code owned by a reseller.  The code is stored verbatim
    but uniqueness is enforced case-insensitively via a functional index on
    LOWER(code).
    """

    __tablename__ = "reseller_referral_codes"
    __table_args__ = (
        Index("ix_reseller_referral_codes_reseller_id_is_active", "reseller_id", "is_active"),
        Index(
            "uq_reseller_referral_codes_lower_code",
            text("LOWER(code)"),
            unique=True,
        ),
    )

    reseller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # relationships
    tenant_referrals: Mapped[list[TenantReferral]] = relationship(
        "TenantReferral",
        back_populates="referral_code",
    )

    def __repr__(self) -> str:
        return f"<ResellerReferralCode code={self.code!r} reseller={self.reseller_id} active={self.is_active}>"


class TenantReferral(Base):
    """
    Records which reseller referred a tenant and via which code.
    One tenant can have at most one referral record (UNIQUE on tenant_id).
    locked_at is set when the tenant makes their first paid subscription.
    """

    __tablename__ = "tenant_referrals"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_tenant_referrals_tenant_id"),
        Index("ix_tenant_referrals_reseller_id_locked_at", "reseller_id", "locked_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reseller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    referral_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reseller_referral_codes.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Snapshot of the code string in case the code record is later soft-deleted
    referral_code_snapshot: Mapped[str] = mapped_column(String(64), nullable=False)
    referred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    # Set atomically when the first paid subscription payment is confirmed
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_paid_subscription_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # relationships
    referral_code: Mapped[ResellerReferralCode | None] = relationship(
        "ResellerReferralCode",
        back_populates="tenant_referrals",
        foreign_keys=[referral_code_id],
    )

    @property
    def is_converted(self) -> bool:
        """True once the referral has been locked by a first paid subscription."""
        return self.locked_at is not None

    def __repr__(self) -> str:
        return (
            f"<TenantReferral tenant={self.tenant_id} "
            f"reseller={self.reseller_id} locked={self.locked_at is not None}>"
        )
