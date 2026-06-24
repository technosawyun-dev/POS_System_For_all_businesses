from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema


class ResellerAssignmentCreateRequest(BaseSchema):
    reseller_id: uuid.UUID
    tenant_id: uuid.UUID
    allowed_branch_ids: list[uuid.UUID] = Field(default_factory=list)
    restricted_permissions: list[str] = Field(default_factory=list)
    access_starts_at: datetime | None = None
    access_expires_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=500)


class ResellerAssignmentUpdateRequest(BaseSchema):
    allowed_branch_ids: list[uuid.UUID] | None = None
    restricted_permissions: list[str] | None = None
    access_starts_at: datetime | None = None
    access_expires_at: datetime | None = None
    is_active: bool | None = None
    notes: str | None = Field(default=None, max_length=500)


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


PaginatedResellerAssignments = PaginatedResponse[ResellerAssignmentResponse]



class MyBusinessResponse(TimestampedSchema):
    """One tenant assignment returned by GET /resellers/me/businesses."""
    tenant_id: uuid.UUID
    allowed_branch_ids: list[uuid.UUID]
    restricted_permissions: list[str]
    access_starts_at: datetime | None
    access_expires_at: datetime | None
    is_active: bool
    is_access_valid: bool


class MyBranchResponse(BaseSchema):
    """Accessible branches for a single tenant. Empty branch_ids means all branches."""
    tenant_id: uuid.UUID
    branch_ids: list[uuid.UUID]
    all_branches_allowed: bool


class MyPermissionsResponse(BaseSchema):
    """
    Per-tenant permission summary using the RESELLER_PERMISSION_MAP spec names.
    True = allowed, False = denied (in restricted_permissions).
    """
    tenant_id: uuid.UUID
    permissions: dict[str, bool]
