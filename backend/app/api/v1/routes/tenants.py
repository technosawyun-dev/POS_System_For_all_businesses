from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import (
    CurrentUser,
    DbSession,
    RequestId,
    require_super_admin,
    require_tenant_admin,
)
from app.core.constants import UserRole
from app.core.exceptions import AuthorizationError
from app.core.constants import TenantStatus
from app.core.upload import delete_receipt_logo, get_receipt_logo_path, save_receipt_logo
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.tenant import (
    TenantCreateRequest,
    TenantResponse,
    TenantSettingsResponse,
    TenantSettingsUpdateRequest,
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
    page_size: int = Query(default=20, ge=1, le=500),
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
)
async def get_tenant(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> TenantResponse:
    # SUPER_ADMIN can read any tenant; all other roles can only read their own
    if current_user.role != UserRole.SUPER_ADMIN.value:
        if current_user.tenant_id is None or str(current_user.tenant_id) != str(tenant_id):
            raise AuthorizationError("You can only view your own tenant")
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
    if current_user.role == UserRole.RESELLER.value:
        from app.reseller_finance.routes.reseller_routes import _assert_referred_tenant
        await _assert_referred_tenant(db, current_user.id, tenant_id)
    elif current_user.role != UserRole.SUPER_ADMIN.value:
        if not current_user.tenant_id or str(current_user.tenant_id) != str(tenant_id):
            raise AuthorizationError("You can only update your own tenant")
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


@router.get(
    "/{tenant_id}/settings",
    response_model=TenantSettingsResponse,
    summary="Get tenant settings",
)
async def get_tenant_settings(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> TenantSettingsResponse:
    # Any authenticated user may read their own tenant's settings (needed for tax/payment at checkout).
    # SUPER_ADMIN may read any tenant's settings.
    if current_user.role != UserRole.SUPER_ADMIN.value:
        if current_user.tenant_id is None or str(current_user.tenant_id) != str(tenant_id):
            raise AuthorizationError("You can only view your own tenant settings")
    service = TenantService(db)
    settings = await service.get_tenant_settings(tenant_id)
    return TenantSettingsResponse.model_validate(settings)


@router.patch(
    "/{tenant_id}/settings",
    response_model=TenantSettingsResponse,
    summary="Update tenant settings",
    dependencies=[Depends(require_tenant_admin)],
)
async def update_tenant_settings(
    tenant_id: uuid.UUID,
    payload: TenantSettingsUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> TenantSettingsResponse:
    if payload.features_enabled is not None and current_user.role != UserRole.SUPER_ADMIN.value:
        raise AuthorizationError("Only a super admin can update POS access features")
    if current_user.role == UserRole.RESELLER.value:
        from app.reseller_finance.routes.reseller_routes import _assert_referred_tenant
        await _assert_referred_tenant(db, current_user.id, tenant_id)
    elif current_user.role != UserRole.SUPER_ADMIN.value:
        if not current_user.tenant_id or str(current_user.tenant_id) != str(tenant_id):
            raise AuthorizationError("You can only update your own tenant settings")
    service = TenantService(db)
    settings = await service.update_tenant_settings(tenant_id, payload)
    return TenantSettingsResponse.model_validate(settings)


@router.post(
    "/{tenant_id}/logo",
    response_model=TenantSettingsResponse,
    summary="Upload receipt logo (JPEG or PNG, max 2 MB)",
    dependencies=[Depends(require_tenant_admin)],
)
async def upload_tenant_logo(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> TenantSettingsResponse:
    if current_user.role != UserRole.SUPER_ADMIN.value:
        if not current_user.tenant_id or str(current_user.tenant_id) != str(tenant_id):
            raise AuthorizationError("You can only manage your own tenant's logo")
    url = await save_receipt_logo(file, tenant_id)
    service = TenantService(db)
    settings = await service.update_tenant_settings(
        tenant_id,
        TenantSettingsUpdateRequest(extra_settings={"receipt_logo_url": url}),
    )
    return TenantSettingsResponse.model_validate(settings)


@router.get(
    "/{tenant_id}/logo",
    summary="Download receipt logo (authenticated — own tenant only)",
)
async def get_tenant_logo(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> FileResponse:
    # Any member of the same tenant can fetch their own logo (needed for receipt preview)
    if current_user.role != UserRole.SUPER_ADMIN.value:
        if not current_user.tenant_id or str(current_user.tenant_id) != str(tenant_id):
            raise AuthorizationError("You can only view your own tenant's logo")
    result = get_receipt_logo_path(tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No logo uploaded for this tenant")
    path, mime = result
    return FileResponse(str(path), media_type=mime)


@router.delete(
    "/{tenant_id}/logo",
    response_model=SuccessResponse,
    summary="Remove receipt logo",
    dependencies=[Depends(require_tenant_admin)],
)
async def delete_tenant_logo(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> SuccessResponse:
    if current_user.role != UserRole.SUPER_ADMIN.value:
        if not current_user.tenant_id or str(current_user.tenant_id) != str(tenant_id):
            raise AuthorizationError("You can only manage your own tenant's logo")
    delete_receipt_logo(tenant_id)
    service = TenantService(db)
    await service.update_tenant_settings(
        tenant_id,
        TenantSettingsUpdateRequest(extra_settings={"receipt_logo_url": None}),
    )
    return SuccessResponse(message="Logo removed successfully")


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
