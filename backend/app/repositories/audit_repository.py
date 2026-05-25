from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.repositories.base import BaseRepository


class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AuditLog, session)

    async def create_log(
        self,
        action: str,
        actor_user_id: uuid.UUID | None = None,
        tenant_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        before_state: dict[str, Any] | None = None,
        after_state: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> AuditLog:
        log = AuditLog(
            action=action,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            before_state=before_state,
            after_state=after_state,
            metadata_=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        action: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[AuditLog], int]:
        filters = [AuditLog.tenant_id == tenant_id]
        if action:
            filters.append(AuditLog.action == action)
        if date_from:
            filters.append(AuditLog.created_at >= date_from)
        if date_to:
            filters.append(AuditLog.created_at <= date_to)
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def get_platform_logs(
        self,
        offset: int = 0,
        limit: int = 20,
        action: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tenant_id: uuid.UUID | None = None,
    ) -> tuple[list[AuditLog], int]:
        filters = []
        if tenant_id:
            filters.append(AuditLog.tenant_id == tenant_id)
        if action:
            filters.append(AuditLog.action == action)
        if date_from:
            filters.append(AuditLog.created_at >= date_from)
        if date_to:
            filters.append(AuditLog.created_at <= date_to)
        return await self.get_all(offset=offset, limit=limit, filters=filters or None)
