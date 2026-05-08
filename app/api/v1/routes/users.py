from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    ClientIp,
    CurrentUser,
    DbSession,
    RequestId,
    UserAgent,
    require_manager_or_above,
    require_super_admin,
    require_tenant_admin,
)
from app.core.constants import UserRole, UserStatus
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.user import (
    UserCreateRequest,
    UserResponse,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
    UserUpdateRequest,
)
from app.services.user_service import UserService

router = APIRouter()


@router.post(
    "",
    response_model=UserResponse,
    status_code=201,
    summary="Create a new user",
    description=(
        "Creates a user within the caller's tenant. "
        "SUPER_ADMIN must pass `?tenant_id=` query param to specify which tenant."
    ),
    dependencies=[Depends(require_tenant_admin)],
)
async def create_user(
    payload: UserCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: str | None = Query(default=None, description="Target tenant (SUPER_ADMIN only)"),
) -> UserResponse:
    from app.core.constants import UserRole as _Role
    from app.core.exceptions import AuthorizationError, ValidationError
    import uuid as _uuid

    if current_user.tenant_id:
        effective_tenant_id = current_user.tenant_id
    elif current_user.role == _Role.SUPER_ADMIN and tenant_id:
        effective_tenant_id = _uuid.UUID(tenant_id)
    else:
        raise ValidationError("tenant_id query param is required for SUPER_ADMIN")

    service = UserService(db)
    user = await service.create_user(
        data=payload,
        actor_id=current_user.id,
        actor_tenant_id=effective_tenant_id,
        request_id=request_id,
    )
    return UserResponse.model_validate(user)


@router.get(
    "",
    response_model=PaginatedResponse[UserResponse],
    summary="List users",
    dependencies=[Depends(require_manager_or_above)],
)
async def list_users(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant_id: str | None = Query(default=None, description="Filter by tenant (super admin only)"),
) -> PaginatedResponse[UserResponse]:
    from app.core.constants import UserRole
    import uuid as _uuid
    service = UserService(db)
    effective_tenant_id = current_user.tenant_id
    if current_user.role == UserRole.SUPER_ADMIN and tenant_id:
        effective_tenant_id = _uuid.UUID(tenant_id)
    if not effective_tenant_id:
        return PaginatedResponse.create(items=[], total=0, page=page, page_size=page_size)
    users, total = await service.list_users(tenant_id=effective_tenant_id, page=page, page_size=page_size)
    return PaginatedResponse.create(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    dependencies=[Depends(require_manager_or_above)],
)
async def get_user(
    user_id: uuid.UUID,
    db: DbSession,
) -> UserResponse:
    service = UserService(db)
    user = await service.get_user(user_id)
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user profile",
    dependencies=[Depends(require_manager_or_above)],
)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> UserResponse:
    service = UserService(db)
    user = await service.update_user(
        user_id=user_id,
        data=payload,
        actor_id=current_user.id,
        tenant_id=current_user.tenant_id,
        request_id=request_id,
    )
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    summary="Update user status",
    dependencies=[Depends(require_tenant_admin)],
)
async def update_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> UserResponse:
    service = UserService(db)
    user = await service.update_user_status(
        user_id=user_id,
        status=payload.status,
        actor_id=current_user.id,
        tenant_id=current_user.tenant_id,
        request_id=request_id,
    )
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}/role",
    response_model=UserResponse,
    summary="Update user role",
    dependencies=[Depends(require_tenant_admin)],
)
async def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> UserResponse:
    service = UserService(db)
    user = await service.update_user_role(
        user_id=user_id,
        role=payload.role,
        actor_id=current_user.id,
        tenant_id=current_user.tenant_id,
        request_id=request_id,
    )
    return UserResponse.model_validate(user)


@router.delete(
    "/{user_id}",
    response_model=SuccessResponse,
    summary="Soft-delete user",
    dependencies=[Depends(require_tenant_admin)],
)
async def delete_user(
    user_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    service = UserService(db)
    await service.soft_delete_user(
        user_id=user_id,
        actor_id=current_user.id,
        tenant_id=current_user.tenant_id,
        request_id=request_id,
    )
    return SuccessResponse(message="User deleted successfully")
