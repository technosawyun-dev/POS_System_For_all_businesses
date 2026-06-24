from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema


# Request schemas


class ReferralCodeCreateRequest(BaseSchema):
    """Create a new referral code for the authenticated reseller.

    If ``code`` is omitted, the system will auto-generate one.
    """

    code: str | None = Field(default=None, max_length=50)


class ReferralCodeUpdateRequest(BaseSchema):
    """Toggle a referral code active/inactive."""

    is_active: bool


class AddTenantReferralRequest(BaseSchema):
    """Associate a tenant with a reseller via a referral code at registration."""

    referral_code: str = Field(min_length=1, max_length=50)


# Response schemas


class ReferralCodeResponse(TimestampedSchema):
    reseller_id: uuid.UUID
    code: str
    is_active: bool


class TenantReferralResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    reseller_id: uuid.UUID
    referral_code_id: uuid.UUID | None = None
    referral_code_snapshot: str
    referred_at: datetime
    locked_at: datetime | None
    first_paid_subscription_at: datetime | None
    tenant_name: str | None = None
    subscription_status: str | None = None
    subscription_expires_at: datetime | None = None


class ReferralStatsResponse(BaseSchema):
    total_referrals: int
    active_referrals: int       # referred tenants still in trial (not yet locked)
    converted_referrals: int    # locked referrals (tenant paid at least once)
    trial_referrals: int
    conversion_rate: float      # percentage, e.g. 42.5


class ReferralLinkResponse(BaseSchema):
    code: str
    referral_url: str           # e.g. "https://app.nexuspos.com/register?ref=CODE"


# Paginated type aliases

PaginatedReferralCodes = PaginatedResponse[ReferralCodeResponse]
PaginatedTenantReferrals = PaginatedResponse[TenantReferralResponse]
