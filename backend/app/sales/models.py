from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import OrderStatus, PaymentStatus
from app.db.base import Base

if TYPE_CHECKING:
    from app.cashiers.models import CashierSession
    from app.payments.models import Payment, Refund
    from app.receipts.models import Receipt


class BranchCounter(Base):
    """
    Sequential order/receipt number counters per branch.
    Locked with SELECT FOR UPDATE during checkout to generate
    collision-free sequential numbers.
    """

    __tablename__ = "branch_counters"
    __table_args__ = (
        UniqueConstraint("branch_id", name="uq_branch_counters_branch_id"),
        Index("ix_branch_counters_branch_id", "branch_id"),
    )

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    order_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    receipt_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<BranchCounter branch={self.branch_id} order={self.order_seq}>"


class Cart(Base):
    """
    Lightweight temporary cart — pre-checkout state.
    Converted to an Order on checkout. Supports offline-sync-ready draft orders.
    """

    __tablename__ = "carts"
    __table_args__ = (
        Index("ix_carts_tenant_id", "tenant_id"),
        Index("ix_carts_branch_id", "branch_id"),
        Index("ix_carts_cashier_session_id", "cashier_session_id"),
        Index("ix_carts_created_at", "created_at"),
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
    cashier_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cashier_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional TTL for auto-expiry of stale carts
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list[CartItem]] = relationship(
        "CartItem", back_populates="cart", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Cart id={self.id} branch={self.branch_id}>"


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        Index("ix_cart_items_cart_id", "cart_id"),
        Index("ix_cart_items_product_id", "product_id"),
    )

    cart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carts.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 4), nullable=False, default=Decimal("0")
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    cart: Mapped[Cart] = relationship("Cart", back_populates="items")

    def __repr__(self) -> str:
        return f"<CartItem product={self.product_id} qty={self.quantity}>"


class Order(Base):
    """
    Immutable record of a completed sales transaction.
    order_status and payment_status are independent lifecycles.
    Price/cost fields are snapshots — never rely on live product data post-sale.
    """

    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_tenant_id", "tenant_id"),
        Index("ix_orders_branch_id", "branch_id"),
        Index("ix_orders_order_number", "order_number", unique=True),
        Index("ix_orders_cashier_session_id", "cashier_session_id"),
        Index("ix_orders_payment_status", "payment_status"),
        Index("ix_orders_order_status", "order_status"),
        Index("ix_orders_completed_at", "completed_at"),
        Index("ix_orders_branch_created_at", "branch_id", "created_at"),
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
    cashier_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cashier_sessions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    order_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)

    order_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=OrderStatus.PENDING
    )
    payment_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=PaymentStatus.PENDING
    )

    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    refunded_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    cashier_session: Mapped[CashierSession] = relationship(
        "CashierSession", back_populates="orders", lazy="noload"
    )
    items: Mapped[list[OrderItem]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )
    payments: Mapped[list[Payment]] = relationship(
        "Payment", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )
    receipt: Mapped[Receipt | None] = relationship(
        "Receipt", back_populates="order", uselist=False, lazy="noload"
    )
    refunds: Mapped[list[Refund]] = relationship(
        "Refund", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return (
            f"<Order {self.order_number} status={self.order_status} "
            f"payment={self.payment_status} total={self.total_amount}>"
        )


class OrderItem(Base):
    """
    Immutable line item of a completed order.
    All prices and costs are snapshots from the time of sale.
    product_name, variant_name, sku are also snapshotted — never rely on live product data.
    """

    __tablename__ = "order_items"
    __table_args__ = (
        Index("ix_order_items_order_id", "order_id"),
        Index("ix_order_items_product_id", "product_id"),
        Index("ix_order_items_variant_id", "variant_id"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
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

    # Immutable snapshots at time of sale
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)

    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit_cost_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)

    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 4), nullable=False, default=Decimal("0")
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )

    # subtotal = unit_price * quantity (pre-discount, pre-tax)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    # total = (subtotal - discount_amount) * (1 + tax_rate)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)

    order: Mapped[Order] = relationship("Order", back_populates="items")

    def __repr__(self) -> str:
        return (
            f"<OrderItem product={self.product_name} "
            f"qty={self.quantity} total={self.total}>"
        )
