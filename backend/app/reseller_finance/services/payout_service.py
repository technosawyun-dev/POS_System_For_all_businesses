from __future__ import annotations

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import NotificationPriority, NotificationType
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.notifications.services import NotificationService
from app.reseller_finance.models import ResellerPayoutRequest, ResellerPayoutRequestItem
from app.reseller_finance.repositories import PayoutRepository, WalletRepository
from app.reseller_finance.services.wallet_service import WalletService
from app.services.audit_service import AuditService

logger = get_logger(__name__)

_PAYOUT_STATUS_PENDING = "PENDING"
_PAYOUT_STATUS_UNDER_REVIEW = "UNDER_REVIEW"
_PAYOUT_STATUS_APPROVED = "APPROVED"
_PAYOUT_STATUS_REJECTED = "REJECTED"
_PAYOUT_STATUS_PAID = "PAID"
_PAYOUT_STATUS_CANCELLED = "CANCELLED"

_MAX_PENDING_PAYOUTS = 3


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PayoutService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.payout_repo = PayoutRepository(session)
        self.wallet_repo = WalletRepository(session)
        self.wallet_svc = WalletService(session)
        self.audit = AuditService(session)
        self.notif_svc = NotificationService(session)

    # Reseller-facing operations

    async def request_payout(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        reason: str | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerPayoutRequest:
        """Reseller requests a payout. Validates and locks funds atomically."""
        if amount <= Decimal("0"):
            raise BusinessRuleError("Payout amount must be greater than zero.")

        # Step 1: Get wallet FOR UPDATE (WalletService.lock_for_payout does its own lock,
        # but we need wallet data for validations before calling it)
        wallet = await self.wallet_svc.get_wallet(reseller_id)

        # Validate minimum payout
        if amount < wallet.min_payout_amount:
            raise BusinessRuleError(
                f"Payout amount {amount} is below the minimum threshold of "
                f"{wallet.min_payout_amount} {wallet.currency_code}."
            )

        # Validate sufficient balance
        if wallet.available_balance < amount:
            raise BusinessRuleError(
                f"Insufficient available balance. Available: {wallet.available_balance} "
                f"{wallet.currency_code}, requested: {amount}."
            )

        # Spam protection: no more than _MAX_PENDING_PAYOUTS open requests
        pending_count = await self.payout_repo.count_pending(reseller_id)
        if pending_count >= _MAX_PENDING_PAYOUTS:
            raise BusinessRuleError(
                f"You already have {pending_count} pending payout request(s). "
                f"A maximum of {_MAX_PENDING_PAYOUTS} are allowed at a time."
            )

        # Step 3: Create PayoutRequest
        payout = ResellerPayoutRequest(
            reseller_id=reseller_id,
            wallet_id=wallet.id,
            amount=amount,
            currency_code=wallet.currency_code,
            status=_PAYOUT_STATUS_PENDING,
            reason=reason,
            requested_at=_now(),
        )
        self.session.add(payout)
        await self.session.flush()
        await self.session.refresh(payout)

        # Steps 4-5: Lock funds → available -= amount, locked += amount
        _w, lock_tx = await self.wallet_svc.lock_for_payout(
            reseller_id=reseller_id,
            amount=amount,
            payout_request_id=payout.id,
            created_by=actor_id,
        )

        # Step 6: Link transaction as PayoutRequestItem
        item = ResellerPayoutRequestItem(
            payout_request_id=payout.id,
            wallet_transaction_id=lock_tx.id,
            amount=amount,
        )
        self.session.add(item)
        await self.session.flush()

        # Step 7: Audit log
        await self.audit.log(
            action="PAYOUT_REQUESTED",
            actor_user_id=actor_id,
            entity_type="RESELLER_PAYOUT_REQUEST",
            entity_id=payout.id,
            after_state={
                "reseller_id": str(reseller_id),
                "amount": str(amount),
                "currency_code": wallet.currency_code,
                "lock_tx_id": str(lock_tx.id),
            },
            request_id=request_id,
        )

        # Step 8: Publish domain event
        await event_publisher.publish(
            DomainEvent(
                event_type="PAYOUT_REQUESTED",
                actor_id=actor_id,
                payload={
                    "payout_id": str(payout.id),
                    "reseller_id": str(reseller_id),
                    "amount": str(amount),
                    "currency_code": wallet.currency_code,
                },
            )
        )

        # Step 9: Notify super admins
        try:
            super_admin_ids = await self.payout_repo.get_super_admin_ids()
            if super_admin_ids:
                await self.notif_svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SYSTEM,
                    priority=NotificationPriority.HIGH,
                    title="Payout Request Received",
                    message=(
                        f"Reseller {reseller_id} has requested a payout of "
                        f"{amount} {wallet.currency_code}. "
                        f"Request ID: {payout.id}."
                    ),
                    user_ids=super_admin_ids,
                    metadata={
                        "payout_id": str(payout.id),
                        "reseller_id": str(reseller_id),
                        "amount": str(amount),
                    },
                )
        except Exception as notif_exc:  # noqa: BLE001
            logger.warning(
                "payout_request_notification_failed",
                payout_id=str(payout.id),
                error=str(notif_exc),
            )

        logger.info(
            "payout_requested",
            payout_id=str(payout.id),
            reseller_id=str(reseller_id),
            amount=str(amount),
        )
        return payout

    async def cancel_payout(
        self,
        payout_id: uuid.UUID,
        reseller_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> ResellerPayoutRequest:
        """Reseller cancels their own PENDING payout. Releases locked funds."""
        payout = await self.get_payout(payout_id, reseller_id=reseller_id)

        if payout.status != _PAYOUT_STATUS_PENDING:
            raise BusinessRuleError(
                f"Only PENDING payouts can be cancelled. Current status: '{payout.status}'."
            )

        payout.status = _PAYOUT_STATUS_CANCELLED
        await self.session.flush()

        # Release locked funds back to available
        await self.wallet_svc.release_locked_for_payout(
            reseller_id=reseller_id,
            amount=payout.amount,
            payout_request_id=payout.id,
            created_by=actor_id,
        )

        await self.audit.log(
            action="PAYOUT_CANCELLED",
            actor_user_id=actor_id,
            entity_type="RESELLER_PAYOUT_REQUEST",
            entity_id=payout_id,
            after_state={"status": _PAYOUT_STATUS_CANCELLED},
        )
        logger.info(
            "payout_cancelled",
            payout_id=str(payout_id),
            reseller_id=str(reseller_id),
        )
        return payout

    # Admin state transitions

    async def put_under_review(
        self,
        payout_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> ResellerPayoutRequest:
        """Admin moves payout to UNDER_REVIEW."""
        payout = await self.get_payout(payout_id)

        if payout.status != _PAYOUT_STATUS_PENDING:
            raise BusinessRuleError(
                f"Can only move PENDING payouts to UNDER_REVIEW. Current: '{payout.status}'."
            )

        payout.status = _PAYOUT_STATUS_UNDER_REVIEW
        payout.reviewed_by = actor_id
        await self.session.flush()
        await self.session.refresh(payout)

        await self.audit.log(
            action="PAYOUT_UNDER_REVIEW",
            actor_user_id=actor_id,
            entity_type="RESELLER_PAYOUT_REQUEST",
            entity_id=payout_id,
            after_state={"status": _PAYOUT_STATUS_UNDER_REVIEW},
        )
        logger.info(
            "payout_under_review",
            payout_id=str(payout_id),
            actor_id=str(actor_id),
        )
        return payout

    async def approve_payout(
        self,
        payout_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> ResellerPayoutRequest:
        """Admin approves payout (PENDING/UNDER_REVIEW → APPROVED). No wallet change."""
        payout = await self.get_payout(payout_id)

        if payout.status not in {_PAYOUT_STATUS_PENDING, _PAYOUT_STATUS_UNDER_REVIEW}:
            raise BusinessRuleError(
                f"Cannot approve payout in status '{payout.status}'. "
                "Must be PENDING or UNDER_REVIEW."
            )

        payout.status = _PAYOUT_STATUS_APPROVED
        payout.reviewed_by = actor_id
        payout.reviewed_at = _now()
        await self.session.flush()
        await self.session.refresh(payout)

        await self.audit.log(
            action="PAYOUT_APPROVED",
            actor_user_id=actor_id,
            entity_type="RESELLER_PAYOUT_REQUEST",
            entity_id=payout_id,
            after_state={"status": _PAYOUT_STATUS_APPROVED},
        )
        logger.info(
            "payout_approved",
            payout_id=str(payout_id),
            actor_id=str(actor_id),
        )
        return payout

    async def reject_payout(
        self,
        payout_id: uuid.UUID,
        actor_id: uuid.UUID,
        reason: str | None,
    ) -> ResellerPayoutRequest:
        """Admin rejects payout. Releases locked funds back to available."""
        payout = await self.get_payout(payout_id)

        if payout.status not in {
            _PAYOUT_STATUS_PENDING,
            _PAYOUT_STATUS_UNDER_REVIEW,
            _PAYOUT_STATUS_APPROVED,
        }:
            raise BusinessRuleError(
                f"Cannot reject payout in status '{payout.status}'."
            )

        payout.status = _PAYOUT_STATUS_REJECTED
        payout.reviewed_by = actor_id
        payout.reviewed_at = _now()
        payout.payout_notes = reason
        await self.session.flush()
        await self.session.refresh(payout)

        # Release locked → available
        await self.wallet_svc.release_locked_for_payout(
            reseller_id=payout.reseller_id,
            amount=payout.amount,
            payout_request_id=payout.id,
            created_by=actor_id,
        )

        await self.audit.log(
            action="PAYOUT_REJECTED",
            actor_user_id=actor_id,
            entity_type="RESELLER_PAYOUT_REQUEST",
            entity_id=payout_id,
            after_state={"status": _PAYOUT_STATUS_REJECTED, "reason": reason},
        )

        # Notify reseller
        reseller_user_id = await self.payout_repo.get_reseller_user_id(payout.reseller_id)
        if reseller_user_id is not None:
            try:
                await self.notif_svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SYSTEM,
                    priority=NotificationPriority.HIGH,
                    title="Payout Request Rejected",
                    message=(
                        f"Your payout request of {payout.amount} {payout.currency_code} "
                        f"has been rejected. Reason: {reason or 'No reason provided'}. "
                        "Your funds have been returned to your available balance."
                    ),
                    user_ids=[reseller_user_id],
                    metadata={"payout_id": str(payout_id), "reason": reason},
                )
            except Exception as notif_exc:  # noqa: BLE001
                logger.warning(
                    "payout_rejection_notification_failed",
                    payout_id=str(payout_id),
                    error=str(notif_exc),
                )

        logger.info(
            "payout_rejected",
            payout_id=str(payout_id),
            reseller_id=str(payout.reseller_id),
            amount=str(payout.amount),
        )
        return payout

    async def mark_paid(
        self,
        payout_id: uuid.UUID,
        actor_id: uuid.UUID,
        payout_method: str | None,
        payout_reference: str | None,
        payout_notes: str | None,
    ) -> ResellerPayoutRequest:
        """Admin marks payout as PAID. Moves locked → total_paid_out."""
        payout = await self.get_payout(payout_id)

        if payout.status != _PAYOUT_STATUS_APPROVED:
            raise BusinessRuleError(
                f"Can only mark APPROVED payouts as PAID. Current: '{payout.status}'."
            )

        payout.status = _PAYOUT_STATUS_PAID
        payout.paid_at = _now()
        payout.payout_method = payout_method
        payout.payout_reference = payout_reference
        payout.payout_notes = payout_notes
        await self.session.flush()
        await self.session.refresh(payout)

        # Move locked → total_paid_out
        await self.wallet_svc.complete_payout(
            reseller_id=payout.reseller_id,
            amount=payout.amount,
            payout_request_id=payout.id,
            created_by=actor_id,
        )

        await self.audit.log(
            action="PAYOUT_PAID",
            actor_user_id=actor_id,
            entity_type="RESELLER_PAYOUT_REQUEST",
            entity_id=payout_id,
            after_state={
                "status": _PAYOUT_STATUS_PAID,
                "payout_method": payout_method,
                "payout_reference": payout_reference,
            },
        )

        await event_publisher.publish(
            DomainEvent(
                event_type="PAYOUT_PAID",
                actor_id=actor_id,
                payload={
                    "payout_id": str(payout_id),
                    "reseller_id": str(payout.reseller_id),
                    "amount": str(payout.amount),
                    "currency_code": payout.currency_code,
                    "payout_method": payout_method,
                    "payout_reference": payout_reference,
                },
            )
        )

        # Notify reseller
        reseller_user_id = await self.payout_repo.get_reseller_user_id(payout.reseller_id)
        if reseller_user_id is not None:
            try:
                await self.notif_svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SYSTEM,
                    priority=NotificationPriority.HIGH,
                    title="Payout Processed",
                    message=(
                        f"Your payout of {payout.amount} {payout.currency_code} "
                        "has been processed and paid."
                    ),
                    user_ids=[reseller_user_id],
                    metadata={
                        "payout_id": str(payout_id),
                        "amount": str(payout.amount),
                        "payout_method": payout_method,
                    },
                )
            except Exception as notif_exc:  # noqa: BLE001
                logger.warning(
                    "payout_paid_notification_failed",
                    payout_id=str(payout_id),
                    error=str(notif_exc),
                )

        logger.info(
            "payout_marked_paid",
            payout_id=str(payout_id),
            reseller_id=str(payout.reseller_id),
            amount=str(payout.amount),
        )
        return payout

    # Admin manual payout creation

    async def admin_create_payout(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        reason: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerPayoutRequest:
        """Super admin manually creates a payout request on behalf of a reseller."""
        if amount <= Decimal("0"):
            raise BusinessRuleError("Payout amount must be greater than zero.")

        wallet = await self.wallet_svc.get_wallet(reseller_id)

        if wallet.available_balance < amount:
            raise BusinessRuleError(
                f"Insufficient available balance for admin payout. "
                f"Available: {wallet.available_balance}, requested: {amount}."
            )

        payout = ResellerPayoutRequest(
            reseller_id=reseller_id,
            wallet_id=wallet.id,
            amount=amount,
            currency_code=wallet.currency_code,
            status=_PAYOUT_STATUS_APPROVED,  # Admin-created payouts skip review
            reason=reason,
            requested_at=_now(),
            reviewed_at=_now(),
            reviewed_by=actor_id,
        )
        self.session.add(payout)
        await self.session.flush()
        await self.session.refresh(payout)

        # Lock the funds immediately
        _w, lock_tx = await self.wallet_svc.lock_for_payout(
            reseller_id=reseller_id,
            amount=amount,
            payout_request_id=payout.id,
            created_by=actor_id,
        )

        item = ResellerPayoutRequestItem(
            payout_request_id=payout.id,
            wallet_transaction_id=lock_tx.id,
            amount=amount,
        )
        self.session.add(item)
        await self.session.flush()

        await self.audit.log(
            action="PAYOUT_ADMIN_CREATED",
            actor_user_id=actor_id,
            entity_type="RESELLER_PAYOUT_REQUEST",
            entity_id=payout.id,
            after_state={
                "reseller_id": str(reseller_id),
                "amount": str(amount),
                "reason": reason,
            },
            request_id=request_id,
        )

        # Notify reseller that admin has created a payout on their behalf
        reseller_user_id = await self.payout_repo.get_reseller_user_id(reseller_id)
        if reseller_user_id is not None:
            try:
                await self.notif_svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SYSTEM,
                    priority=NotificationPriority.HIGH,
                    title="Payout Created by Admin",
                    message=(
                        f"An admin has created a payout of {amount} {wallet.currency_code} "
                        f"on your behalf. It has been approved and is ready for disbursement."
                        f"{(' Reason: ' + reason) if reason else ''}"
                    ),
                    user_ids=[reseller_user_id],
                    metadata={
                        "payout_id": str(payout.id),
                        "amount": str(amount),
                        "currency_code": wallet.currency_code,
                    },
                )
            except Exception as notif_exc:  # noqa: BLE001
                logger.warning(
                    "admin_payout_notification_failed",
                    payout_id=str(payout.id),
                    error=str(notif_exc),
                )

        logger.info(
            "payout_admin_created",
            payout_id=str(payout.id),
            reseller_id=str(reseller_id),
            amount=str(amount),
            actor_id=str(actor_id),
        )
        return payout

    # Read operations

    async def get_payout(
        self,
        payout_id: uuid.UUID,
        reseller_id: uuid.UUID | None = None,
    ) -> ResellerPayoutRequest:
        """Gets payout. If reseller_id provided, validates ownership."""
        payout = await self.payout_repo.get_by_id(payout_id)
        if payout is None:
            raise NotFoundError("ResellerPayoutRequest", payout_id)
        if reseller_id is not None and payout.reseller_id != reseller_id:
            raise NotFoundError("ResellerPayoutRequest", payout_id)
        return payout

    async def list_payouts(
        self,
        reseller_id: uuid.UUID,
        page: int,
        page_size: int,
        status_filter: str | None,
    ) -> tuple[list[ResellerPayoutRequest], int]:
        """Reseller's own payouts."""
        return await self.payout_repo.list_by_reseller(
            reseller_id=reseller_id,
            page=page,
            page_size=page_size,
            status_filter=status_filter,
        )

    async def admin_list_payouts(
        self,
        page: int,
        page_size: int,
        status_filter: str | None,
        reseller_id: uuid.UUID | None,
    ) -> tuple[list[ResellerPayoutRequest], int]:
        """Admin views all payouts, optionally filtered by reseller or status."""
        return await self.payout_repo.list_all(
            page=page,
            page_size=page_size,
            status_filter=status_filter,
            reseller_id=reseller_id,
        )

    # Route-facing adapter methods (unified API consumed by route handlers)

    async def create_payout_request(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        reason: str | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerPayoutRequest:
        """Alias of ``request_payout`` using the parameter names the route layer uses."""
        return await self.request_payout(
            reseller_id=reseller_id,
            amount=amount,
            reason=reason,
            actor_id=actor_id,
            request_id=request_id,
        )

    async def get_payout_request(
        self,
        payout_id: uuid.UUID,
        reseller_id: uuid.UUID | None = None,
    ) -> ResellerPayoutRequest:
        """Alias of ``get_payout`` using the route-layer parameter name."""
        return await self.get_payout(payout_id=payout_id, reseller_id=reseller_id)

    async def list_payout_requests(
        self,
        reseller_id: uuid.UUID | None,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> tuple[list[ResellerPayoutRequest], int]:
        """Unified listing method for both reseller-scoped and admin-wide views."""
        if reseller_id is not None:
            return await self.list_payouts(
                reseller_id=reseller_id,
                page=page,
                page_size=page_size,
                status_filter=status,
            )
        return await self.admin_list_payouts(
            page=page,
            page_size=page_size,
            status_filter=status,
            reseller_id=None,
        )

    async def cancel_payout_request(
        self,
        payout_id: uuid.UUID,
        reseller_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        """Alias of ``cancel_payout`` for the route layer."""
        await self.cancel_payout(
            payout_id=payout_id,
            reseller_id=reseller_id,
            actor_id=actor_id,
        )

    async def transition_payout(
        self,
        payout_id: uuid.UUID,
        target_status: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
        notes: str | None = None,
    ) -> ResellerPayoutRequest:
        """Generic status transition dispatcher used by admin route handlers.

        Maps *target_status* to the appropriate granular service method.
        """
        if target_status == _PAYOUT_STATUS_UNDER_REVIEW:
            return await self.put_under_review(payout_id=payout_id, actor_id=actor_id)
        if target_status == _PAYOUT_STATUS_APPROVED:
            return await self.approve_payout(payout_id=payout_id, actor_id=actor_id)
        if target_status == _PAYOUT_STATUS_REJECTED:
            return await self.reject_payout(
                payout_id=payout_id, actor_id=actor_id, reason=notes
            )
        allowed = {
            _PAYOUT_STATUS_UNDER_REVIEW,
            _PAYOUT_STATUS_APPROVED,
            _PAYOUT_STATUS_REJECTED,
        }
        raise BusinessRuleError(
            f"Unsupported target status '{target_status}' for transition_payout. "
            f"Allowed: {sorted(allowed)}."
        )

    async def mark_payout_paid(
        self,
        payout_id: uuid.UUID,
        payout_method: str | None,
        payout_reference: str | None,
        payout_notes: str | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerPayoutRequest:
        """Alias of ``mark_paid`` with the parameter names the route layer uses."""
        return await self.mark_paid(
            payout_id=payout_id,
            actor_id=actor_id,
            payout_method=payout_method,
            payout_reference=payout_reference,
            payout_notes=payout_notes,
        )
