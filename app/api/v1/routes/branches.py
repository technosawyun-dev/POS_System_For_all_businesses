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
from app.schemas.branch import (
    BranchCreateRequest,
    BranchResponse,
    BranchUpdateRequest,
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.branch_service import BranchService

router = APIRouter()


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
    service = BranchService(db)
    branch = await service.create_branch(
        tenant_id=tenant_id, data=payload, actor_id=current_user.id, request_id=request_id
    )
    return BranchResponse.model_validate(branch)


@router.get(
    "",
    response_model=PaginatedResponse[BranchResponse],
    summary="List branches",
    dependencies=[Depends(require_manager_or_above)],
)
async def list_branches(
    tenant_id: uuid.UUID,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[BranchResponse]:
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
    dependencies=[Depends(require_manager_or_above)],
)
async def get_branch(
    tenant_id: uuid.UUID,
    branch_id: uuid.UUID,
    db: DbSession,
) -> BranchResponse:
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
    service = BranchService(db)
    branch = await service.update_branch(
        branch_id=branch_id,
        tenant_id=tenant_id,
        data=payload,
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
    service = BranchService(db)
    await service.soft_delete_branch(
        branch_id=branch_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Branch deleted successfully")
