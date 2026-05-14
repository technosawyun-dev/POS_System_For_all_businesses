from __future__ import annotations

import uuid

from app.models.user import User

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    DbSession,
    EffectiveTenantId,
    require_roles,
)
from app.core.constants import UserRole
from app.devices.schemas import (
    DeviceListResponse,
    DeviceRegisterRequest,
    DeviceResponse,
    DeviceUpdateRequest,
)
from app.devices.services import DeviceService

router = APIRouter()

_manage_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)
_view_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)
_admin_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
)


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a POS device",
)
async def register_device(
    data: DeviceRegisterRequest,
    db: DbSession,
    current_user: User = _manage_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> DeviceResponse:
    svc = DeviceService(db)
    device = await svc.register_device(
        tenant_id=tenant_id,
        branch_id=data.branch_id,
        device_uuid=data.device_uuid,
        device_name=data.device_name,
        platform=data.platform,
        app_version=data.app_version,
        actor_user_id=current_user.id,
    )
    return DeviceResponse.model_validate(device)


@router.get(
    "",
    response_model=DeviceListResponse,
    summary="List registered devices",
)
async def list_devices(
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    branch_id: uuid.UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> DeviceListResponse:
    svc = DeviceService(db)
    items, total = await svc.list_devices(
        tenant_id=tenant_id,
        branch_id=branch_id,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    return DeviceListResponse(
        items=[DeviceResponse.model_validate(d) for d in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Get device by ID",
)
async def get_device(
    device_id: uuid.UUID,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> DeviceResponse:
    svc = DeviceService(db)
    device = await svc.get_device(device_id, tenant_id)
    return DeviceResponse.model_validate(device)


@router.patch(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Update device metadata",
)
async def update_device(
    device_id: uuid.UUID,
    data: DeviceUpdateRequest,
    db: DbSession,
    current_user: User = _manage_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> DeviceResponse:
    svc = DeviceService(db)
    device = await svc.update_device(
        device_id=device_id,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        device_name=data.device_name,
        app_version=data.app_version,
    )
    return DeviceResponse.model_validate(device)


@router.post(
    "/{device_id}/deactivate",
    response_model=DeviceResponse,
    summary="Deactivate a device",
)
async def deactivate_device(
    device_id: uuid.UUID,
    db: DbSession,
    current_user: User = _admin_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> DeviceResponse:
    svc = DeviceService(db)
    device = await svc.deactivate_device(
        device_id=device_id,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
    )
    return DeviceResponse.model_validate(device)


@router.post(
    "/{device_id}/heartbeat",
    response_model=DeviceResponse,
    summary="Update device last-seen timestamp",
)
async def device_heartbeat(
    device_id: uuid.UUID,
    db: DbSession,
    current_user: User = _manage_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> DeviceResponse:
    svc = DeviceService(db)
    device = await svc.touch_heartbeat(device_id, tenant_id)
    return DeviceResponse.model_validate(device)
