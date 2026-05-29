from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class AddPaymentRequest(BaseModel):
    payment_method: str
    amount: Decimal = Field(gt=0)
    reference_number: str | None = None
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    tenant_id: uuid.UUID
    payment_method: str
    amount: Decimal
    payment_status: str
    reference_number: str | None
    notes: str | None
    paid_at: datetime | None
    processed_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    items: list[PaymentResponse]
    total: int
    page: int
    page_size: int


class RefundItemRequest(BaseModel):
    order_item_id: uuid.UUID
    quantity: Decimal = Field(gt=0)
    amount: Decimal = Field(gt=0)


class RefundRequest(BaseModel):
    order_id: uuid.UUID
    reason: str
    items: list[RefundItemRequest] = Field(min_length=1)
    notes: str | None = None
    refund_method: str = Field(default="CASH", pattern="^(CASH|REPLACEMENT)$")


class RefundItemResponse(BaseModel):
    id: uuid.UUID
    refund_id: uuid.UUID
    order_item_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    product_name: str | None = None
    variant_name: str | None = None
    quantity: Decimal
    amount: Decimal
    stock_movement_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class RefundResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    tenant_id: uuid.UUID
    refund_number: str
    reason: str
    refund_type: str
    amount: Decimal
    notes: str | None
    processed_by: uuid.UUID
    processed_by_name: str | None = None
    processed_at: datetime
    items: list[RefundItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RefundListResponse(BaseModel):
    items: list[RefundResponse]
    total: int
    page: int
    page_size: int
