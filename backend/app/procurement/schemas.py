from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_validator

from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema



class PurchaseOrderItemCreate(BaseSchema):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    ordered_quantity: Decimal = Field(gt=0)
    unit_cost: Decimal = Field(ge=0)

    @field_validator("ordered_quantity", "unit_cost", mode="before")
    @classmethod
    def coerce_decimal(cls, v: object) -> Decimal:
        return Decimal(str(v))


class PurchaseOrderItemResponse(TimestampedSchema):
    purchase_order_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    variant_id: uuid.UUID | None
    ordered_quantity: Decimal
    received_quantity: Decimal
    unit_cost: Decimal
    line_total: Decimal



class PurchaseOrderCreate(BaseSchema):
    branch_id: uuid.UUID
    supplier_id: uuid.UUID
    order_date: datetime
    expected_date: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    items: list[PurchaseOrderItemCreate] = Field(min_length=1)

    @field_validator("discount_amount", "tax_amount", mode="before")
    @classmethod
    def coerce_decimal(cls, v: object) -> Decimal:
        return Decimal(str(v))


class PurchaseOrderUpdate(BaseSchema):
    order_date: datetime | None = None
    expected_date: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)
    discount_amount: Decimal | None = None
    tax_amount: Decimal | None = None
    items: list[PurchaseOrderItemCreate] | None = None


class PurchaseOrderSummary(TimestampedSchema):
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    supplier_id: uuid.UUID
    po_number: str
    status: str
    order_date: datetime
    expected_date: datetime | None
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    created_by: uuid.UUID
    created_by_name: str | None = None
    approved_by_name: str | None = None
    supplier_name: str | None = None


class PurchaseOrderDetail(PurchaseOrderSummary):
    notes: str | None
    items: list[PurchaseOrderItemResponse]
    payable: SupplierPayableSummary | None = None


PaginatedPurchaseOrders = PaginatedResponse[PurchaseOrderSummary]



class GoodsReceiptItemCreate(BaseSchema):
    purchase_order_item_id: uuid.UUID
    received_quantity: Decimal = Field(gt=0)
    unit_cost: Decimal = Field(ge=0)

    @field_validator("received_quantity", "unit_cost", mode="before")
    @classmethod
    def coerce_decimal(cls, v: object) -> Decimal:
        return Decimal(str(v))


class GoodsReceiptItemResponse(TimestampedSchema):
    goods_receipt_id: uuid.UUID
    purchase_order_item_id: uuid.UUID
    product_name: str | None = None
    received_quantity: Decimal
    unit_cost: Decimal
    line_total: Decimal



class GoodsReceiptCreate(BaseSchema):
    purchase_order_id: uuid.UUID
    branch_id: uuid.UUID
    receipt_date: datetime
    notes: str | None = Field(default=None, max_length=1000)
    items: list[GoodsReceiptItemCreate] = Field(min_length=1)


class GoodsReceiptSummary(TimestampedSchema):
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    purchase_order_id: uuid.UUID
    receipt_number: str
    receipt_date: datetime
    status: str
    received_by: uuid.UUID
    received_by_name: str | None = None


class GoodsReceiptDetail(GoodsReceiptSummary):
    notes: str | None
    items: list[GoodsReceiptItemResponse]


PaginatedGoodsReceipts = PaginatedResponse[GoodsReceiptSummary]



class SupplierPaymentCreate(BaseSchema):
    payment_method: str = Field(min_length=1, max_length=50)
    reference_number: str | None = Field(default=None, max_length=255)
    amount: Decimal = Field(gt=0)
    payment_date: datetime
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_decimal(cls, v: object) -> Decimal:
        return Decimal(str(v))


class SupplierPaymentResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    supplier_id: uuid.UUID
    supplier_payable_id: uuid.UUID
    payment_method: str
    reference_number: str | None
    amount: Decimal
    payment_date: datetime
    status: str
    notes: str | None
    recorded_by: uuid.UUID
    recorded_by_name: str | None = None



class SupplierPayableSummary(TimestampedSchema):
    tenant_id: uuid.UUID
    supplier_id: uuid.UUID
    purchase_order_id: uuid.UUID
    total_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    status: str
    supplier_name: str | None = None


class SupplierPayableDetail(SupplierPayableSummary):
    payments: list[SupplierPaymentResponse]


PaginatedSupplierPayables = PaginatedResponse[SupplierPayableSummary]



class SupplierBalance(BaseSchema):
    supplier_id: uuid.UUID
    tenant_id: uuid.UUID
    total_payable: Decimal
    total_paid: Decimal
    outstanding_balance: Decimal
    open_count: int
    partial_count: int
