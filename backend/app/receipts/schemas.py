from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class ReceiptResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    receipt_number: str
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    change_amount: Decimal
    cashier_name: str
    branch_name: str
    tenant_name: str
    payment_methods: list[Any]
    items_snapshot: list[Any]
    issued_at: datetime
    voided_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReceiptListResponse(BaseModel):
    items: list[ReceiptResponse]
    total: int
    page: int
    page_size: int
