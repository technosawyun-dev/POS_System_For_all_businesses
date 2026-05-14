from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.sales.models import Order


class Receipt(Base):
    """
    Printable receipt snapshot for a completed order.
    Stores full denormalized snapshots for receipt reprinting without
    relying on live product/branch/user data.
    Supports future thermal printer integration.
    """

    __tablename__ = "receipts"
    __table_args__ = (
        Index("ix_receipts_order_id", "order_id", unique=True),
        Index("ix_receipts_tenant_id", "tenant_id"),
        Index("ix_receipts_branch_id", "branch_id"),
        Index("ix_receipts_receipt_number", "receipt_number", unique=True),
        Index("ix_receipts_issued_at", "issued_at"),
        Index("ix_receipts_branch_issued_at", "branch_id", "issued_at"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
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

    receipt_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    change_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )

    # Denormalized snapshots for reprinting
    cashier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    branch_name: Mapped[str] = mapped_column(String(200), nullable=False)
    tenant_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Full snapshot of payment methods used (JSON array)
    payment_methods: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    # Full denormalized line-items snapshot for reprinting
    items_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    order: Mapped[Order] = relationship("Order", back_populates="receipt")

    def __repr__(self) -> str:
        return f"<Receipt {self.receipt_number} order={self.order_id} total={self.total_amount}>"
