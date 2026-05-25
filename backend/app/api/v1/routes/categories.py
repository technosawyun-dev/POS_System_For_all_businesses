from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, DbSession, EffectiveTenantId, RequestId, require_cashier_or_above, require_manager_or_above, require_tenant_admin
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.product import CategoryCreateRequest, CategoryResponse, CategoryUpdateRequest
from app.services.product_service import CategoryService

router = APIRouter()


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=201,
    summary="Create category",
    dependencies=[Depends(require_manager_or_above)],
)
async def create_category(
    payload: CategoryCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CategoryResponse:
    service = CategoryService(db)
    category = await service.create_category(
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CategoryResponse.model_validate(category)


@router.get(
    "",
    response_model=PaginatedResponse[CategoryResponse],
    summary="List categories",
    dependencies=[Depends(require_cashier_or_above)],
)
async def list_categories(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    parent_id: uuid.UUID | None = Query(default=None),
) -> PaginatedResponse[CategoryResponse]:
    service = CategoryService(db)
    categories, total = await service.list_categories(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        parent_id=parent_id,
    )
    return PaginatedResponse.create(
        items=[CategoryResponse.model_validate(c) for c in categories],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Get category",
    dependencies=[Depends(require_cashier_or_above)],
)
async def get_category(
    category_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> CategoryResponse:
    service = CategoryService(db)
    category = await service.get_category(category_id, tenant_id)
    return CategoryResponse.model_validate(category)


@router.patch(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Update category",
    dependencies=[Depends(require_manager_or_above)],
)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CategoryResponse:
    service = CategoryService(db)
    category = await service.update_category(
        category_id=category_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CategoryResponse.model_validate(category)


@router.delete(
    "/{category_id}",
    response_model=SuccessResponse,
    summary="Delete category",
    dependencies=[Depends(require_tenant_admin)],
)
async def delete_category(
    category_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SuccessResponse:
    service = CategoryService(db)
    await service.delete_category(
        category_id=category_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Category deleted successfully")
