from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampedSchema


# Reseller note schemas


class NoteCreateRequest(BaseSchema):
    note: str = Field(min_length=1, max_length=2000)


class NoteResponse(BaseSchema):
    id: uuid.UUID
    reseller_id: uuid.UUID
    note: str
    created_by: uuid.UUID
    created_at: datetime


# Platform-level finance analytics


class ResellerFinanceOverviewResponse(BaseSchema):
    total_resellers: int
    total_wallets_value: Decimal
    total_pending_payouts: int
    total_pending_payout_amount: Decimal
    total_commission_earned: Decimal
    total_commission_paid_out: Decimal
    total_referrals: int
    converted_referrals: int
    currency_code: str


class ResellerWalletSummary(BaseSchema):
    reseller_id: uuid.UUID
    reseller_name: str
    reseller_email: str
    available_balance: Decimal
    locked_balance: Decimal
    total_paid_out: Decimal
    total_referrals: int
    commission_rate_pct: Decimal
    min_payout_amount: Decimal
    currency_code: str
    primary_code: str | None = None
