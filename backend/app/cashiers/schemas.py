from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator


class OpenSessionRequest(BaseModel):
    branch_id: uuid.UUID
    opening_balance: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("opening_balance")
    @classmethod
    def validate_balance(cls, v: Decimal) -> Decimal:
        if v < Decimal("0"):
            raise ValueError("Opening balance cannot be negative")
        return v


class CloseSessionRequest(BaseModel):
    actual_balance: Decimal = Field(ge=0)
    notes: str | None = Field(default=None, max_length=500)


class CashierSessionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    cashier_user_id: uuid.UUID
    opening_balance: Decimal
    closing_balance: Decimal | None
    expected_balance: Decimal | None
    actual_balance: Decimal | None
    discrepancy_amount: Decimal | None
    status: str
    opened_at: datetime
    closed_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CashierSessionListResponse(BaseModel):
    items: list[CashierSessionResponse]
    total: int
    page: int
    page_size: int
