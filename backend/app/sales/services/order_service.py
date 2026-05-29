from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.sales.models import Order
from app.sales.repositories import OrderRepository


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.order_repo = OrderRepository(session)

    async def get_order(
        self,
        order_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Order:
        order = await self.order_repo.get_with_details(order_id)
        if not order or order.tenant_id != tenant_id:
            raise NotFoundError("Order", order_id)
        return order

    async def get_order_by_number(
        self,
        order_number: str,
        tenant_id: uuid.UUID,
    ) -> Order:
        order = await self.order_repo.get_by_order_number(order_number)
        if not order or order.tenant_id != tenant_id:
            raise NotFoundError("Order", order_number)
        return await self.order_repo.get_with_details(order.id)

    async def list_orders(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        branch_id: uuid.UUID | None = None,
        cashier_session_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
        order_status: str | None = None,
        payment_status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[Order], int]:
        offset = (page - 1) * page_size
        return await self.order_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            branch_id=branch_id,
            cashier_session_id=cashier_session_id,
            cashier_user_id=cashier_user_id,
            order_status=order_status,
            payment_status=payment_status,
            date_from=date_from,
            date_to=date_to,
        )
