from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import Branch, BranchSettings
from app.repositories.base import BaseRepository


class BranchRepository(BaseRepository[Branch]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Branch, session)

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        include_deleted: bool = False,
    ) -> tuple[list[Branch], int]:
        filters = [Branch.tenant_id == tenant_id]
        if not include_deleted:
            filters.append(Branch.is_deleted.is_(False))
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def get_active_by_id(self, branch_id: uuid.UUID) -> Branch | None:
        stmt = select(Branch).where(Branch.id == branch_id, Branch.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_by_id_and_tenant(
        self, branch_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Branch | None:
        stmt = select(Branch).where(
            Branch.id == branch_id,
            Branch.tenant_id == tenant_id,
            Branch.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def code_exists_in_tenant(
        self, code: str, tenant_id: uuid.UUID, exclude_id: uuid.UUID | None = None
    ) -> bool:
        stmt = select(Branch.id).where(
            Branch.code == code,
            Branch.tenant_id == tenant_id,
            Branch.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(Branch.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def soft_delete(self, branch: Branch) -> Branch:
        branch.is_deleted = True
        branch.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
        return branch

    async def get_settings(self, branch_id: uuid.UUID) -> BranchSettings | None:
        stmt = select(BranchSettings).where(BranchSettings.branch_id == branch_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_settings(self, branch_id: uuid.UUID, tenant_id: uuid.UUID) -> BranchSettings:
        settings = BranchSettings(branch_id=branch_id, tenant_id=tenant_id)
        self.session.add(settings)
        await self.session.flush()
        await self.session.refresh(settings)
        return settings
