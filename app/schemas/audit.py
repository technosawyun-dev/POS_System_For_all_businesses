from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import AliasChoices, Field

from app.schemas.common import BaseSchema, TimestampedSchema


class AuditLogResponse(TimestampedSchema):
    actor_user_id: uuid.UUID | None
    tenant_id: uuid.UUID | None
    branch_id: uuid.UUID | None
    action: str
    entity_type: str | None
    entity_id: str | None
    before_state: dict[str, Any] | None
    after_state: dict[str, Any] | None
    # "metadata" is a reserved SQLAlchemy attr — ORM object exposes it as metadata_
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("metadata_", "metadata"),
    )
    ip_address: str | None
    user_agent: str | None
    request_id: str | None


class AuditLogFilterParams(BaseSchema):
    actor_user_id: uuid.UUID | None = None
    tenant_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    action: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
