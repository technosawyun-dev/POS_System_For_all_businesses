from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    RequestId,
    require_super_admin,
    require_tenant_admin,
)
from app.core.constants import TenantStatus
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.tenant import (
    TenantCreateRequest,
    TenantResponse,
    TenantStatusUpdateRequest,
    TenantUpdateRequest,
)
from app.services.tenant_service import TenantService

router = APIRouter()


@router.post(
    "",
    response_model=TenantResponse,
    status_code=201,
    summary="Create a new tenant",
    dependencies=[Depends(require_super_admin)],
)
async def create_tenant(
    payload: TenantCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> TenantResponse:
    service = TenantService(db)
    tenant = await service.create_tenant(data=payload, actor_id=current_user.id, request_id=request_id)
    return TenantResponse.model_validate(tenant)


@router.get(
    "",
    response_model=PaginatedResponse[TenantResponse],
    summary="List all tenants",
    dependencies=[Depends(require_super_admin)],
)
async def list_tenants(
    db: DbSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[TenantResponse]:
    service = TenantService(db)
    tenants, total = await service.list_tenants(page=page, page_size=page_size)
    return PaginatedResponse.create(
        items=[TenantResponse.model_validate(t) for t in tenants],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{tenant_id}",
    response_model=TenantResponse,
    summary="Get tenant by ID",
    dependencies=[Depends(require_tenant_admin)],
)
async def get_tenant(
    tenant_id: uuid.UUID,
    db: DbSession,
) -> TenantResponse:
    service = TenantService(db)
    tenant = await service.get_tenant(tenant_id)
    return TenantResponse.model_validate(tenant)


@router.patch(
    "/{tenant_id}",
    response_model=TenantResponse,
    summary="Update tenant",
    dependencies=[Depends(require_tenant_admin)],
)
async def update_tenant(
    tenant_id: uuid.UUID,
    payload: TenantUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> TenantResponse:
    service = TenantService(db)
    tenant = await service.update_tenant(
        tenant_id=tenant_id, data=payload, actor_id=current_user.id, request_id=request_id
    )
    return TenantResponse.model_validate(tenant)


@router.patch(
    "/{tenant_id}/status",
    response_model=TenantResponse,
    summary="Update tenant status",
    dependencies=[Depends(require_super_admin)],
)
async def update_tenant_status(
    tenant_id: uuid.UUID,
    payload: TenantStatusUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> TenantResponse:
    service = TenantService(db)
    tenant = await service.update_tenant_status(
        tenant_id=tenant_id, status=payload.status, actor_id=current_user.id, request_id=request_id
    )
    return TenantResponse.model_validate(tenant)


@router.delete(
    "/{tenant_id}",
    response_model=SuccessResponse,
    summary="Soft-delete tenant",
    dependencies=[Depends(require_super_admin)],
)
async def delete_tenant(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    service = TenantService(db)
    await service.soft_delete_tenant(tenant_id=tenant_id, actor_id=current_user.id, request_id=request_id)
    return SuccessResponse(message="Tenant deleted successfully")
