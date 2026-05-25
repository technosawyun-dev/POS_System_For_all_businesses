from __future__ import annotations

import uuid
from datetime import datetime

from app.models.user import User

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    DbSession,
    EffectiveTenantId,
    RequestId,
    get_effective_tenant_id,
    require_roles,
)
from app.core.constants import SyncEntityType, UserRole
from app.sync.repositories import SyncOperationRepository
from app.sync.schemas import (
    SyncOperationListResponse,
    SyncOperationResponse,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.sync.services.pull_service import SyncPullService
from app.sync.services.push_service import SyncPushService

router = APIRouter()

_sync_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)
_view_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
)

_ALL_ENTITY_TYPES = [e.value for e in SyncEntityType]


@router.post(
    "/push",
    response_model=SyncPushResponse,
    status_code=status.HTTP_200_OK,
    summary="Push offline operations",
    description=(
        "Upload a batch of offline operations from a device. "
        "Each operation is replayed idempotently — duplicate operation_uuids "
        "return the cached result without re-executing."
    ),
)
async def sync_push(
    data: SyncPushRequest,
    db: DbSession,
    current_user: User = _sync_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
) -> SyncPushResponse:
    svc = SyncPushService(db)
    return await svc.push(
        tenant_id=tenant_id,
        data=data,
        actor_user_id=current_user.id,
    )


@router.get(
    "/pull",
    response_model=SyncPullResponse,
    summary="Pull changed data (delta sync)",
    description=(
        "Download records that changed since the device's last checkpoint. "
        "Specify entity_types to limit the pull to relevant data. "
        "Checkpoints are updated automatically."
    ),
)
async def sync_pull(
    db: DbSession,
    current_user: User = _sync_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
    device_id: uuid.UUID = Query(..., description="The device pulling data"),
    entity_types: list[str] = Query(
        default=_ALL_ENTITY_TYPES,
        description="Entity types to pull (products, variants, inventory, categories, branches, settings, prices)",
    ),
    since_at: datetime | None = Query(
        default=None,
        description="Override checkpoint — return records updated after this time",
    ),
    page_size: int = Query(default=200, ge=1, le=1000),
) -> SyncPullResponse:
    svc = SyncPullService(db)
    return await svc.pull(
        tenant_id=tenant_id,
        device_id=device_id,
        entity_types=entity_types,
        since_at=since_at,
        page_size=page_size,
    )


@router.get(
    "/operations",
    response_model=SyncOperationListResponse,
    summary="List sync operations (audit/debug)",
)
async def list_sync_operations(
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
    device_id: uuid.UUID | None = Query(default=None),
    op_status: str | None = Query(default=None, alias="status"),
    operation_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> SyncOperationListResponse:
    repo = SyncOperationRepository(db)
    items, total = await repo.get_for_tenant(
        tenant_id=tenant_id,
        device_id=device_id,
        status=op_status,
        operation_type=operation_type,
        page=page,
        page_size=page_size,
    )
    return SyncOperationListResponse(
        items=[SyncOperationResponse.model_validate(op) for op in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/operations/{operation_id}",
    response_model=SyncOperationResponse,
    summary="Get sync operation by ID",
)
async def get_sync_operation(
    operation_id: uuid.UUID,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
) -> SyncOperationResponse:
    from app.core.exceptions import NotFoundError
    repo = SyncOperationRepository(db)
    op = await repo.get_by_id(operation_id)
    if not op or op.tenant_id != tenant_id:
        raise NotFoundError("SyncOperation", operation_id)
    return SyncOperationResponse.model_validate(op)
