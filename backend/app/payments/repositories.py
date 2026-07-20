from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cashiers.models import CashierSession
from app.payments.models import Payment, Refund, RefundItem
from app.repositories.base import BaseRepository
from app.sales.models import Order


class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Payment, session)

    async def get_by_order(self, order_id: uuid.UUID) -> list[Payment]:
        result = await self.session.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        return list(result.scalars().all())

    async def get_cash_total_for_session(
        self,
        cashier_session_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Decimal:
        """Sum of all cash payments for orders in a cashier session."""
        from app.sales.models import Order
        from app.core.constants import PaymentMethod, PaymentStatus

        result = await self.session.execute(
            select(func.coalesce(func.sum(Payment.amount), Decimal("0")))
            .join(Order, Order.id == Payment.order_id)
            .where(
                Order.cashier_session_id == cashier_session_id,
                Order.tenant_id == tenant_id,
                Payment.payment_method == PaymentMethod.CASH,
                Payment.payment_status == PaymentStatus.PAID,
            )
        )
        return result.scalar_one()

    async def get_totals_by_method_for_session(
        self,
        cashier_session_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> dict[str, Decimal]:
        """Gross amount collected per payment method for orders in a cashier
        session (PAID payments only) — e.g. {"CASH": 50000, "KPAY": 12000}.
        Methods with no payments this session are simply absent from the dict.

        Not netted against refunds for non-cash methods: Refund.refund_type
        only distinguishes CASH refunds from everything else (FULL/PARTIAL/
        REPLACEMENT are refund *scope*, not a payment method), so a reliable
        per-method refund breakdown isn't derivable from the current schema.
        Cash is the one method refunds can be netted against precisely — see
        get_cash_total_for_session / get_cash_refunds_for_session, which the
        cash-drawer reconciliation (expected_balance) actually uses.
        """
        from app.sales.models import Order
        from app.core.constants import PaymentStatus

        result = await self.session.execute(
            select(
                Payment.payment_method,
                func.coalesce(func.sum(Payment.amount), Decimal("0")),
            )
            .join(Order, Order.id == Payment.order_id)
            .where(
                Order.cashier_session_id == cashier_session_id,
                Order.tenant_id == tenant_id,
                Payment.payment_status == PaymentStatus.PAID,
            )
            .group_by(Payment.payment_method)
        )
        return {method: total for method, total in result.all()}

    async def get_cash_refunds_for_session(
        self,
        cashier_session_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Decimal:
        """Sum of cash refunds actually processed during a cashier session —
        i.e. the session open at refund time, which may differ from the
        session that made the original sale (a return in a later shift)."""
        from app.payments.models import Refund

        result = await self.session.execute(
            select(func.coalesce(func.sum(Refund.amount), Decimal("0")))
            .where(
                Refund.cashier_session_id == cashier_session_id,
                Refund.tenant_id == tenant_id,
                Refund.refund_type == "CASH",
            )
        )
        return result.scalar_one()

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        order_id: uuid.UUID | None = None,
        payment_method: str | None = None,
        payment_status: str | None = None,
    ) -> tuple[list[Payment], int]:
        filters: list[Any] = [Payment.tenant_id == tenant_id]
        if order_id:
            filters.append(Payment.order_id == order_id)
        if payment_method:
            filters.append(Payment.payment_method == payment_method)
        if payment_status:
            filters.append(Payment.payment_status == payment_status)
        return await self.get_all(offset=offset, limit=limit, filters=filters)


class RefundRepository(BaseRepository[Refund]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Refund, session)

    async def get_with_items(self, refund_id: uuid.UUID) -> Refund | None:
        result = await self.session.execute(
            select(Refund)
            .options(selectinload(Refund.items))
            .where(Refund.id == refund_id)
        )
        return result.scalar_one_or_none()

    async def get_by_order(self, order_id: uuid.UUID) -> list[Refund]:
        result = await self.session.execute(
            select(Refund)
            .options(selectinload(Refund.items))
            .where(Refund.order_id == order_id)
        )
        return list(result.scalars().all())

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        order_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[Refund], int]:
        filters: list[Any] = [Refund.tenant_id == tenant_id]
        if order_id:
            filters.append(Refund.order_id == order_id)
        if branch_id:
            # Refund has no branch_id of its own — reach it through its order.
            filters.append(
                Refund.order_id.in_(
                    select(Order.id).where(Order.branch_id == branch_id)
                )
            )
        if cashier_user_id:
            filters.append(
                or_(
                    Refund.processed_by == cashier_user_id,
                    Refund.order_id.in_(
                        select(Order.id)
                        .join(CashierSession, Order.cashier_session_id == CashierSession.id)
                        .where(CashierSession.cashier_user_id == cashier_user_id)
                    ),
                )
            )
        return await self.get_all(
            offset=offset,
            limit=limit,
            filters=filters,
            order_by=Refund.processed_at.desc(),
        )

    async def get_by_refund_number(self, refund_number: str) -> Refund | None:
        result = await self.session.execute(
            select(Refund).where(Refund.refund_number == refund_number)
        )
        return result.scalar_one_or_none()
