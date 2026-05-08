from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reseller import ResellerAssignment
from app.repositories.base import BaseRepository


class ResellerRepository(BaseRepository[ResellerAssignment]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ResellerAssignment, session)

    async def get_by_reseller_and_tenant(
        self, reseller_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> ResellerAssignment | None:
        stmt = select(ResellerAssignment).where(
            ResellerAssignment.reseller_id == reseller_id,
            ResellerAssignment.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_reseller(self, reseller_id: uuid.UUID) -> list[ResellerAssignment]:
        stmt = select(ResellerAssignment).where(
            ResellerAssignment.reseller_id == reseller_id,
            ResellerAssignment.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_tenant(self, tenant_id: uuid.UUID) -> list[ResellerAssignment]:
        stmt = select(ResellerAssignment).where(ResellerAssignment.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
