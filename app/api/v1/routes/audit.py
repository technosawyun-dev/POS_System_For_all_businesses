from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    require_tenant_admin,
)
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditLogResponse
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.get(
    "/logs",
    response_model=PaginatedResponse[AuditLogResponse],
    summary="List audit logs",
    dependencies=[Depends(require_tenant_admin)],
)
async def list_audit_logs(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    action: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
) -> PaginatedResponse[AuditLogResponse]:
    repo = AuditRepository(db)
    tenant_id = current_user.tenant_id
    if not tenant_id:
        return PaginatedResponse.create(items=[], total=0, page=page, page_size=page_size)

    offset = (page - 1) * page_size
    logs, total = await repo.get_by_tenant(
        tenant_id=tenant_id,
        offset=offset,
        limit=page_size,
        action=action,
        date_from=date_from,
        date_to=date_to,
    )
    return PaginatedResponse.create(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )
