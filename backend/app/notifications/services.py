from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, NotificationType
from app.core.exceptions import NotFoundError
from app.notifications.models import Notification, NotificationRecipient
from app.notifications.repositories import (
    NotificationPreferenceRepository,
    NotificationRecipientRepository,
    NotificationRepository,
)
from app.notifications.schemas import (
    NotificationPreferenceUpdateRequest,
    NotificationSummaryResponse,
)
from app.services.audit_service import AuditService


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.notif_repo = NotificationRepository(session)
        self.recipient_repo = NotificationRecipientRepository(session)
        self.pref_repo = NotificationPreferenceRepository(session)
        self.audit = AuditService(session)


    async def create_notification(
        self,
        *,
        tenant_id: uuid.UUID | None,
        type: str,
        priority: str,
        title: str,
        message: str,
        recipient_ids: list[uuid.UUID],
        metadata: dict | None = None,
        expires_at: datetime | None = None,
        actor_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> Notification:
        notification = await self.notif_repo.create(
            tenant_id=tenant_id,
            type=type,
            priority=priority,
            title=title,
            message=message,
            metadata=metadata,
            expires_at=expires_at,
        )

        if recipient_ids:
            await self.recipient_repo.create_many(
                notification_id=notification.id,
                user_ids=recipient_ids,
            )

        await self.audit.log(
            action=AuditAction.NOTIFICATION_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.NOTIFICATION,
            entity_id=notification.id,
            after_state={
                "type": type,
                "priority": priority,
                "title": title,
                "recipient_count": len(recipient_ids),
            },
            request_id=request_id,
        )

        return notification

    async def notify_users(
        self,
        *,
        tenant_id: uuid.UUID | None,
        type: str,
        priority: str,
        title: str,
        message: str,
        user_ids: list[uuid.UUID],
        metadata: dict | None = None,
        expires_at: datetime | None = None,
    ) -> Notification:
        """Convenience wrapper: create_notification without actor/request_id."""
        return await self.create_notification(
            tenant_id=tenant_id,
            type=type,
            priority=priority,
            title=title,
            message=message,
            recipient_ids=user_ids,
            metadata=metadata,
            expires_at=expires_at,
        )


    async def mark_read(
        self,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        request_id: str | None = None,
    ) -> NotificationRecipient:
        recipient = await self.recipient_repo.get_by_notification_and_user(
            notification_id=notification_id,
            user_id=user_id,
        )
        if recipient is None:
            raise NotFoundError("Notification", notification_id)

        if recipient.is_read:
            return recipient

        now = datetime.now(timezone.utc)
        recipient = await self.recipient_repo.mark_read(recipient, now)

        await self.audit.log(
            action=AuditAction.NOTIFICATION_READ,
            actor_user_id=user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.NOTIFICATION,
            entity_id=notification_id,
            request_id=request_id,
        )

        return recipient

    async def mark_all_read(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        request_id: str | None = None,
    ) -> int:
        now = datetime.now(timezone.utc)
        count = await self.recipient_repo.mark_all_read(
            user_id=user_id,
            tenant_id=tenant_id,
            now=now,
        )

        if count > 0:
            await self.audit.log(
                action=AuditAction.NOTIFICATION_READ_ALL,
                actor_user_id=user_id,
                tenant_id=tenant_id,
                metadata={"count": count},
                request_id=request_id,
            )

        return count


    async def list_notifications(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        page: int = 1,
        page_size: int = 20,
        type_filter: str | None = None,
        priority_filter: str | None = None,
        is_read_filter: bool | None = None,
    ) -> tuple[list[NotificationSummaryResponse], int]:
        offset = (page - 1) * page_size
        rows, total = await self.notif_repo.list_for_user(
            user_id=user_id,
            tenant_id=tenant_id,
            offset=offset,
            limit=page_size,
            type_filter=type_filter,
            priority_filter=priority_filter,
            is_read_filter=is_read_filter,
        )
        items = [
            NotificationSummaryResponse(
                id=notif.id,
                type=notif.type,
                priority=notif.priority,
                title=notif.title,
                message=notif.message,
                metadata_=notif.metadata_,
                expires_at=notif.expires_at,
                is_read=is_read,
                read_at=read_at,
                created_at=notif.created_at,
            )
            for notif, is_read, read_at in rows
        ]
        return items, total

    async def unread_count(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
    ) -> int:
        return await self.notif_repo.get_unread_count(
            user_id=user_id,
            tenant_id=tenant_id,
        )

    async def delete_expired(self) -> int:
        now = datetime.now(timezone.utc)
        return await self.notif_repo.delete_expired(now)


    async def get_preferences(self, user_id: uuid.UUID):  # type: ignore[return]
        return await self.pref_repo.get_or_create(user_id)

    async def update_preferences(
        self,
        user_id: uuid.UUID,
        data: NotificationPreferenceUpdateRequest,
        request_id: str | None = None,
    ):  # type: ignore[return]
        pref = await self.pref_repo.get_or_create(user_id)
        updates = data.model_dump(exclude_none=True)
        if updates:
            pref = await self.pref_repo.update(pref, **updates)
            await self.audit.log(
                action=AuditAction.NOTIFICATION_PREFERENCE_UPDATED,
                actor_user_id=user_id,
                entity_type=EntityType.NOTIFICATION_PREFERENCE,
                entity_id=pref.id,
                after_state=updates,
                request_id=request_id,
            )
        return pref


    async def is_email_enabled_for_type(
        self,
        user_id: uuid.UUID,
        notification_type: str,
    ) -> bool:
        """Check whether a user has email delivery enabled for a notification type."""
        pref = await self.pref_repo.get_or_create(user_id)
        if not pref.email_enabled:
            return False
        type_map = {
            NotificationType.INVENTORY: pref.inventory_enabled,
            NotificationType.PROCUREMENT: pref.procurement_enabled,
            NotificationType.CUSTOMER: pref.customer_enabled,
            NotificationType.SUBSCRIPTION: pref.subscription_enabled,
            NotificationType.SECURITY: pref.security_enabled,
            NotificationType.SYSTEM: True,  # system notifications always allowed if email on
        }
        return type_map.get(notification_type, True)
