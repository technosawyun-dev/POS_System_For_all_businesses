from __future__ import annotations

from app.models.user import User

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select as _sa_select

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    get_effective_tenant_id,
    get_request_id,
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


async def _enrich_refund_response(refund, db) -> RefundResponse:
    """Populate product_name / variant_name on each RefundItem from order_items."""
    from sqlalchemy import select as _select
    from app.payments.schemas import RefundItemResponse
    from app.sales.models import OrderItem

    order_item_ids = [ri.order_item_id for ri in refund.items]
    name_map: dict[uuid.UUID, tuple[str, str | None]] = {}
    if order_item_ids:
        rows = await db.execute(
            _select(OrderItem.id, OrderItem.product_name, OrderItem.variant_name)
            .where(OrderItem.id.in_(order_item_ids))
        )
        for row in rows.all():
            name_map[row.id] = (row.product_name, row.variant_name)

    item_responses = []
    for ri in refund.items:
        pname, vname = name_map.get(ri.order_item_id, ("", None))
        item_data = {
            "id": ri.id,
            "refund_id": ri.refund_id,
            "order_item_id": ri.order_item_id,
            "product_id": ri.product_id,
            "variant_id": ri.variant_id,
            "product_name": pname or None,
            "variant_name": vname,
            "quantity": ri.quantity,
            "amount": ri.amount,
            "stock_movement_id": ri.stock_movement_id,
            "created_at": ri.created_at,
        }
        item_responses.append(RefundItemResponse.model_validate(item_data))

    base = RefundResponse.model_validate(refund)
    return base.model_copy(update={"items": item_responses})

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
    UserRole.CASHIER,
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
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
    request_id: str = Depends(get_request_id),
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
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
    order_id: uuid.UUID | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
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
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
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
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
    request_id: str = Depends(get_request_id),
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
        refund_method=data.refund_method,
    )
    refund = await svc.process_refund(
        tenant_id=tenant_id,
        data=refund_input,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return await _enrich_refund_response(refund, db)


@router.get(
    "/refunds",
    response_model=RefundListResponse,
    summary="List refunds",
)
async def list_refunds(
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
    order_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> RefundListResponse:
    cashier_user_id = current_user.id if current_user.role == UserRole.CASHIER.value else None
    svc = RefundService(db)
    items, total = await svc.list_refunds(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        order_id=order_id,
        cashier_user_id=cashier_user_id,
    )

    # Batch-load processor names: one query for all processors in this page.
    processor_ids = list({r.processed_by for r in items if r.processed_by})
    pname_map: dict[uuid.UUID, str] = {}
    if processor_ids:
        rows = await db.execute(
            _sa_select(
                User.id,
                (User.first_name + " " + User.last_name).label("full_name"),
            ).where(User.id.in_(processor_ids))
        )
        for row in rows.all():
            pname_map[row[0]] = row[1]

    enriched = []
    for r in items:
        base = await _enrich_refund_response(r, db)
        enriched.append(base.model_copy(update={"processed_by_name": pname_map.get(r.processed_by)}))

    return RefundListResponse(
        items=enriched,
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
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
) -> RefundResponse:
    svc = RefundService(db)
    refund = await svc.get_refund(refund_id, tenant_id)
    return RefundResponse.model_validate(refund)
