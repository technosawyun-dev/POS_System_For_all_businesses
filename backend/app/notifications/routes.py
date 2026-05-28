from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import CurrentUser, DbSession, RequestId, require_manager_or_above
from app.notifications.schemas import (
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdateRequest,
    UnreadCountResponse,
)
from app.notifications.services import NotificationService
from app.schemas.common import PaginatedResponse, SuccessResponse

router = APIRouter()


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications for current user",
)
async def list_notifications(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    type: str | None = Query(default=None, description="Filter by notification type"),
    priority: str | None = Query(default=None, description="Filter by priority"),
    read: bool | None = Query(default=None, description="Filter by read status"),
) -> NotificationListResponse:
    svc = NotificationService(db)
    # super_admin has no tenant_id on their JWT; pass None so they see platform notifs
    effective_tenant = current_user.tenant_id if current_user.tenant_id else None
    items, total = await svc.list_notifications(
        user_id=current_user.id,
        tenant_id=effective_tenant,
        page=page,
        page_size=page_size,
        type_filter=type,
        priority_filter=priority,
        is_read_filter=read,
    )
    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count for current user",
)
async def get_unread_count(
    db: DbSession,
    current_user: CurrentUser,
) -> UnreadCountResponse:
    svc = NotificationService(db)
    effective_tenant = current_user.tenant_id if current_user.tenant_id else None
    count = await svc.unread_count(
        user_id=current_user.id,
        tenant_id=effective_tenant,
    )
    return UnreadCountResponse(unread_count=count)


@router.post(
    "/{notification_id}/read",
    response_model=SuccessResponse,
    summary="Mark a notification as read",
)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    svc = NotificationService(db)
    effective_tenant = current_user.tenant_id if current_user.tenant_id else None
    await svc.mark_read(
        notification_id=notification_id,
        user_id=current_user.id,
        tenant_id=effective_tenant,
        request_id=request_id,
    )
    return SuccessResponse(message="Notification marked as read")


@router.post(
    "/read-all",
    response_model=SuccessResponse,
    summary="Mark all notifications as read for current user",
)
async def mark_all_read(
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    svc = NotificationService(db)
    effective_tenant = current_user.tenant_id if current_user.tenant_id else None
    count = await svc.mark_all_read(
        user_id=current_user.id,
        tenant_id=effective_tenant,
        request_id=request_id,
    )
    return SuccessResponse(message=f"{count} notification(s) marked as read")


@router.get(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    summary="Get notification preferences for current user",
)
async def get_preferences(
    db: DbSession,
    current_user: CurrentUser,
) -> NotificationPreferenceResponse:
    svc = NotificationService(db)
    pref = await svc.get_preferences(current_user.id)
    return NotificationPreferenceResponse.model_validate(pref)


@router.patch(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    summary="Update notification preferences for current user",
)
async def update_preferences(
    data: NotificationPreferenceUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> NotificationPreferenceResponse:
    svc = NotificationService(db)
    pref = await svc.update_preferences(
        user_id=current_user.id,
        data=data,
        request_id=request_id,
    )
    return NotificationPreferenceResponse.model_validate(pref)
