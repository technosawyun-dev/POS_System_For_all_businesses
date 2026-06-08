from __future__ import annotations

"""
Notification event handlers.

Imported at application startup (main.py) to register all handlers with the
process-level event_publisher. Each handler opens its own DB session so that
failures here do NOT roll back the originating business transaction.
"""

from app.core.constants import NotificationPriority, NotificationType
from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.events.types import EventType

logger = get_logger(__name__)


async def _get_tenant_user_ids(session, tenant_id) -> list:  # type: ignore[no-untyped-def]
    """Return all active user IDs for a tenant (manager+)."""
    from sqlalchemy import select

    from app.core.constants import UserRole, UserStatus
    from app.models.user import User

    result = await session.execute(
        select(User.id).where(
            User.tenant_id == tenant_id,
            User.status == UserStatus.ACTIVE,
            User.role.in_([
                UserRole.BUSINESS_OWNER.value,
                UserRole.MANAGER.value,
            ]),
        )
    )
    return list(result.scalars().all())


async def _get_inventory_alert_ids(session, tenant_id) -> list:  # type: ignore[no-untyped-def]
    """Return active user IDs for inventory alerts: owner + manager + inventory staff."""
    from sqlalchemy import select

    from app.core.constants import UserRole, UserStatus
    from app.models.user import User

    result = await session.execute(
        select(User.id).where(
            User.tenant_id == tenant_id,
            User.status == UserStatus.ACTIVE,
            User.role.in_([
                UserRole.BUSINESS_OWNER.value,
                UserRole.MANAGER.value,
                UserRole.INVENTORY_STAFF.value,
            ]),
        )
    )
    return list(result.scalars().all())


async def _get_tenant_owner_ids(session, tenant_id) -> list:  # type: ignore[no-untyped-def]
    """Return active BUSINESS_OWNER user IDs for a tenant (plan changes — owner only)."""
    from sqlalchemy import select

    from app.core.constants import UserRole, UserStatus
    from app.models.user import User

    result = await session.execute(
        select(User.id).where(
            User.tenant_id == tenant_id,
            User.status == UserStatus.ACTIVE,
            User.role == UserRole.BUSINESS_OWNER.value,
        )
    )
    return list(result.scalars().all())


async def _get_super_admin_ids(session) -> list:  # type: ignore[no-untyped-def]
    from sqlalchemy import select

    from app.core.constants import UserRole, UserStatus
    from app.models.user import User

    result = await session.execute(
        select(User.id).where(
            User.role == UserRole.SUPER_ADMIN.value,
            User.status == UserStatus.ACTIVE,
        )
    )
    return list(result.scalars().all())



