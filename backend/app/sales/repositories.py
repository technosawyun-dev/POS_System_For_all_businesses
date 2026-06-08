from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cashiers.models import CashierSession
from app.repositories.base import BaseRepository
from app.sales.models import BranchCounter, Cart, CartItem, Order, OrderItem


class BranchCounterRepository:
    """Manages sequential order/receipt number generation per branch."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_or_create_locked(self, branch_id: uuid.UUID) -> BranchCounter:
        """
        Upsert a counter row then acquire a row-level lock.
        Same pattern as BranchInventoryRepository.get_or_create_locked().
        """
        stmt = (
            pg_insert(BranchCounter)
            .values(branch_id=branch_id, order_seq=0, receipt_seq=0)
            .on_conflict_do_nothing(constraint="uq_branch_counters_branch_id")
        )
        await self.session.execute(stmt)

        result = await self.session.execute(
            select(BranchCounter)
            .where(BranchCounter.branch_id == branch_id)
            .with_for_update()
        )
        return result.scalar_one()

    async def next_order_number(self, branch_id: uuid.UUID, branch_code: str) -> str:
        counter = await self.get_or_create_locked(branch_id)
        counter.order_seq += 1
        await self.session.flush()
        return f"ORD-{branch_code}-{counter.order_seq:08d}"

    async def next_receipt_number(self, branch_id: uuid.UUID, branch_code: str) -> str:
        counter = await self.get_or_create_locked(branch_id)
        counter.receipt_seq += 1
        await self.session.flush()
        return f"REC-{branch_code}-{counter.receipt_seq:08d}"


class CartRepository(BaseRepository[Cart]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Cart, session)

    async def get_with_items(self, cart_id: uuid.UUID) -> Cart | None:
        result = await self.session.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.id == cart_id)
        )
        return result.scalar_one_or_none()

    async def get_by_session(
        self,
        cashier_session_id: uuid.UUID,
    ) -> list[Cart]:
        result = await self.session.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.cashier_session_id == cashier_session_id)
        )
        return list(result.scalars().all())


class OrderRepository(BaseRepository[Order]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Order, session)

    async def get_with_details(self, order_id: uuid.UUID) -> Order | None:
        result = await self.session.execute(
            select(Order)
            .options(
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.refunds),
            )
            .where(Order.id == order_id)
        )
        return result.scalar_one_or_none()

    async def get_by_order_number(self, order_number: str) -> Order | None:
        result = await self.session.execute(
            select(Order).where(Order.order_number == order_number)
        )
        return result.scalar_one_or_none()

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        branch_id: uuid.UUID | None = None,
        cashier_session_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
        order_status: str | None = None,
        payment_status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[Order], int]:
        filters: list[Any] = [Order.tenant_id == tenant_id]
        if branch_id:
            filters.append(Order.branch_id == branch_id)
        if cashier_session_id:
            filters.append(Order.cashier_session_id == cashier_session_id)
        if cashier_user_id:
            filters.append(
                Order.cashier_session_id.in_(
                    select(CashierSession.id).where(
                        CashierSession.cashier_user_id == cashier_user_id
                    )
                )
            )
        if order_status:
            filters.append(Order.order_status == order_status)
        if payment_status:
            filters.append(Order.payment_status == payment_status)
        if date_from:
            filters.append(Order.created_at >= date_from)
        if date_to:
            filters.append(Order.created_at <= date_to)

        where_clause = and_(*filters)
        count_stmt = select(func.count()).select_from(Order).where(where_clause)
        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = (
            select(Order)
            .options(selectinload(Order.payments))
            .where(where_clause)
            .order_by(Order.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        items = list(result.scalars().all())
        return items, total

    async def get_by_id_and_tenant(
        self,
        order_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Order | None:
        result = await self.session.execute(
            select(Order).where(
                Order.id == order_id,
                Order.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()


class OrderItemRepository(BaseRepository[OrderItem]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(OrderItem, session)

    async def get_by_order(self, order_id: uuid.UUID) -> list[OrderItem]:
        result = await self.session.execute(
            select(OrderItem).where(OrderItem.order_id == order_id)
        )
        return list(result.scalars().all())
