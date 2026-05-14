from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cashiers.models import CashierSession
from app.core.constants import CashierSessionStatus
from app.repositories.base import BaseRepository


class CashierSessionRepository(BaseRepository[CashierSession]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(CashierSession, session)

    async def get_open_session(
        self,
        cashier_user_id: uuid.UUID,
        branch_id: uuid.UUID,
    ) -> CashierSession | None:
        result = await self.session.execute(
            select(CashierSession).where(
                CashierSession.cashier_user_id == cashier_user_id,
                CashierSession.branch_id == branch_id,
                CashierSession.status == CashierSessionStatus.OPEN,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        branch_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[CashierSession], int]:
        filters: list[Any] = [CashierSession.tenant_id == tenant_id]
        if branch_id:
            filters.append(CashierSession.branch_id == branch_id)
        if cashier_user_id:
            filters.append(CashierSession.cashier_user_id == cashier_user_id)
        if status:
            filters.append(CashierSession.status == status)
        return await self.get_all(
            offset=offset,
            limit=limit,
            filters=filters,
            order_by=CashierSession.opened_at.desc(),
        )

    async def get_by_id_and_tenant(
        self,
        session_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> CashierSession | None:
        result = await self.session.execute(
            select(CashierSession).where(
                CashierSession.id == session_id,
                CashierSession.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()
