from __future__ import annotations

from app.models.user import User

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    require_roles,
)
from app.core.constants import UserRole
from app.payments.schemas import (
    AddPaymentRequest,
    PaymentListResponse,
    PaymentResponse,
    RefundListResponse,
    RefundRequest,
    RefundResponse,
)
from app.payments.services import PaymentService
from app.sales.services.refund_service import (
    RefundInput,
    RefundItemInput,
    RefundService,
)

router = APIRouter()

_payment_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)
_refund_access = require_roles(
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


@router.post(
    "/orders/{order_id}/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add payment to order",
    description="Add a partial or split payment to an existing order.",
)
async def add_payment(
    order_id: uuid.UUID,
    data: AddPaymentRequest,
    db: DbSession,
    current_user: User = _payment_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    request_id: str = Depends(RequestId),
) -> PaymentResponse:
    svc = PaymentService(db)
    payment = await svc.add_payment(
        order_id=order_id,
        tenant_id=tenant_id,
        payment_method=data.payment_method,
        amount=data.amount,
        actor_user_id=current_user.id,
        reference_number=data.reference_number,
        notes=data.notes,
        request_id=request_id,
    )
    return PaymentResponse.model_validate(payment)


@router.get(
    "/payments",
    response_model=PaymentListResponse,
    summary="List payments",
)
async def list_payments(
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    order_id: uuid.UUID | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaymentListResponse:
    svc = PaymentService(db)
    items, total = await svc.list_payments(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        order_id=order_id,
        payment_method=payment_method,
        payment_status=payment_status,
    )
    return PaymentListResponse(
        items=[PaymentResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentResponse,
    summary="Get payment",
)
async def get_payment(
    payment_id: uuid.UUID,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> PaymentResponse:
    svc = PaymentService(db)
    payment = await svc.get_payment(payment_id, tenant_id)
    return PaymentResponse.model_validate(payment)


@router.post(
    "/refunds",
    response_model=RefundResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process refund",
    description=(
        "Process a full or partial refund. "
        "Creates REFUND stock movements to restore inventory and updates order status."
    ),
)
async def process_refund(
    data: RefundRequest,
    db: DbSession,
    current_user: User = _refund_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    request_id: str = Depends(RequestId),
) -> RefundResponse:
    svc = RefundService(db)
    refund_input = RefundInput(
        order_id=data.order_id,
        reason=data.reason,
        items=[
            RefundItemInput(
                order_item_id=item.order_item_id,
                quantity=item.quantity,
                amount=item.amount,
            )
            for item in data.items
        ],
        notes=data.notes,
    )
    refund = await svc.process_refund(
        tenant_id=tenant_id,
        data=refund_input,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return RefundResponse.model_validate(refund)


@router.get(
    "/refunds",
    response_model=RefundListResponse,
    summary="List refunds",
)
async def list_refunds(
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
    order_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> RefundListResponse:
    svc = RefundService(db)
    items, total = await svc.list_refunds(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        order_id=order_id,
    )
    return RefundListResponse(
        items=[RefundResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/refunds/{refund_id}",
    response_model=RefundResponse,
    summary="Get refund",
)
async def get_refund(
    refund_id: uuid.UUID,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(EffectiveTenantId),
) -> RefundResponse:
    svc = RefundService(db)
    refund = await svc.get_refund(refund_id, tenant_id)
    return RefundResponse.model_validate(refund)
