from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_validator, model_validator

from app.core.constants import (
    AdjustmentStatus,
    InventoryAdjustmentType,
    StockMovementType,
    TransferStatus,
)
from app.schemas.common import BaseSchema, TimestampedSchema


# Branch Inventory

class BranchInventoryResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    quantity_on_hand: Decimal
    quantity_reserved: Decimal
    quantity_available: Decimal
    quantity_sold: Decimal = Decimal("0")
    reorder_point: Decimal | None
    reorder_quantity: Decimal | None
    sync_version: int
    last_movement_at: datetime | None


class BranchInventoryUpdateRequest(BaseSchema):
    reorder_point: Decimal | None = Field(default=None, ge=0)
    reorder_quantity: Decimal | None = Field(default=None, ge=0)


# Stock Movement

class StockMovementResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    movement_type: str
    quantity: Decimal
    previous_quantity: Decimal
    new_quantity: Decimal
    reference_type: str | None
    reference_id: str | None
    unit_cost: Decimal | None
    reason: str | None
    notes: str | None
    actor_user_id: uuid.UUID
    actor_name: str | None = None


# Opening Stock

class OpeningStockItemRequest(BaseSchema):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=500)


class OpeningStockRequest(BaseSchema):
    branch_id: uuid.UUID
    items: list[OpeningStockItemRequest] = Field(min_length=1)
    reason: str | None = Field(default=None, max_length=500)


# Inventory Adjustment

class AdjustmentItemRequest(BaseSchema):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    # Signed: positive = add stock, negative = remove stock
    quantity_change: Decimal
    unit_cost: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("quantity_change")
    @classmethod
    def quantity_not_zero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("quantity_change cannot be zero")
        return v


class InventoryAdjustmentCreateRequest(BaseSchema):
    branch_id: uuid.UUID
    adjustment_type: InventoryAdjustmentType
    items: list[AdjustmentItemRequest] = Field(min_length=1)
    reason: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=500)
    reference_number: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_item_signs(self) -> "InventoryAdjustmentCreateRequest":
        # Enforce sign consistency with adjustment_type
        decrease_types = {
            InventoryAdjustmentType.DAMAGE,
            InventoryAdjustmentType.EXPIRED,
            InventoryAdjustmentType.LOST,
        }
        increase_types = {InventoryAdjustmentType.FOUND}

        for item in self.items:
            if self.adjustment_type in decrease_types and item.quantity_change > 0:
                raise ValueError(
                    f"Adjustment type '{self.adjustment_type}' requires negative quantity_change"
                )
            if self.adjustment_type in increase_types and item.quantity_change < 0:
                raise ValueError(
                    f"Adjustment type '{self.adjustment_type}' requires positive quantity_change"
                )
        return self


class AdjustmentItemResponse(BaseSchema):
    id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    quantity_change: Decimal
    quantity_before: Decimal
    quantity_after: Decimal
    unit_cost: Decimal | None
    notes: str | None
    stock_movement_id: uuid.UUID | None


class InventoryAdjustmentResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    adjustment_type: str
    status: str
    reference_number: str | None
    reason: str | None
    notes: str | None
    actor_user_id: uuid.UUID
    approved_by_id: uuid.UUID | None
    approved_at: datetime | None
    completed_at: datetime | None
    items: list[AdjustmentItemResponse] = Field(default_factory=list)


# Inventory Transfer

class TransferItemRequest(BaseSchema):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    quantity_requested: Decimal = Field(gt=0)
    unit_cost: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=500)


class InventoryTransferCreateRequest(BaseSchema):
    from_branch_id: uuid.UUID
    to_branch_id: uuid.UUID
    items: list[TransferItemRequest] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=500)
    reference_number: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def branches_must_differ(self) -> "InventoryTransferCreateRequest":
        if self.from_branch_id == self.to_branch_id:
            raise ValueError("Source and destination branches must be different")
        return self


class TransferApproveRequest(BaseSchema):
    notes: str | None = Field(default=None, max_length=500)


class TransferCancelRequest(BaseSchema):
    reason: str = Field(min_length=1, max_length=500)


class TransferItemResponse(BaseSchema):
    id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    quantity_requested: Decimal
    quantity_transferred: Decimal
    unit_cost: Decimal | None
    notes: str | None


class InventoryTransferResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    from_branch_id: uuid.UUID
    to_branch_id: uuid.UUID
    status: str
    reference_number: str | None
    notes: str | None
    requested_by_id: uuid.UUID
    approved_by_id: uuid.UUID | None
    approved_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancelled_by_id: uuid.UUID | None
    cancel_reason: str | None
    items: list[TransferItemResponse] = Field(default_factory=list)


# Inventory Valuation

class InventoryValuationItem(BaseSchema):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    product_name: str
    sku: str | None
    quantity_on_hand: Decimal
    unit_cost: Decimal | None
    total_value: Decimal


class InventoryValuationResponse(BaseSchema):
    branch_id: uuid.UUID
    tenant_id: uuid.UUID
    total_value: Decimal
    total_items: int
    items: list[InventoryValuationItem]
