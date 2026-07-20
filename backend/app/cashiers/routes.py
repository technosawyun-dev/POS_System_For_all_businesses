from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    assert_branch_access,
    require_roles,
    scope_branch_filter,
)
from app.cashiers.schemas import (
    CashierSessionClosePreviewResponse,
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
    assert_branch_access(current_user, data.branch_id)
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


@router.get(
    "/mine/open",
    response_model=list[CashierSessionResponse],
    summary="List the current user's own open cashier sessions (any branch)",
)
async def get_my_open_sessions(
    db: DbSession,
    current_user: User = _cashier_access,
) -> list[CashierSessionResponse]:
    svc = CashierSessionService(db)
    sessions = await svc.get_my_open_sessions(current_user.id)
    return [CashierSessionResponse.model_validate(s) for s in sessions]


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
    existing = await svc.get_session(session_id, tenant_id)
    assert_branch_access(current_user, existing.branch_id)
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
    "/{session_id}/close-preview",
    response_model=CashierSessionClosePreviewResponse,
    summary="Preview cash reconciliation figures before closing a session",
)
async def get_close_preview(
    session_id: uuid.UUID,
    db: DbSession,
    current_user: User = _cashier_access,
    tenant_id: EffectiveTenantId = None,
) -> CashierSessionClosePreviewResponse:
    svc = CashierSessionService(db)
    existing = await svc.get_session(session_id, tenant_id)
    assert_branch_access(current_user, existing.branch_id)
    preview = await svc.get_close_preview(session_id, tenant_id)
    return CashierSessionClosePreviewResponse(**preview)


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
    assert_branch_access(current_user, session.branch_id)
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
    branch_id = scope_branch_filter(current_user, branch_id)
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
