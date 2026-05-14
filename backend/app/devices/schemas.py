from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import DevicePlatform


class DeviceRegisterRequest(BaseModel):
    device_uuid: str = Field(..., max_length=100)
    device_name: str = Field(..., max_length=200)
    branch_id: uuid.UUID
    platform: DevicePlatform
    app_version: str | None = Field(None, max_length=50)


class DeviceUpdateRequest(BaseModel):
    device_name: str | None = Field(None, max_length=200)
    app_version: str | None = Field(None, max_length=50)


class DeviceResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    device_uuid: str
    device_name: str
    platform: str
    app_version: str | None
    last_seen_at: datetime | None
    last_sync_at: datetime | None
    is_active: bool
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class DeviceListResponse(BaseModel):
    items: list[DeviceResponse]
    total: int
    page: int
    page_size: int
