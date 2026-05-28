from __future__ import annotations

"""
Referral / Commission / Wallet event handlers.

Imported at application startup (main.py) to register all handlers with the
process-level event_publisher.  Each handler opens its own DB session so that
failures here do NOT roll back the originating business transaction.
"""

from app.core.constants import NotificationPriority, NotificationType
from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import event_publisher

logger = get_logger(__name__)

# event type constants (mirrors events/types.py additions)
_REFERRAL_CREATED = "REFERRAL_CREATED"
_COMMISSION_EARNED = "COMMISSION_EARNED"
_COMMISSION_REVERSED = "COMMISSION_REVERSED"
_PAYOUT_REQUESTED = "PAYOUT_REQUESTED"
_PAYOUT_APPROVED = "PAYOUT_APPROVED"
_PAYOUT_REJECTED = "PAYOUT_REJECTED"
_PAYOUT_COMPLETED = "PAYOUT_COMPLETED"


async def _get_super_admin_ids(session) -> list:  # type: ignore[no-untyped-def]
    from sqlalchemy import select
    from app.core.constants import UserRole, UserStatus
    from app.models.user import User

    result = await session.execute(
        select(User.id).where(
            User.role == UserRole.SUPER_ADMIN.value,
            User.status == UserStatus.ACTIVE.value,
            User.is_deleted.is_(False),
        )
    )
    return list(result.scalars().all())


# REFERRAL_CREATED — notify reseller

@event_publisher.on(_REFERRAL_CREATED)
async def handle_referral_created(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    reseller_id = event.payload.get("reseller_id")
    tenant_name = event.payload.get("tenant_name", "a new business")

    if not reseller_id:
        return

    async with AsyncSessionLocal() as session:
        try:
            import uuid
            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.MEDIUM,
                title="New Referral Registered",
                message=(
                    f"{tenant_name} has registered using your referral code. "
                    "You'll earn commission when they activate a paid subscription."
                ),
                user_ids=[uuid.UUID(str(reseller_id))],
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_referral_created_error", reseller_id=str(reseller_id))


# COMMISSION_EARNED — notify reseller

@event_publisher.on(_COMMISSION_EARNED)
async def handle_commission_earned(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    reseller_id = event.payload.get("reseller_id")
    amount = event.payload.get("commission_amount", "0")
    currency = event.payload.get("currency_code", "MMK")
    tenant_name = event.payload.get("tenant_name", "a referred business")

    if not reseller_id:
        return

    async with AsyncSessionLocal() as session:
        try:
            import uuid
            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.HIGH,
                title=f"Commission Earned: {amount} {currency}",
                message=(
                    f"You earned a commission of {amount} {currency} "
                    f"from {tenant_name}'s subscription payment."
                ),
                user_ids=[uuid.UUID(str(reseller_id))],
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_commission_earned_error", reseller_id=str(reseller_id))


# COMMISSION_REVERSED — notify reseller

@event_publisher.on(_COMMISSION_REVERSED)
async def handle_commission_reversed(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    reseller_id = event.payload.get("reseller_id")
    amount = event.payload.get("reversal_amount", "0")
    currency = event.payload.get("currency_code", "MMK")
    reason = event.payload.get("reason", "subscription cancelled")

    if not reseller_id:
        return

    async with AsyncSessionLocal() as session:
        try:
            import uuid
            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.MEDIUM,
                title=f"Commission Reversal: {amount} {currency}",
                message=(
                    f"A commission of {amount} {currency} has been reversed. "
                    f"Reason: {reason}"
                ),
                user_ids=[uuid.UUID(str(reseller_id))],
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_commission_reversed_error", reseller_id=str(reseller_id))


# PAYOUT_REQUESTED — notify super admins

@event_publisher.on(_PAYOUT_REQUESTED)
async def handle_payout_requested(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    reseller_name = event.payload.get("reseller_name", "A reseller")
    amount = event.payload.get("amount", "0")
    currency = event.payload.get("currency_code", "MMK")

    async with AsyncSessionLocal() as session:
        try:
            super_admin_ids = await _get_super_admin_ids(session)
            if not super_admin_ids:
                return

            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.HIGH,
                title="Payout Request Submitted",
                message=(
                    f"{reseller_name} has requested a payout of {amount} {currency}. "
                    "Review and approve in the Reseller Finance panel."
                ),
                user_ids=super_admin_ids,
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_payout_requested_error")


# PAYOUT_APPROVED — notify reseller

@event_publisher.on(_PAYOUT_APPROVED)
async def handle_payout_approved(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    reseller_id = event.payload.get("reseller_id")
    amount = event.payload.get("amount", "0")
    currency = event.payload.get("currency_code", "MMK")

    if not reseller_id:
        return

    async with AsyncSessionLocal() as session:
        try:
            import uuid
            svc = NotificationService(session)
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.HIGH,
                title="Payout Approved",
                message=(
                    f"Your payout request of {amount} {currency} has been approved. "
                    "Payment will be processed shortly."
                ),
                user_ids=[uuid.UUID(str(reseller_id))],
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_payout_approved_error", reseller_id=str(reseller_id))


# PAYOUT_REJECTED — notify reseller

@event_publisher.on(_PAYOUT_REJECTED)
async def handle_payout_rejected(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    reseller_id = event.payload.get("reseller_id")
    amount = event.payload.get("amount", "0")
    currency = event.payload.get("currency_code", "MMK")
    reason = event.payload.get("rejection_reason", "")

    if not reseller_id:
        return

    async with AsyncSessionLocal() as session:
        try:
            import uuid
            svc = NotificationService(session)
            msg = f"Your payout request of {amount} {currency} has been rejected."
            if reason:
                msg += f" Reason: {reason}"
            msg += " Your funds have been returned to your available balance."
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.HIGH,
                title="Payout Rejected",
                message=msg,
                user_ids=[uuid.UUID(str(reseller_id))],
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_payout_rejected_error", reseller_id=str(reseller_id))


# PAYOUT_COMPLETED — notify reseller

@event_publisher.on(_PAYOUT_COMPLETED)
async def handle_payout_completed(event: DomainEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.notifications.services import NotificationService

    reseller_id = event.payload.get("reseller_id")
    amount = event.payload.get("amount", "0")
    currency = event.payload.get("currency_code", "MMK")
    payout_method = event.payload.get("payout_method", "")
    payout_reference = event.payload.get("payout_reference", "")

    if not reseller_id:
        return

    async with AsyncSessionLocal() as session:
        try:
            import uuid
            svc = NotificationService(session)
            msg = f"Your payout of {amount} {currency} has been completed."
            if payout_method:
                msg += f" Method: {payout_method}."
            if payout_reference:
                msg += f" Reference: {payout_reference}."
            await svc.notify_users(
                tenant_id=None,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.HIGH,
                title="Payout Completed",
                message=msg,
                user_ids=[uuid.UUID(str(reseller_id))],
                metadata=event.payload,
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("handle_payout_completed_error", reseller_id=str(reseller_id))
