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

        if sub.plan_id == data.plan_id:
            raise BusinessRuleError("Already on this plan")

        new_plan = await self.plan_repo.get_by_id(data.plan_id)
        if not new_plan:
            raise NotFoundError("SubscriptionPlan", data.plan_id)
        if not new_plan.is_active:
            raise BusinessRuleError("Target plan is not active")

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

    async def cancel_subscription(
        self,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
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

    async def process_expired_subscriptions(self) -> int:
        """Mark expired subscriptions as EXPIRED. Users must upgrade to continue."""
        now = _now()
        expired = await self.sub_repo.get_expired(now)

        for sub in expired:
            old_status = sub.status
            old_plan_id = sub.plan_id

            sub.status = SubscriptionStatus.EXPIRED

            self._add_history(
                sub,
                change_type=SubscriptionChangeType.EXPIRED,
                old_plan_id=old_plan_id,
                old_status=old_status,
                new_status=SubscriptionStatus.EXPIRED,
                note="Subscription auto-expired. Upgrade required to continue.",
            )
            await self.audit.log(
                action=AuditAction.SUBSCRIPTION_EXPIRED,
                tenant_id=sub.tenant_id,
                entity_type=EntityType.TENANT_SUBSCRIPTION,
                entity_id=sub.id,
                after_state={"previous_status": old_status},
            )

        await self.session.flush()
        return len(expired)

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

    async def _notify_silent(self, *, user_ids: list, **kwargs) -> None:
        """Fire a notification; skipped when no recipients. Never raises."""
        if not user_ids:
            return
        try:
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
            if float(target_plan.price) >= float(sub.plan.price if sub.plan else 0):
                raise BusinessRuleError("Target plan must be cheaper than current plan for a downgrade.")
            target_plan_name = target_plan.name

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

        return proof

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

        # Sync denormalized tenant fields
        tenant = await self.session.get(Tenant, sub.tenant_id)
        if tenant:
            tenant.status = TenantStatus.ACTIVE
            tenant.subscription_plan = plan.code

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
        # Keep existing expires_at — tenant already paid for the current period;
        # next renewal will be on the new plan's billing cycle.
        sub.trial_ends_at = None

        # Sync denormalized tenant fields
        tenant = await self.session.get(Tenant, sub.tenant_id)
        if tenant:
            tenant.status = TenantStatus.ACTIVE
            tenant.subscription_plan = new_plan.code

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
        proof = await self.proof_repo.get_by_id(proof_id)
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

        sub = await self.sub_repo.get_by_id(proof.subscription_id)
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
        else:
            # INITIAL_ACTIVATION — original behavior
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
            plan_name = sub.plan.name if sub.plan else "your plan"
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

        return proof

    async def reject_proof(
        self,
        proof_id: uuid.UUID,
        actor_id: uuid.UUID,
        review_notes: str | None = None,
        request_id: str | None = None,
    ) -> PaymentProof:
        proof = await self.proof_repo.get_by_id(proof_id)
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

        return proof

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
