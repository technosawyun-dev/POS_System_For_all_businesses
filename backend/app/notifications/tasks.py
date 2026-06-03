from __future__ import annotations

"""
Celery-ready notification task functions.

These tasks are NOT yet scheduled in beat_schedule — add them to
app/tasks/celery_app.py beat_schedule when ready to activate.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.tasks.celery_app import celery_app

logger = get_logger(__name__)




async def _check_low_stock_async() -> dict[str, Any]:
    from sqlalchemy import select

    from app.core.constants import NotificationType
    from app.events.base import DomainEvent
    from app.events.publisher import event_publisher
    from app.events.types import EventType
    from app.models.inventory import BranchInventory
    from app.models.product import Product
    from app.notifications.models import Notification

    notified = 0
    async with AsyncSessionLocal() as session:
        try:
            # Collect product+branch combos already notified in the last 24 h
            # to avoid flooding users with repeated alerts for the same item.
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            recent_stmt = (
                select(
                    Notification.metadata_["product_id"].as_string(),
                    Notification.metadata_["branch_id"].as_string(),
                )
                .where(
                    Notification.type == NotificationType.INVENTORY,
                    Notification.created_at >= cutoff,
                    Notification.metadata_["product_id"].as_string().is_not(None),
                )
                .distinct()
            )
            recent_rows = await session.execute(recent_stmt)
            recently_notified: set[tuple[str, str]] = {
                (r[0], r[1]) for r in recent_rows
            }

            # Find all branch-inventory rows that are at or below their reorder point
            stmt = (
                select(Product, BranchInventory)
                .join(BranchInventory, BranchInventory.product_id == Product.id)
                .where(
                    Product.is_active.is_(True),
                    BranchInventory.reorder_point.is_not(None),
                    BranchInventory.quantity_on_hand <= BranchInventory.reorder_point,
                )
            )
            result = await session.execute(stmt)
            for product, inventory in result.all():
                key = (str(product.id), str(inventory.branch_id))
                if key in recently_notified:
                    continue  # already alerted within the last 24 h
                await event_publisher.publish(
                    DomainEvent(
                        event_type=EventType.LOW_STOCK,
                        tenant_id=product.tenant_id,
                        payload={
                            "product_id": str(product.id),
                            "product_name": product.name,
                            "sku": product.sku or "",
                            "current_stock": float(inventory.quantity_on_hand),
                            "reorder_level": float(inventory.reorder_point),
                            "branch_id": str(inventory.branch_id),
                        },
                    )
                )
                notified += 1
        except Exception:
            logger.exception("check_low_stock_error")
    return {"low_stock_items_notified": notified}


async def _check_trial_expiring_async() -> dict[str, Any]:
    from sqlalchemy import select

    from app.core.constants import SubscriptionStatus
    from app.events.base import DomainEvent
    from app.events.publisher import event_publisher
    from app.events.types import EventType
    from app.models.tenant import Tenant
    from app.subscriptions.models import TenantSubscription

    now = datetime.now(timezone.utc)
    notified = 0

    async with AsyncSessionLocal() as session:
        try:
            for days_ahead in [7, 3, 1]:
                target_date = now + timedelta(days=days_ahead)
                window_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
                window_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)

                stmt = (
                    select(TenantSubscription, Tenant)
                    .join(Tenant, Tenant.id == TenantSubscription.tenant_id)
                    .where(
                        TenantSubscription.status == SubscriptionStatus.TRIAL,
                        TenantSubscription.trial_ends_at >= window_start,
                        TenantSubscription.trial_ends_at <= window_end,
                    )
                )
                result = await session.execute(stmt)
                for sub, tenant in result.all():
                    await event_publisher.publish(
                        DomainEvent(
                            event_type=EventType.TRIAL_EXPIRING,
                            tenant_id=sub.tenant_id,
                            payload={
                                "subscription_id": str(sub.id),
                                "tenant_name": tenant.name,
                                "days_remaining": days_ahead,
                                "expires_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else "",
                            },
                        )
                    )
                    notified += 1
        except Exception:
            logger.exception("check_trial_expiring_error")
    return {"trial_expiring_notified": notified}


async def _check_subscription_expiring_async() -> dict[str, Any]:
    from sqlalchemy import select

    from app.core.constants import SubscriptionStatus
    from app.events.base import DomainEvent
    from app.events.publisher import event_publisher
    from app.events.types import EventType
    from app.models.tenant import Tenant
    from app.subscriptions.models import TenantSubscription

    now = datetime.now(timezone.utc)
    notified = 0

    async with AsyncSessionLocal() as session:
        try:
            for days_ahead in [14, 7, 3, 1]:
                target_date = now + timedelta(days=days_ahead)
                window_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
                window_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)

                stmt = (
                    select(TenantSubscription, Tenant)
                    .join(Tenant, Tenant.id == TenantSubscription.tenant_id)
                    .where(
                        TenantSubscription.status == SubscriptionStatus.ACTIVE,
                        TenantSubscription.expires_at >= window_start,
                        TenantSubscription.expires_at <= window_end,
                    )
                )
                result = await session.execute(stmt)
                for sub, tenant in result.all():
                    await event_publisher.publish(
                        DomainEvent(
                            event_type=EventType.SUBSCRIPTION_EXPIRING,
                            tenant_id=sub.tenant_id,
                            payload={
                                "subscription_id": str(sub.id),
                                "tenant_name": tenant.name,
                                "days_remaining": days_ahead,
                                "expires_at": sub.expires_at.isoformat(),
                            },
                        )
                    )
                    notified += 1
        except Exception:
            logger.exception("check_subscription_expiring_error")
    return {"subscription_expiring_notified": notified}


async def _check_payables_overdue_async() -> dict[str, Any]:
    from sqlalchemy import select

    from app.core.constants import SupplierPayableStatus
    from app.events.base import DomainEvent
    from app.events.publisher import event_publisher
    from app.events.types import EventType
    from app.models.supplier import Supplier
    from app.procurement.models import PurchaseOrder, SupplierPayable

    now = datetime.now(timezone.utc)
    overdue_threshold = now - timedelta(days=30)
    notified = 0

    async with AsyncSessionLocal() as session:
        try:
            stmt = (
                select(SupplierPayable, PurchaseOrder, Supplier)
                .join(
                    PurchaseOrder,
                    PurchaseOrder.id == SupplierPayable.purchase_order_id,
                )
                .join(
                    Supplier,
                    Supplier.id == SupplierPayable.supplier_id,
                )
                .where(
                    SupplierPayable.status.in_([
                        SupplierPayableStatus.OPEN,
                        SupplierPayableStatus.PARTIAL,
                    ]),
                    PurchaseOrder.order_date < overdue_threshold,
                )
            )
            result = await session.execute(stmt)
            for payable, po, supplier in result.all():
                await event_publisher.publish(
                    DomainEvent(
                        event_type=EventType.PAYABLE_OVERDUE,
                        tenant_id=payable.tenant_id,
                        payload={
                            "payable_id": str(payable.id),
                            "po_number": po.po_number,
                            "supplier_name": supplier.name,
                            "total_amount": str(payable.total_amount),
                            "remaining_amount": str(payable.remaining_amount),
                            "order_date": po.order_date.isoformat(),
                        },
                    )
                )
                notified += 1
        except Exception:
            logger.exception("check_payables_overdue_error")
    return {"overdue_payables_notified": notified}


async def _cleanup_expired_notifications_async() -> dict[str, Any]:
    from app.notifications.services import NotificationService

    deleted = 0
    async with AsyncSessionLocal() as session:
        try:
            svc = NotificationService(session)
            deleted = await svc.delete_expired()
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("cleanup_expired_notifications_error")
    return {"deleted": deleted}


async def _send_email_async(
    to: str,
    template_name: str,
    context: dict[str, Any],
    user_id: str | None,
) -> None:
    from app.notifications.email import email_service

    if user_id and not to:
        # Resolve email from user_id
        from sqlalchemy import select

        from app.models.user import User

        async with AsyncSessionLocal() as session:
            import uuid as _uuid

            result = await session.execute(
                select(User.email, User.first_name, User.last_name).where(
                    User.id == _uuid.UUID(user_id)
                )
            )
            row = result.first()
            if row:
                to = row[0]
                context.setdefault("recipient_name", f"{row[1]} {row[2]}")

    if not to:
        return

    await email_service.send_email_notification(
        to=to,
        template_name=template_name,
        context=context,
    )




@celery_app.task(
    name="app.notifications.tasks.check_low_stock",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def check_low_stock(self: Any) -> dict[str, Any]:
    """Check all tenants for products below reorder level and emit LOW_STOCK events."""
    try:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(_check_low_stock_async())
    except Exception as exc:
        logger.error("check_low_stock_task_failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.notifications.tasks.check_trial_expiring",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def check_trial_expiring(self: Any) -> dict[str, Any]:
    """Emit TRIAL_EXPIRING events for trials expiring in 7, 3, 1 day(s)."""
    try:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(_check_trial_expiring_async())
    except Exception as exc:
        logger.error("check_trial_expiring_task_failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.notifications.tasks.check_subscription_expiring",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def check_subscription_expiring(self: Any) -> dict[str, Any]:
    """Emit SUBSCRIPTION_EXPIRING events for subscriptions expiring in 14, 7, 3, 1 day(s)."""
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_check_subscription_expiring_async())
        finally:
            loop.close()
    except Exception as exc:
        logger.error("check_subscription_expiring_task_failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.notifications.tasks.check_payables_overdue",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def check_payables_overdue(self: Any) -> dict[str, Any]:
    """Emit PAYABLE_OVERDUE events for supplier payables unpaid past 30 days."""
    try:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(_check_payables_overdue_async())
    except Exception as exc:
        logger.error("check_payables_overdue_task_failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.notifications.tasks.cleanup_expired_notifications",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def cleanup_expired_notifications(self: Any) -> dict[str, Any]:
    """Hard-delete notifications whose expires_at has passed."""
    try:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(_cleanup_expired_notifications_async())
    except Exception as exc:
        logger.error("cleanup_expired_notifications_task_failed", error=str(exc))
        raise self.retry(exc=exc)
