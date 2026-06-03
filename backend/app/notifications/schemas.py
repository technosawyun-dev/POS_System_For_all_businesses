from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema


class NotificationSummaryResponse(BaseSchema):
    id: uuid.UUID
    type: str
    priority: str
    title: str
    message: str
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")
    expires_at: datetime | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime


class NotificationResponse(TimestampedSchema):
    tenant_id: uuid.UUID | None
    type: str
    priority: str
    title: str
    message: str
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")
    expires_at: datetime | None
    is_read: bool = False
    read_at: datetime | None = None


# Paginated alias used by the list endpoint
NotificationListResponse = PaginatedResponse[NotificationSummaryResponse]


class UnreadCountResponse(BaseSchema):
    unread_count: int


class NotificationPreferenceResponse(TimestampedSchema):
    user_id: uuid.UUID
    email_enabled: bool
    inventory_enabled: bool
    procurement_enabled: bool
    customer_enabled: bool
    subscription_enabled: bool
    security_enabled: bool


class NotificationPreferenceUpdateRequest(BaseSchema):
    email_enabled: bool | None = None
    inventory_enabled: bool | None = None
    procurement_enabled: bool | None = None
    customer_enabled: bool | None = None
    subscription_enabled: bool | None = None
    security_enabled: bool | None = None
