from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    check_reseller_access,
    require_cashier_or_above,
    require_inventory_access,
    require_manager_or_above,
)
from app.core.constants import UserRole
from app.core.constants import StockMovementType
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.inventory import (
    BranchInventoryResponse,
    BranchInventoryUpdateRequest,
    InventoryAdjustmentCreateRequest,
    InventoryAdjustmentResponse,
    InventoryTransferCreateRequest,
    InventoryTransferResponse,
    InventoryValuationResponse,
    OpeningStockRequest,
    StockMovementResponse,
    TransferApproveRequest,
    TransferCancelRequest,
)
from app.services.inventory_service import InventoryService

router = APIRouter()


# Branch Inventory

@router.get(
    "/branches/{branch_id}",
    response_model=PaginatedResponse[BranchInventoryResponse],
    summary="Get branch inventory",
    dependencies=[Depends(require_cashier_or_above)],
)
async def get_branch_inventory(
    branch_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedResponse[BranchInventoryResponse]:
    if current_user.role == UserRole.RESELLER.value:
        from app.services.reseller_access import ResellerAccessService
        svc = ResellerAccessService(db)
        await svc.require_branch_and_permission(current_user.id, tenant_id, branch_id, "inventory:view")
    service = InventoryService(db)
    items, total = await service.get_branch_inventory(
        branch_id=branch_id,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
    )

    # Fetch sold quantities for each product in one query
    from decimal import Decimal as _Decimal
    from sqlalchemy import func, select
    from app.models.inventory import StockMovement

    product_ids = [inv.product_id for inv in items]
    sold_map: dict[uuid.UUID, _Decimal] = {}
    if product_ids:
        result = await db.execute(
            select(
                StockMovement.product_id,
                func.coalesce(func.sum(StockMovement.quantity), 0).label("qty_sold"),
            )
            .where(
                StockMovement.branch_id == branch_id,
                StockMovement.movement_type == StockMovementType.SALE,
                StockMovement.product_id.in_(product_ids),
            )
            .group_by(StockMovement.product_id)
        )
        for row in result.all():
            sold_map[row.product_id] = _Decimal(str(row.qty_sold))

    response_items = []
    for inv in items:
        data = inv.to_dict()
        data["quantity_available"] = inv.quantity_available
        data["quantity_sold"] = sold_map.get(inv.product_id, _Decimal("0"))
        response_items.append(BranchInventoryResponse.model_validate(data))

    return PaginatedResponse.create(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/branches/{branch_id}/products/{product_id}/reorder",
    response_model=BranchInventoryResponse,
    summary="Update reorder levels for a product in a branch",
    dependencies=[Depends(require_manager_or_above)],
)
async def update_reorder_levels(
    branch_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: BranchInventoryUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    variant_id: uuid.UUID | None = Query(default=None),
) -> BranchInventoryResponse:
    if current_user.role == UserRole.RESELLER.value:
        from app.services.reseller_access import ResellerAccessService
        svc = ResellerAccessService(db)
        await svc.require_branch_and_permission(current_user.id, tenant_id, branch_id, "inventory:update")
    service = InventoryService(db)
    inv = await service.update_reorder_levels(
        branch_id=branch_id,
        tenant_id=tenant_id,
        product_id=product_id,
        variant_id=variant_id,
        reorder_point=payload.reorder_point,
        reorder_quantity=payload.reorder_quantity,
    )
    data = inv.to_dict()
    data["quantity_available"] = inv.quantity_available
    return BranchInventoryResponse.model_validate(data)


# Stock Movements

@router.get(
    "/branches/{branch_id}/movements",
    response_model=PaginatedResponse[StockMovementResponse],
    summary="List stock movements for a branch",
    dependencies=[Depends(require_inventory_access)],
)
async def list_stock_movements(
    branch_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    product_id: uuid.UUID | None = Query(default=None),
    movement_type: StockMovementType | None = Query(default=None),
) -> PaginatedResponse[StockMovementResponse]:
    if current_user.role == UserRole.RESELLER.value:
        from app.services.reseller_access import ResellerAccessService
        svc = ResellerAccessService(db)
        await svc.require_branch_and_permission(current_user.id, tenant_id, branch_id, "inventory:movement:view")
    service = InventoryService(db)
    movements, total = await service.get_stock_movements(
        branch_id=branch_id,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        product_id=product_id,
        movement_type=movement_type.value if movement_type else None,
    )
    return PaginatedResponse.create(
        items=[StockMovementResponse.model_validate(m) for m in movements],
        total=total,
        page=page,
        page_size=page_size,
    )


# Opening Stock

@router.post(
    "/opening-stock",
    response_model=list[StockMovementResponse],
    status_code=201,
    summary="Set opening stock for a branch",
    dependencies=[Depends(require_manager_or_above)],
)
async def set_opening_stock(
    payload: OpeningStockRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> list[StockMovementResponse]:
    service = InventoryService(db)
    movements = await service.set_opening_stock(
        tenant_id=tenant_id,
        data=payload,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return [StockMovementResponse.model_validate(m) for m in movements]


# Valuation

@router.get(
    "/branches/{branch_id}/valuation",
    response_model=InventoryValuationResponse,
    summary="Get inventory valuation for a branch",
    dependencies=[Depends(require_manager_or_above)],
)
async def get_inventory_valuation(
    branch_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> InventoryValuationResponse:
    if current_user.role == UserRole.RESELLER.value:
        from app.services.reseller_access import ResellerAccessService
        svc = ResellerAccessService(db)
        await svc.require_branch_and_permission(current_user.id, tenant_id, branch_id, "inventory:view")
    service = InventoryService(db)
    result = await service.get_inventory_valuation(
        branch_id=branch_id,
        tenant_id=tenant_id,
    )
    return InventoryValuationResponse.model_validate(result)


# Adjustments

@router.post(
    "/adjustments",
    response_model=InventoryAdjustmentResponse,
    status_code=201,
    summary="Create inventory adjustment",
    dependencies=[Depends(require_inventory_access)],
)
async def create_adjustment(
    payload: InventoryAdjustmentCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> InventoryAdjustmentResponse:
    if current_user.role == UserRole.RESELLER.value:
        from app.services.reseller_access import ResellerAccessService
        svc = ResellerAccessService(db)
        await svc.require_branch_and_permission(current_user.id, tenant_id, payload.branch_id, "inventory:adjust")
    service = InventoryService(db)
    adjustment = await service.create_adjustment(
        tenant_id=tenant_id,
        data=payload,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return InventoryAdjustmentResponse.model_validate(adjustment)


@router.get(
    "/adjustments",
    response_model=PaginatedResponse[InventoryAdjustmentResponse],
    summary="List inventory adjustments",
    dependencies=[Depends(require_inventory_access), check_reseller_access("inventory:view")],
)
async def list_adjustments(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    branch_id: uuid.UUID | None = Query(default=None),
) -> PaginatedResponse[InventoryAdjustmentResponse]:
    service = InventoryService(db)
    adjustments, total = await service.list_adjustments(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        branch_id=branch_id,
    )
    return PaginatedResponse.create(
        items=[InventoryAdjustmentResponse.model_validate(a) for a in adjustments],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/adjustments/{adjustment_id}",
    response_model=InventoryAdjustmentResponse,
    summary="Get adjustment detail",
    dependencies=[Depends(require_inventory_access), check_reseller_access("inventory:view", check_branch=False)],
)
async def get_adjustment(
    adjustment_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> InventoryAdjustmentResponse:
    service = InventoryService(db)
    adjustment = await service.get_adjustment(adjustment_id, tenant_id)
    return InventoryAdjustmentResponse.model_validate(adjustment)


# Transfers

@router.post(
    "/transfers",
    response_model=InventoryTransferResponse,
    status_code=201,
    summary="Create stock transfer request",
    dependencies=[Depends(require_inventory_access)],
)
async def create_transfer(
    payload: InventoryTransferCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> InventoryTransferResponse:
    if current_user.role == UserRole.RESELLER.value:
        from app.services.reseller_access import ResellerAccessService
        svc = ResellerAccessService(db)
        await svc.require_branch_and_permission(current_user.id, tenant_id, payload.from_branch_id, "inventory:transfer")
        await svc.require_branch_access(current_user.id, tenant_id, payload.to_branch_id)
    service = InventoryService(db)
    transfer = await service.create_transfer(
        tenant_id=tenant_id,
        data=payload,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return InventoryTransferResponse.model_validate(transfer)


@router.get(
    "/transfers",
    response_model=PaginatedResponse[InventoryTransferResponse],
    summary="List stock transfers",
    dependencies=[Depends(require_inventory_access), check_reseller_access("inventory:view")],
)
async def list_transfers(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    branch_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
) -> PaginatedResponse[InventoryTransferResponse]:
    service = InventoryService(db)
    transfers, total = await service.list_transfers(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        branch_id=branch_id,
        status=status,
    )
    return PaginatedResponse.create(
        items=[InventoryTransferResponse.model_validate(t) for t in transfers],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/transfers/{transfer_id}",
    response_model=InventoryTransferResponse,
    summary="Get transfer detail",
    dependencies=[Depends(require_inventory_access), check_reseller_access("inventory:view", check_branch=False)],
)
async def get_transfer(
    transfer_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> InventoryTransferResponse:
    service = InventoryService(db)
    transfer = await service.get_transfer(transfer_id, tenant_id)
    return InventoryTransferResponse.model_validate(transfer)


@router.post(
    "/transfers/{transfer_id}/approve",
    response_model=InventoryTransferResponse,
    summary="Approve stock transfer",
    dependencies=[Depends(require_manager_or_above)],
)
async def approve_transfer(
    transfer_id: uuid.UUID,
    payload: TransferApproveRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> InventoryTransferResponse:
    service = InventoryService(db)
    transfer = await service.approve_transfer(
        transfer_id=transfer_id,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return InventoryTransferResponse.model_validate(transfer)


@router.post(
    "/transfers/{transfer_id}/execute",
    response_model=InventoryTransferResponse,
    summary="Execute approved transfer (creates stock movements)",
    dependencies=[Depends(require_manager_or_above)],
)
async def execute_transfer(
    transfer_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> InventoryTransferResponse:
    service = InventoryService(db)
    transfer = await service.execute_transfer(
        transfer_id=transfer_id,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return InventoryTransferResponse.model_validate(transfer)


@router.post(
    "/transfers/{transfer_id}/cancel",
    response_model=InventoryTransferResponse,
    summary="Cancel stock transfer",
    dependencies=[Depends(require_manager_or_above)],
)
async def cancel_transfer(
    transfer_id: uuid.UUID,
    payload: TransferCancelRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> InventoryTransferResponse:
    service = InventoryService(db)
    transfer = await service.cancel_transfer(
        transfer_id=transfer_id,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        reason=payload.reason,
        request_id=request_id,
    )
    return InventoryTransferResponse.model_validate(transfer)
