from __future__ import annotations

import uuid

from pydantic import EmailStr, Field

from app.core.constants import SupplierStatus
from app.schemas.common import BaseSchema, TimestampedSchema


class SupplierContactCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    position: str | None = Field(default=None, max_length=100)
    is_primary: bool = False


class SupplierContactUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    position: str | None = Field(default=None, max_length=100)
    is_primary: bool | None = None


class SupplierContactResponse(TimestampedSchema):
    supplier_id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    position: str | None
    is_primary: bool
    is_deleted: bool


class SupplierCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class SupplierUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=255)
    status: SupplierStatus | None = None
    notes: str | None = None


class SupplierResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    name: str
    code: str
    email: str | None
    phone: str | None
    address: str | None
    city: str | None
    country: str | None
    website: str | None
    status: str
    notes: str | None
    is_deleted: bool
    contacts: list[SupplierContactResponse] = Field(default_factory=list)


class SupplierSummaryResponse(BaseSchema):
    id: uuid.UUID
    name: str
    code: str
    status: str
