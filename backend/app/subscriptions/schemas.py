from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema



class PlanEntitlementCreate(BaseSchema):
    feature_code: str
    enabled: bool = True
    limit_value: int | None = None


class PlanEntitlementResponse(TimestampedSchema):
    plan_id: uuid.UUID
    feature_code: str
    enabled: bool
    limit_value: int | None


class PlanCreateRequest(BaseSchema):
    name: str
    code: str
    description: str | None = None
    billing_cycle: str
    price: Decimal
    currency: str = "USD"
    trial_days: int = Field(default=0, ge=0)
    is_active: bool = True
    is_trial: bool = False
    is_public: bool = True
    sort_order: int = 0
    entitlements: list[PlanEntitlementCreate] = Field(default_factory=list)

    @field_validator("price", mode="before")
    @classmethod
    def coerce_price(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class PlanUpdateRequest(BaseSchema):
    name: str | None = None
    description: str | None = None
    billing_cycle: str | None = None
    price: Decimal | None = None
    currency: str | None = None
    trial_days: int | None = None
    is_active: bool | None = None
    is_trial: bool | None = None
    is_public: bool | None = None
    sort_order: int | None = None
    entitlements: list[PlanEntitlementCreate] | None = None

    @field_validator("price", mode="before")
    @classmethod
    def coerce_price(cls, v: Any) -> Decimal | None:
        if v is None:
            return None
        return Decimal(str(v))


class PlanResponse(TimestampedSchema):
    name: str
    code: str
    description: str | None
    billing_cycle: str
    price: Decimal
    currency: str
    trial_days: int
    is_active: bool
    is_trial: bool
    is_public: bool
    sort_order: int
    entitlements: list[PlanEntitlementResponse]


class TrialStatusResponse(BaseSchema):
    status: str
    plan_name: str
    plan_code: str
    started_at: str
    expires_at: str
    days_remaining: int
    is_expired: bool
    usage: dict[str, dict]


class PublicPlanResponse(BaseSchema):
    id: uuid.UUID
    name: str
    code: str
    description: str | None
    billing_cycle: str
    price: Decimal
    currency: str
    trial_days: int
    sort_order: int
    entitlements: list[PlanEntitlementResponse]


class RegisterRequest(BaseSchema):
    business_name: str = Field(min_length=2, max_length=255)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class RegistrationResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    tenant_id: str
    onboarding_required: bool = True


class SubscriptionHistoryResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    subscription_id: uuid.UUID
    change_type: str
    old_plan_id: uuid.UUID | None
    new_plan_id: uuid.UUID | None
    old_status: str | None
    new_status: str | None
    note: str | None
    changed_by_user_id: uuid.UUID | None


class SubscriptionResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    plan_id: uuid.UUID
    status: str
    started_at: datetime
    expires_at: datetime
    cancelled_at: datetime | None
    trial_ends_at: datetime | None
    auto_renew: bool
    plan: PlanResponse


class PaymentProofCreateRequest(BaseSchema):
    amount: Decimal
    currency: str = "USD"
    reference_number: str | None = None
    proof_file_url: str

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class PaymentProofResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    subscription_id: uuid.UUID
    amount: Decimal
    currency: str
    reference_number: str | None
    proof_file_url: str
    status: str
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    review_notes: str | None


class ActivateSubscriptionRequest(BaseSchema):
    plan_id: uuid.UUID
    extension_days: int = Field(default=30, ge=1)


class ChangePlanRequest(BaseSchema):
    plan_id: uuid.UUID


class ReviewProofRequest(BaseSchema):
    review_notes: str | None = None


# Paginated type aliases
PaginatedPlans = PaginatedResponse[PlanResponse]
PaginatedSubscriptionHistory = PaginatedResponse[SubscriptionHistoryResponse]
PaginatedPaymentProofs = PaginatedResponse[PaymentProofResponse]



class TenantEntitlementOverrideCreateRequest(BaseSchema):
    feature_code: str
    enabled: bool | None = None
    limit_value: int | None = None
    reason: str | None = None
    expires_at: datetime | None = None


class TenantEntitlementOverrideUpdateRequest(BaseSchema):
    enabled: bool | None = None
    limit_value: int | None = None
    reason: str | None = None
    expires_at: datetime | None = None


class TenantEntitlementOverrideResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    feature_code: str
    enabled: bool | None
    limit_value: int | None
    reason: str | None
    expires_at: datetime | None
    created_by_user_id: uuid.UUID | None


class EffectiveEntitlementResponse(BaseSchema):
    feature_code: str
    enabled: bool
    limit_value: int | None
    source: str


class SubscriptionOverviewResponse(BaseSchema):
    total_tenants: int
    active_subscriptions: int
    trial_subscriptions: int
    expired_subscriptions: int
    suspended_subscriptions: int
    monthly_revenue: Decimal


class ExtendSubscriptionRequest(BaseSchema):
    days: int = Field(ge=1, le=3650)
    reason: str | None = None


class AdminChangePlanRequest(BaseSchema):
    plan_id: uuid.UUID
    reason: str | None = None


# Paginated admin type aliases
PaginatedAdminSubscriptions = PaginatedResponse[SubscriptionResponse]
PaginatedOverrides = PaginatedResponse[TenantEntitlementOverrideResponse]
