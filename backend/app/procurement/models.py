from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import (
    GoodsReceiptStatus,
    PurchaseOrderStatus,
    SupplierPayableStatus,
    SupplierPaymentStatus,
)
from app.db.base import Base


class POCounter(Base):
    """Per-tenant sequence counter for PO numbers (PO-000001)."""

    __tablename__ = "po_counters"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_po_counters_tenant_id"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    last_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class GRCounter(Base):
    """Per-tenant sequence counter for goods receipt numbers (GR-000001)."""

    __tablename__ = "gr_counters"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_gr_counters_tenant_id"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    last_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("tenant_id", "po_number", name="uq_purchase_orders_tenant_po_number"),
        Index("ix_purchase_orders_tenant_id", "tenant_id"),
        Index("ix_purchase_orders_branch_id", "branch_id"),
        Index("ix_purchase_orders_supplier_id", "supplier_id"),
        Index("ix_purchase_orders_status", "status"),
        Index("ix_purchase_orders_po_number", "po_number"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False
    )
    po_number: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=PurchaseOrderStatus.DRAFT
    )
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expected_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list[PurchaseOrderItem]] = relationship(
        "PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan"
    )
    receipts: Mapped[list[GoodsReceipt]] = relationship(
        "GoodsReceipt", back_populates="purchase_order"
    )
    payable: Mapped[SupplierPayable | None] = relationship(
        "SupplierPayable", back_populates="purchase_order", uselist=False
    )

    def __repr__(self) -> str:
        return f"<PurchaseOrder {self.po_number} status={self.status}>"


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__ = (
        Index("ix_purchase_order_items_purchase_order_id", "purchase_order_id"),
        Index("ix_purchase_order_items_product_id", "product_id"),
    )

    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=True
    )
    ordered_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    purchase_order: Mapped[PurchaseOrder] = relationship(
        "PurchaseOrder", back_populates="items"
    )
    product: Mapped[Any] = relationship(
        "Product", foreign_keys=[product_id], lazy="raise"
    )
    receipt_items: Mapped[list[GoodsReceiptItem]] = relationship(
        "GoodsReceiptItem", back_populates="purchase_order_item"
    )

    def __repr__(self) -> str:
        return f"<PurchaseOrderItem product={self.product_id} qty={self.ordered_quantity}>"


class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "receipt_number", name="uq_goods_receipts_tenant_receipt_number"
        ),
        Index("ix_goods_receipts_tenant_id", "tenant_id"),
        Index("ix_goods_receipts_branch_id", "branch_id"),
        Index("ix_goods_receipts_purchase_order_id", "purchase_order_id"),
        Index("ix_goods_receipts_status", "status"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False
    )
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    receipt_number: Mapped[str] = mapped_column(String(20), nullable=False)
    receipt_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=GoodsReceiptStatus.RECEIVED
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    items: Mapped[list[GoodsReceiptItem]] = relationship(
        "GoodsReceiptItem", back_populates="goods_receipt", cascade="all, delete-orphan"
    )
    purchase_order: Mapped[PurchaseOrder] = relationship(
        "PurchaseOrder", back_populates="receipts"
    )

    def __repr__(self) -> str:
        return f"<GoodsReceipt {self.receipt_number} status={self.status}>"


class GoodsReceiptItem(Base):
    __tablename__ = "goods_receipt_items"
    __table_args__ = (
        Index("ix_goods_receipt_items_goods_receipt_id", "goods_receipt_id"),
        Index("ix_goods_receipt_items_purchase_order_item_id", "purchase_order_item_id"),
    )

    goods_receipt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goods_receipts.id", ondelete="CASCADE"), nullable=False
    )
    purchase_order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_order_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    goods_receipt: Mapped[GoodsReceipt] = relationship(
        "GoodsReceipt", back_populates="items"
    )
    purchase_order_item: Mapped[PurchaseOrderItem] = relationship(
        "PurchaseOrderItem", back_populates="receipt_items"
    )

    def __repr__(self) -> str:
        return f"<GoodsReceiptItem poi={self.purchase_order_item_id} qty={self.received_quantity}>"


class SupplierPayable(Base):
    __tablename__ = "supplier_payables"
    __table_args__ = (
        UniqueConstraint(
            "purchase_order_id", name="uq_supplier_payables_purchase_order_id"
        ),
        Index("ix_supplier_payables_tenant_id", "tenant_id"),
        Index("ix_supplier_payables_supplier_id", "supplier_id"),
        Index("ix_supplier_payables_status", "status"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False
    )
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )
    remaining_amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=SupplierPayableStatus.OPEN
    )

    payments: Mapped[list[SupplierPayment]] = relationship(
        "SupplierPayment", back_populates="payable", cascade="all, delete-orphan"
    )
    purchase_order: Mapped[PurchaseOrder] = relationship(
        "PurchaseOrder", back_populates="payable"
    )

    def __repr__(self) -> str:
        return f"<SupplierPayable po={self.purchase_order_id} remaining={self.remaining_amount}>"


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"
    __table_args__ = (
        Index("ix_supplier_payments_tenant_id", "tenant_id"),
        Index("ix_supplier_payments_supplier_id", "supplier_id"),
        Index("ix_supplier_payments_supplier_payable_id", "supplier_payable_id"),
        Index("ix_supplier_payments_status", "status"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False
    )
    supplier_payable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("supplier_payables.id", ondelete="CASCADE"), nullable=False
    )
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=SupplierPaymentStatus.CONFIRMED
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    payable: Mapped[SupplierPayable] = relationship("SupplierPayable", back_populates="payments")

    def __repr__(self) -> str:
        return f"<SupplierPayment amount={self.amount} method={self.payment_method}>"
