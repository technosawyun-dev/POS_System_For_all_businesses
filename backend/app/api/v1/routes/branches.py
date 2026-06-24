from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    RequestId,
    require_manager_or_above,
    require_tenant_admin,
)
from app.subscriptions.entitlements import EntitlementService, TenantSubscriptionValidator
from app.schemas.branch import (
    BranchCreateRequest,
    BranchResponse,
    BranchStatusUpdateRequest,
    BranchUpdateRequest,
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.branch_service import BranchService

router = APIRouter()


def _assert_tenant_access(current_user, tenant_id: uuid.UUID) -> None:
    """Raise AuthorizationError when the caller's tenant does not match the path tenant.

    SUPER_ADMIN bypasses this check and may operate on any tenant.
    All other roles (including RESELLER) must own the tenant in their JWT.
    """
    from app.core.constants import UserRole
    from app.core.exceptions import AuthorizationError
    if current_user.role == UserRole.SUPER_ADMIN.value:
        return
    if not current_user.tenant_id or current_user.tenant_id != tenant_id:
        raise AuthorizationError("Access denied: you do not have permission for this tenant")


@router.post(
    "",
    response_model=BranchResponse,
    status_code=201,
    summary="Create branch",
    dependencies=[Depends(require_tenant_admin)],
)
async def create_branch(
    tenant_id: uuid.UUID,
    payload: BranchCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> BranchResponse:
    _assert_tenant_access(current_user, tenant_id)
    from app.core.constants import BranchStatus, UserRole
    from app.models.branch import Branch
    from sqlalchemy import func, select

    if current_user.role != UserRole.SUPER_ADMIN.value:
        # Validate subscription is active
        await TenantSubscriptionValidator(db).validate_subscription_active(tenant_id)
        # Validate branch limit
        result = await db.execute(
            select(func.count()).select_from(Branch).where(
                Branch.tenant_id == tenant_id,
                Branch.status != BranchStatus.CLOSED,
            )
        )
        count = result.scalar_one()
        await EntitlementService(db).validate_limit(tenant_id, "branches", count)

    service = BranchService(db)
    branch = await service.create_branch(
        tenant_id=tenant_id, data=payload, actor_id=current_user.id, request_id=request_id
    )
    return BranchResponse.model_validate(branch)


@router.get(
    "",
    response_model=PaginatedResponse[BranchResponse],
    summary="List branches",
)
async def list_branches(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedResponse[BranchResponse]:
    _assert_tenant_access(current_user, tenant_id)
    service = BranchService(db)
    branches, total = await service.list_branches(tenant_id=tenant_id, page=page, page_size=page_size)
    return PaginatedResponse.create(
        items=[BranchResponse.model_validate(b) for b in branches],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{branch_id}",
    response_model=BranchResponse,
    summary="Get branch by ID",
)
async def get_branch(
    tenant_id: uuid.UUID,
    branch_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> BranchResponse:
    _assert_tenant_access(current_user, tenant_id)
    service = BranchService(db)
    branch = await service.get_branch(branch_id=branch_id, tenant_id=tenant_id)
    return BranchResponse.model_validate(branch)


@router.patch(
    "/{branch_id}",
    response_model=BranchResponse,
    summary="Update branch",
    dependencies=[Depends(require_tenant_admin)],
)
async def update_branch(
    tenant_id: uuid.UUID,
    branch_id: uuid.UUID,
    payload: BranchUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> BranchResponse:
    _assert_tenant_access(current_user, tenant_id)
    service = BranchService(db)
    branch = await service.update_branch(
        branch_id=branch_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return BranchResponse.model_validate(branch)


@router.patch(
    "/{branch_id}/status",
    response_model=BranchResponse,
    summary="Update branch status (activate/deactivate)",
    dependencies=[Depends(require_tenant_admin)],
)
async def update_branch_status(
    tenant_id: uuid.UUID,
    branch_id: uuid.UUID,
    payload: BranchStatusUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> BranchResponse:
    _assert_tenant_access(current_user, tenant_id)
    service = BranchService(db)
    branch = await service.update_branch_status(
        branch_id=branch_id,
        tenant_id=tenant_id,
        status=payload.status,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return BranchResponse.model_validate(branch)


@router.delete(
    "/{branch_id}",
    response_model=SuccessResponse,
    summary="Soft-delete branch",
    dependencies=[Depends(require_tenant_admin)],
)
async def delete_branch(
    tenant_id: uuid.UUID,
    branch_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    _assert_tenant_access(current_user, tenant_id)
    service = BranchService(db)
    await service.soft_delete_branch(
        branch_id=branch_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Branch deleted successfully")
