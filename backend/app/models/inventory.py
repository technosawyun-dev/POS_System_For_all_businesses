from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import AdjustmentStatus, StockMovementType, TransferStatus
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.product import Product, ProductVariant


class BranchInventory(Base):
    """
    Materialized per-branch inventory position.
    quantity_on_hand MUST only be updated through create_stock_movement().
    This row is the locked target for all inventory mutations.
    """

    __tablename__ = "branch_inventory"
    __table_args__ = (
        # Partial unique indexes handle NULL variant_id correctly in PostgreSQL
        Index(
            "uq_branch_inv_no_variant",
            "branch_id", "product_id",
            unique=True,
            postgresql_where=text("variant_id IS NULL"),
        ),
        Index(
            "uq_branch_inv_with_variant",
            "branch_id", "product_id", "variant_id",
            unique=True,
            postgresql_where=text("variant_id IS NOT NULL"),
        ),
        Index("ix_branch_inventory_tenant_id", "tenant_id"),
        Index("ix_branch_inventory_branch_product", "branch_id", "product_id"),
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
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # The materialized stock position — ONLY updated via create_stock_movement()
    quantity_on_hand: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    # Quantity reserved by pending transactions (e.g., pending sales orders)
    quantity_reserved: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )

    reorder_point: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    reorder_quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)

    # Offline sync preparation — monotonically increasing per write
    sync_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_movement_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    product: Mapped[Product] = relationship("Product", back_populates="branch_inventory")
    variant: Mapped[ProductVariant | None] = relationship(
        "ProductVariant", back_populates="branch_inventory"
    )
    movements: Mapped[list[StockMovement]] = relationship(
        "StockMovement",
        primaryjoin="and_(BranchInventory.branch_id == foreign(StockMovement.branch_id), "
                    "BranchInventory.product_id == foreign(StockMovement.product_id))",
        viewonly=True,
        overlaps="movements",
    )

    @property
    def quantity_available(self) -> Decimal:
        return self.quantity_on_hand - self.quantity_reserved

    def __repr__(self) -> str:
        return (
            f"<BranchInventory branch={self.branch_id} "
            f"product={self.product_id} qty={self.quantity_on_hand}>"
        )


class StockMovement(Base):
    """
    Immutable inventory ledger entry.
    Every stock change creates one record here. Never updated after creation.
    """

    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("ix_stock_movements_tenant_branch", "tenant_id", "branch_id"),
        Index("ix_stock_movements_product_id", "product_id"),
        Index("ix_stock_movements_variant_id", "variant_id"),
        Index("ix_stock_movements_movement_type", "movement_type"),
        Index("ix_stock_movements_created_at", "created_at"),
        Index("ix_stock_movements_reference", "reference_type", "reference_id"),
        Index("ix_stock_movements_actor", "actor_user_id"),
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

    movement_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Quantity is always stored as a positive absolute value.
    # The direction (inbound/outbound) is determined by movement_type.
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)

    # Audit trail — snapshot of stock before and after this movement
    previous_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    new_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)

    # Reference to the business document that caused this movement
    reference_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)

    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    product: Mapped[Product] = relationship("Product")

    def __repr__(self) -> str:
        return (
            f"<StockMovement type={self.movement_type} "
            f"qty={self.quantity} product={self.product_id}>"
        )


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"
    __table_args__ = (
        Index("ix_inv_adj_tenant_branch", "tenant_id", "branch_id"),
        Index("ix_inv_adj_status", "status"),
        Index("ix_inv_adj_created_at", "created_at"),
        Index("ix_inv_adj_actor", "actor_user_id"),
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
    adjustment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=AdjustmentStatus.COMPLETED
    )
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Approval fields — prepared for future approval workflow
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list[InventoryAdjustmentItem]] = relationship(
        "InventoryAdjustmentItem", back_populates="adjustment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<InventoryAdjustment id={self.id} type={self.adjustment_type} status={self.status}>"


class InventoryAdjustmentItem(Base):
    __tablename__ = "inventory_adjustment_items"
    __table_args__ = (
        Index("ix_inv_adj_items_adjustment_id", "adjustment_id"),
        Index("ix_inv_adj_items_product_id", "product_id"),
    )

    adjustment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_adjustments.id", ondelete="CASCADE"),
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
    # Signed quantity: positive = stock added, negative = stock removed
    quantity_change: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    quantity_before: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    quantity_after: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # FK to the stock movement created for this item
    stock_movement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_movements.id", ondelete="SET NULL"),
        nullable=True,
    )

    adjustment: Mapped[InventoryAdjustment] = relationship(
        "InventoryAdjustment", back_populates="items"
    )

    def __repr__(self) -> str:
        return f"<AdjustmentItem product={self.product_id} change={self.quantity_change}>"


class InventoryTransfer(Base):
    __tablename__ = "inventory_transfers"
    __table_args__ = (
        Index("ix_inv_transfer_tenant_id", "tenant_id"),
        Index("ix_inv_transfer_from_branch", "from_branch_id"),
        Index("ix_inv_transfer_to_branch", "to_branch_id"),
        Index("ix_inv_transfer_status", "status"),
        Index("ix_inv_transfer_created_at", "created_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
    )
    to_branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=TransferStatus.PENDING
    )
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    cancel_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    items: Mapped[list[InventoryTransferItem]] = relationship(
        "InventoryTransferItem", back_populates="transfer", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<InventoryTransfer from={self.from_branch_id} "
            f"to={self.to_branch_id} status={self.status}>"
        )


class InventoryTransferItem(Base):
    __tablename__ = "inventory_transfer_items"
    __table_args__ = (
        Index("ix_inv_transfer_items_transfer_id", "transfer_id"),
        Index("ix_inv_transfer_items_product_id", "product_id"),
    )

    transfer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_transfers.id", ondelete="CASCADE"),
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
    quantity_requested: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    quantity_transferred: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    transfer: Mapped[InventoryTransfer] = relationship(
        "InventoryTransfer", back_populates="items"
    )

    def __repr__(self) -> str:
        return f"<TransferItem product={self.product_id} qty={self.quantity_requested}>"
