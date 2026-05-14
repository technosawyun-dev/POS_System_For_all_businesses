from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.base import BaseRepository
from app.sync.models import SyncCheckpoint, SyncOperation


class SyncCheckpointRepository(BaseRepository[SyncCheckpoint]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SyncCheckpoint, session)

    async def get_by_device_and_entity(
        self, device_id: uuid.UUID, entity_type: str
    ) -> SyncCheckpoint | None:
        stmt = select(SyncCheckpoint).where(
            SyncCheckpoint.device_id == device_id,
            SyncCheckpoint.entity_type == entity_type,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_for_device(self, device_id: uuid.UUID) -> list[SyncCheckpoint]:
        stmt = select(SyncCheckpoint).where(SyncCheckpoint.device_id == device_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def upsert(
        self,
        device_id: uuid.UUID,
        entity_type: str,
        last_synced_at: Any,
        last_sync_version: int,
    ) -> SyncCheckpoint:
        existing = await self.get_by_device_and_entity(device_id, entity_type)
        if existing:
            return await self.update(
                existing,
                last_synced_at=last_synced_at,
                last_sync_version=last_sync_version,
            )
        return await self.create(
            device_id=device_id,
            entity_type=entity_type,
            last_synced_at=last_synced_at,
            last_sync_version=last_sync_version,
        )


class SyncOperationRepository(BaseRepository[SyncOperation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SyncOperation, session)

    async def get_by_operation_uuid(
        self, operation_uuid: str, tenant_id: uuid.UUID
    ) -> SyncOperation | None:
        stmt = select(SyncOperation).where(
            SyncOperation.operation_uuid == operation_uuid,
            SyncOperation.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_retryable_failed(
        self, max_retries: int = 3, limit: int = 50
    ) -> list[SyncOperation]:
        """Return FAILED operations that have not exceeded max_retries."""
        stmt = (
            select(SyncOperation)
            .where(
                SyncOperation.status == "FAILED",
                SyncOperation.retry_count < max_retries,
            )
            .order_by(SyncOperation.created_at.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_for_tenant(
        self,
        tenant_id: uuid.UUID,
        device_id: uuid.UUID | None = None,
        status: str | None = None,
        operation_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SyncOperation], int]:
        filters: list[Any] = [SyncOperation.tenant_id == tenant_id]
        if device_id is not None:
            filters.append(SyncOperation.device_id == device_id)
        if status is not None:
            filters.append(SyncOperation.status == status)
        if operation_type is not None:
            filters.append(SyncOperation.operation_type == operation_type)
        offset = (page - 1) * page_size
        return await self.get_all(offset=offset, limit=page_size, filters=filters)
