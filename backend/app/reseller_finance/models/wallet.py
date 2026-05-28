from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, ClassVar

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.reseller_finance.models.payout import ResellerPayoutRequest, ResellerPayoutRequestItem


class ResellerWallet(Base):
    """
    One wallet per reseller.  Tracks available, locked, pending balances and
    cumulative paid-out amount.  commission_rate_pct governs how much of a
    subscription payment is credited to the reseller.
    """

    __tablename__ = "reseller_wallets"
    __table_args__ = (
        UniqueConstraint("reseller_id", name="uq_reseller_wallets_reseller_id"),
        CheckConstraint(
            "available_balance >= -999999999",
            name="ck_reseller_wallets_available_balance_min",
        ),
        CheckConstraint(
            "locked_balance >= 0",
            name="ck_reseller_wallets_locked_balance_non_negative",
        ),
        CheckConstraint(
            "total_paid_out >= 0",
            name="ck_reseller_wallets_total_paid_out_non_negative",
        ),
        CheckConstraint(
            "commission_rate_pct >= 0 AND commission_rate_pct <= 100",
            name="ck_reseller_wallets_commission_rate_pct_range",
        ),
    )

    reseller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    available_balance: Mapped[Decimal] = mapped_column(
        Numeric(20, 6), nullable=False, default=Decimal("0")
    )
    locked_balance: Mapped[Decimal] = mapped_column(
        Numeric(20, 6), nullable=False, default=Decimal("0")
    )
    pending_balance: Mapped[Decimal] = mapped_column(
        Numeric(20, 6), nullable=False, default=Decimal("0")
    )
    total_paid_out: Mapped[Decimal] = mapped_column(
        Numeric(20, 6), nullable=False, default=Decimal("0")
    )
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False, default="MMK")
    commission_rate_pct: Mapped[Decimal] = mapped_column(
        Numeric(8, 4), nullable=False, default=Decimal("10.0000")
    )
    min_payout_amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 6), nullable=False, default=Decimal("10000.000000")
    )

    # relationships
    transactions: Mapped[list[ResellerWalletTransaction]] = relationship(
        "ResellerWalletTransaction",
        back_populates="wallet",
        cascade="all, delete-orphan",
        order_by="ResellerWalletTransaction.created_at.desc()",
    )
    payout_requests: Mapped[list[ResellerPayoutRequest]] = relationship(
        "ResellerPayoutRequest",
        back_populates="wallet",
    )

    @property
    def net_balance(self) -> Decimal:
        """Sum of all balance buckets (available + locked + pending)."""
        return self.available_balance + self.locked_balance + self.pending_balance

    def __repr__(self) -> str:
        return (
            f"<ResellerWallet reseller={self.reseller_id} "
            f"available={self.available_balance} currency={self.currency_code}>"
        )


class ResellerWalletTransaction(Base):
    """
    Immutable ledger entry.  Every change to a wallet balance is recorded here.
    The transaction_type enum-string carries the sign semantics:
      Credits  → COMMISSION_EARNED, BONUS, MANUAL_ADJUSTMENT (when positive)
      Debits   → COMMISSION_REVERSAL, PAYOUT_LOCKED, PAYOUT_COMPLETED, PENALTY
    amount is always stored as a positive number.
    """

    __tablename__ = "reseller_wallet_transactions"
    __table_args__ = (
        Index(
            "ix_reseller_wallet_transactions_wallet_id_created_at",
            "wallet_id",
            text("created_at DESC"),
        ),
        Index(
            "ix_reseller_wallet_transactions_reseller_id_type_created_at",
            "reseller_id",
            "transaction_type",
            text("created_at DESC"),
        ),
        Index(
            "uq_wallet_tx_commission_earned",
            "wallet_id",
            "reference_type",
            "reference_id",
            unique=True,
            postgresql_where=text("transaction_type = 'COMMISSION_EARNED'"),
        ),
        Index(
            "uq_wallet_tx_commission_reversal",
            "wallet_id",
            "reference_type",
            "reference_id",
            unique=True,
            postgresql_where=text("transaction_type = 'COMMISSION_REVERSAL'"),
        ),
        CheckConstraint(
            "amount > 0",
            name="ck_reseller_wallet_transactions_amount_positive",
        ),
    )

    # ResellerWalletTransaction is an immutable ledger — no updated_at column.
    # ClassVar tells SQLAlchemy's annotated declarative form to skip this attribute.
    updated_at: ClassVar[None] = None

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
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    balance_before: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False, default="MMK")
    reference_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # relationships
    wallet: Mapped[ResellerWallet] = relationship(
        "ResellerWallet",
        back_populates="transactions",
        foreign_keys=[wallet_id],
    )
    payout_items: Mapped[list[ResellerPayoutRequestItem]] = relationship(
        "ResellerPayoutRequestItem",
        back_populates="wallet_transaction",
    )

    def __repr__(self) -> str:
        return (
            f"<ResellerWalletTransaction type={self.transaction_type} "
            f"amount={self.amount} wallet={self.wallet_id}>"
        )
