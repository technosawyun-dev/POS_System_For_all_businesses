from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import PaymentMethod, PaymentStatus, RefundReason, RefundType
from app.db.base import Base

if TYPE_CHECKING:
    from app.sales.models import Order


class Payment(Base):
    """
    A single payment record against an order.
    Multiple payments can exist per order (split payments, partial payments).
    """

    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_order_id", "order_id"),
        Index("ix_payments_tenant_id", "tenant_id"),
        Index("ix_payments_payment_method", "payment_method"),
        Index("ix_payments_payment_status", "payment_status"),
        Index("ix_payments_paid_at", "paid_at"),
        Index("ix_payments_processed_by", "processed_by"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    payment_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=PaymentStatus.PAID
    )
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    order: Mapped[Order] = relationship("Order", back_populates="payments")

    def __repr__(self) -> str:
        return (
            f"<Payment method={self.payment_method} "
            f"amount={self.amount} status={self.payment_status}>"
        )


class Refund(Base):
    """
    Refund record — can be full or partial, and can cover specific line items.
    Each refund creates REFUND stock movements via the inventory engine.
    """

    __tablename__ = "refunds"
    __table_args__ = (
        Index("ix_refunds_order_id", "order_id"),
        Index("ix_refunds_tenant_id", "tenant_id"),
        Index("ix_refunds_refund_number", "refund_number", unique=True),
        Index("ix_refunds_processed_by", "processed_by"),
        Index("ix_refunds_processed_at", "processed_at"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )

    refund_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    refund_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RefundType.PARTIAL
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    processed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    order: Mapped[Order] = relationship("Order", back_populates="refunds")
    items: Mapped[list[RefundItem]] = relationship(
        "RefundItem", back_populates="refund", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return (
            f"<Refund {self.refund_number} type={self.refund_type} "
            f"amount={self.amount}>"
        )


class RefundItem(Base):
    """Line-item detail of a refund — links back to the original OrderItem."""

    __tablename__ = "refund_items"
    __table_args__ = (
        Index("ix_refund_items_refund_id", "refund_id"),
        Index("ix_refund_items_order_item_id", "order_item_id"),
        Index("ix_refund_items_product_id", "product_id"),
    )

    refund_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("refunds.id", ondelete="CASCADE"),
        nullable=False,
    )
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="RESTRICT"),
        nullable=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)

    # Link to the REFUND stock movement created for inventory restoration
    stock_movement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_movements.id", ondelete="SET NULL"),
        nullable=True,
    )

    refund: Mapped[Refund] = relationship("Refund", back_populates="items")

    def __repr__(self) -> str:
        return f"<RefundItem product={self.product_id} qty={self.quantity} amount={self.amount}>"
