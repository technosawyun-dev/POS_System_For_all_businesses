from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    require_cashier_or_above,
    require_inventory_access,
    require_manager_or_above,
    require_tenant_admin,
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.subscriptions.gates import validate_product_limit
from app.schemas.product import (
    PriceHistoryResponse,
    ProductCreateRequest,
    ProductDetailResponse,
    ProductResponse,
    ProductUpdateRequest,
    ProductVariantCreateRequest,
    ProductVariantResponse,
    ProductVariantUpdateRequest,
)
from app.services.product_service import ProductService

router = APIRouter()


@router.post(
    "",
    response_model=ProductResponse,
    status_code=201,
    summary="Create product",
    dependencies=[Depends(require_inventory_access), Depends(validate_product_limit)],
)
async def create_product(
    payload: ProductCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> ProductResponse:
    service = ProductService(db)
    product = await service.create_product(
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return ProductResponse.model_validate(product)


@router.get(
    "",
    response_model=PaginatedResponse[ProductResponse],
    summary="List products",
    dependencies=[Depends(require_cashier_or_above)],
)
async def list_products(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    category_id: uuid.UUID | None = Query(default=None),
    brand_id: uuid.UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
) -> PaginatedResponse[ProductResponse]:
    service = ProductService(db)
    products, total = await service.list_products(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        category_id=category_id,
        brand_id=brand_id,
        is_active=is_active,
        search=search,
    )
    return PaginatedResponse.create(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/barcode/{barcode}",
    response_model=ProductDetailResponse,
    summary="Lookup product by barcode",
    dependencies=[Depends(require_cashier_or_above)],
)
async def get_by_barcode(
    barcode: str,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> ProductDetailResponse:
    service = ProductService(db)
    product = await service.get_by_barcode(tenant_id, barcode)
    return ProductDetailResponse.model_validate(product)


@router.get(
    "/sku/{sku}",
    response_model=ProductResponse,
    summary="Lookup product by SKU",
    dependencies=[Depends(require_cashier_or_above)],
)
async def get_by_sku(
    sku: str,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> ProductResponse:
    service = ProductService(db)
    product = await service.get_by_sku(tenant_id, sku)
    return ProductResponse.model_validate(product)


@router.get(
    "/{product_id}",
    response_model=ProductDetailResponse,
    summary="Get product with variants",
    dependencies=[Depends(require_cashier_or_above)],
)
async def get_product(
    product_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> ProductDetailResponse:
    service = ProductService(db)
    product = await service.get_product_detail(product_id, tenant_id)
    return ProductDetailResponse.model_validate(product)


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update product",
    dependencies=[Depends(require_inventory_access)],
)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> ProductResponse:
    service = ProductService(db)
    product = await service.update_product(
        product_id=product_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return ProductResponse.model_validate(product)


@router.delete(
    "/{product_id}",
    response_model=SuccessResponse,
    summary="Delete product",
    dependencies=[Depends(require_manager_or_above)],
)
async def delete_product(
    product_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SuccessResponse:
    service = ProductService(db)
    await service.delete_product(
        product_id=product_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Product deleted successfully")


@router.get(
    "/{product_id}/price-history",
    response_model=PaginatedResponse[PriceHistoryResponse],
    summary="Get product price history",
    dependencies=[Depends(require_manager_or_above)],
)
async def get_price_history(
    product_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedResponse[PriceHistoryResponse]:
    service = ProductService(db)
    history, total = await service.get_price_history(
        product_id=product_id,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[PriceHistoryResponse.model_validate(h) for h in history],
        total=total,
        page=page,
        page_size=page_size,
    )


# Variants

@router.post(
    "/{product_id}/variants",
    response_model=ProductVariantResponse,
    status_code=201,
    summary="Add product variant",
    dependencies=[Depends(require_inventory_access)],
)
async def add_variant(
    product_id: uuid.UUID,
    payload: ProductVariantCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> ProductVariantResponse:
    service = ProductService(db)
    variant = await service.add_variant(
        product_id=product_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return ProductVariantResponse.model_validate(variant)


@router.patch(
    "/{product_id}/variants/{variant_id}",
    response_model=ProductVariantResponse,
    summary="Update product variant",
    dependencies=[Depends(require_inventory_access)],
)
async def update_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: ProductVariantUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> ProductVariantResponse:
    service = ProductService(db)
    variant = await service.update_variant(
        product_id=product_id,
        variant_id=variant_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return ProductVariantResponse.model_validate(variant)


@router.delete(
    "/{product_id}/variants/{variant_id}",
    response_model=SuccessResponse,
    summary="Delete product variant",
    dependencies=[Depends(require_manager_or_above)],
)
async def delete_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SuccessResponse:
    service = ProductService(db)
    await service.delete_variant(
        product_id=product_id,
        variant_id=variant_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Variant deleted successfully")
