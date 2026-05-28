from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.analytics.dashboard_service import DashboardService
from app.analytics.financial_reports import FinancialReportsService
from app.analytics.inventory_reports import InventoryReportsService
from app.analytics.sales_reports import SalesReportsService
from app.analytics.schemas import (
    BranchSalesResponse,
    CashierSalesResponse,
    CategorySalesResponse,
    DashboardResponse,
    DeadStockResponse,
    FastMovingResponse,
    FinancialSummaryResponse,
    InventoryValuationResponse,
    LowStockResponse,
    MovementReportResponse,
    PaymentMethodResponse,
    ProfitReportResponse,
    SalesSummaryResponse,
    SalesTrendResponse,
    TopProductResponse,
)
from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    check_reseller_access,
    require_cashier_or_above,
    require_manager_or_above,
)
from app.core.cache import cache_get, cache_set
from app.db.redis import get_redis
from app.models.user import User

router = APIRouter()

_DASHBOARD_TTL = 120  # seconds


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    dependencies=[check_reseller_access("analytics:dashboard:view")],
)
async def get_dashboard(
    db: DbSession,
    current_user: Annotated[User, Depends(require_cashier_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    branch_id: uuid.UUID | None = Query(default=None),
    redis=Depends(get_redis),
) -> DashboardResponse:
    cache_key = f"dashboard:{tenant_id}:{branch_id or 'all'}"

    cached = await cache_get(redis, cache_key)
    if cached:
        return DashboardResponse(**cached)

    svc = DashboardService(db)
    result = await svc.get_dashboard(
        tenant_id=tenant_id,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )

    await cache_set(redis, cache_key, result.model_dump(mode="json"), ttl=_DASHBOARD_TTL)
    return result



@router.get(
    "/sales/summary",
    response_model=SalesSummaryResponse,
    dependencies=[check_reseller_access("analytics:sales:view")],
)
async def get_sales_summary(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
) -> SalesSummaryResponse:
    svc = SalesReportsService(db)
    return await svc.get_summary(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/sales/trend",
    response_model=SalesTrendResponse,
    dependencies=[check_reseller_access("analytics:sales:view")],
)
async def get_sales_trend(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    granularity: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
) -> SalesTrendResponse:
    svc = SalesReportsService(db)
    return await svc.get_trend(
        tenant_id=tenant_id,
        granularity=granularity,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/sales/top-products",
    response_model=list[TopProductResponse],
    dependencies=[check_reseller_access("analytics:sales:view")],
)
async def get_top_products(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
) -> list[TopProductResponse]:
    svc = SalesReportsService(db)
    return await svc.get_top_products(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        limit=limit,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/sales/by-category",
    response_model=list[CategorySalesResponse],
    dependencies=[check_reseller_access("analytics:sales:view")],
)
async def get_sales_by_category(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
) -> list[CategorySalesResponse]:
    svc = SalesReportsService(db)
    return await svc.get_by_category(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/sales/by-branch",
    response_model=list[BranchSalesResponse],
    dependencies=[check_reseller_access("analytics:sales:view", check_branch=False)],
)
async def get_sales_by_branch(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> list[BranchSalesResponse]:
    svc = SalesReportsService(db)
    return await svc.get_by_branch(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/sales/by-cashier",
    response_model=list[CashierSalesResponse],
    dependencies=[check_reseller_access("analytics:sales:view")],
)
async def get_sales_by_cashier(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
) -> list[CashierSalesResponse]:
    svc = SalesReportsService(db)
    return await svc.get_by_cashier(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/sales/payment-methods",
    response_model=list[PaymentMethodResponse],
    dependencies=[check_reseller_access("analytics:sales:view")],
)
async def get_payment_methods(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
) -> list[PaymentMethodResponse]:
    svc = SalesReportsService(db)
    return await svc.get_payment_methods(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )



@router.get(
    "/inventory/valuation",
    response_model=InventoryValuationResponse,
    dependencies=[check_reseller_access("analytics:inventory:view")],
)
async def get_inventory_valuation(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    branch_id: uuid.UUID | None = Query(default=None),
) -> InventoryValuationResponse:
    svc = InventoryReportsService(db)
    return await svc.get_valuation(
        tenant_id=tenant_id,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/inventory/low-stock",
    response_model=list[LowStockResponse],
    dependencies=[check_reseller_access("analytics:inventory:view")],
)
async def get_low_stock(
    db: DbSession,
    current_user: Annotated[User, Depends(require_cashier_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    branch_id: uuid.UUID | None = Query(default=None),
) -> list[LowStockResponse]:
    svc = InventoryReportsService(db)
    return await svc.get_low_stock(
        tenant_id=tenant_id,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/inventory/movements",
    response_model=list[MovementReportResponse],
    dependencies=[check_reseller_access("analytics:inventory:view")],
)
async def get_inventory_movements(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
    movement_type: str | None = Query(default=None),
) -> list[MovementReportResponse]:
    svc = InventoryReportsService(db)
    return await svc.get_movements(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        movement_type=movement_type,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/inventory/fast-moving",
    response_model=list[FastMovingResponse],
    dependencies=[check_reseller_access("analytics:inventory:view")],
)
async def get_fast_moving(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
) -> list[FastMovingResponse]:
    svc = InventoryReportsService(db)
    return await svc.get_fast_moving(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        limit=limit,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/inventory/dead-stock",
    response_model=list[DeadStockResponse],
    dependencies=[check_reseller_access("analytics:inventory:view")],
)
async def get_dead_stock(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    days: int = Query(default=90, ge=1, le=365),
    branch_id: uuid.UUID | None = Query(default=None),
) -> list[DeadStockResponse]:
    svc = InventoryReportsService(db)
    return await svc.get_dead_stock(
        tenant_id=tenant_id,
        days=days,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )



@router.get(
    "/financial/summary",
    response_model=FinancialSummaryResponse,
    dependencies=[check_reseller_access("analytics:financial:view")],
)
async def get_financial_summary(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
) -> FinancialSummaryResponse:
    svc = FinancialReportsService(db)
    return await svc.get_summary(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/financial/profit",
    response_model=ProfitReportResponse,
    dependencies=[check_reseller_access("report:profit")],
)
async def get_profit_report(
    db: DbSession,
    current_user: Annotated[User, Depends(require_manager_or_above)],
    tenant_id: EffectiveTenantId,
    request_id: RequestId,
    by: str = Query(default="product", pattern="^(product|category|branch)$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    branch_id: uuid.UUID | None = Query(default=None),
) -> ProfitReportResponse:
    svc = FinancialReportsService(db)
    return await svc.get_profit_report(
        tenant_id=tenant_id,
        by=by,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
