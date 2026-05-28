from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from app.core.constants import TenantStatus
from app.schemas.common import BaseSchema, TimestampedSchema


class TenantCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    country: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    timezone: str = "UTC"
    currency: str = Field(default="MMK", max_length=10)
    locale: str = Field(default="en-US", max_length=20)
    subscription_plan: str = "trial"


class TenantUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    country: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    timezone: str | None = None
    currency: str | None = Field(default=None, max_length=10)
    locale: str | None = Field(default=None, max_length=20)


class TenantStatusUpdateRequest(BaseSchema):
    status: TenantStatus


class TenantSettingsUpdateRequest(BaseSchema):
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    tax_inclusive: bool | None = None
    extra_settings: dict | None = None


class TenantSettingsResponse(BaseSchema):
    tenant_id: uuid.UUID
    tax_rate: float | None
    tax_inclusive: bool
    extra_settings: dict


class TenantResponse(TimestampedSchema):
    name: str
    slug: str
    business_code: str
    status: str
    email: str | None
    phone: str | None
    address: str | None
    country: str | None
    city: str | None
    timezone: str
    currency: str
    locale: str
    owner_id: uuid.UUID | None
    subscription_plan: str
    subscription_expires_at: datetime | None
    is_deleted: bool


class TenantSummaryResponse(BaseSchema):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    timezone: str
    currency: str
