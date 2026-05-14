from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampedSchema


class ResellerAssignmentCreateRequest(BaseSchema):
    reseller_id: uuid.UUID
    tenant_id: uuid.UUID
    allowed_branch_ids: list[uuid.UUID] = Field(default_factory=list)
    restricted_permissions: list[str] = Field(default_factory=list)
    access_starts_at: datetime | None = None
    access_expires_at: datetime | None = None
    notes: str | None = None


class ResellerAssignmentUpdateRequest(BaseSchema):
    allowed_branch_ids: list[uuid.UUID] | None = None
    restricted_permissions: list[str] | None = None
    access_starts_at: datetime | None = None
    access_expires_at: datetime | None = None
    is_active: bool | None = None
    notes: str | None = None


class ResellerAssignmentResponse(TimestampedSchema):
    reseller_id: uuid.UUID
    tenant_id: uuid.UUID
    allowed_branch_ids: list
    restricted_permissions: list
    access_starts_at: datetime | None
    access_expires_at: datetime | None
    is_active: bool
    notes: str | None
    assigned_by_id: uuid.UUID | None
