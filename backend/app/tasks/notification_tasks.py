from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from app.core.logging import get_logger
from app.tasks.celery_app import celery_app

logger = get_logger(__name__)


def _run(coro: Any) -> Any:
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="app.tasks.notification_tasks.process_expired_subscriptions",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def process_expired_subscriptions(self: Any) -> dict:
    """Daily: expire all TRIAL/ACTIVE subscriptions past their expires_at."""
    async def _run_async() -> dict:
        from app.db.session import AsyncSessionLocal
        from app.subscriptions.repositories import TenantSubscriptionRepository
        from app.subscriptions.models import SubscriptionHistory
        from app.core.constants import (
            AuditAction,
            EntityType,
            NotificationPriority,
            NotificationType,
            SubscriptionChangeType,
            SubscriptionStatus,
        )
        from app.services.audit_service import AuditService
        from app.notifications.services import NotificationService
        from sqlalchemy import select
        from app.models.user import User

        now = datetime.now(timezone.utc)
        expired_count = 0

        async with AsyncSessionLocal() as session:
            sub_repo = TenantSubscriptionRepository(session)
            audit = AuditService(session)
            notif_svc = NotificationService(session)
            expired_subs = await sub_repo.get_expired(now)

            for sub in expired_subs:
                old_status = sub.status
                sub.status = SubscriptionStatus.EXPIRED

                history = SubscriptionHistory(
                    tenant_id=sub.tenant_id,
                    subscription_id=sub.id,
                    change_type=SubscriptionChangeType.EXPIRED,
                    old_status=old_status,
                    new_status=SubscriptionStatus.EXPIRED,
                    note="Auto-expired by daily scheduler",
                )
                session.add(history)

                await audit.log(
                    action=AuditAction.SUBSCRIPTION_EXPIRED,
                    tenant_id=sub.tenant_id,
                    entity_type=EntityType.TENANT_SUBSCRIPTION,
                    entity_id=sub.id,
                    after_state={"previous_status": old_status, "source": "scheduler"},
                )

                # Notify all active users in the tenant
                try:
                    stmt = select(User).where(
                        User.tenant_id == sub.tenant_id,
                        User.is_deleted.is_(False),
                    )
                    result = await session.execute(stmt)
                    users = list(result.scalars().all())
                    recipient_ids = [u.id for u in users]

                    if recipient_ids:
                        plan_name = sub.plan.name if sub.plan else "your plan"
                        await notif_svc.create_notification(
                            tenant_id=sub.tenant_id,
                            type=NotificationType.SUBSCRIPTION,
                            priority=NotificationPriority.CRITICAL,
                            title="Subscription Expired — Action Required",
                            message=(
                                f"Your {plan_name} subscription has expired. "
                                "Access to business features is now restricted. "
                                "Submit a payment proof to reactivate your account."
                            ),
                            recipient_ids=recipient_ids,
                            metadata={
                                "plan_code": sub.plan.code if sub.plan else "",
                                "expired_at": now.isoformat(),
                                "event": "subscription_expired",
                            },
                        )
                except Exception as notif_exc:
                    logger.warning(
                        "expiry_notification_failed",
                        tenant_id=str(sub.tenant_id),
                        error=str(notif_exc),
                    )

                expired_count += 1

            await session.commit()

        logger.info("subscriptions_expired_batch", count=expired_count)
        return {"expired": expired_count}

    try:
        return _run(_run_async())
    except Exception as exc:
        logger.error("process_expired_subscriptions_failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.notification_tasks.send_trial_reminders",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def send_trial_reminders(self: Any) -> dict:
    """Daily: send trial expiry reminders at 7, 3, 1 days before expiration.

    Uses Redis to deduplicate: each (tenant_id, days_remaining, date) combo is
    sent at most once.  If Redis is unavailable the task falls back to sending
    without deduplication rather than failing silently.
    """
    async def _run_async() -> dict:
        from app.db.session import AsyncSessionLocal
        from app.subscriptions.repositories import TenantSubscriptionRepository
        from app.notifications.services import NotificationService
        from app.core.constants import NotificationPriority, NotificationType
        from sqlalchemy import select as sel
        from app.models.user import User
        from app.db.redis import get_redis_pool

        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        reminder_days = [7, 3, 1]
        sent = 0

        # Redis for idempotency; non-fatal if unavailable
        try:
            redis = await get_redis_pool()
        except Exception:
            redis = None

        async def _already_sent(tenant_id: str, days: int) -> bool:
            if redis is None:
                return False
            key = f"reminder_sent:{tenant_id}:{days}:{today_str}"
            return bool(await redis.exists(key))

        async def _mark_sent(tenant_id: str, days: int) -> None:
            if redis is None:
                return
            key = f"reminder_sent:{tenant_id}:{days}:{today_str}"
            await redis.set(key, "1", ex=90000)  # 25-hour TTL

        async with AsyncSessionLocal() as session:
            sub_repo = TenantSubscriptionRepository(session)
            notif_svc = NotificationService(session)

            for days in reminder_days:
                expiring = await sub_repo.get_expiring_trials(days, now)
                for sub in expiring:
                    tenant_id_str = str(sub.tenant_id)

                    if await _already_sent(tenant_id_str, days):
                        logger.debug(
                            "trial_reminder_skipped_duplicate",
                            tenant_id=tenant_id_str,
                            days=days,
                        )
                        continue

                    stmt = sel(User).where(
                        User.tenant_id == sub.tenant_id,
                        User.is_deleted.is_(False),
                    )
                    result = await session.execute(stmt)
                    users = list(result.scalars().all())
                    recipient_ids = [u.id for u in users]

                    if not recipient_ids:
                        continue

                    priority = NotificationPriority.HIGH if days <= 1 else NotificationPriority.MEDIUM
                    await notif_svc.create_notification(
                        tenant_id=sub.tenant_id,
                        type=NotificationType.SUBSCRIPTION,
                        priority=priority,
                        title=f"Trial expires in {days} day{'s' if days > 1 else ''}",
                        message=(
                            f"Your {sub.plan.name} trial expires in {days} day{'s' if days > 1 else ''}. "
                            "Upgrade now to keep access to all features."
                        ),
                        recipient_ids=recipient_ids,
                        metadata={"days_remaining": days, "plan_code": sub.plan.code},
                    )

                    await _mark_sent(tenant_id_str, days)
                    sent += 1

            await session.commit()

        logger.info("trial_reminders_sent", count=sent)
        return {"reminders_sent": sent}

    try:
        return _run(_run_async())
    except Exception as exc:
        logger.error("send_trial_reminders_failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.notification_tasks.send_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_notification(self: Any, user_id: str, notification_type: str, payload: dict) -> dict:
    """Generic notification dispatch task (kept for backward compatibility)."""
    logger.info(
        "notification_task",
        user_id=user_id,
        notification_type=notification_type,
        task_id=self.request.id,
    )
    return {"status": "queued", "user_id": user_id, "type": notification_type}


@celery_app.task(
    name="app.tasks.notification_tasks.send_email_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_email_task(
    self: Any,
    to: str,
    template_name: str,
    context: dict[str, Any],
    user_id: str | None = None,
) -> dict[str, Any]:
    """Deliver an email notification. Resolves recipient address from user_id if to is empty."""
    from app.notifications.tasks import _send_email_async

    logger.info(
        "send_email_task",
        template=template_name,
        user_id=user_id,
        task_id=self.request.id,
    )
    try:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_send_email_async(to, template_name, context, user_id))
        finally:
            loop.close()
        return {"status": "sent", "template": template_name}
    except Exception as exc:
        logger.error("send_email_task_failed", error=str(exc), template=template_name)
        raise self.retry(exc=exc)
