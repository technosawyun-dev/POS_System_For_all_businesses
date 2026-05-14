from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.devices.models import PosDevice
from app.repositories.base import BaseRepository


class DeviceRepository(BaseRepository[PosDevice]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(PosDevice, session)

    async def get_by_id_for_tenant(
        self, device_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> PosDevice | None:
        stmt = select(PosDevice).where(
            PosDevice.id == device_id,
            PosDevice.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_device_uuid(
        self, device_uuid: str, tenant_id: uuid.UUID
    ) -> PosDevice | None:
        stmt = select(PosDevice).where(
            PosDevice.device_uuid == device_uuid,
            PosDevice.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_for_tenant(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PosDevice], int]:
        filters: list[Any] = [PosDevice.tenant_id == tenant_id]
        if branch_id is not None:
            filters.append(PosDevice.branch_id == branch_id)
        if is_active is not None:
            filters.append(PosDevice.is_active == is_active)
        offset = (page - 1) * page_size
        return await self.get_all(offset=offset, limit=page_size, filters=filters)
