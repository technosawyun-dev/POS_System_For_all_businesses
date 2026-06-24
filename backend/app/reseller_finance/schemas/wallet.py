from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema


# Response schemas


class WalletResponse(TimestampedSchema):
    reseller_id: uuid.UUID
    available_balance: Decimal
    locked_balance: Decimal
    pending_balance: Decimal
    total_paid_out: Decimal
    currency_code: str
    commission_rate_pct: Decimal
    min_payout_amount: Decimal


class WalletTransactionResponse(BaseSchema):
    id: uuid.UUID
    wallet_id: uuid.UUID
    reseller_id: uuid.UUID
    transaction_type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    currency_code: str
    reference_type: str | None
    reference_id: uuid.UUID | None
    notes: str | None
    created_at: datetime


# Request schemas


class UpdateWalletSettingsRequest(BaseSchema):
    """Super-admin adjustment of per-reseller wallet configuration."""

    commission_rate_pct: Decimal = Field(ge=0, le=100)
    min_payout_amount: Decimal = Field(gt=0)


class ManualAdjustmentRequest(BaseSchema):
    """Super-admin manual wallet credit/debit.

    ``transaction_type`` must be one of: MANUAL_ADJUSTMENT, BONUS, PENALTY.
    """

    reseller_id: uuid.UUID
    amount: Decimal = Field(ne=0)
    transaction_type: str = Field(min_length=1, max_length=50)
    notes: str = Field(min_length=1, max_length=1000)


# Paginated type aliases

PaginatedTransactions = PaginatedResponse[WalletTransactionResponse]