@event_publisher.on(EventType.LOW_STOCK)
async def handle_low_stock(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    product_name = event.payload.get("product_name", "Unknown Product")
    sku = event.payload.get("sku", "")
    current_stock = event.payload.get("current_stock", 0)
    reorder_level = event.payload.get("reorder_level", 0)

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_inventory_alert_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.INVENTORY,
                priority=NotificationPriority.HIGH,
                title=f"Low Stock Alert: {product_name}",
                message=(
                    f"{product_name} (SKU: {sku}) is below reorder level. "
                    f"Current stock: {current_stock}, reorder at: {reorder_level}."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()

        except Exception:
            await session.rollback()
            logger.exception("handle_low_stock_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.PURCHASE_ORDER_APPROVED)
async def handle_purchase_order_approved(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    po_number = event.payload.get("po_number", "")
    supplier_name = event.payload.get("supplier_name", "")
    total_amount = event.payload.get("total_amount", "")
    currency = event.payload.get("currency", "MMK")
    expected_date = event.payload.get("expected_date", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.PROCUREMENT,
                priority=NotificationPriority.MEDIUM,
                title=f"Purchase Order {po_number} Approved",
                message=(
                    f"PO {po_number} from {supplier_name} has been approved. "
                    f"Total: {total_amount} {currency}."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()

        except Exception:
            await session.rollback()
            logger.exception("handle_po_approved_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.GOODS_RECEIPT_CREATED)
async def handle_goods_receipt_created(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    receipt_number = event.payload.get("receipt_number", "")
    po_number = event.payload.get("po_number", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.PROCUREMENT,
                priority=NotificationPriority.LOW,
                title=f"Goods Receipt {receipt_number} Created",
                message=f"Goods receipt {receipt_number} for PO {po_number} has been recorded.",
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_gr_created_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.PAYABLE_OVERDUE)
async def handle_payable_overdue(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    supplier_name = event.payload.get("supplier_name", "")
    amount = event.payload.get("remaining_amount", "")
    po_number = event.payload.get("po_number", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.PROCUREMENT,
                priority=NotificationPriority.HIGH,
                title=f"Overdue Payable: {supplier_name}",
                message=(
                    f"Supplier payable for PO {po_number} ({supplier_name}) "
                    f"is overdue. Outstanding: {amount}."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_payable_overdue_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.CUSTOMER_BALANCE_HIGH)
async def handle_customer_balance_high(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    customer_name = event.payload.get("customer_name", "")
    balance = event.payload.get("current_balance", "")
    credit_limit = event.payload.get("credit_limit", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.CUSTOMER,
                priority=NotificationPriority.HIGH,
                title=f"High Balance Alert: {customer_name}",
                message=(
                    f"Customer {customer_name} has an outstanding balance of "
                    f"{balance} (credit limit: {credit_limit})."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_customer_balance_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.TRIAL_EXPIRING)
async def handle_trial_expiring(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.email import email_service
    from app.notifications.services import NotificationService

    days = event.payload.get("days_remaining", 0)
    tenant_name = event.payload.get("tenant_name", "")
    expires_at = event.payload.get("expires_at", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.HIGH if days <= 1 else NotificationPriority.MEDIUM,
                title=f"Trial Expires in {days} Day(s)",
                message=(
                    f"Your trial subscription for {tenant_name} expires in {days} day(s) "
                    f"on {expires_at}. Activate your subscription to continue."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()

            for uid in recipient_ids:
                if await svc.is_email_enabled_for_type(uid, NotificationType.SUBSCRIPTION):
                    await email_service.queue_email_notification(
                        to="",
                        template_name="subscription_expiring",
                        context={
                            "recipient_name": "",
                            "tenant_name": tenant_name,
                            "days": days,
                            "expires_at": expires_at,
                        },
                        user_id=uid,
                    )

        except Exception:
            await session.rollback()
            logger.exception("handle_trial_expiring_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.SUBSCRIPTION_EXPIRING)
async def handle_subscription_expiring(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.email import email_service
    from app.notifications.services import NotificationService

    days = event.payload.get("days_remaining", 0)
    tenant_name = event.payload.get("tenant_name", "")
    expires_at = event.payload.get("expires_at", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.HIGH if days <= 3 else NotificationPriority.MEDIUM,
                title=f"Subscription Expires in {days} Day(s)",
                message=(
                    f"Your subscription for {tenant_name} expires in {days} day(s) "
                    f"on {expires_at}. Renew now to avoid service interruption."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()

            for uid in recipient_ids:
                if await svc.is_email_enabled_for_type(uid, NotificationType.SUBSCRIPTION):
                    await email_service.queue_email_notification(
                        to="",
                        template_name="subscription_expiring",
                        context={
                            "recipient_name": "",
                            "tenant_name": tenant_name,
                            "days": days,
                            "expires_at": expires_at,
                        },
                        user_id=uid,
                    )

        except Exception:
            await session.rollback()
            logger.exception("handle_sub_expiring_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.SUBSCRIPTION_EXPIRED)
async def handle_subscription_expired(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    tenant_name = event.payload.get("tenant_name", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.CRITICAL,
                title="Subscription Expired",
                message=(
                    f"Your subscription for {tenant_name} has expired. "
                    "Renew immediately to restore full access."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_sub_expired_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.PAYMENT_PROOF_SUBMITTED)
async def handle_payment_proof_submitted(event: DomainEvent) -> None:
    """Notify all super admins when a tenant submits a payment proof."""
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    tenant_name = event.payload.get("tenant_name", "")
    amount = event.payload.get("amount", "")
    currency = event.payload.get("currency", "MMK")

    async with AsyncSessionLocal() as session:
        try:
            super_admin_ids = await _get_super_admin_ids(session)
            if not super_admin_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,  # platform notification
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.HIGH,
                title="Payment Proof Submitted",
                message=(
                    f"{tenant_name} has submitted a payment proof of "
                    f"{amount} {currency} for subscription renewal. Review required."
                ),
                user_ids=super_admin_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_payment_proof_submitted_error")



@event_publisher.on(EventType.PAYMENT_PROOF_APPROVED)
async def handle_payment_proof_approved(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.email import email_service
    from app.notifications.services import NotificationService

    tenant_name = event.payload.get("tenant_name", "")
    amount = event.payload.get("amount", "")
    currency = event.payload.get("currency", "MMK")
    expires_at = event.payload.get("expires_at", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.HIGH,
                title="Payment Proof Approved",
                message=(
                    f"Your payment proof of {amount} {currency} has been approved. "
                    f"Subscription active until {expires_at}."
                ),
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()

            for uid in recipient_ids:
                if await svc.is_email_enabled_for_type(uid, NotificationType.SUBSCRIPTION):
                    await email_service.queue_email_notification(
                        to="",
                        template_name="payment_proof_approved",
                        context={
                            "recipient_name": "",
                            "tenant_name": tenant_name,
                            "amount": amount,
                            "currency": currency,
                            "expires_at": expires_at,
                        },
                        user_id=uid,
                    )

        except Exception:
            await session.rollback()
            logger.exception("handle_payment_proof_approved_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.SYNC_FAILED)
async def handle_sync_failed(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    device_id = event.payload.get("device_id", "")
    error = event.payload.get("error", "Unknown error")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.HIGH,
                title="Sync Failed",
                message=f"Offline sync failed for device {device_id}. Error: {error}",
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_sync_failed_error", tenant_id=str(event.tenant_id))



@event_publisher.on(EventType.BUSINESS_REGISTERED)
async def handle_business_registered(event: DomainEvent) -> None:
    """Notify all super admins when a new business registers."""
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    business_name = event.payload.get("business_name", "Unknown")
    owner_name = event.payload.get("owner_name", "")
    owner_email = event.payload.get("owner_email", "")
    plan_name = event.payload.get("plan_name", "Trial")
    trial_days = event.payload.get("trial_days", 14)

    async with AsyncSessionLocal() as session:
        try:
            super_admin_ids = await _get_super_admin_ids(session)
            if not super_admin_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.MEDIUM,
                title=f"New Business Registered: {business_name}",
                message=(
                    f"{owner_name} ({owner_email}) just registered '{business_name}' "
                    f"on a {trial_days}-day {plan_name} trial."
                ),
                user_ids=super_admin_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_business_registered_error")


@event_publisher.on(EventType.SUBSCRIPTION_ACTIVATED)
async def handle_subscription_activated(event: DomainEvent) -> None:
    """Notify super admins when a tenant activates (purchases) a subscription."""
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService
    from app.models.tenant import Tenant
    from sqlalchemy import select

    plan_name = event.payload.get("plan_name", "")
    expires_at = event.payload.get("expires_at", "")

    async with AsyncSessionLocal() as session:
        try:
            super_admin_ids = await _get_super_admin_ids(session)
            if not super_admin_ids:
                return

            tenant_name = "Unknown"
            if event.tenant_id:
                row = await session.execute(select(Tenant.name).where(Tenant.id == event.tenant_id))
                tenant_name = row.scalar_one_or_none() or "Unknown"

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.HIGH,
                title=f"Subscription Purchased: {tenant_name}",
                message=(
                    f"'{tenant_name}' has activated the '{plan_name}' plan. "
                    f"Active until {expires_at[:10]}."
                ),
                user_ids=super_admin_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_subscription_activated_error")


@event_publisher.on(EventType.SUBSCRIPTION_RENEWED)
async def handle_subscription_renewed(event: DomainEvent) -> None:
    """Notify super admins when a tenant renews their subscription."""
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService
    from app.models.tenant import Tenant
    from sqlalchemy import select

    plan_name = event.payload.get("plan_name", "")
    expires_at = event.payload.get("expires_at", "")

    async with AsyncSessionLocal() as session:
        try:
            super_admin_ids = await _get_super_admin_ids(session)
            if not super_admin_ids:
                return

            tenant_name = "Unknown"
            if event.tenant_id:
                row = await session.execute(select(Tenant.name).where(Tenant.id == event.tenant_id))
                tenant_name = row.scalar_one_or_none() or "Unknown"

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.MEDIUM,
                title=f"Subscription Renewed: {tenant_name}",
                message=(
                    f"'{tenant_name}' renewed their '{plan_name}' subscription. "
                    f"New expiry: {expires_at[:10]}."
                ),
                user_ids=super_admin_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_subscription_renewed_error")


@event_publisher.on(EventType.SUBSCRIPTION_UPGRADED)
async def handle_subscription_upgraded(event: DomainEvent) -> None:
    """Notify super admins and the tenant's owners/managers when a plan is upgraded."""
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService
    from app.models.tenant import Tenant
    from sqlalchemy import select

    old_plan = event.payload.get("old_plan_name", "")
    new_plan = event.payload.get("new_plan_name", "")

    async with AsyncSessionLocal() as session:
        try:
            tenant_name = "Unknown"
            if event.tenant_id:
                row = await session.execute(select(Tenant.name).where(Tenant.id == event.tenant_id))
                tenant_name = row.scalar_one_or_none() or "Unknown"

            svc = NotificationService(session)

            # Notify super admins
            super_admin_ids = await _get_super_admin_ids(session)
            if super_admin_ids:
                await svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SUBSCRIPTION,
                    priority=NotificationPriority.HIGH,
                    title=f"Plan Upgraded: {tenant_name}",
                    message=f"'{tenant_name}' upgraded from '{old_plan}' to '{new_plan}'.",
                    user_ids=super_admin_ids,
                    metadata=event.payload,
                )

            # Notify the tenant's business owner only (not managers)
            if event.tenant_id:
                owner_ids = await _get_tenant_owner_ids(session, event.tenant_id)
                if owner_ids:
                    await svc.notify_users(
                        tenant_id=event.tenant_id,
                        type=NotificationType.SUBSCRIPTION,
                        priority=NotificationPriority.HIGH,
                        title="Plan Upgraded",
                        message=f"Your plan has been upgraded from '{old_plan}' to '{new_plan}'.",
                        user_ids=owner_ids,
                        metadata=event.payload,
                    )

            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_subscription_upgraded_error")


@event_publisher.on(EventType.SUBSCRIPTION_DOWNGRADED)
async def handle_subscription_downgraded(event: DomainEvent) -> None:
    """Notify super admins and the tenant's owners/managers when a plan is downgraded."""
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService
    from app.models.tenant import Tenant
    from sqlalchemy import select

    old_plan = event.payload.get("old_plan_name", "")
    new_plan = event.payload.get("new_plan_name", "")

    async with AsyncSessionLocal() as session:
        try:
            tenant_name = "Unknown"
            if event.tenant_id:
                row = await session.execute(select(Tenant.name).where(Tenant.id == event.tenant_id))
                tenant_name = row.scalar_one_or_none() or "Unknown"

            svc = NotificationService(session)

            # Notify super admins
            super_admin_ids = await _get_super_admin_ids(session)
            if super_admin_ids:
                await svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SUBSCRIPTION,
                    priority=NotificationPriority.MEDIUM,
                    title=f"Plan Downgraded: {tenant_name}",
                    message=f"'{tenant_name}' downgraded from '{old_plan}' to '{new_plan}'.",
                    user_ids=super_admin_ids,
                    metadata=event.payload,
                )

            # Notify the tenant's business owner only (not managers)
            if event.tenant_id:
                owner_ids = await _get_tenant_owner_ids(session, event.tenant_id)
                if owner_ids:
                    await svc.notify_users(
                        tenant_id=event.tenant_id,
                        type=NotificationType.SUBSCRIPTION,
                        priority=NotificationPriority.MEDIUM,
                        title="Plan Downgraded",
                        message=f"Your plan has been downgraded from '{old_plan}' to '{new_plan}'.",
                        user_ids=owner_ids,
                        metadata=event.payload,
                    )

            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_subscription_downgraded_error")


@event_publisher.on(EventType.DEVICE_OFFLINE)
async def handle_device_offline(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    device_name = event.payload.get("device_name", "")

    async with AsyncSessionLocal() as session:
        try:
            recipient_ids = await _get_tenant_user_ids(session, event.tenant_id)
            if not recipient_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=event.tenant_id,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.MEDIUM,
                title=f"Device Offline: {device_name}",
                message=f"POS device '{device_name}' has gone offline.",
                user_ids=recipient_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_device_offline_error", tenant_id=str(event.tenant_id))
