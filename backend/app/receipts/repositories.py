from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.receipts.models import Receipt
from app.repositories.base import BaseRepository


class ReceiptRepository(BaseRepository[Receipt]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Receipt, session)

    async def get_by_order(self, order_id: uuid.UUID) -> Receipt | None:
        result = await self.session.execute(
            select(Receipt).where(Receipt.order_id == order_id)
        )
        return result.scalar_one_or_none()

    async def get_by_receipt_number(self, receipt_number: str) -> Receipt | None:
        result = await self.session.execute(
            select(Receipt).where(Receipt.receipt_number == receipt_number)
        )
        return result.scalar_one_or_none()

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[Receipt], int]:
        filters: list[Any] = [Receipt.tenant_id == tenant_id]
        if branch_id:
            filters.append(Receipt.branch_id == branch_id)
        return await self.get_all(
            offset=offset,
            limit=limit,
            filters=filters,
            order_by=Receipt.issued_at.desc(),
        )

    async def get_by_id_and_tenant(
        self,
        receipt_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Receipt | None:
        result = await self.session.execute(
            select(Receipt).where(
                Receipt.id == receipt_id,
                Receipt.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()
