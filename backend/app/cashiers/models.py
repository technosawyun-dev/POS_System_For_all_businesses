from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CashierSessionStatus
from app.db.base import Base

if TYPE_CHECKING:
    from app.sales.models import Order


class CashierSession(Base):
    """
    Represents an active POS shift for a cashier at a specific branch.
    Only one OPEN session per cashier per branch is allowed at any time
    (enforced by partial unique index on status = 'OPEN').
    """

    __tablename__ = "cashier_sessions"
    __table_args__ = (
        Index(
            "uq_cashier_session_open",
            "cashier_user_id", "branch_id",
            unique=True,
            postgresql_where=text("status = 'OPEN'"),
        ),
        Index("ix_cashier_sessions_tenant_id", "tenant_id"),
        Index("ix_cashier_sessions_branch_id", "branch_id"),
        Index("ix_cashier_sessions_cashier_user_id", "cashier_user_id"),
        Index("ix_cashier_sessions_status", "status"),
        Index("ix_cashier_sessions_opened_at", "opened_at"),
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
    cashier_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    opening_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    closing_balance: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    # expected_balance = opening_balance + sum(cash sales) - sum(cash refunds)
    expected_balance: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    actual_balance: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    discrepancy_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=CashierSessionStatus.OPEN
    )

    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    orders: Mapped[list[Order]] = relationship(
        "Order", back_populates="cashier_session", lazy="noload"
    )

    def __repr__(self) -> str:
        return (
            f"<CashierSession cashier={self.cashier_user_id} "
            f"branch={self.branch_id} status={self.status}>"
        )
