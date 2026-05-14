from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.core.constants import SyncEntityType, SyncOperationType


# Push Schemas

class SyncOperationInput(BaseModel):
    """A single offline operation to replay on the server."""

    operation_uuid: str = Field(
        ...,
        max_length=100,
        description="Device-generated UUID for idempotency. Must be unique per tenant.",
    )
    operation_type: SyncOperationType
    entity_type: str = Field(..., max_length=50)
    payload: dict[str, Any] = Field(..., description="Operation-specific data")
    operation_timestamp: datetime = Field(
        ..., description="When the operation was performed offline"
    )


class SyncPushRequest(BaseModel):
    device_id: uuid.UUID
    branch_id: uuid.UUID
    operations: list[SyncOperationInput] = Field(
        ..., min_length=1, max_length=100, description="Batch of offline operations (max 100)"
    )


class SyncOperationResult(BaseModel):
    operation_uuid: str
    status: str
    entity_id: uuid.UUID | None = None
    entity_type: str | None = None
    result_snapshot: dict[str, Any] | None = None
    error: str | None = None
    replayed: bool = False


class SyncPushResponse(BaseModel):
    processed_count: int
    failed_count: int
    skipped_count: int = 0
    results: list[SyncOperationResult]
    sync_timestamp: datetime


# Pull Schemas

class SyncCheckpointInfo(BaseModel):
    entity_type: str
    last_synced_at: datetime
    last_sync_version: int


class SyncEntityBundle(BaseModel):
    entity_type: str
    items: list[dict[str, Any]]
    total: int
    has_more: bool


class SyncPullResponse(BaseModel):
    entities: dict[str, SyncEntityBundle]
    checkpoints: dict[str, SyncCheckpointInfo]
    sync_timestamp: datetime


# Checkpoint Schemas

class SyncCheckpointResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    device_id: uuid.UUID
    entity_type: str
    last_synced_at: datetime
    last_sync_version: int
    created_at: datetime
    updated_at: datetime


# Operation Schemas

class SyncOperationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID
    device_id: uuid.UUID
    operation_uuid: str
    operation_type: str
    entity_type: str
    entity_id: uuid.UUID | None
    payload: dict[str, Any]
    result_snapshot: dict[str, Any] | None
    operation_timestamp: datetime
    processed_at: datetime | None
    failed_at: datetime | None
    retry_count: int
    status: str
    error_message: str | None
    created_at: datetime


class SyncOperationListResponse(BaseModel):
    items: list[SyncOperationResponse]
    total: int
    page: int
    page_size: int
