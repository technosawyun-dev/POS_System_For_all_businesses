from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    require_roles,
)
from app.cashiers.schemas import (
    CashierSessionListResponse,
    CashierSessionResponse,
    CloseSessionRequest,
    OpenSessionRequest,
)
from app.cashiers.services import CashierSessionService
from app.core.constants import UserRole
from app.models.user import User

router = APIRouter()

_cashier_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
)
_manager_access = require_roles(
    UserRole.SUPER_ADMIN,
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
)


@router.post(
    "",
    response_model=CashierSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Open cashier session",
)
async def open_session(
    data: OpenSessionRequest,
    db: DbSession,
    current_user: User = _cashier_access,
    tenant_id: EffectiveTenantId = None,
    request_id: RequestId = None,
) -> CashierSessionResponse:
    svc = CashierSessionService(db)
    session = await svc.open_session(
        tenant_id=tenant_id,
        branch_id=data.branch_id,
        cashier_user_id=current_user.id,
        opening_balance=data.opening_balance,
        notes=data.notes,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return CashierSessionResponse.model_validate(session)


@router.post(
    "/{session_id}/close",
    response_model=CashierSessionResponse,
    summary="Close cashier session",
)
async def close_session(
    session_id: uuid.UUID,
    data: CloseSessionRequest,
    db: DbSession,
    current_user: User = _cashier_access,
    tenant_id: EffectiveTenantId = None,
    request_id: RequestId = None,
) -> CashierSessionResponse:
    svc = CashierSessionService(db)
    session = await svc.close_session(
        session_id=session_id,
        tenant_id=tenant_id,
        actual_balance=data.actual_balance,
        closing_notes=data.notes,
        actor_user_id=current_user.id,
        request_id=request_id,
    )
    return CashierSessionResponse.model_validate(session)


@router.get(
    "/{session_id}",
    response_model=CashierSessionResponse,
    summary="Get cashier session",
)
async def get_session(
    session_id: uuid.UUID,
    db: DbSession,
    current_user: User = _cashier_access,
    tenant_id: EffectiveTenantId = None,
) -> CashierSessionResponse:
    svc = CashierSessionService(db)
    session = await svc.get_session(session_id, tenant_id)
    return CashierSessionResponse.model_validate(session)


@router.get(
    "",
    response_model=CashierSessionListResponse,
    summary="List cashier sessions",
)
async def list_sessions(
    db: DbSession,
    current_user: User = _manager_access,
    tenant_id: EffectiveTenantId = None,
    branch_id: uuid.UUID | None = Query(default=None),
    cashier_user_id: uuid.UUID | None = Query(default=None),
    session_status: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> CashierSessionListResponse:
    svc = CashierSessionService(db)
    items, total = await svc.list_sessions(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        branch_id=branch_id,
        cashier_user_id=cashier_user_id,
        status=session_status,
    )
    return CashierSessionListResponse(
        items=[CashierSessionResponse.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )
