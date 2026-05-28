from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    BillingCycle,
    EntityType,
    PaymentProofStatus,
    SubscriptionChangeType,
    SubscriptionStatus,
    TenantStatus,
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
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        if sub.status not in {SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED}:
            raise BusinessRuleError(
                f"Cannot renew subscription in status '{sub.status}'. "
                "Must be ACTIVE or EXPIRED."
            )

        now = _now()
        old_status = sub.status
        base = sub.expires_at if sub.expires_at > now else now
        sub.expires_at = _expires_at_for_cycle(sub.plan.billing_cycle, base)
        if sub.status == SubscriptionStatus.EXPIRED:
            sub.status = SubscriptionStatus.ACTIVE

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.RENEWED,
            new_plan_id=sub.plan_id,
            old_status=old_status,
            new_status=sub.status,
            note=f"Extended to {sub.expires_at.isoformat()}",
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_RENEWED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={"expires_at": sub.expires_at.isoformat()},
            request_id=request_id,
        )

        result = await self.sub_repo.get_by_tenant(tenant_id)
        try:
            from app.events.base import DomainEvent
            from app.events.publisher import event_publisher
            from app.events.types import EventType
            await event_publisher.publish(DomainEvent(
                event_type=EventType.SUBSCRIPTION_RENEWED,
                tenant_id=tenant_id,
                actor_id=actor_id,
                payload={
                    "plan_name": sub.plan.name if sub.plan else "",
                    "expires_at": sub.expires_at.isoformat(),
                },
            ))
        except Exception as exc:
            logger.warning("subscription_renewed_event_failed", error=str(exc))
        return result  # type: ignore[return-value]

    async def upgrade_subscription(
        self,
        tenant_id: uuid.UUID,
        data: ChangePlanRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
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

        old_plan_id = sub.plan_id
        sub.plan_id = data.plan_id

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.UPGRADED,
            old_plan_id=old_plan_id,
            new_plan_id=data.plan_id,
            old_status=sub.status,
            new_status=sub.status,
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_UPGRADED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={"old_plan_id": str(old_plan_id), "new_plan_id": str(data.plan_id)},
            request_id=request_id,
        )

        result = await self.sub_repo.get_by_tenant(tenant_id)
        try:
            from app.events.base import DomainEvent
            from app.events.publisher import event_publisher
            from app.events.types import EventType
            old_plan = await self.plan_repo.get_by_id(old_plan_id)
            await event_publisher.publish(DomainEvent(
                event_type=EventType.SUBSCRIPTION_UPGRADED,
                tenant_id=tenant_id,
                actor_id=actor_id,
                payload={
                    "old_plan_name": old_plan.name if old_plan else str(old_plan_id),
                    "new_plan_name": new_plan.name,
                    "new_plan_id": str(data.plan_id),
                },
            ))
        except Exception as exc:
            logger.warning("subscription_upgraded_event_failed", error=str(exc))
        return result  # type: ignore[return-value]

    async def downgrade_subscription(
        self,
        tenant_id: uuid.UUID,
        data: ChangePlanRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
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

        old_plan_id = sub.plan_id
        sub.plan_id = data.plan_id

        self._add_history(
            sub,
            change_type=SubscriptionChangeType.DOWNGRADED,
            old_plan_id=old_plan_id,
            new_plan_id=data.plan_id,
            old_status=sub.status,
            new_status=sub.status,
            changed_by_user_id=actor_id,
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_DOWNGRADED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={"old_plan_id": str(old_plan_id), "new_plan_id": str(data.plan_id)},
            request_id=request_id,
        )

        result = await self.sub_repo.get_by_tenant(tenant_id)
        try:
            from app.events.base import DomainEvent
            from app.events.publisher import event_publisher
            from app.events.types import EventType
            old_plan = await self.plan_repo.get_by_id(old_plan_id)
            await event_publisher.publish(DomainEvent(
                event_type=EventType.SUBSCRIPTION_DOWNGRADED,
                tenant_id=tenant_id,
                actor_id=actor_id,
                payload={
                    "old_plan_name": old_plan.name if old_plan else str(old_plan_id),
                    "new_plan_name": new_plan.name,
                    "new_plan_id": str(data.plan_id),
                },
            ))
        except Exception as exc:
            logger.warning("subscription_downgraded_event_failed", error=str(exc))
        return result  # type: ignore[return-value]

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
        """Batch expire all ACTIVE/TRIAL subscriptions past their expires_at. Returns count."""
        now = _now()
        expired = await self.sub_repo.get_expired(now)

        for sub in expired:
            old_status = sub.status
            sub.status = SubscriptionStatus.EXPIRED
            self._add_history(
                sub,
                change_type=SubscriptionChangeType.EXPIRED,
                old_status=old_status,
                new_status=SubscriptionStatus.EXPIRED,
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
        expires_at = sub.expires_at
        delta = expires_at - now
        days_remaining = max(0, delta.days)
        is_expired = now >= expires_at

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
            expires_at=sub.expires_at.isoformat(),
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

        if sub.status == SubscriptionStatus.CANCELLED:
            raise BusinessRuleError("Cannot submit payment proof for a cancelled subscription")

        proof = PaymentProof(
            tenant_id=tenant_id,
            subscription_id=sub.id,
            amount=data.amount,
            currency=data.currency,
            reference_number=data.reference_number,
            proof_file_url=data.proof_file_url,
            status=PaymentProofStatus.PENDING,
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
            },
            request_id=request_id,
        )

        return proof

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

        # Activate the subscription
        sub = await self.sub_repo.get_by_id(proof.subscription_id)
        if not sub:
            raise NotFoundError("TenantSubscription", proof.subscription_id)

        plan = await self.plan_repo.get_by_id(sub.plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", sub.plan_id)

        old_status = sub.status
        base = sub.expires_at if sub.expires_at > now else now
        sub.status = SubscriptionStatus.ACTIVE
        sub.expires_at = _expires_at_for_cycle(plan.billing_cycle, base)
        sub.trial_ends_at = None

        # Sync denormalized tenant fields
        tenant = await self.session.get(Tenant, sub.tenant_id)
        if tenant:
            tenant.status = TenantStatus.ACTIVE
            tenant.subscription_plan = plan.code

        # Create subscription history entry
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
            action=AuditAction.PAYMENT_PROOF_APPROVED,
            actor_user_id=actor_id,
            tenant_id=sub.tenant_id,
            entity_type=EntityType.PAYMENT_PROOF,
            entity_id=proof_id,
            after_state={"review_notes": review_notes, "subscription_status": sub.status},
            request_id=request_id,
        )
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

        # Commission generation — fail-open so approval is never blocked
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
                actual_paid_amount=Decimal(str(proof.amount)),
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
