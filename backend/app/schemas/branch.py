from __future__ import annotations

import uuid

from pydantic import EmailStr, Field

from app.core.constants import BranchStatus
from app.schemas.common import BaseSchema, TimestampedSchema


class BranchCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=50)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    timezone: str = "UTC"
    currency: str = Field(default="MMK", max_length=10)
    is_main_branch: bool = False


class BranchUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    timezone: str | None = None
    currency: str | None = Field(default=None, max_length=10)
    manager_id: uuid.UUID | None = None
    is_main_branch: bool | None = None


class BranchStatusUpdateRequest(BaseSchema):
    status: BranchStatus


class BranchSettingsUpdateRequest(BaseSchema):
    opening_hours: dict | None = None
    receipt_header: str | None = Field(default=None, max_length=500)
    receipt_footer: str | None = Field(default=None, max_length=500)
    extra_settings: dict | None = None


class BranchResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    name: str
    code: str
    status: str
    address: str | None
    city: str | None
    country: str | None
    phone: str | None
    email: str | None
    timezone: str
    currency: str
    manager_id: uuid.UUID | None
    is_main_branch: bool
    is_deleted: bool


class BranchSummaryResponse(BaseSchema):
    id: uuid.UUID
    name: str
    code: str
    status: str
    is_main_branch: bool
