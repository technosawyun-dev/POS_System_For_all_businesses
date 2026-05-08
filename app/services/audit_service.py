from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.audit_repository import AuditRepository


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit_repo = AuditRepository(session)

    async def log(
        self,
        action: str,
        actor_user_id: uuid.UUID | None = None,
        tenant_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        entity_type: str | None = None,
        entity_id: Any = None,
        before_state: dict[str, Any] | None = None,
        after_state: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> None:
        await self.audit_repo.create_log(
            action=action,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            before_state=before_state,
            after_state=after_state,
            metadata=metadata,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )
