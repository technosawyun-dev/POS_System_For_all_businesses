from __future__ import annotations

from app.models.user import User

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ClientIp,
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    UserAgent,
    require_roles,
)
from app.core.constants import UserRole
from app.sales.schemas import (
    CartCreateRequest,
    CartItemRequest,
    CartItemUpdateRequest,
    CartResponse,
    CartTotalsResponse,
    CheckoutRequest,
    OrderListResponse,
    OrderResponse,
    VoidOrderRequest,
)
from app.sales.services.cart_service import CartService
from app.sales.services.checkout_service import (
    CheckoutInput,
    CheckoutItemInput,
    CheckoutPaymentInput,
    CheckoutService,
)
from app.sales.services.order_service import OrderService

router = APIRouter()

_sales_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)
_void_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
)
_view_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)


# Cart Endpoints

@router.post(
    "/carts",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create cart",
)
async def create_cart(
    data: CartCreateRequest,
    db: DbSession,
    current_user: User = _sales_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> CartResponse:
    svc = CartService(db)
    cart = await svc.create_cart(
        tenant_id=tenant_id,
        branch_id=data.branch_id,
        cashier_session_id=data.cashier_session_id,
        customer_id=data.customer_id,
        notes=data.notes,
    )
    totals = svc.preview_totals(cart)
    response = CartResponse.model_validate(cart)
    response.totals = CartTotalsResponse(**totals)
    return response


@router.get(
    "/carts/{cart_id}",
    response_model=CartResponse,
    summary="Get cart",
)
async def get_cart(
    cart_id: uuid.UUID,
    db: DbSession,
    current_user: User = _sales_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> CartResponse:
    svc = CartService(db)
    cart = await svc.get_cart(cart_id, tenant_id)
    totals = svc.preview_totals(cart)
    response = CartResponse.model_validate(cart)
    response.totals = CartTotalsResponse(**totals)
    return response


@router.post(
    "/carts/{cart_id}/items",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add item to cart",
)
async def add_cart_item(
    cart_id: uuid.UUID,
    data: CartItemRequest,
    db: DbSession,
    current_user: User = _sales_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> CartResponse:
    svc = CartService(db)
    cart = await svc.add_item(
        cart_id=cart_id,
        tenant_id=tenant_id,
        product_id=data.product_id,
        variant_id=data.variant_id,
        quantity=data.quantity,
        unit_price=data.unit_price,
        discount_amount=data.discount_amount,
        tax_rate=data.tax_rate,
        notes=data.notes,
    )
    totals = svc.preview_totals(cart)
    response = CartResponse.model_validate(cart)
    response.totals = CartTotalsResponse(**totals)
    return response


@router.patch(
    "/carts/{cart_id}/items/{item_id}",
    response_model=CartResponse,
    summary="Update cart item",
)
async def update_cart_item(
    cart_id: uuid.UUID,
    item_id: uuid.UUID,
    data: CartItemUpdateRequest,
    db: DbSession,
    current_user: User = _sales_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> CartResponse:
    svc = CartService(db)
    cart = await svc.update_item(
        cart_id=cart_id,
        item_id=item_id,
        tenant_id=tenant_id,
        quantity=data.quantity,
        unit_price=data.unit_price,
        discount_amount=data.discount_amount,
        tax_rate=data.tax_rate,
    )
    totals = svc.preview_totals(cart)
    response = CartResponse.model_validate(cart)
    response.totals = CartTotalsResponse(**totals)
    return response


@router.delete(
    "/carts/{cart_id}/items/{item_id}",
    response_model=CartResponse,
    summary="Remove item from cart",
)
async def remove_cart_item(
    cart_id: uuid.UUID,
    item_id: uuid.UUID,
    db: DbSession,
    current_user: User = _sales_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> CartResponse:
    svc = CartService(db)
    cart = await svc.remove_item(cart_id, item_id, tenant_id)
    totals = svc.preview_totals(cart)
    response = CartResponse.model_validate(cart)
    response.totals = CartTotalsResponse(**totals)
    return response


@router.delete(
    "/carts/{cart_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete cart",
)
async def delete_cart(
    cart_id: uuid.UUID,
    db: DbSession,
    current_user: User = _sales_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> None:
    svc = CartService(db)
    await svc.delete_cart(cart_id, tenant_id)


# Checkout Endpoint

@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Transactional checkout",
    description=(
        "ALL-OR-NOTHING checkout. Creates order, deducts inventory via SALE stock movements, "
        "records payments, and generates receipt in a single database transaction."
    ),
)
async def checkout(
    data: CheckoutRequest,
    db: DbSession,
    current_user: User = _sales_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    request_id: str = Depends(RequestId),
) -> OrderResponse:
    svc = CheckoutService(db)
    checkout_input = CheckoutInput(
        cashier_session_id=data.cashier_session_id,
        items=[
            CheckoutItemInput(
                product_id=item.product_id,
                variant_id=item.variant_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_amount=item.discount_amount,
                tax_rate=item.tax_rate,
                notes=item.notes,
            )
            for item in data.items
        ],
        payments=[
            CheckoutPaymentInput(
                payment_method=pmt.payment_method,
                amount=pmt.amount,
                reference_number=pmt.reference_number,
                notes=pmt.notes,
            )
            for pmt in data.payments
        ],
        customer_id=data.customer_id,
        order_discount_amount=data.discount_amount,
        notes=data.notes,
    )
    order = await svc.checkout(
        tenant_id=tenant_id,
        data=checkout_input,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return OrderResponse.model_validate(order)


# Order Endpoints

@router.get(
    "/orders",
    response_model=OrderListResponse,
    summary="List orders",
)
async def list_orders(
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    branch_id: uuid.UUID | None = Query(default=None),
    cashier_session_id: uuid.UUID | None = Query(default=None),
    order_status: str | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> OrderListResponse:
    svc = OrderService(db)
    items, total = await svc.list_orders(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        branch_id=branch_id,
        cashier_session_id=cashier_session_id,
        order_status=order_status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
    )
    return OrderListResponse(
        items=[OrderResponse.model_validate(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/orders/{order_id}",
    response_model=OrderResponse,
    summary="Get order",
)
async def get_order(
    order_id: uuid.UUID,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.get_order(order_id, tenant_id)
    return OrderResponse.model_validate(order)


@router.post(
    "/orders/{order_id}/void",
    response_model=OrderResponse,
    summary="Void order",
    description="Voids a completed order and restores inventory via REFUND stock movements.",
)
async def void_order(
    order_id: uuid.UUID,
    data: VoidOrderRequest,
    db: DbSession,
    current_user: User = _void_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    request_id: str = Depends(RequestId),
) -> OrderResponse:
    svc = CheckoutService(db)
    order = await svc.void_order(
        order_id=order_id,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        reason=data.reason,
        request_id=request_id,
    )
    return OrderResponse.model_validate(order)
