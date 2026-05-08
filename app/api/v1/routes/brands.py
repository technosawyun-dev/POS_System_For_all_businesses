from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, DbSession, EffectiveTenantId, RequestId, require_manager_or_above, require_tenant_admin
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.product import BrandCreateRequest, BrandResponse, BrandUpdateRequest
from app.services.product_service import BrandService

router = APIRouter()


@router.post(
    "",
    response_model=BrandResponse,
    status_code=201,
    summary="Create brand",
    dependencies=[Depends(require_manager_or_above)],
)
async def create_brand(
    payload: BrandCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> BrandResponse:
    service = BrandService(db)
    brand = await service.create_brand(
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return BrandResponse.model_validate(brand)


@router.get(
    "",
    response_model=PaginatedResponse[BrandResponse],
    summary="List brands",
    dependencies=[Depends(require_manager_or_above)],
)
async def list_brands(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[BrandResponse]:
    service = BrandService(db)
    brands, total = await service.list_brands(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[BrandResponse.model_validate(b) for b in brands],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{brand_id}",
    response_model=BrandResponse,
    summary="Get brand",
    dependencies=[Depends(require_manager_or_above)],
)
async def get_brand(
    brand_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> BrandResponse:
    service = BrandService(db)
    brand = await service.get_brand(brand_id, tenant_id)
    return BrandResponse.model_validate(brand)


@router.patch(
    "/{brand_id}",
    response_model=BrandResponse,
    summary="Update brand",
    dependencies=[Depends(require_manager_or_above)],
)
async def update_brand(
    brand_id: uuid.UUID,
    payload: BrandUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> BrandResponse:
    service = BrandService(db)
    brand = await service.update_brand(
        brand_id=brand_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return BrandResponse.model_validate(brand)


@router.delete(
    "/{brand_id}",
    response_model=SuccessResponse,
    summary="Delete brand",
    dependencies=[Depends(require_tenant_admin)],
)
async def delete_brand(
    brand_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SuccessResponse:
    service = BrandService(db)
    await service.delete_brand(
        brand_id=brand_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Brand deleted successfully")
