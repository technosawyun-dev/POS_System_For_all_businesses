from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.repositories import AnalyticsRepository
from app.analytics.schemas import DashboardResponse
from app.core.constants import AuditAction, EntityType
from app.services.audit_service import AuditService


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = AnalyticsRepository(session)
        self.audit = AuditService(session)

    async def get_dashboard(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
        actor_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> DashboardResponse:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today_start + timedelta(days=1)
        yesterday_start = today_start - timedelta(days=1)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = today_start.replace(day=1)

        today_stats = await self.repo.get_order_stats_in_range(
            tenant_id, today_start, tomorrow, branch_id, cashier_user_id
        )
        yesterday_stats = await self.repo.get_order_stats_in_range(
            tenant_id, yesterday_start, today_start, branch_id, cashier_user_id
        )
        week_stats = await self.repo.get_order_stats_in_range(
            tenant_id, week_start, tomorrow, branch_id, cashier_user_id
        )
        month_stats = await self.repo.get_order_stats_in_range(
            tenant_id, month_start, tomorrow, branch_id, cashier_user_id
        )
        refund_stats = await self.repo.get_refund_stats_in_range(
            tenant_id, month_start, tomorrow
        )
        customer_stats = await self.repo.get_customer_stats(tenant_id, month_start)
        low_stock_count = await self.repo.get_low_stock_count(tenant_id, branch_id)
        inventory_value = await self.repo.get_total_inventory_value(tenant_id, branch_id)

        await self.audit.log(
            action=AuditAction.DASHBOARD_VIEWED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.ANALYTICS_REPORT,
            after_state={"branch_id": str(branch_id) if branch_id else None},
            request_id=request_id,
        )

        return DashboardResponse(
            sales_today=Decimal(str(today_stats.get("gross_sales", 0))),
            sales_yesterday=Decimal(str(yesterday_stats.get("gross_sales", 0))),
            sales_this_week=Decimal(str(week_stats.get("gross_sales", 0))),
            sales_this_month=Decimal(str(month_stats.get("gross_sales", 0))),
            orders_today=int(today_stats.get("order_count", 0)),
            orders_this_month=int(month_stats.get("order_count", 0)),
            revenue_today=Decimal(str(today_stats.get("net_revenue", 0))),
            revenue_month=Decimal(str(month_stats.get("net_revenue", 0))),
            refund_count_month=int(refund_stats.get("refund_count", 0)),
            refund_amount_month=Decimal(str(refund_stats.get("refund_amount", 0))),
            total_customers=int(customer_stats.get("total_customers", 0)),
            new_customers_month=int(customer_stats.get("new_customers_month", 0)),
            low_stock_products=low_stock_count,
            inventory_value=Decimal(str(inventory_value)),
            generated_at=now,
        )
