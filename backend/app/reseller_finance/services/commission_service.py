from __future__ import annotations

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import NotificationPriority, NotificationType
from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.notifications.services import NotificationService
from app.reseller_finance.models import ResellerWalletTransaction
from app.reseller_finance.repositories import ReferralRepository, WalletRepository
from app.reseller_finance.services.wallet_service import WalletService
from app.services.audit_service import AuditService

logger = get_logger(__name__)

_COMMISSION_TX_TYPES: frozenset[str] = frozenset({
    "COMMISSION_EARNED",
    "COMMISSION_REVERSAL",
})


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CommissionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.referral_repo = ReferralRepository(session)
        self.wallet_repo = WalletRepository(session)
        self.wallet_svc = WalletService(session)
        self.audit = AuditService(session)
        self.notif_svc = NotificationService(session)

    # Commission earning

    async def try_earn_commission(
        self,
        payment_proof_id: uuid.UUID,
        subscription_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actual_paid_amount: Decimal,
        currency_code: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerWalletTransaction | None:
        """Main entry point. Called after payment proof approved.

        FAIL-OPEN: catches all exceptions, logs them, returns None so that
        payment proof approval is never blocked.
        """
        try:
            return await self._earn_commission_inner(
                payment_proof_id=payment_proof_id,
                subscription_id=subscription_id,
                tenant_id=tenant_id,
                actual_paid_amount=actual_paid_amount,
                currency_code=currency_code,
                actor_id=actor_id,
                request_id=request_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "commission_earn_failed",
                payment_proof_id=str(payment_proof_id),
                tenant_id=str(tenant_id),
                error=str(exc),
                exc_info=True,
            )
            return None

    async def _earn_commission_inner(
        self,
        payment_proof_id: uuid.UUID,
        subscription_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actual_paid_amount: Decimal,
        currency_code: str,
        actor_id: uuid.UUID,
        request_id: str | None,
    ) -> ResellerWalletTransaction | None:
        # Step 1: Check if tenant has a referral
        referral = await self.referral_repo.get_referral_by_tenant(tenant_id)
        if referral is None:
            logger.debug(
                "commission_skipped_no_referral",
                tenant_id=str(tenant_id),
                payment_proof_id=str(payment_proof_id),
            )
            return None

        reseller_id = referral.reseller_id

        # Step 2: Lock the referral on first paid subscription (idempotent)
        if referral.locked_at is None:
            referral.locked_at = _now()
            referral.first_paid_subscription_at = _now()
            await self.session.flush()
            logger.info(
                "tenant_referral_locked_on_commission",
                tenant_id=str(tenant_id),
                referral_id=str(referral.id),
            )

        # Step 3: Idempotency check
        existing_tx = await self.wallet_repo.get_transaction_by_reference(
            reseller_id=reseller_id,
            reference_type="PAYMENT_PROOF",
            reference_id=payment_proof_id,
            tx_type="COMMISSION_EARNED",
        )
        if existing_tx is not None:
            logger.info(
                "commission_already_earned_idempotent",
                payment_proof_id=str(payment_proof_id),
                tx_id=str(existing_tx.id),
            )
            return existing_tx

        # Step 4: Get or create reseller wallet
        wallet = await self.wallet_svc.get_or_create_wallet(reseller_id)

        # Step 5: Calculate commission
        commission_amount = (
            actual_paid_amount * (wallet.commission_rate_pct / Decimal("100"))
        ).quantize(Decimal("0.01"))

        # Step 6: Skip if zero
        if commission_amount <= Decimal("0"):
            logger.info(
                "commission_skipped_zero_amount",
                reseller_id=str(reseller_id),
                actual_paid_amount=str(actual_paid_amount),
                rate=str(wallet.commission_rate_pct),
            )
            return None

        # Step 7: Credit the wallet
        _wallet, tx = await self.wallet_svc.credit_available(
            reseller_id=reseller_id,
            amount=commission_amount,
            tx_type="COMMISSION_EARNED",
            reference_type="PAYMENT_PROOF",
            reference_id=payment_proof_id,
            notes=(
                f"Commission earned on payment proof {payment_proof_id} "
                f"for tenant {tenant_id}. "
                f"Paid amount: {actual_paid_amount} {currency_code}. "
                f"Rate: {wallet.commission_rate_pct}%."
            ),
            metadata={
                "payment_proof_id": str(payment_proof_id),
                "subscription_id": str(subscription_id),
                "tenant_id": str(tenant_id),
                "actual_paid_amount": str(actual_paid_amount),
                "currency_code": currency_code,
                "commission_rate_pct": str(wallet.commission_rate_pct),
            },
            created_by=actor_id,
        )

        # Step 8: Audit log
        await self.audit.log(
            action="COMMISSION_EARNED",
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type="RESELLER_WALLET_TRANSACTION",
            entity_id=tx.id,
            after_state={
                "reseller_id": str(reseller_id),
                "commission_amount": str(commission_amount),
                "currency_code": currency_code,
                "payment_proof_id": str(payment_proof_id),
            },
            request_id=request_id,
        )

        # Step 9: Publish domain event
        await event_publisher.publish(
            DomainEvent(
                event_type="COMMISSION_EARNED",
                tenant_id=tenant_id,
                actor_id=actor_id,
                payload={
                    "reseller_id": str(reseller_id),
                    "payment_proof_id": str(payment_proof_id),
                    "subscription_id": str(subscription_id),
                    "commission_amount": str(commission_amount),
                    "currency_code": currency_code,
                    "wallet_tx_id": str(tx.id),
                },
            )
        )

        # Step 10: In-app notification to reseller user
        reseller_user_id = await self.referral_repo.get_reseller_user_id(reseller_id)
        if reseller_user_id is not None:
            try:
                await self.notif_svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SUBSCRIPTION,
                    priority=NotificationPriority.MEDIUM,
                    title="Commission Earned",
                    message=(
                        f"You earned {commission_amount} {currency_code} commission "
                        f"from a referred tenant's subscription payment."
                    ),
                    user_ids=[reseller_user_id],
                    metadata={
                        "commission_amount": str(commission_amount),
                        "currency_code": currency_code,
                        "payment_proof_id": str(payment_proof_id),
                    },
                )
            except Exception as notif_exc:  # noqa: BLE001
                logger.warning(
                    "commission_notification_failed",
                    reseller_id=str(reseller_id),
                    error=str(notif_exc),
                )

        logger.info(
            "commission_earned",
            reseller_id=str(reseller_id),
            payment_proof_id=str(payment_proof_id),
            commission_amount=str(commission_amount),
            currency_code=currency_code,
            tx_id=str(tx.id),
        )
        return tx

    # Commission reversal

    async def reverse_commission(
        self,
        payment_proof_id: uuid.UUID,
        tenant_id: uuid.UUID,
        reversal_reason: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerWalletTransaction | None:
        """Called on subscription refund/cancellation. FAIL-OPEN."""
        try:
            return await self._reverse_commission_inner(
                payment_proof_id=payment_proof_id,
                tenant_id=tenant_id,
                reversal_reason=reversal_reason,
                actor_id=actor_id,
                request_id=request_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "commission_reversal_failed",
                payment_proof_id=str(payment_proof_id),
                tenant_id=str(tenant_id),
                error=str(exc),
                exc_info=True,
            )
            return None

    async def _reverse_commission_inner(
        self,
        payment_proof_id: uuid.UUID,
        tenant_id: uuid.UUID,
        reversal_reason: str,
        actor_id: uuid.UUID,
        request_id: str | None,
    ) -> ResellerWalletTransaction | None:
        referral = await self.referral_repo.get_referral_by_tenant(tenant_id)
        if referral is None:
            return None

        reseller_id = referral.reseller_id

        # Step 1: Idempotency for the reversal itself
        existing_reversal = await self.wallet_repo.get_transaction_by_reference(
            reseller_id=reseller_id,
            reference_type="PAYMENT_PROOF",
            reference_id=payment_proof_id,
            tx_type="COMMISSION_REVERSAL",
        )
        if existing_reversal is not None:
            logger.info(
                "commission_reversal_already_exists",
                payment_proof_id=str(payment_proof_id),
                tx_id=str(existing_reversal.id),
            )
            return existing_reversal

        # Step 2: Find the original commission transaction
        original_tx = await self.wallet_repo.get_transaction_by_reference(
            reseller_id=reseller_id,
            reference_type="PAYMENT_PROOF",
            reference_id=payment_proof_id,
            tx_type="COMMISSION_EARNED",
        )
        if original_tx is None:
            logger.info(
                "commission_reversal_skipped_no_original",
                payment_proof_id=str(payment_proof_id),
                reseller_id=str(reseller_id),
            )
            return None

        reversal_amount = original_tx.amount

        # Step 3: Reverse via debit — may make balance negative (per spec)
        _wallet, tx = await self.wallet_svc.debit_available(
            reseller_id=reseller_id,
            amount=reversal_amount,
            tx_type="COMMISSION_REVERSAL",
            reference_type="PAYMENT_PROOF",
            reference_id=payment_proof_id,
            notes=(
                f"Commission reversal for payment proof {payment_proof_id}. "
                f"Reason: {reversal_reason}."
            ),
            metadata={
                "original_tx_id": str(original_tx.id),
                "payment_proof_id": str(payment_proof_id),
                "tenant_id": str(tenant_id),
                "reversal_reason": reversal_reason,
            },
            created_by=actor_id,
        )

        # Step 4: Audit + event + notification
        await self.audit.log(
            action="COMMISSION_REVERSED",
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type="RESELLER_WALLET_TRANSACTION",
            entity_id=tx.id,
            after_state={
                "reseller_id": str(reseller_id),
                "reversal_amount": str(reversal_amount),
                "payment_proof_id": str(payment_proof_id),
                "reason": reversal_reason,
            },
            request_id=request_id,
        )

        await event_publisher.publish(
            DomainEvent(
                event_type="COMMISSION_REVERSED",
                tenant_id=tenant_id,
                actor_id=actor_id,
                payload={
                    "reseller_id": str(reseller_id),
                    "payment_proof_id": str(payment_proof_id),
                    "reversal_amount": str(reversal_amount),
                    "reversal_reason": reversal_reason,
                    "wallet_tx_id": str(tx.id),
                },
            )
        )

        reseller_user_id = await self.referral_repo.get_reseller_user_id(reseller_id)
        if reseller_user_id is not None:
            try:
                await self.notif_svc.notify_users(
                    tenant_id=None,
                    type=NotificationType.SUBSCRIPTION,
                    priority=NotificationPriority.HIGH,
                    title="Commission Reversed",
                    message=(
                        f"A commission of {reversal_amount} {original_tx.currency_code} "
                        f"has been reversed. Reason: {reversal_reason}."
                    ),
                    user_ids=[reseller_user_id],
                    metadata={
                        "reversal_amount": str(reversal_amount),
                        "payment_proof_id": str(payment_proof_id),
                        "reason": reversal_reason,
                    },
                )
            except Exception as notif_exc:  # noqa: BLE001
                logger.warning(
                    "commission_reversal_notification_failed",
                    reseller_id=str(reseller_id),
                    error=str(notif_exc),
                )

        logger.info(
            "commission_reversed",
            reseller_id=str(reseller_id),
            payment_proof_id=str(payment_proof_id),
            reversal_amount=str(reversal_amount),
            tx_id=str(tx.id),
        )
        return tx

    # History

    async def get_commission_history(
        self,
        reseller_id: uuid.UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[ResellerWalletTransaction], int]:
        """Returns paginated wallet transactions for COMMISSION_EARNED + COMMISSION_REVERSAL."""
        offset = (page - 1) * page_size
        return await self.wallet_repo.list_transactions(
            reseller_id=reseller_id,
            tx_types=list(_COMMISSION_TX_TYPES),
            offset=offset,
            limit=page_size,
        )
