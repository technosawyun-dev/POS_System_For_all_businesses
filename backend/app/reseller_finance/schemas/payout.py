from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema


# Request schemas


class PayoutRequestCreate(BaseSchema):
    """Reseller self-service payout request.

    Amount must be positive and will be validated against the wallet's
    ``available_balance`` and ``min_payout_amount`` by the service layer.
    """

    amount: Decimal = Field(gt=0)
    reason: str | None = Field(default=None, max_length=500)


class AdminPayoutCreate(BaseSchema):
    """Super-admin initiated payout on behalf of a reseller."""

    reseller_id: uuid.UUID
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=1, max_length=500)


class PayoutReviewRequest(BaseSchema):
    """Optional notes when approving or rejecting a payout."""

    notes: str | None = Field(default=None, max_length=500)


class PayoutMarkPaidRequest(BaseSchema):
    """Mark an approved payout as disbursed.

    All fields are optional audit metadata; at least one is recommended.
    """

    payout_method: str | None = Field(default=None, max_length=100)
    payout_reference: str | None = Field(default=None, max_length=255)
    payout_notes: str | None = Field(default=None, max_length=500)


# Response schemas


class PayoutRequestResponse(TimestampedSchema):
    reseller_id: uuid.UUID
    reseller_name: str | None = None
    reseller_email: str | None = None
    wallet_id: uuid.UUID
    amount: Decimal
    currency_code: str
    status: str                            # PENDING | UNDER_REVIEW | APPROVED | REJECTED | PAID | CANCELLED
    reason: str | None
    payout_method: str | None
    payout_reference: str | None
    payout_notes: str | None
    requested_at: datetime
    reviewed_at: datetime | None
    paid_at: datetime | None
    reviewed_by: uuid.UUID | None


# Paginated type aliases

PaginatedPayoutRequests = PaginatedResponse[PayoutRequestResponse]
