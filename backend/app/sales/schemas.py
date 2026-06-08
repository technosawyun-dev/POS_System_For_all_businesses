from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


# Cart Schemas

class CartItemRequest(BaseModel):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    notes: str | None = None


class CartItemUpdateRequest(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=0)
    unit_price: Decimal | None = Field(default=None, ge=0)
    discount_amount: Decimal | None = Field(default=None, ge=0)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=1)


class CartCreateRequest(BaseModel):
    branch_id: uuid.UUID
    cashier_session_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    notes: str | None = None


class CartItemResponse(BaseModel):
    id: uuid.UUID
    cart_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    quantity: Decimal
    unit_price: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CartTotalsResponse(BaseModel):
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    item_count: int


class CartResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    cashier_session_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    notes: str | None
    expires_at: datetime | None
    items: list[CartItemResponse]
    totals: CartTotalsResponse | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Order Schemas

class CheckoutItemRequest(BaseModel):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    notes: str | None = None


class CheckoutPaymentRequest(BaseModel):
    payment_method: str
    amount: Decimal = Field(gt=0)
    reference_number: str | None = None
    notes: str | None = None


class CheckoutRequest(BaseModel):
    cashier_session_id: uuid.UUID
    items: list[CheckoutItemRequest] = Field(min_length=1)
    payments: list[CheckoutPaymentRequest] = Field(default_factory=list)
    customer_id: uuid.UUID | None = None
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list) -> list:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v

    @model_validator(mode='after')
    def validate_payments_or_customer(self) -> 'CheckoutRequest':
        if not self.payments and not self.customer_id:
            raise ValueError("Order must have at least one payment, or assign a customer for on-account sale")
        return self


class VoidOrderRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    product_name: str
    variant_name: str | None
    sku: str | None
    quantity: Decimal
    unit_price: Decimal
    unit_cost_snapshot: Decimal | None
    tax_rate: Decimal
    discount_amount: Decimal
    subtotal: Decimal
    total: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentResponse(BaseModel):
    id: uuid.UUID
    payment_method: str
    amount: Decimal
    reference_number: str | None
    notes: str | None
    paid_at: datetime | None

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    cashier_session_id: uuid.UUID
    customer_id: uuid.UUID | None
    order_number: str
    order_status: str
    payment_status: str
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    refunded_amount: Decimal
    notes: str | None
    completed_at: datetime | None
    voided_at: datetime | None
    created_by: uuid.UUID
    cashier_name: str | None = None
    customer_name: str | None = None
    branch_name: str | None = None
    items: list[OrderItemResponse] = []
    payments: list[PaymentResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    page_size: int
