"""
Pure-SQL analytics aggregation layer.

All methods are READ-ONLY. No side effects, no commits.
Every method filters by tenant_id as the first mandatory guard.
Branch filters never cross tenant boundaries (enforced via Order/BranchInventory FK chain).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, case, distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cashiers.models import CashierSession
from app.core.constants import OrderStatus, PaymentStatus, StockMovementType
from app.customers.models import Customer
from app.models.branch import Branch
from app.models.inventory import BranchInventory, StockMovement
from app.models.product import Category, Product
from app.models.user import User
from app.payments.models import Payment, Refund
from app.sales.models import Order, OrderItem


class AnalyticsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session


    def _order_filters(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
    ) -> list:
        """Base filter list for completed/refunded orders scoped to tenant."""
        f: list = [
            Order.tenant_id == tenant_id,
            Order.order_status.in_([
                OrderStatus.COMPLETED.value,
                OrderStatus.PARTIALLY_REFUNDED.value,
                OrderStatus.REFUNDED.value,
            ]),
        ]
        if start_dt:
            f.append(Order.created_at >= start_dt)
        if end_dt:
            f.append(Order.created_at < end_dt)
        if branch_id:
            f.append(Order.branch_id == branch_id)
        if cashier_user_id:
            f.append(
                Order.cashier_session_id.in_(
                    select(CashierSession.id).where(
                        CashierSession.cashier_user_id == cashier_user_id
                    )
                )
            )
        return f


    async def get_order_stats_in_range(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime,
        end_dt: datetime,
        branch_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """COUNT and SUM of completed orders in [start_dt, end_dt)."""
        filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id, cashier_user_id)
        stmt = select(
            func.count().label("order_count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("gross_sales"),
            func.coalesce(func.sum(Order.refunded_amount), 0).label("total_refunded"),
            func.coalesce(
                func.sum(Order.total_amount - Order.refunded_amount), 0
            ).label("net_revenue"),
        ).where(and_(*filters))
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else {
            "order_count": 0,
            "gross_sales": Decimal("0"),
            "total_refunded": Decimal("0"),
            "net_revenue": Decimal("0"),
        }

    async def get_refund_stats_in_range(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime,
        end_dt: datetime,
    ) -> dict[str, Any]:
        stmt = select(
            func.count().label("refund_count"),
            func.coalesce(func.sum(Refund.amount), 0).label("refund_amount"),
        ).where(
            and_(
                Refund.tenant_id == tenant_id,
                Refund.created_at >= start_dt,
                Refund.created_at < end_dt,
            )
        )
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else {"refund_count": 0, "refund_amount": Decimal("0")}

    async def get_customer_stats(
        self,
        tenant_id: uuid.UUID,
        month_start: datetime,
    ) -> dict[str, Any]:
        stmt = select(
            func.count().label("total_customers"),
            func.count(
                case((Customer.created_at >= month_start, Customer.id))
            ).label("new_customers_month"),
        ).where(
            and_(
                Customer.tenant_id == tenant_id,
                Customer.is_active.is_(True),
                Customer.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else {"total_customers": 0, "new_customers_month": 0}

    async def get_total_customer_outstanding(
        self,
        tenant_id: uuid.UUID,
    ) -> Decimal:
        """Sum of current_balance for all active customers with a positive balance (they owe money)."""
        stmt = select(
            func.coalesce(func.sum(Customer.current_balance), Decimal("0"))
        ).where(
            and_(
                Customer.tenant_id == tenant_id,
                Customer.is_active.is_(True),
                Customer.deleted_at.is_(None),
                Customer.current_balance > 0,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() or Decimal("0")

    async def get_low_stock_count(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
    ) -> int:
        filters = [
            BranchInventory.tenant_id == tenant_id,
            BranchInventory.reorder_point.is_not(None),
            BranchInventory.quantity_on_hand <= BranchInventory.reorder_point,
        ]
        if branch_id:
            filters.append(BranchInventory.branch_id == branch_id)
        stmt = select(func.count()).where(and_(*filters))
        result = await self.session.execute(stmt)
        return result.scalar_one() or 0

    async def get_total_inventory_value(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
    ) -> Decimal:
        filters: list = [
            BranchInventory.tenant_id == tenant_id,
            Product.is_deleted.is_(False),
        ]
        if branch_id:
            filters.append(BranchInventory.branch_id == branch_id)
        stmt = (
            select(
                func.coalesce(
                    func.sum(
                        BranchInventory.quantity_on_hand
                        * func.coalesce(Product.cost_price, 0)
                    ),
                    0,
                ).label("inventory_value")
            )
            .join(Product, Product.id == BranchInventory.product_id)
            .where(and_(*filters))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() or Decimal("0")


    async def get_sales_summary(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id)
        stmt = select(
            func.count().label("order_count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("gross_sales"),
            func.coalesce(func.sum(Order.refunded_amount), 0).label("refund_amount"),
            func.coalesce(
                func.sum(Order.total_amount - Order.refunded_amount), 0
            ).label("net_sales"),
            func.coalesce(func.avg(Order.total_amount), 0).label("average_order_value"),
            func.count(distinct(Order.customer_id)).label("unique_customers"),
        ).where(and_(*filters))
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else {
            "order_count": 0,
            "gross_sales": Decimal("0"),
            "refund_amount": Decimal("0"),
            "net_sales": Decimal("0"),
            "average_order_value": Decimal("0"),
            "unique_customers": 0,
        }

    async def get_sales_trend(
        self,
        tenant_id: uuid.UUID,
        granularity: str,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        pg_grain = {"daily": "day", "weekly": "week", "monthly": "month"}.get(
            granularity, "day"
        )
        period_expr = func.date_trunc(pg_grain, Order.created_at).label("period")
        filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id)
        stmt = (
            select(
                period_expr,
                func.count().label("orders"),
                func.coalesce(func.sum(Order.total_amount), 0).label("sales"),
                func.coalesce(
                    func.sum(Order.total_amount - Order.refunded_amount), 0
                ).label("revenue"),
            )
            .where(and_(*filters))
            .group_by(period_expr)
            .order_by(period_expr)
        )
        result = await self.session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_top_products(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        order_filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id)
        cogs_expr = func.coalesce(
            func.sum(
                OrderItem.quantity * func.coalesce(OrderItem.unit_cost_snapshot, 0)
            ),
            0,
        )
        rev_expr = func.sum(OrderItem.total)
        stmt = (
            select(
                OrderItem.product_id,
                OrderItem.product_name,
                func.max(OrderItem.sku).label("sku"),
                func.sum(OrderItem.quantity).label("quantity_sold"),
                rev_expr.label("revenue"),
                cogs_expr.label("cogs"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .where(and_(*order_filters))
            .group_by(OrderItem.product_id, OrderItem.product_name)
            .order_by(rev_expr.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["profit_estimate"] = Decimal(str(r["revenue"])) - Decimal(str(r["cogs"]))
        return rows

    async def get_sales_by_category(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        order_filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id)
        stmt = (
            select(
                Product.category_id,
                func.coalesce(Category.name, "Uncategorized").label("category_name"),
                func.sum(OrderItem.quantity).label("quantity_sold"),
                func.sum(OrderItem.total).label("sales"),
                func.coalesce(
                    func.sum(
                        OrderItem.total
                        - OrderItem.quantity
                        * func.coalesce(OrderItem.unit_cost_snapshot, 0)
                    ),
                    0,
                ).label("profit"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .outerjoin(Category, Category.id == Product.category_id)
            .where(and_(*order_filters))
            .group_by(Product.category_id, Category.name)
            .order_by(func.sum(OrderItem.total).desc())
        )
        result = await self.session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_sales_by_branch(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
    ) -> list[dict[str, Any]]:
        filters = self._order_filters(tenant_id, start_dt, end_dt)
        stmt = (
            select(
                Order.branch_id,
                Branch.name.label("branch_name"),
                func.count().label("orders"),
                func.coalesce(func.sum(Order.total_amount), 0).label("sales"),
                func.coalesce(func.sum(Order.refunded_amount), 0).label("refunds"),
                func.coalesce(
                    func.sum(Order.total_amount - Order.refunded_amount), 0
                ).label("revenue"),
            )
            .join(Branch, Branch.id == Order.branch_id)
            .where(and_(*filters))
            .group_by(Order.branch_id, Branch.name)
            .order_by(func.sum(Order.total_amount).desc())
        )
        result = await self.session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_sales_by_cashier(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id)
        cashier_name = (User.first_name + " " + User.last_name).label("cashier_name")
        stmt = (
            select(
                Order.created_by.label("cashier_id"),
                cashier_name,
                func.count().label("orders"),
                func.coalesce(func.sum(Order.total_amount), 0).label("sales"),
                func.coalesce(func.sum(Order.refunded_amount), 0).label("refunds"),
                func.coalesce(func.avg(Order.total_amount), 0).label("average_ticket"),
            )
            .join(User, User.id == Order.created_by)
            .where(and_(*filters))
            .group_by(Order.created_by, User.first_name, User.last_name)
            .order_by(func.sum(Order.total_amount).desc())
        )
        result = await self.session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_payment_methods_stats(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        payment_filters: list = [
            Payment.tenant_id == tenant_id,
            Payment.payment_status == PaymentStatus.PAID.value,
        ]
        if start_dt:
            payment_filters.append(Payment.created_at >= start_dt)
        if end_dt:
            payment_filters.append(Payment.created_at < end_dt)
        if branch_id:
            payment_filters.append(Order.branch_id == branch_id)

        # Normalize legacy/variant payment method strings to canonical enum values
        # so old test data and new transactions group together correctly.
        normalized_method = case(
            (Payment.payment_method == "KBZPAY",    "KPAY"),
            (Payment.payment_method == "KBZ_PAY",   "KPAY"),
            (Payment.payment_method == "WAVE_PAY",  "WAVEPAY"),
            (Payment.payment_method == "WAVEMONEY", "WAVEPAY"),
            (Payment.payment_method == "AYAPAY",    "AYA_PAY"),
            (Payment.payment_method == "CBPAY",     "CB_PAY"),
            else_=Payment.payment_method,
        ).label("payment_method")

        stmt = (
            select(
                normalized_method,
                func.count().label("transaction_count"),
                func.coalesce(func.sum(Payment.amount), 0).label("amount"),
            )
            .join(Order, Order.id == Payment.order_id)
            .where(and_(*payment_filters))
            .group_by(normalized_method)
            .order_by(func.sum(Payment.amount).desc())
        )
        result = await self.session.execute(stmt)
        rows = [dict(r) for r in result.mappings().all()]

        total = sum(Decimal(str(r["amount"])) for r in rows)
        for r in rows:
            r["percentage"] = (
                (Decimal(str(r["amount"])) / total * 100) if total else Decimal("0")
            )
        return rows


    async def get_inventory_valuation(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        filters: list = [
            BranchInventory.tenant_id == tenant_id,
            Product.is_deleted.is_(False),
        ]
        if branch_id:
            filters.append(BranchInventory.branch_id == branch_id)
        stmt = (
            select(
                BranchInventory.product_id,
                Product.name.label("product_name"),
                Product.sku,
                func.sum(BranchInventory.quantity_on_hand).label("quantity_on_hand"),
                func.coalesce(Product.cost_price, 0).label("cost_price"),
                func.coalesce(
                    func.sum(BranchInventory.quantity_on_hand)
                    * func.coalesce(Product.cost_price, 0),
                    0,
                ).label("valuation"),
            )
            .join(Product, Product.id == BranchInventory.product_id)
            .where(and_(*filters))
            .group_by(
                BranchInventory.product_id,
                Product.name,
                Product.sku,
                Product.cost_price,
            )
            .order_by(
                (
                    func.sum(BranchInventory.quantity_on_hand)
                    * func.coalesce(Product.cost_price, 0)
                ).desc()
            )
        )
        result = await self.session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_low_stock_items(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        filters: list = [
            BranchInventory.tenant_id == tenant_id,
            BranchInventory.reorder_point.is_not(None),
            BranchInventory.quantity_on_hand <= BranchInventory.reorder_point,
            Product.is_deleted.is_(False),
        ]
        if branch_id:
            filters.append(BranchInventory.branch_id == branch_id)
        stmt = (
            select(
                BranchInventory.product_id,
                Product.name.label("product_name"),
                Product.sku,
                BranchInventory.branch_id,
                Branch.name.label("branch_name"),
                BranchInventory.quantity_on_hand,
                BranchInventory.reorder_point,
            )
            .join(Product, Product.id == BranchInventory.product_id)
            .join(Branch, Branch.id == BranchInventory.branch_id)
            .where(and_(*filters))
            .order_by(BranchInventory.quantity_on_hand.asc())
        )
        result = await self.session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_movement_report(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
        movement_type: str | None = None,
    ) -> list[dict[str, Any]]:
        filters: list = [StockMovement.tenant_id == tenant_id]
        if start_dt:
            filters.append(StockMovement.created_at >= start_dt)
        if end_dt:
            filters.append(StockMovement.created_at < end_dt)
        if branch_id:
            filters.append(StockMovement.branch_id == branch_id)
        if movement_type:
            filters.append(StockMovement.movement_type == movement_type)
        stmt = (
            select(
                StockMovement.movement_type,
                func.count().label("count"),
                func.coalesce(func.sum(StockMovement.quantity), 0).label("total_quantity"),
            )
            .where(and_(*filters))
            .group_by(StockMovement.movement_type)
            .order_by(func.sum(StockMovement.quantity).desc())
        )
        result = await self.session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_fast_moving_products(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        # Aggregate on product_id only (tighter GROUP BY), then join Product for names.
        # This lets the planner use the (tenant_id, movement_type, created_at) index
        # on the inner scan without dragging Product columns into the sort.
        mv_filters: list = [
            StockMovement.tenant_id == tenant_id,
            StockMovement.movement_type == StockMovementType.SALE.value,
        ]
        if start_dt:
            mv_filters.append(StockMovement.created_at >= start_dt)
        if end_dt:
            mv_filters.append(StockMovement.created_at < end_dt)
        if branch_id:
            mv_filters.append(StockMovement.branch_id == branch_id)

        agg_sq = (
            select(
                StockMovement.product_id,
                func.sum(StockMovement.quantity).label("quantity_sold"),
                func.count(distinct(StockMovement.reference_id)).label("order_count"),
            )
            .where(and_(*mv_filters))
            .group_by(StockMovement.product_id)
            .order_by(func.sum(StockMovement.quantity).desc())
            .limit(limit)
            .subquery()
        )

        stmt = (
            select(
                agg_sq.c.product_id,
                Product.name.label("product_name"),
                Product.sku,
                agg_sq.c.quantity_sold,
                agg_sq.c.order_count,
            )
            .join(Product, and_(Product.id == agg_sq.c.product_id, Product.is_deleted.is_(False)))
            .order_by(agg_sq.c.quantity_sold.desc())
        )
        result = await self.session.execute(stmt)
        rows = [dict(r) for r in result.mappings().all()]
        for i, r in enumerate(rows):
            r["rank"] = i + 1
        return rows

    async def get_dead_stock(
        self,
        tenant_id: uuid.UUID,
        days_threshold: int = 90,
        branch_id: uuid.UUID | None = None,
        now: datetime | None = None,
    ) -> list[dict[str, Any]]:
        if now is None:
            now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days_threshold)

        last_sale_sq = (
            select(
                StockMovement.product_id,
                func.max(StockMovement.created_at).label("last_sold_at"),
            )
            .where(
                and_(
                    StockMovement.tenant_id == tenant_id,
                    StockMovement.movement_type == StockMovementType.SALE.value,
                )
            )
            .group_by(StockMovement.product_id)
            .subquery()
        )

        inv_filters: list = [BranchInventory.tenant_id == tenant_id]
        if branch_id:
            inv_filters.append(BranchInventory.branch_id == branch_id)

        stmt = (
            select(
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                Product.sku,
                func.coalesce(
                    func.sum(BranchInventory.quantity_on_hand), 0
                ).label("quantity_on_hand"),
                last_sale_sq.c.last_sold_at,
            )
            .join(
                BranchInventory,
                and_(BranchInventory.product_id == Product.id, *inv_filters),
            )
            .outerjoin(last_sale_sq, last_sale_sq.c.product_id == Product.id)
            .where(
                and_(
                    Product.tenant_id == tenant_id,
                    Product.is_deleted.is_(False),
                    or_(
                        last_sale_sq.c.last_sold_at.is_(None),
                        last_sale_sq.c.last_sold_at < cutoff,
                    ),
                )
            )
            .group_by(
                Product.id,
                Product.name,
                Product.sku,
                last_sale_sq.c.last_sold_at,
            )
            .having(func.coalesce(func.sum(BranchInventory.quantity_on_hand), 0) > 0)
            .order_by(last_sale_sq.c.last_sold_at.asc().nullsfirst())
        )
        result = await self.session.execute(stmt)
        rows = [dict(r) for r in result.mappings().all()]

        for r in rows:
            last_sold = r.get("last_sold_at")
            if last_sold:
                if last_sold.tzinfo is None:
                    last_sold = last_sold.replace(tzinfo=timezone.utc)
                r["days_without_sale"] = (now - last_sold).days
            else:
                r["days_without_sale"] = days_threshold + 1
        return rows


    async def get_financial_summary(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        order_filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id)

        rev_stmt = select(
            func.coalesce(func.sum(Order.total_amount), 0).label("gross_revenue"),
            func.coalesce(func.sum(Order.refunded_amount), 0).label("refund_amount"),
            func.coalesce(
                func.sum(Order.total_amount - Order.refunded_amount), 0
            ).label("net_revenue"),
        ).where(and_(*order_filters))

        cogs_stmt = (
            select(
                func.coalesce(
                    func.sum(
                        OrderItem.quantity
                        * func.coalesce(OrderItem.unit_cost_snapshot, 0)
                    ),
                    0,
                ).label("cogs")
            )
            .join(Order, Order.id == OrderItem.order_id)
            .where(and_(*order_filters))
        )

        rev_result = await self.session.execute(rev_stmt)
        cogs_result = await self.session.execute(cogs_stmt)

        rev_row = dict(rev_result.mappings().first() or {})
        cogs_row = dict(cogs_result.mappings().first() or {})
        return {**rev_row, **cogs_row}

    async def get_profit_by_product(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        return await self._get_profit_by_dim(
            tenant_id, "product", start_dt, end_dt, branch_id
        )

    async def get_profit_by_category(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        return await self._get_profit_by_dim(
            tenant_id, "category", start_dt, end_dt, branch_id
        )

    async def get_profit_by_branch(
        self,
        tenant_id: uuid.UUID,
        start_dt: datetime | None = None,
        end_dt: datetime | None = None,
    ) -> list[dict[str, Any]]:
        return await self._get_profit_by_dim(tenant_id, "branch", start_dt, end_dt)

    async def _get_profit_by_dim(
        self,
        tenant_id: uuid.UUID,
        dimension: str,
        start_dt: datetime | None,
        end_dt: datetime | None,
        branch_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        order_filters = self._order_filters(tenant_id, start_dt, end_dt, branch_id)
        cogs_expr = func.coalesce(
            func.sum(OrderItem.quantity * func.coalesce(OrderItem.unit_cost_snapshot, 0)),
            0,
        )
        rev_expr = func.coalesce(func.sum(OrderItem.total), 0)

        if dimension == "product":
            dim_id = OrderItem.product_id.label("dimension_id")
            dim_name = func.max(OrderItem.product_name).label("dimension_name")
            group_cols = [OrderItem.product_id]
            base = (
                select(dim_id, dim_name, rev_expr.label("revenue"), cogs_expr.label("cogs"))
                .join(Order, Order.id == OrderItem.order_id)
                .where(and_(*order_filters))
                .group_by(OrderItem.product_id)
                .order_by(rev_expr.desc())
            )
        elif dimension == "category":
            dim_id = Product.category_id.label("dimension_id")
            dim_name = func.coalesce(
                func.max(Category.name), "Uncategorized"
            ).label("dimension_name")
            group_cols = [Product.category_id]
            base = (
                select(dim_id, dim_name, rev_expr.label("revenue"), cogs_expr.label("cogs"))
                .join(Order, Order.id == OrderItem.order_id)
                .join(Product, Product.id == OrderItem.product_id)
                .outerjoin(Category, Category.id == Product.category_id)
                .where(and_(*order_filters))
                .group_by(Product.category_id)
                .order_by(rev_expr.desc())
            )
        else:  # branch
            dim_id = Order.branch_id.label("dimension_id")
            dim_name = Branch.name.label("dimension_name")
            base = (
                select(dim_id, dim_name, rev_expr.label("revenue"), cogs_expr.label("cogs"))
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(Branch, Branch.id == Order.branch_id)
                .where(and_(*order_filters))
                .group_by(Order.branch_id, Branch.name)
                .order_by(rev_expr.desc())
            )

        result = await self.session.execute(base)
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["profit"] = Decimal(str(r["revenue"])) - Decimal(str(r["cogs"]))
        return rows
