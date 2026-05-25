from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    check_reseller_access,
    require_inventory_access,
    require_manager_or_above,
)
from app.models.user import User
from app.procurement.schemas import (
    GoodsReceiptCreate,
    GoodsReceiptDetail,
    GoodsReceiptSummary,
    PaginatedGoodsReceipts,
    PaginatedPurchaseOrders,
    PaginatedSupplierPayables,
    PurchaseOrderCreate,
    PurchaseOrderDetail,
    PurchaseOrderSummary,
    PurchaseOrderUpdate,
    SupplierBalance,
    SupplierPayableDetail,
    SupplierPayableSummary,
    SupplierPaymentCreate,
    SupplierPaymentResponse,
)
from app.procurement.services import (
    PurchaseOrderService,
    ReceivingService,
    SupplierPayableService,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()



@router.post(
    "/purchase-orders",
    response_model=PurchaseOrderDetail,
    status_code=201,
    dependencies=[check_reseller_access("procurement:create", check_branch=False)],
)
async def create_purchase_order(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    data: PurchaseOrderCreate,
) -> PurchaseOrderDetail:
    svc = PurchaseOrderService(db)
    po = await svc.create_po(
        tenant_id=tenant_id,
        data=data,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return PurchaseOrderDetail.model_validate(po)


@router.get(
    "/purchase-orders",
    response_model=PaginatedPurchaseOrders,
    dependencies=[check_reseller_access("procurement:view")],
)
async def list_purchase_orders(
    db: DbSession,
    current_user: Annotated[User, Depends(require_inventory_access)],
    tenant_id: EffectiveTenantId,
    branch_id: uuid.UUID | None = Query(default=None),
    supplier_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedPurchaseOrders:
    svc = PurchaseOrderService(db)
    items, total = await svc.list_pos(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        branch_id=branch_id,
        supplier_id=supplier_id,
        status=status,
    )
    return PaginatedResponse.create(
        items=[PurchaseOrderSummary.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/purchase-orders/{po_id}",
    response_model=PurchaseOrderDetail,
    dependencies=[check_reseller_access("procurement:view", check_branch=False)],
)
async def get_purchase_order(
    po_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_inventory_access)],
    tenant_id: EffectiveTenantId,
) -> PurchaseOrderDetail:
    svc = PurchaseOrderService(db)
    po = await svc.get_po(po_id, tenant_id)
    return PurchaseOrderDetail.model_validate(po)


@router.patch("/purchase-orders/{po_id}", response_model=PurchaseOrderDetail)
async def update_purchase_order(
    po_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    data: PurchaseOrderUpdate,
) -> PurchaseOrderDetail:
    svc = PurchaseOrderService(db)
    po = await svc.update_po(po_id, tenant_id, data, current_user.id)
    return PurchaseOrderDetail.model_validate(po)


@router.post("/purchase-orders/{po_id}/submit", response_model=PurchaseOrderDetail)
async def submit_purchase_order(
    po_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
) -> PurchaseOrderDetail:
    svc = PurchaseOrderService(db)
    po = await svc.submit_po(po_id, tenant_id, current_user.id, request_id)
    return PurchaseOrderDetail.model_validate(po)


@router.post(
    "/purchase-orders/{po_id}/approve",
    response_model=PurchaseOrderDetail,
    dependencies=[check_reseller_access("procurement:approve", check_branch=False)],
)
async def approve_purchase_order(
    po_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
) -> PurchaseOrderDetail:
    svc = PurchaseOrderService(db)
    po = await svc.approve_po(po_id, tenant_id, current_user.id, request_id)
    return PurchaseOrderDetail.model_validate(po)


@router.post("/purchase-orders/{po_id}/cancel", response_model=PurchaseOrderDetail)
async def cancel_purchase_order(
    po_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
) -> PurchaseOrderDetail:
    svc = PurchaseOrderService(db)
    po = await svc.cancel_po(po_id, tenant_id, current_user.id, request_id)
    return PurchaseOrderDetail.model_validate(po)



@router.post("/receipts", response_model=GoodsReceiptDetail, status_code=201)
async def create_goods_receipt(
    db: DbSession,
    current_user: Annotated[User, Depends(require_inventory_access)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    data: GoodsReceiptCreate,
) -> GoodsReceiptDetail:
    svc = ReceivingService(db)
    receipt = await svc.create_goods_receipt(
        tenant_id=tenant_id,
        data=data,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return GoodsReceiptDetail.model_validate(receipt)


@router.get(
    "/receipts",
    response_model=PaginatedGoodsReceipts,
    dependencies=[check_reseller_access("procurement:view")],
)
async def list_goods_receipts(
    db: DbSession,
    current_user: Annotated[User, Depends(require_inventory_access)],
    tenant_id: EffectiveTenantId,
    purchase_order_id: uuid.UUID | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedGoodsReceipts:
    svc = ReceivingService(db)
    items, total = await svc.list_receipts(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        purchase_order_id=purchase_order_id,
        branch_id=branch_id,
    )
    return PaginatedResponse.create(
        items=[GoodsReceiptSummary.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/receipts/{receipt_id}", response_model=GoodsReceiptDetail)
async def get_goods_receipt(
    receipt_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_inventory_access)],
    tenant_id: EffectiveTenantId,
) -> GoodsReceiptDetail:
    svc = ReceivingService(db)
    receipt = await svc.get_receipt(receipt_id, tenant_id)
    return GoodsReceiptDetail.model_validate(receipt)



@router.get("/payables", response_model=PaginatedSupplierPayables)
async def list_payables(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    supplier_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedSupplierPayables:
    svc = SupplierPayableService(db)
    items, total = await svc.list_payables(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        supplier_id=supplier_id,
        status=status,
    )
    return PaginatedResponse.create(
        items=[SupplierPayableSummary.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/payables/{payable_id}", response_model=SupplierPayableDetail)
async def get_payable(
    payable_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
) -> SupplierPayableDetail:
    svc = SupplierPayableService(db)
    payable = await svc.get_payable(payable_id, tenant_id)
    return SupplierPayableDetail.model_validate(payable)


@router.get("/suppliers/{supplier_id}/balance", response_model=SupplierBalance)
async def get_supplier_balance(
    supplier_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
) -> SupplierBalance:
    svc = SupplierPayableService(db)
    balance = await svc.supplier_balance(supplier_id, tenant_id)
    return SupplierBalance.model_validate(balance)


@router.post("/payables/{payable_id}/payments", response_model=SupplierPaymentResponse, status_code=201)
async def record_supplier_payment(
    payable_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    data: SupplierPaymentCreate,
) -> SupplierPaymentResponse:
    svc = SupplierPayableService(db)
    payment = await svc.record_payment(
        payable_id=payable_id,
        tenant_id=tenant_id,
        data=data,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SupplierPaymentResponse.model_validate(payment)
