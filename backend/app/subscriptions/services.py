from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    BillingCycle,
    EntityType,
    NotificationType,
    PaymentProofStatus,
    ProofActionType,
    SubscriptionChangeType,
    SubscriptionStatus,
    TenantStatus,
    UserRole,
)
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models.tenant import Tenant
from app.services.audit_service import AuditService

logger = get_logger(__name__)
from app.subscriptions.models import (
    PaymentProof,
    PlanEntitlement,
    PlatformSettings,
    SubscriptionHistory,
    SubscriptionPlan,
    TenantSubscription,
)
from app.subscriptions.repositories import (
    PaymentProofRepository,
    SubscriptionHistoryRepository,
    SubscriptionPlanRepository,
    TenantSubscriptionRepository,
)
from app.subscriptions.schemas import (
    ActivateSubscriptionRequest,
    ChangePlanRequest,
    PaymentProofCreateRequest,
    PlanCreateRequest,
    PlanUpdateRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _expires_at_for_cycle(billing_cycle: str, from_date: datetime) -> datetime:
    if billing_cycle == BillingCycle.YEARLY:
        return from_date + timedelta(days=365)
    return from_date + timedelta(days=30)



class PlanService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.plan_repo = SubscriptionPlanRepository(session)
        self.audit = AuditService(session)

    async def create_plan(
        self,
        data: PlanCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> SubscriptionPlan:
        existing = await self.plan_repo.get_by_code(data.code)
        if existing:
            raise ConflictError(f"Plan with code '{data.code}' already exists")

        if data.is_trial:
            existing_count = await self.plan_repo.count_trial_plans()
            if existing_count > 0:
                raise ConflictError("Only one active trial plan is allowed")

        plan = SubscriptionPlan(
            name=data.name,
            code=data.code,
            description=data.description,
            billing_cycle=data.billing_cycle,
            price=data.price,
            currency=data.currency,
            trial_days=data.trial_days,
            is_active=data.is_active,
            is_trial=data.is_trial,
            is_public=data.is_public,
            sort_order=data.sort_order,
            is_custom=data.is_custom,
            contact_links=data.contact_links,
        )
        self.session.add(plan)
        await self.session.flush()
        await self.session.refresh(plan)

        for ent_data in data.entitlements:
            self.session.add(PlanEntitlement(
                plan_id=plan.id,
                feature_code=ent_data.feature_code,
                enabled=ent_data.enabled,
                limit_value=ent_data.limit_value,
            ))

        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PLAN_CREATED,
            actor_user_id=actor_id,
            entity_type=EntityType.SUBSCRIPTION_PLAN,
            entity_id=plan.id,
            after_state={"code": data.code, "name": data.name, "price": str(data.price)},
            request_id=request_id,
        )

        return await self.plan_repo.get_by_id(plan.id)  # type: ignore[return-value]

    async def update_plan(
        self,
        plan_id: uuid.UUID,
        data: PlanUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> SubscriptionPlan:
        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", plan_id)

        if data.name is not None:
            plan.name = data.name
        if data.description is not None:
            plan.description = data.description
        if data.billing_cycle is not None:
            plan.billing_cycle = data.billing_cycle
        if data.price is not None:
            plan.price = data.price
        if data.currency is not None:
            plan.currency = data.currency
        if data.trial_days is not None:
            plan.trial_days = data.trial_days
        if data.is_active is not None:
            plan.is_active = data.is_active
        if data.is_trial is not None:
            plan.is_trial = data.is_trial
        if data.is_public is not None:
            plan.is_public = data.is_public
        if data.sort_order is not None:
            plan.sort_order = data.sort_order
        if data.is_custom is not None:
            plan.is_custom = data.is_custom
        if data.contact_links is not None:
            plan.contact_links = data.contact_links

        # Guard: still only one active trial plan allowed after update
        becoming_trial = data.is_trial is True and not plan.is_trial
        becoming_active = data.is_active is True and not plan.is_active
        if (becoming_trial or (data.is_trial is True and (becoming_active or plan.is_active))):
            existing_count = await self.plan_repo.count_trial_plans()
            # Exclude the plan being updated from the count
            if plan.is_trial and plan.is_active:
                existing_count -= 1
            if existing_count > 0:
                raise ConflictError("Only one active trial plan is allowed")

        if data.entitlements is not None:
            for ent in list(plan.entitlements):
                await self.session.delete(ent)
            await self.session.flush()
            for ent_data in data.entitlements:
                self.session.add(PlanEntitlement(
                    plan_id=plan_id,
                    feature_code=ent_data.feature_code,
                    enabled=ent_data.enabled,
                    limit_value=ent_data.limit_value,
                ))

        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PLAN_UPDATED,
            actor_user_id=actor_id,
            entity_type=EntityType.SUBSCRIPTION_PLAN,
            entity_id=plan_id,
            request_id=request_id,
        )

        return await self.plan_repo.get_by_id(plan_id)  # type: ignore[return-value]

    async def archive_plan(
        self,
        plan_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> SubscriptionPlan:
        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", plan_id)

        plan.is_active = False
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PLAN_UPDATED,
            actor_user_id=actor_id,
            entity_type=EntityType.SUBSCRIPTION_PLAN,
            entity_id=plan_id,
            after_state={"is_active": False, "action": "archived"},
            request_id=request_id,
        )

        return await self.plan_repo.get_by_id(plan_id)  # type: ignore[return-value]

    async def get_plan(self, plan_id: uuid.UUID) -> SubscriptionPlan:
        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", plan_id)
        return plan

    async def list_plans(
        self,
        page: int = 1,
        page_size: int = 20,
        include_inactive: bool = False,
    ) -> tuple[list[SubscriptionPlan], int]:
        offset = (page - 1) * page_size
        return await self.plan_repo.get_all(
            offset=offset, limit=page_size, include_inactive=include_inactive
        )

    async def get_trial_plan(self) -> SubscriptionPlan | None:
        return await self.plan_repo.get_trial_plan()

    async def list_public_plans(self) -> list[SubscriptionPlan]:
        return await self.plan_repo.get_public_plans()



class SubscriptionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.sub_repo = TenantSubscriptionRepository(session)
        self.plan_repo = SubscriptionPlanRepository(session)
        self.audit = AuditService(session)

    def _add_history(
        self,
        subscription: TenantSubscription,
        change_type: str,
        old_plan_id: uuid.UUID | None = None,
        new_plan_id: uuid.UUID | None = None,
        old_status: str | None = None,
        new_status: str | None = None,
        note: str | None = None,
        changed_by_user_id: uuid.UUID | None = None,
    ) -> SubscriptionHistory:
        entry = SubscriptionHistory(
            tenant_id=subscription.tenant_id,
            subscription_id=subscription.id,
            change_type=change_type,
            old_plan_id=old_plan_id,
            new_plan_id=new_plan_id,
            old_status=old_status,
            new_status=new_status,
            note=note,
            changed_by_user_id=changed_by_user_id,
        )
        self.session.add(entry)
        return entry

    async def create_trial_subscription(
        self,
        tenant_id: uuid.UUID,
        plan_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> TenantSubscription:
        existing = await self.sub_repo.get_by_tenant(tenant_id)
        if existing:
            raise ConflictError(f"Tenant {tenant_id} already has a subscription")

        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", plan_id)

        now = _now()
        trial_days = plan.trial_days if plan.trial_days > 0 else 14
        trial_ends_at = now + timedelta(days=trial_days)

        sub = TenantSubscription(
            tenant_id=tenant_id,
            plan_id=plan_id,
            status=SubscriptionStatus.TRIAL,
            started_at=now,
            expires_at=trial_ends_at,
            trial_ends_at=trial_ends_at,
            auto_renew=True,
        )
        self.session.add(sub)
        await self.session.flush()
        await self.session.refresh(sub)

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.TRIAL_STARTED,
            new_plan_id=plan_id,
            new_status=SubscriptionStatus.TRIAL,
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={"status": SubscriptionStatus.TRIAL, "plan_id": str(plan_id)},
            request_id=request_id,
        )

        return await self.sub_repo.get_by_tenant(tenant_id)  # type: ignore[return-value]

    async def activate_subscription(
        self,
        tenant_id: uuid.UUID,
        data: ActivateSubscriptionRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        plan = await self.plan_repo.get_by_id(data.plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", data.plan_id)
        if not plan.is_active:
            raise BusinessRuleError("Target plan is not active")

        now = _now()
        old_status = sub.status
        old_plan_id = sub.plan_id

        sub.plan_id = data.plan_id
        sub.status = SubscriptionStatus.ACTIVE
        sub.expires_at = now + timedelta(days=data.extension_days)
        sub.trial_ends_at = None

        # Sync denormalized tenant fields
        tenant = await self.session.get(Tenant, tenant_id)
        if tenant:
            tenant.status = TenantStatus.ACTIVE
            tenant.subscription_plan = plan.code

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.ACTIVATED,
            old_plan_id=old_plan_id,
            new_plan_id=data.plan_id,
            old_status=old_status,
            new_status=SubscriptionStatus.ACTIVE,
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_ACTIVATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "status": SubscriptionStatus.ACTIVE,
                "plan_id": str(data.plan_id),
                "expires_at": sub.expires_at.isoformat(),
            },
            request_id=request_id,
        )

        result = await self.sub_repo.get_by_tenant(tenant_id)
        try:
            from app.events.base import DomainEvent
            from app.events.publisher import event_publisher
            from app.events.types import EventType
            await event_publisher.publish(DomainEvent(
                event_type=EventType.SUBSCRIPTION_ACTIVATED,
                tenant_id=tenant_id,
                actor_id=actor_id,
                payload={
                    "plan_name": plan.name,
                    "plan_id": str(data.plan_id),
                    "expires_at": sub.expires_at.isoformat(),
                },
            ))
        except Exception as exc:
            logger.warning("subscription_activated_event_failed", error=str(exc))
        return result  # type: ignore[return-value]

    async def renew_subscription(
        self,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> PaymentProof:
        """
        Instead of extending directly, create a PENDING PaymentProof with
        action_type=RENEWAL. The actual extension happens when a SUPER_ADMIN
        approves the proof via approve_proof().
        """
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        if sub.status not in {SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED}:
            raise BusinessRuleError(
                f"Cannot request renewal for subscription in status '{sub.status}'. "
                "Must be ACTIVE, EXPIRED, or CANCELLED."
            )

        # Block renewal for subscriptions without an expiry (no paid plan set)
        if sub.expires_at is None:
            raise BusinessRuleError(
                "This subscription has no expiry and cannot be renewed. "
                "Upgrade to a paid plan instead."
            )

        proof = PaymentProof(
            tenant_id=tenant_id,
            subscription_id=sub.id,
            amount=sub.plan.price if sub.plan else 0,
            currency=sub.plan.currency if sub.plan else "MMK",
            status=PaymentProofStatus.PENDING,
            action_type=ProofActionType.RENEWAL,
        )
        self.session.add(proof)
        await self.session.flush()
        await self.session.refresh(proof)

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.RENEWAL_REQUESTED,
            new_plan_id=sub.plan_id,
            old_status=sub.status,
            new_status=sub.status,
            note="Renewal payment proof submitted; awaiting admin approval.",
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PAYMENT_PROOF_SUBMITTED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PAYMENT_PROOF,
            entity_id=proof.id,
            after_state={"action_type": ProofActionType.RENEWAL, "plan_id": str(sub.plan_id)},
            request_id=request_id,
        )

        return proof

    async def upgrade_subscription(
        self,
        tenant_id: uuid.UUID,
        data: ChangePlanRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> PaymentProof:
        """
        Instead of switching plan immediately, create a PENDING PaymentProof with
        action_type=UPGRADE and target_plan_id. The actual switch happens when a
        SUPER_ADMIN approves the proof via approve_proof().
        """
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        reactivating = sub.status in {SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED}
        if sub.plan_id == data.plan_id and not reactivating:
            raise BusinessRuleError("Already on this plan")

        new_plan = await self.plan_repo.get_by_id(data.plan_id)
        if not new_plan:
            raise NotFoundError("SubscriptionPlan", data.plan_id)
        if not new_plan.is_active:
            raise BusinessRuleError("Target plan is not active")

        proof = PaymentProof(
            tenant_id=tenant_id,
            subscription_id=sub.id,
            amount=new_plan.price,
            currency=new_plan.currency,
            status=PaymentProofStatus.PENDING,
            action_type=ProofActionType.UPGRADE,
            target_plan_id=data.plan_id,
        )
        self.session.add(proof)
        await self.session.flush()
        await self.session.refresh(proof)

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.UPGRADE_REQUESTED,
            old_plan_id=sub.plan_id,
            new_plan_id=data.plan_id,
            old_status=sub.status,
            new_status=sub.status,
            note=f"Upgrade to plan '{new_plan.name}' requested; awaiting payment proof approval.",
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PAYMENT_PROOF_SUBMITTED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PAYMENT_PROOF,
            entity_id=proof.id,
            after_state={
                "action_type": ProofActionType.UPGRADE,
                "target_plan_id": str(data.plan_id),
                "target_plan_name": new_plan.name,
            },
            request_id=request_id,
        )

        return proof

    async def downgrade_subscription(
        self,
        tenant_id: uuid.UUID,
        data: ChangePlanRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Schedule a downgrade at end of current billing period instead of
        switching immediately. Sets pending_downgrade_plan_id on TenantSubscription.
        The Celery expiry job applies it when the subscription expires.
        """
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        if sub.status != SubscriptionStatus.ACTIVE:
            raise BusinessRuleError(
                f"Can only schedule a downgrade for an ACTIVE subscription. "
                f"Current: '{sub.status}'"
            )

        if sub.plan_id == data.plan_id:
            raise BusinessRuleError("Already on this plan")

        new_plan = await self.plan_repo.get_by_id(data.plan_id)
        if not new_plan:
            raise NotFoundError("SubscriptionPlan", data.plan_id)
        if not new_plan.is_active:
            raise BusinessRuleError("Target plan is not active")
        if new_plan.is_custom:
            raise BusinessRuleError("Custom plans are not self-service — please contact us directly.")
        # The payment-proof downgrade path already enforces this; this direct
        # endpoint didn't, so a tenant could "downgrade" straight to a free
        # plan with no proof required, and the Celery expiry job would then
        # auto-activate it indefinitely at no cost.
        current_price = sub.plan.price if sub.plan else None
        if current_price is not None and float(new_plan.price) >= float(current_price):
            raise BusinessRuleError("Target plan must be cheaper than the current plan for a downgrade")

        now = _now()
        sub.pending_downgrade_plan_id = data.plan_id
        sub.pending_downgrade_requested_at = now

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.DOWNGRADE_REQUESTED,
            old_plan_id=sub.plan_id,
            new_plan_id=data.plan_id,
            old_status=sub.status,
            new_status=sub.status,
            note=(
                f"Downgrade to plan '{new_plan.name}' scheduled for end of billing period "
                f"(expires_at={sub.expires_at.isoformat() if sub.expires_at else 'N/A'})."
            ),
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_DOWNGRADED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "pending_downgrade_plan_id": str(data.plan_id),
                "pending_downgrade_plan_name": new_plan.name,
                "scheduled_at": now.isoformat(),
            },
            request_id=request_id,
        )

        return {
            "message": "Downgrade scheduled for end of current billing period",
            "pending_downgrade_plan_id": data.plan_id,
            "pending_downgrade_requested_at": now,
        }

    async def cancel_pending_downgrade(
        self,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """Cancel a scheduled downgrade before it takes effect, keeping the current plan."""
        # Locked: the daily expiry job (process_expired_subscriptions) also reads/clears
        # pending_downgrade_plan_id for subscriptions that expire around the same time —
        # without the lock, a user's cancel could race that job and lose the update.
        sub = await self.sub_repo.get_by_tenant_locked(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        if not sub.pending_downgrade_plan_id:
            raise BusinessRuleError("No pending downgrade to cancel")

        # Once a super admin has approved the payment proof for this specific
        # downgrade, it's locked in — the tenant already paid for the new plan,
        # so unwinding it here would need a refund/commission-reversal flow that
        # doesn't exist. Only a still-pending or rejected proof (or no proof at
        # all yet) may be cancelled.
        proof_repo = PaymentProofRepository(self.session)
        approved_proof = await proof_repo.get_approved_by_subscription_action_and_plan(
            sub.id, ProofActionType.DOWNGRADE, sub.pending_downgrade_plan_id
        )
        if approved_proof:
            raise BusinessRuleError(
                "This downgrade has already been approved and paid for — it can no longer be cancelled."
            )

        cancelled_plan_id = sub.pending_downgrade_plan_id
        sub.pending_downgrade_plan_id = None
        sub.pending_downgrade_requested_at = None

        # Reject any still-PENDING downgrade proof for this subscription too —
        # otherwise it's left orphaned, and an admin approving it later would
        # be a silent no-op (the fields it would have acted on are already
        # cleared), showing "approved" with nothing actually happening.
        orphaned_proofs = await proof_repo.get_pending_by_subscription_and_action(
            sub.id, ProofActionType.DOWNGRADE
        )
        for proof in orphaned_proofs:
            proof.status = PaymentProofStatus.REJECTED
            proof.reviewed_by = actor_id
            proof.reviewed_at = _now()
            proof.review_notes = "Auto-rejected: the scheduled downgrade this proof was for was cancelled."

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.DOWNGRADE_CANCELLED,
            old_plan_id=cancelled_plan_id,
            new_plan_id=sub.plan_id,
            old_status=sub.status,
            new_status=sub.status,
            note="Scheduled downgrade cancelled; remaining on current plan.",
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_DOWNGRADE_CANCELLED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={"cancelled_pending_downgrade_plan_id": str(cancelled_plan_id)},
            request_id=request_id,
        )

        return {"message": "Pending downgrade cancelled"}

    async def cancel_subscription(
        self,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant_locked(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        if sub.status == SubscriptionStatus.CANCELLED:
            raise BusinessRuleError("Subscription is already cancelled")

        old_status = sub.status
        sub.status = SubscriptionStatus.CANCELLED
        sub.cancelled_at = _now()

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.CANCELLED,
            old_status=old_status,
            new_status=SubscriptionStatus.CANCELLED,
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_CANCELLED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            request_id=request_id,
        )

        # Claw back any commission a reseller earned across this subscription's
        # lifetime (initial activation, any later upgrades) — otherwise a
        # cancelled tenant leaves the reseller permanently overpaid.
        # reverse_commission is fail-open and no-ops for proofs that never
        # earned commission, so this is safe to call for every approved proof.
        try:
            from app.reseller_finance.services.commission_service import CommissionService
            commission_svc = CommissionService(self.session)
            proof_repo = PaymentProofRepository(self.session)
            approved_proofs = await proof_repo.get_approved_by_tenant(tenant_id)
            for proof in approved_proofs:
                await commission_svc.reverse_commission(
                    payment_proof_id=proof.id,
                    tenant_id=tenant_id,
                    reversal_reason="Subscription cancelled",
                    actor_id=actor_id,
                    request_id=request_id,
                )
        except Exception as exc:
            logger.warning("commission_reversal_on_cancel_failed", tenant_id=str(tenant_id), error=str(exc))

        return await self.sub_repo.get_by_tenant(tenant_id)  # type: ignore[return-value]

    async def suspend_subscription(
        self,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        if sub.status not in {SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL}:
            raise BusinessRuleError(
                f"Can only suspend ACTIVE or TRIAL subscriptions. Current: '{sub.status}'"
            )

        old_status = sub.status
        sub.status = SubscriptionStatus.SUSPENDED

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.SUSPENDED,
            old_status=old_status,
            new_status=SubscriptionStatus.SUSPENDED,
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_SUSPENDED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            request_id=request_id,
        )

        return await self.sub_repo.get_by_tenant(tenant_id)  # type: ignore[return-value]

    async def expire_subscription(
        self,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        if sub.status == SubscriptionStatus.EXPIRED:
            raise BusinessRuleError("Subscription is already expired")

        old_status = sub.status
        sub.status = SubscriptionStatus.EXPIRED

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.EXPIRED,
            old_status=old_status,
            new_status=SubscriptionStatus.EXPIRED,
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_EXPIRED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            request_id=request_id,
        )

        return await self.sub_repo.get_by_tenant(tenant_id)  # type: ignore[return-value]

    async def get_subscription(self, tenant_id: uuid.UUID) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)
        return sub

    async def get_history(
        self, tenant_id: uuid.UUID, page: int = 1, page_size: int = 20
    ) -> tuple[list[Any], int]:
        history_repo = SubscriptionHistoryRepository(self.session)
        offset = (page - 1) * page_size
        return await history_repo.get_by_tenant(tenant_id, offset=offset, limit=page_size)



class TrialStatusService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.sub_repo = TenantSubscriptionRepository(session)

    async def get_status(self, tenant_id: uuid.UUID) -> Any:
        from sqlalchemy import func, select
        from app.models.branch import Branch
        from app.models.user import User
        from app.customers.models import Customer
        from app.subscriptions.entitlements import EntitlementService

        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        now = _now()
        if sub.expires_at is not None:
            delta = sub.expires_at - now
            days_remaining = max(0, delta.days)
            is_expired = now >= sub.expires_at
            expires_at_str: str | None = sub.expires_at.isoformat()
        else:
            # No expiry date set (should not occur with current plans but handled as a safety net)
            days_remaining = -1
            is_expired = False
            expires_at_str = None

        async def _count(model: Any, *filters: Any) -> int:
            stmt = select(func.count()).select_from(model).where(*filters)
            result = await self.session.execute(stmt)
            return result.scalar_one()

        from app.models.product import Product
        product_count = await _count(Product, Product.tenant_id == tenant_id, Product.is_deleted.is_(False))
        staff_count   = await _count(User,    User.tenant_id == tenant_id,    User.is_deleted.is_(False))
        branch_count  = await _count(Branch,  Branch.tenant_id == tenant_id)
        customer_count = await _count(Customer, Customer.tenant_id == tenant_id, Customer.is_active.is_(True))

        # Use effective limits (respects super_admin overrides)
        ent_svc = EntitlementService(self.session)
        async def _eff_limit(feature_code: str) -> int | None:
            return await ent_svc.get_effective_limit(tenant_id, feature_code)

        from app.subscriptions.schemas import TrialStatusResponse
        return TrialStatusResponse(
            status=sub.status,
            plan_name=sub.plan.name,
            plan_code=sub.plan.code,
            started_at=sub.started_at.isoformat(),
            expires_at=expires_at_str,
            days_remaining=days_remaining,
            is_expired=is_expired,
            usage={
                "products":  {"used": product_count,  "limit": await _eff_limit("products")},
                "staff":     {"used": staff_count,     "limit": await _eff_limit("users")},
                "branches":  {"used": branch_count,    "limit": await _eff_limit("branches")},
                "customers": {"used": customer_count,  "limit": await _eff_limit("customers")},
            },
        )


class PaymentProofService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.proof_repo = PaymentProofRepository(session)
        self.sub_repo = TenantSubscriptionRepository(session)
        self.plan_repo = SubscriptionPlanRepository(session)
        self.audit = AuditService(session)

    async def _get_super_admin_ids(self) -> list[uuid.UUID]:
        from sqlalchemy import select
        from app.models.user import User
        result = await self.session.execute(
            select(User.id).where(User.role == UserRole.SUPER_ADMIN, User.is_deleted.is_(False))
        )
        return list(result.scalars().all())

    async def _get_tenant_owner_ids(self, tenant_id: uuid.UUID) -> list[uuid.UUID]:
        from sqlalchemy import select
        from app.models.user import User
        result = await self.session.execute(
            select(User.id).where(
                User.tenant_id == tenant_id,
                User.role == UserRole.BUSINESS_OWNER,
                User.is_deleted.is_(False),
            )
        )
        return list(result.scalars().all())

    async def _get_tenant_owner_email(self, tenant_id: uuid.UUID) -> str | None:
        from sqlalchemy import select
        from app.models.user import User
        result = await self.session.execute(
            select(User.email).where(
                User.tenant_id == tenant_id,
                User.role == UserRole.BUSINESS_OWNER,
                User.is_deleted.is_(False),
            ).limit(1)
        )
        return result.scalar_one_or_none()

    async def _notify_silent(self, *, user_ids: list, **kwargs) -> None:
        """Fire a notification; skipped when no recipients. Never raises."""
        if not user_ids:
            return
        try:
            # A SAVEPOINT keeps a notification-layer failure from poisoning the
            # caller's outer transaction (e.g. a payment-proof approval, whose
            # actual business effect must still commit even if this fails).
            async with self.session.begin_nested():
                from app.notifications.services import NotificationService
                svc = NotificationService(self.session)
                await svc.notify_users(user_ids=user_ids, **kwargs)
        except Exception as exc:
            logger.warning("notification_send_failed", error=str(exc))

    async def submit_proof(
        self,
        tenant_id: uuid.UUID,
        data: PaymentProofCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> PaymentProof:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        # The schema only checks the path shape (/uploads/proofs/...) — without this,
        # a tenant could submit a proof_file_url pointing into another tenant's
        # proof directory (e.g. one it obtained through some other legitimate access)
        # and have it recorded as its own payment proof.
        if not data.proof_file_url.startswith(f"/uploads/proofs/{tenant_id}/"):
            raise BusinessRuleError("proof_file_url must reference a file uploaded by this tenant.")

        # CANCELLED subscriptions may submit a proof to reactivate

        action_type = getattr(data, "action_type", None) or ProofActionType.INITIAL_ACTIVATION
        target_plan_id = getattr(data, "target_plan_id", None)

        # Validate DOWNGRADE action: target plan must exist, be active, and cheaper than current
        target_plan_name: str | None = None
        if action_type == ProofActionType.DOWNGRADE:
            if not target_plan_id:
                raise BusinessRuleError("Downgrade proof requires a target_plan_id.")
            target_plan = await self.plan_repo.get_by_id(target_plan_id)
            if not target_plan or not target_plan.is_active:
                raise BusinessRuleError("Target downgrade plan not found or inactive.")
            if target_plan.is_custom:
                raise BusinessRuleError("Custom plans are not self-service — please contact us directly.")
            if float(target_plan.price) >= float(sub.plan.price if sub.plan else 0):
                raise BusinessRuleError("Target plan must be cheaper than current plan for a downgrade.")
            target_plan_name = target_plan.name
        elif target_plan_id:
            # Upgrade / initial-activation proofs also carry a target_plan_id
            # (see PlansPage/CurrentSubscriptionPage) — block custom plans there too.
            target_plan = await self.plan_repo.get_by_id(target_plan_id)
            if target_plan and target_plan.is_custom:
                raise BusinessRuleError("Custom plans are not self-service — please contact us directly.")

        proof = PaymentProof(
            tenant_id=tenant_id,
            subscription_id=sub.id,
            amount=data.amount,
            currency=data.currency,
            reference_number=data.reference_number,
            proof_file_url=data.proof_file_url,
            status=PaymentProofStatus.PENDING,
            action_type=action_type,
            target_plan_id=target_plan_id,
        )
        self.session.add(proof)
        await self.session.flush()
        await self.session.refresh(proof)

        await self.audit.log(
            action=AuditAction.PAYMENT_PROOF_SUBMITTED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PAYMENT_PROOF,
            entity_id=proof.id,
            after_state={
                "amount": str(data.amount),
                "currency": data.currency,
                "reference_number": data.reference_number,
                "action_type": str(action_type),
                **({"target_plan_id": str(target_plan_id)} if target_plan_id else {}),
            },
            request_id=request_id,
        )

        # Notify all super admins that a new proof is waiting for review
        tenant = await self.session.get(Tenant, tenant_id)
        tenant_name = tenant.name if tenant else str(tenant_id)
        plan_name = sub.plan.name if sub.plan else "Unknown"
        action_label = (
            f"downgrade to {target_plan_name}" if action_type == ProofActionType.DOWNGRADE and target_plan_name
            else f"renew {plan_name}" if action_type == ProofActionType.RENEWAL
            else f"upgrade from {plan_name}" if action_type == ProofActionType.UPGRADE
            else plan_name
        )
        admin_ids = await self._get_super_admin_ids()
        await self._notify_silent(
            tenant_id=None,
            type=NotificationType.SUBSCRIPTION,
            priority="HIGH",
            title="Payment Proof Submitted",
            message=(
                f"{tenant_name} submitted a payment proof to {action_label} "
                f"({data.currency} {int(data.amount):,}). Review required."
            ),
            user_ids=admin_ids,
            metadata={
                "proof_id": str(proof.id),
                "tenant_id": str(tenant_id),
                "action_type": str(action_type),
            },
        )

        # Re-fetch with eager-loaded relationships so target_plan_name is available
        # for response serialisation without hitting async lazy-load outside greenlet.
        loaded = await self.proof_repo.get_by_id(proof.id)
        return loaded or proof

    async def _extend_subscription(
        self,
        sub: "TenantSubscription",
        actor_id: uuid.UUID,
        proof_amount: "Decimal",
        proof_currency: str,
        request_id: str | None = None,
    ) -> None:
        """Extend an existing subscription by one billing cycle (RENEWAL path)."""
        from decimal import Decimal as _Decimal

        plan = await self.plan_repo.get_by_id(sub.plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", sub.plan_id)

        now = _now()
        old_status = sub.status
        base = sub.expires_at if (sub.expires_at is not None and sub.expires_at > now) else now
        sub.status = SubscriptionStatus.ACTIVE
        sub.expires_at = _expires_at_for_cycle(plan.billing_cycle, base)
        sub.trial_ends_at = None
        # A renewal supersedes any scheduled downgrade — otherwise the stale
        # pending_downgrade_plan_id survives to the (now pushed-out) expiry
        # date and the Celery job force-downgrades a tenant who just renewed.
        sub.pending_downgrade_plan_id = None
        sub.pending_downgrade_requested_at = None

        # Sync denormalized tenant fields
        tenant = await self.session.get(Tenant, sub.tenant_id)
        if tenant:
            tenant.status = TenantStatus.ACTIVE
            tenant.subscription_plan = plan.code
            tenant.subscription_expires_at = sub.expires_at

        history = SubscriptionHistory(
            tenant_id=sub.tenant_id,
            subscription_id=sub.id,
            change_type=SubscriptionChangeType.RENEWED,
            new_plan_id=sub.plan_id,
            old_status=old_status,
            new_status=SubscriptionStatus.ACTIVE,
            note=(
                f"Renewed via payment proof approval. "
                f"Extended to {sub.expires_at.isoformat()}. "
                f"Amount: {proof_amount} {proof_currency}"
            ),
            changed_by_user_id=actor_id,
        )
        self.session.add(history)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_RENEWED,
            actor_user_id=actor_id,
            tenant_id=sub.tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "status": SubscriptionStatus.ACTIVE,
                "expires_at": sub.expires_at.isoformat(),
                "triggered_by": "payment_proof_renewal_approval",
            },
            request_id=request_id,
        )

        try:
            from app.events.base import DomainEvent
            from app.events.publisher import event_publisher
            from app.events.types import EventType
            await event_publisher.publish(DomainEvent(
                event_type=EventType.SUBSCRIPTION_RENEWED,
                tenant_id=sub.tenant_id,
                actor_id=actor_id,
                payload={
                    "plan_name": plan.name,
                    "expires_at": sub.expires_at.isoformat(),
                },
            ))
        except Exception as exc:
            logger.warning("subscription_renewed_event_failed", error=str(exc))

    async def _apply_upgrade(
        self,
        sub: "TenantSubscription",
        target_plan_id: uuid.UUID,
        actor_id: uuid.UUID,
        proof_amount: "Decimal",
        proof_currency: str,
        request_id: str | None = None,
    ) -> None:
        """Switch plan to target_plan_id immediately (UPGRADE approval path)."""
        new_plan = await self.plan_repo.get_by_id(target_plan_id)
        if not new_plan:
            raise NotFoundError("SubscriptionPlan", target_plan_id)
        if not new_plan.is_active:
            raise BusinessRuleError("Target upgrade plan is no longer active")

        now = _now()
        old_plan_id = sub.plan_id
        old_status = sub.status

        sub.plan_id = target_plan_id
        sub.status = SubscriptionStatus.ACTIVE
        # If upgrading FROM a trial (or from an expired/no expiry state) give a full
        # billing cycle starting now. For paid→higher-paid upgrades keep the existing
        # expires_at so the tenant does not lose days they already paid for.
        if old_status == SubscriptionStatus.TRIAL or sub.expires_at is None or sub.expires_at <= now:
            sub.expires_at = _expires_at_for_cycle(new_plan.billing_cycle, now)
        sub.trial_ends_at = None
        # An upgrade supersedes any scheduled downgrade — otherwise the stale
        # pending_downgrade_plan_id survives to expiry and the Celery job
        # force-downgrades a tenant who just paid for an upgrade instead.
        sub.pending_downgrade_plan_id = None
        sub.pending_downgrade_requested_at = None

        # Sync denormalized tenant fields
        tenant = await self.session.get(Tenant, sub.tenant_id)
        if tenant:
            tenant.status = TenantStatus.ACTIVE
            tenant.subscription_plan = new_plan.code
            tenant.subscription_expires_at = sub.expires_at

        history = SubscriptionHistory(
            tenant_id=sub.tenant_id,
            subscription_id=sub.id,
            change_type=SubscriptionChangeType.UPGRADED,
            old_plan_id=old_plan_id,
            new_plan_id=target_plan_id,
            old_status=old_status,
            new_status=SubscriptionStatus.ACTIVE,
            note=(
                f"Upgraded via payment proof approval. "
                f"Amount: {proof_amount} {proof_currency}"
            ),
            changed_by_user_id=actor_id,
        )
        self.session.add(history)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_UPGRADED,
            actor_user_id=actor_id,
            tenant_id=sub.tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "old_plan_id": str(old_plan_id),
                "new_plan_id": str(target_plan_id),
                "triggered_by": "payment_proof_upgrade_approval",
            },
            request_id=request_id,
        )

        try:
            from app.events.base import DomainEvent
            from app.events.publisher import event_publisher
            from app.events.types import EventType
            old_plan = await self.plan_repo.get_by_id(old_plan_id)
            await event_publisher.publish(DomainEvent(
                event_type=EventType.SUBSCRIPTION_UPGRADED,
                tenant_id=sub.tenant_id,
                actor_id=actor_id,
                payload={
                    "old_plan_name": old_plan.name if old_plan else str(old_plan_id),
                    "new_plan_name": new_plan.name,
                    "new_plan_id": str(target_plan_id),
                },
            ))
        except Exception as exc:
            logger.warning("subscription_upgraded_event_failed", error=str(exc))

    async def _apply_downgrade(
        self,
        sub: "TenantSubscription",
        target_plan_id: uuid.UUID,
        actor_id: uuid.UUID,
        proof_amount: "Decimal",
        proof_currency: str,
        request_id: str | None = None,
    ) -> None:
        """Confirm downgrade payment — deferred activation.

        The plan switch does NOT happen here. pending_downgrade_plan_id stays set
        so the daily Celery expiry job can detect the paid downgrade and activate
        Plan B the moment Plan A expires. The tenant keeps Plan A features until
        the last day of their current billing period.
        """
        new_plan = await self.plan_repo.get_by_id(target_plan_id)
        if not new_plan:
            raise NotFoundError("SubscriptionPlan", target_plan_id)
        if not new_plan.is_active:
            raise BusinessRuleError("Target downgrade plan is no longer active")

        expires_str = (
            sub.expires_at.strftime("%d %b %Y") if sub.expires_at else "end of billing period"
        )
        current_plan_name = sub.plan.name if sub.plan else "your current plan"

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_DOWNGRADED,
            actor_user_id=actor_id,
            tenant_id=sub.tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "pending_downgrade_plan_id": str(target_plan_id),
                "pending_downgrade_plan_name": new_plan.name,
                "payment_amount": str(proof_amount),
                "payment_currency": proof_currency,
                "switches_at": sub.expires_at.isoformat() if sub.expires_at else None,
                "triggered_by": "payment_proof_downgrade_approval_deferred",
            },
            request_id=request_id,
        )

        # Notify owner: payment confirmed, plan switches automatically at expiry
        owner_ids = await self._get_tenant_owner_ids(sub.tenant_id)
        await self._notify_silent(
            tenant_id=sub.tenant_id,
            type=NotificationType.SUBSCRIPTION,
            priority="HIGH",
            title="Downgrade Payment Approved",
            message=(
                f"Your payment for the {new_plan.name} plan has been approved. "
                f"Your account will automatically switch to {new_plan.name} on {expires_str}. "
                f"You can continue using {current_plan_name} until then."
            ),
            user_ids=owner_ids,
            metadata={
                "target_plan_name": new_plan.name,
                "target_plan_id": str(target_plan_id),
                "switches_at": sub.expires_at.isoformat() if sub.expires_at else None,
            },
        )

    async def approve_proof(
        self,
        proof_id: uuid.UUID,
        actor_id: uuid.UUID,
        review_notes: str | None = None,
        request_id: str | None = None,
    ) -> PaymentProof:
        # Lock both rows before the status check — otherwise two concurrent
        # approve requests for the same still-PENDING proof (double-click, or
        # two admins) can both pass validation and both apply the subscription
        # extension/upgrade/downgrade, duplicating billing-cycle extensions,
        # notifications, and audit rows.
        proof = await self.proof_repo.get_by_id_locked(proof_id)
        if not proof:
            raise NotFoundError("PaymentProof", proof_id)

        if proof.status != PaymentProofStatus.PENDING:
            raise BusinessRuleError(
                f"Payment proof is already '{proof.status}'. Only PENDING proofs can be approved."
            )

        now = _now()
        proof.status = PaymentProofStatus.APPROVED
        proof.reviewed_by = actor_id
        proof.reviewed_at = now
        proof.review_notes = review_notes

        sub = await self.sub_repo.get_by_id_locked(proof.subscription_id)
        if not sub:
            raise NotFoundError("TenantSubscription", proof.subscription_id)

        # Dispatch based on action_type
        action = getattr(proof, "action_type", ProofActionType.INITIAL_ACTIVATION)

        if action == ProofActionType.RENEWAL:
            # Extend existing subscription by one billing cycle
            await self._extend_subscription(
                sub=sub,
                actor_id=actor_id,
                proof_amount=proof.amount,
                proof_currency=proof.currency,
                request_id=request_id,
            )
        elif action == ProofActionType.UPGRADE:
            if not proof.target_plan_id:
                raise BusinessRuleError(
                    "Upgrade proof is missing target_plan_id; cannot apply upgrade."
                )
            await self._apply_upgrade(
                sub=sub,
                target_plan_id=proof.target_plan_id,
                actor_id=actor_id,
                proof_amount=proof.amount,
                proof_currency=proof.currency,
                request_id=request_id,
            )
        elif action == ProofActionType.DOWNGRADE:
            if not proof.target_plan_id:
                raise BusinessRuleError(
                    "Downgrade proof is missing target_plan_id; cannot apply downgrade."
                )
            await self._apply_downgrade(
                sub=sub,
                target_plan_id=proof.target_plan_id,
                actor_id=actor_id,
                proof_amount=proof.amount,
                proof_currency=proof.currency,
                request_id=request_id,
            )
        elif proof.target_plan_id and proof.target_plan_id != sub.plan_id:
            # INITIAL_ACTIVATION with a target plan that differs from the subscription's
            # current plan — e.g. a trial tenant picking their first paid plan via the
            # "Select Plan" proof flow, which does not set action_type explicitly and so
            # defaults to INITIAL_ACTIVATION. Apply it the same way an UPGRADE proof
            # would, so the subscription actually moves onto the plan that was paid for.
            await self._apply_upgrade(
                sub=sub,
                target_plan_id=proof.target_plan_id,
                actor_id=actor_id,
                proof_amount=proof.amount,
                proof_currency=proof.currency,
                request_id=request_id,
            )
        else:
            # INITIAL_ACTIVATION — original behavior (activates the plan already on
            # the subscription; no target plan was specified on the proof).
            plan = await self.plan_repo.get_by_id(sub.plan_id)
            if not plan:
                raise NotFoundError("SubscriptionPlan", sub.plan_id)

            old_status = sub.status
            base = sub.expires_at if (sub.expires_at is not None and sub.expires_at > now) else now
            sub.status = SubscriptionStatus.ACTIVE
            sub.expires_at = _expires_at_for_cycle(plan.billing_cycle, base)
            sub.trial_ends_at = None

            # Sync denormalized tenant fields
            tenant = await self.session.get(Tenant, sub.tenant_id)
            if tenant:
                tenant.status = TenantStatus.ACTIVE
                tenant.subscription_plan = plan.code
                tenant.subscription_expires_at = sub.expires_at

            history = SubscriptionHistory(
                tenant_id=sub.tenant_id,
                subscription_id=sub.id,
                change_type=SubscriptionChangeType.ACTIVATED,
                new_plan_id=sub.plan_id,
                old_status=old_status,
                new_status=SubscriptionStatus.ACTIVE,
                note=f"Activated via payment proof approval. Amount: {proof.amount} {proof.currency}",
                changed_by_user_id=actor_id,
            )
            self.session.add(history)
            await self.session.flush()

            await self.audit.log(
                action=AuditAction.SUBSCRIPTION_ACTIVATED,
                actor_user_id=actor_id,
                tenant_id=sub.tenant_id,
                entity_type=EntityType.TENANT_SUBSCRIPTION,
                entity_id=sub.id,
                after_state={
                    "status": SubscriptionStatus.ACTIVE,
                    "expires_at": sub.expires_at.isoformat(),
                    "triggered_by": "payment_proof_approval",
                },
                request_id=request_id,
            )

        await self.audit.log(
            action=AuditAction.PAYMENT_PROOF_APPROVED,
            actor_user_id=actor_id,
            tenant_id=sub.tenant_id,
            entity_type=EntityType.PAYMENT_PROOF,
            entity_id=proof_id,
            after_state={
                "review_notes": review_notes,
                "action_type": str(action),
                "subscription_status": sub.status,
            },
            request_id=request_id,
        )

        # DOWNGRADE approval notification is sent inside _apply_downgrade (deferred activation).
        # For all other action types, notify the owner that the subscription is now active.
        if action != ProofActionType.DOWNGRADE:
            # sub.plan is a relationship loaded before _apply_upgrade() changed
            # sub.plan_id — it isn't refreshed by the flush, so it still points at
            # the OLD plan whenever this proof specified a target (UPGRADE, or the
            # INITIAL_ACTIVATION-with-target fallback above). proof.target_plan is
            # fetched independently and is always correct in that case; only fall
            # back to sub.plan for a true no-target activation, where sub.plan was
            # never reassigned and is still accurate.
            notified_plan = proof.target_plan if proof.target_plan else sub.plan
            plan_name = notified_plan.name if notified_plan else "your plan"
            owner_ids = await self._get_tenant_owner_ids(sub.tenant_id)
            await self._notify_silent(
                tenant_id=sub.tenant_id,
                type=NotificationType.SUBSCRIPTION,
                priority="HIGH",
                title="Subscription Activated",
                message=(
                    f"Your payment proof has been approved. Your {plan_name} subscription "
                    f"is now active."
                    + (f" Note: {review_notes}" if review_notes else "")
                ),
                user_ids=owner_ids,
                metadata={"proof_id": str(proof_id), "plan_name": plan_name, "review_notes": review_notes},
            )

        # Commission generation — only for INITIAL_ACTIVATION and UPGRADE (paid plan switches).
        # RENEWAL does NOT re-trigger commission (already earned on first payment).
        if action in {ProofActionType.INITIAL_ACTIVATION, ProofActionType.UPGRADE}:
            try:
                from decimal import Decimal
                from app.reseller_finance.services.commission_service import CommissionService
                from app.reseller_finance.services.referral_service import ReferralService
                commission_svc = CommissionService(self.session)
                referral_svc = ReferralService(self.session)
                await commission_svc.try_earn_commission(
                    tenant_id=sub.tenant_id,
                    subscription_id=sub.id,
                    payment_proof_id=proof_id,
                    actual_paid_amount=proof.amount,
                    currency_code=proof.currency,
                    actor_id=actor_id,
                    request_id=request_id,
                )
                # Lock referral on first paid subscription
                await referral_svc.lock_referral(
                    tenant_id=sub.tenant_id,
                    first_paid_at=now,
                )
            except Exception as exc:
                from app.core.logging import get_logger as _get_logger
                _get_logger(__name__).warning(
                    "commission_earn_failed",
                    tenant_id=str(sub.tenant_id),
                    proof_id=str(proof_id),
                    error=str(exc),
                )

        # Send receipt email to business owner
        try:
            owner_email = await self._get_tenant_owner_email(sub.tenant_id)
            if owner_email:
                from app.notifications.email import send_subscription_receipt_email
                _action_labels = {
                    ProofActionType.RENEWAL: "Renewal",
                    ProofActionType.UPGRADE: "Upgrade",
                    ProofActionType.DOWNGRADE: "Downgrade",
                    ProofActionType.INITIAL_ACTIVATION: "Activation",
                }
                # Whenever the proof named a target plan (UPGRADE, DOWNGRADE, or the
                # INITIAL_ACTIVATION-with-target fallback that also switches plans),
                # the receipt is for that target — sub.plan may be stale (see the
                # in-app notification above for why). Only a true no-target
                # activation falls back to sub.plan.
                if proof.target_plan:
                    receipt_plan = proof.target_plan
                else:
                    receipt_plan = sub.plan
                tenant_name = proof.tenant.name if proof.tenant else str(sub.tenant_id)
                plan_name = receipt_plan.name if receipt_plan else "Unknown Plan"
                plan_price = str(receipt_plan.price) if receipt_plan else "—"
                started_str = sub.started_at.strftime("%B %d, %Y") if sub.started_at else "—"
                expires_str_receipt = sub.expires_at.strftime("%B %d, %Y") if sub.expires_at else "—"
                await send_subscription_receipt_email(
                    to=owner_email,
                    tenant_name=tenant_name,
                    plan_name=plan_name,
                    plan_price=plan_price,
                    currency=proof.currency,
                    started_at=started_str,
                    expires_at=expires_str_receipt,
                    paid_amount=str(proof.amount),
                    reference_number=proof.reference_number or None,
                    action_label=_action_labels.get(action, "Receipt"),
                )
        except Exception as _exc:
            logger.warning("subscription_receipt_email_failed", error=str(_exc))

        loaded = await self.proof_repo.get_by_id(proof.id)
        return loaded or proof

    async def reject_proof(
        self,
        proof_id: uuid.UUID,
        actor_id: uuid.UUID,
        review_notes: str | None = None,
        request_id: str | None = None,
    ) -> PaymentProof:
        proof = await self.proof_repo.get_by_id_locked(proof_id)
        if not proof:
            raise NotFoundError("PaymentProof", proof_id)

        if proof.status != PaymentProofStatus.PENDING:
            raise BusinessRuleError(
                f"Payment proof is already '{proof.status}'. Only PENDING proofs can be rejected."
            )

        proof.status = PaymentProofStatus.REJECTED
        proof.reviewed_by = actor_id
        proof.reviewed_at = _now()
        proof.review_notes = review_notes

        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PAYMENT_PROOF_REJECTED,
            actor_user_id=actor_id,
            tenant_id=proof.tenant_id,
            entity_type=EntityType.PAYMENT_PROOF,
            entity_id=proof_id,
            after_state={"review_notes": review_notes},
            request_id=request_id,
        )

        # Notify tenant owner that proof was rejected and they must resubmit
        owner_ids = await self._get_tenant_owner_ids(proof.tenant_id)
        reason_part = f" Reason: {review_notes}" if review_notes else " No reason provided."
        await self._notify_silent(
            tenant_id=proof.tenant_id,
            type=NotificationType.SUBSCRIPTION,
            priority="HIGH",
            title="Payment Proof Rejected",
            message=(
                f"Your payment proof was rejected and your subscription was not activated."
                f"{reason_part} Please resubmit a new payment proof."
            ),
            user_ids=owner_ids,
            metadata={"proof_id": str(proof_id), "review_notes": review_notes},
        )

        loaded = await self.proof_repo.get_by_id(proof.id)
        return loaded or proof

    async def list_proofs(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PaymentProof], int]:
        offset = (page - 1) * page_size
        return await self.proof_repo.get_by_tenant(
            tenant_id, offset=offset, limit=page_size
        )

    async def list_all_proofs(
        self,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
        tenant_id: uuid.UUID | None = None,
    ) -> tuple[list[PaymentProof], int]:
        offset = (page - 1) * page_size
        return await self.proof_repo.get_all(
            status=status, offset=offset, limit=page_size, tenant_id=tenant_id
        )


class PlatformSettingsService:
    SETTINGS_KEY = "default"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _get_or_create(self) -> PlatformSettings:
        from sqlalchemy import select
        result = await self.session.execute(
            select(PlatformSettings).where(PlatformSettings.settings_key == self.SETTINGS_KEY)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = PlatformSettings(settings_key=self.SETTINGS_KEY, payment_methods=[])
            self.session.add(row)
            await self.session.flush()
        return row

    async def get_payment_methods(self) -> list:
        row = await self._get_or_create()
        return row.payment_methods or []

    async def set_payment_methods(self, methods: list) -> list:
        row = await self._get_or_create()
        row.payment_methods = [m.model_dump() if hasattr(m, 'model_dump') else dict(m) for m in methods]
        await self.session.flush()
        return row.payment_methods

    async def get_app_download_links(self) -> dict:
        row = await self._get_or_create()
        return row.app_download_links or {
            "android": "", "ios": "", "windows": "", "ubuntu": "", "mac": "", "print_agent": "",
            "youtube": "", "phone": "", "telegram": "", "viber": "",
            "email": "", "facebook": "", "tiktok": "",
        }

    async def set_app_download_links(self, links: dict) -> dict:
        row = await self._get_or_create()
        row.app_download_links = dict(links)
        await self.session.flush()
        return row.app_download_links
