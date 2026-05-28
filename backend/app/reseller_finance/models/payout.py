from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.reseller_finance.models.wallet import ResellerWallet, ResellerWalletTransaction


class ResellerPayoutRequest(Base):
    """
    A reseller's request to withdraw funds from their wallet.

    Status lifecycle:
      PENDING → UNDER_REVIEW → APPROVED → PAID
                             ↘ REJECTED
      (any non-terminal state) → CANCELLED
    """

    __tablename__ = "reseller_payout_requests"
    __table_args__ = (
        Index(
            "ix_reseller_payout_requests_reseller_id_status",
            "reseller_id",
            "status",
        ),
        Index(
            "ix_reseller_payout_requests_status_requested_at",
            "status",
            text("requested_at DESC"),
        ),
        CheckConstraint(
            "amount > 0",
            name="ck_reseller_payout_requests_amount_positive",
        ),
    )

    reseller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reseller_wallets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False, default="MMK")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    payout_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payout_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payout_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # relationships
    wallet: Mapped[ResellerWallet] = relationship(
        "ResellerWallet",
        back_populates="payout_requests",
        foreign_keys=[wallet_id],
    )
    items: Mapped[list[ResellerPayoutRequestItem]] = relationship(
        "ResellerPayoutRequestItem",
        back_populates="payout_request",
        cascade="all, delete-orphan",
    )

    @property
    def is_terminal(self) -> bool:
        """True if the request can no longer change status."""
        return self.status in {"REJECTED", "PAID", "CANCELLED"}

    def __repr__(self) -> str:
        return (
            f"<ResellerPayoutRequest reseller={self.reseller_id} "
            f"amount={self.amount} status={self.status}>"
        )


class ResellerPayoutRequestItem(Base):
    """
    Links a payout request to the specific wallet transactions being paid out.
    Each transaction may appear in at most one payout request
    (enforced by the UNIQUE constraint on the pair).
    """

    __tablename__ = "reseller_payout_request_items"
    __table_args__ = (
        UniqueConstraint(
            "payout_request_id",
            "wallet_transaction_id",
            name="uq_reseller_payout_request_items_request_transaction",
        ),
        CheckConstraint(
            "amount > 0",
            name="ck_reseller_payout_request_items_amount_positive",
        ),
    )

    payout_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reseller_payout_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    wallet_transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reseller_wallet_transactions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)

    # relationships
    payout_request: Mapped[ResellerPayoutRequest] = relationship(
        "ResellerPayoutRequest",
        back_populates="items",
        foreign_keys=[payout_request_id],
    )
    wallet_transaction: Mapped[ResellerWalletTransaction] = relationship(
        "ResellerWalletTransaction",
        back_populates="payout_items",
        foreign_keys=[wallet_transaction_id],
    )

    def __repr__(self) -> str:
        return (
            f"<ResellerPayoutRequestItem request={self.payout_request_id} "
            f"tx={self.wallet_transaction_id} amount={self.amount}>"
        )
