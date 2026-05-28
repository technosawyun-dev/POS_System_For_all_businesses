from __future__ import annotations

from app.models.user import User

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    get_effective_tenant_id,
    require_roles,
)
from app.core.constants import UserRole
from app.receipts.schemas import ReceiptListResponse, ReceiptResponse
from app.receipts.services import ReceiptService

router = APIRouter()

_view_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)
_manager_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
)


@router.get(
    "",
    response_model=ReceiptListResponse,
    summary="List receipts",
)
async def list_receipts(
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
    branch_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> ReceiptListResponse:
    svc = ReceiptService(db)
    items, total = await svc.list_receipts(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        branch_id=branch_id,
    )
    return ReceiptListResponse(
        items=[ReceiptResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{receipt_id}",
    response_model=ReceiptResponse,
    summary="Get receipt by ID",
)
async def get_receipt(
    receipt_id: uuid.UUID,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
) -> ReceiptResponse:
    svc = ReceiptService(db)
    receipt = await svc.get_receipt(receipt_id, tenant_id)
    return ReceiptResponse.model_validate(receipt)


@router.get(
    "/number/{receipt_number}",
    response_model=ReceiptResponse,
    summary="Get receipt by number",
)
async def get_receipt_by_number(
    receipt_number: str,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
) -> ReceiptResponse:
    svc = ReceiptService(db)
    receipt = await svc.get_receipt_by_number(receipt_number, tenant_id)
    return ReceiptResponse.model_validate(receipt)


@router.get(
    "/order/{order_id}",
    response_model=ReceiptResponse,
    summary="Get receipt by order ID",
)
async def get_receipt_by_order(
    order_id: uuid.UUID,
    db: DbSession,
    current_user: User = _view_access,
    tenant_id: uuid.UUID = Depends(get_effective_tenant_id),
) -> ReceiptResponse:
    svc = ReceiptService(db)
    receipt = await svc.get_receipt_by_order(order_id, tenant_id)
    return ReceiptResponse.model_validate(receipt)
