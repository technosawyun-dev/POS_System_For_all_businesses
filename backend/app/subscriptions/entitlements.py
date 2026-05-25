from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import (
    AuditAction,
    EntityType,
    SubscriptionChangeType,
    SubscriptionStatus,
)
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    SubscriptionExpiredException,
    SubscriptionSuspendedException,
    UsageLimitExceededException,
)
from app.services.audit_service import AuditService
from app.models.tenant import Tenant
from app.subscriptions.models import (
    SubscriptionHistory,
    SubscriptionPlan,
    TenantEntitlementOverride,
    TenantSubscription,
)
from app.subscriptions.repositories import (
    SubscriptionPlanRepository,
    TenantSubscriptionRepository,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)



@dataclass
class EffectiveEntitlement:
    feature_code: str
    enabled: bool
    limit_value: int | None
    source: str  # "override" | "plan" | "default"



class TenantEntitlementOverrideRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, override_id: uuid.UUID) -> TenantEntitlementOverride | None:
        stmt = select(TenantEntitlementOverride).where(TenantEntitlementOverride.id == override_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant_feature(
        self, tenant_id: uuid.UUID, feature_code: str
    ) -> TenantEntitlementOverride | None:
        stmt = select(TenantEntitlementOverride).where(
            TenantEntitlementOverride.tenant_id == tenant_id,
            TenantEntitlementOverride.feature_code == feature_code,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant(self, tenant_id: uuid.UUID) -> list[TenantEntitlementOverride]:
        stmt = (
            select(TenantEntitlementOverride)
            .where(TenantEntitlementOverride.tenant_id == tenant_id)
            .order_by(TenantEntitlementOverride.feature_code)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_tenant_active(
        self, tenant_id: uuid.UUID, now: datetime
    ) -> list[TenantEntitlementOverride]:
        stmt = select(TenantEntitlementOverride).where(
            TenantEntitlementOverride.tenant_id == tenant_id,
            (TenantEntitlementOverride.expires_at.is_(None))
            | (TenantEntitlementOverride.expires_at > now),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())



class TenantSubscriptionValidator:
    def __init__(self, session: AsyncSession) -> None:
        self.sub_repo = TenantSubscriptionRepository(session)

    async def validate_subscription_active(self, tenant_id: uuid.UUID) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise SubscriptionExpiredException(
                "No subscription found. Please contact your administrator."
            )
        if sub.status == SubscriptionStatus.EXPIRED:
            raise SubscriptionExpiredException(
                f"Subscription expired on {sub.expires_at.strftime('%Y-%m-%d')}. "
                "Please renew to continue."
            )
        if sub.status == SubscriptionStatus.SUSPENDED:
            raise SubscriptionSuspendedException(
                "Your subscription has been suspended. Please contact support."
            )
        if sub.status == SubscriptionStatus.CANCELLED:
            raise SubscriptionExpiredException(
                "Subscription has been cancelled. Please contact support."
            )
        return sub

    async def validate_not_expired(self, tenant_id: uuid.UUID) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub or sub.status == SubscriptionStatus.EXPIRED:
            raise SubscriptionExpiredException()
        return sub

    async def validate_not_suspended(self, tenant_id: uuid.UUID) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub or sub.status == SubscriptionStatus.SUSPENDED:
            raise SubscriptionSuspendedException()
        return sub



class EntitlementService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.override_repo = TenantEntitlementOverrideRepository(session)
        self.sub_repo = TenantSubscriptionRepository(session)

    async def get_effective_entitlement(
        self, tenant_id: uuid.UUID, feature_code: str
    ) -> EffectiveEntitlement:
        now = _now()

        # Priority 1: active override
        override = await self.override_repo.get_by_tenant_feature(tenant_id, feature_code)
        if override is not None:
            if override.expires_at is None or override.expires_at > now:
                enabled = override.enabled if override.enabled is not None else True
                return EffectiveEntitlement(
                    feature_code=feature_code,
                    enabled=enabled,
                    limit_value=override.limit_value,
                    source="override",
                )

        # Priority 2: plan entitlement
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if sub and sub.plan:
            for ent in sub.plan.entitlements:
                if ent.feature_code == feature_code:
                    return EffectiveEntitlement(
                        feature_code=feature_code,
                        enabled=ent.enabled,
                        limit_value=ent.limit_value,
                        source="plan",
                    )

        # Priority 3: system default — disabled
        return EffectiveEntitlement(
            feature_code=feature_code,
            enabled=False,
            limit_value=None,
            source="default",
        )

    async def is_feature_enabled(self, tenant_id: uuid.UUID, feature_code: str) -> bool:
        ent = await self.get_effective_entitlement(tenant_id, feature_code)
        return ent.enabled

    async def get_effective_limit(self, tenant_id: uuid.UUID, feature_code: str) -> int | None:
        ent = await self.get_effective_entitlement(tenant_id, feature_code)
        return ent.limit_value

    async def get_all_effective_entitlements(
        self, tenant_id: uuid.UUID
    ) -> list[EffectiveEntitlement]:
        now = _now()
        active_overrides = await self.override_repo.get_by_tenant_active(tenant_id, now)
        override_map = {o.feature_code: o for o in active_overrides}

        sub = await self.sub_repo.get_by_tenant(tenant_id)
        result: dict[str, EffectiveEntitlement] = {}

        if sub and sub.plan:
            for ent in sub.plan.entitlements:
                fc = ent.feature_code
                if fc in override_map:
                    o = override_map[fc]
                    enabled = o.enabled if o.enabled is not None else ent.enabled
                    lv = o.limit_value if o.limit_value is not None else ent.limit_value
                    result[fc] = EffectiveEntitlement(fc, enabled, lv, "override")
                else:
                    result[fc] = EffectiveEntitlement(fc, ent.enabled, ent.limit_value, "plan")

        for fc, o in override_map.items():
            if fc not in result:
                enabled = o.enabled if o.enabled is not None else False
                result[fc] = EffectiveEntitlement(fc, enabled, o.limit_value, "override")

        return list(result.values())

    async def validate_limit(
        self, tenant_id: uuid.UUID, feature_code: str, current_count: int
    ) -> None:
        ent = await self.get_effective_entitlement(tenant_id, feature_code)
        if ent.limit_value is not None and current_count >= ent.limit_value:
            raise UsageLimitExceededException(feature_code, current_count, ent.limit_value)



class TenantOverrideService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.override_repo = TenantEntitlementOverrideRepository(session)
        self.audit = AuditService(session)

    async def create_override(
        self,
        tenant_id: uuid.UUID,
        feature_code: str,
        enabled: bool | None,
        limit_value: int | None,
        reason: str | None,
        expires_at: datetime | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantEntitlementOverride:
        existing = await self.override_repo.get_by_tenant_feature(tenant_id, feature_code)
        if existing:
            raise ConflictError(
                f"Override for feature '{feature_code}' already exists for this tenant"
            )

        override = TenantEntitlementOverride(
            tenant_id=tenant_id,
            feature_code=feature_code,
            enabled=enabled,
            limit_value=limit_value,
            reason=reason,
            expires_at=expires_at,
            created_by_user_id=actor_id,
        )
        self.session.add(override)
        await self.session.flush()
        await self.session.refresh(override)

        await self.audit.log(
            action=AuditAction.ENTITLEMENT_OVERRIDE_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.ENTITLEMENT_OVERRIDE,
            entity_id=override.id,
            after_state={
                "feature_code": feature_code,
                "enabled": enabled,
                "limit_value": limit_value,
                "reason": reason,
            },
            request_id=request_id,
        )
        return override

    async def update_override(
        self,
        override_id: uuid.UUID,
        enabled: bool | None,
        limit_value: int | None,
        reason: str | None,
        expires_at: datetime | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantEntitlementOverride:
        override = await self.override_repo.get_by_id(override_id)
        if not override:
            raise NotFoundError("TenantEntitlementOverride", override_id)

        if enabled is not None:
            override.enabled = enabled
        if limit_value is not None:
            override.limit_value = limit_value
        if reason is not None:
            override.reason = reason
        if expires_at is not None:
            override.expires_at = expires_at

        await self.session.flush()
        await self.session.refresh(override)

        await self.audit.log(
            action=AuditAction.ENTITLEMENT_OVERRIDE_UPDATED,
            actor_user_id=actor_id,
            tenant_id=override.tenant_id,
            entity_type=EntityType.ENTITLEMENT_OVERRIDE,
            entity_id=override_id,
            after_state={
                "enabled": override.enabled,
                "limit_value": override.limit_value,
                "reason": override.reason,
            },
            request_id=request_id,
        )
        return override

    async def remove_override(
        self,
        override_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        override = await self.override_repo.get_by_id(override_id)
        if not override:
            raise NotFoundError("TenantEntitlementOverride", override_id)

        tenant_id = override.tenant_id
        feature_code = override.feature_code
        await self.session.delete(override)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.ENTITLEMENT_OVERRIDE_REMOVED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.ENTITLEMENT_OVERRIDE,
            entity_id=override_id,
            after_state={"feature_code": feature_code, "action": "removed"},
            request_id=request_id,
        )

    async def list_overrides(self, tenant_id: uuid.UUID) -> list[TenantEntitlementOverride]:
        return await self.override_repo.get_by_tenant(tenant_id)



class AdminSubscriptionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.sub_repo = TenantSubscriptionRepository(session)
        self.plan_repo = SubscriptionPlanRepository(session)
        self.audit = AuditService(session)

    async def get_overview(self) -> dict:
        total_result = await self.session.execute(
            select(func.count()).select_from(Tenant).where(Tenant.is_deleted.is_(False))
        )
        total = total_result.scalar_one()

        stmt_counts = (
            select(TenantSubscription.status, func.count().label("cnt"))
            .group_by(TenantSubscription.status)
        )
        result = await self.session.execute(stmt_counts)
        rows = result.all()
        status_map: dict[str, int] = {r.status: r.cnt for r in rows}

        revenue_stmt = (
            select(func.sum(SubscriptionPlan.price))
            .join(TenantSubscription, TenantSubscription.plan_id == SubscriptionPlan.id)
            .where(TenantSubscription.status == SubscriptionStatus.ACTIVE)
        )
        revenue_result = await self.session.execute(revenue_stmt)
        monthly_revenue = revenue_result.scalar_one() or Decimal("0.00")

        return {
            "total_tenants": total,
            "active_subscriptions": status_map.get(SubscriptionStatus.ACTIVE, 0),
            "trial_subscriptions": status_map.get(SubscriptionStatus.TRIAL, 0),
            "expired_subscriptions": status_map.get(SubscriptionStatus.EXPIRED, 0),
            "suspended_subscriptions": status_map.get(SubscriptionStatus.SUSPENDED, 0),
            "monthly_revenue": monthly_revenue,
        }

    async def list_all_subscriptions(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[TenantSubscription], int]:
        offset = (page - 1) * page_size
        count_stmt = select(func.count()).select_from(TenantSubscription)
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        stmt = (
            select(TenantSubscription)
            .options(
                selectinload(TenantSubscription.plan).selectinload(SubscriptionPlan.entitlements)
            )
            .order_by(TenantSubscription.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def extend_subscription(
        self,
        tenant_id: uuid.UUID,
        days: int,
        reason: str | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        now = _now()
        base = sub.expires_at if sub.expires_at > now else now
        old_expires = sub.expires_at
        sub.expires_at = base + timedelta(days=days)

        history = SubscriptionHistory(
            tenant_id=tenant_id,
            subscription_id=sub.id,
            change_type=SubscriptionChangeType.EXTENDED,
            new_plan_id=sub.plan_id,
            old_status=sub.status,
            new_status=sub.status,
            note=(
                f"Extended by {days} days. Reason: {reason or 'N/A'}. "
                f"New expires: {sub.expires_at.isoformat()}"
            ),
            changed_by_user_id=actor_id,
        )
        self.session.add(history)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_EXTENDED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "days_added": days,
                "old_expires_at": old_expires.isoformat(),
                "new_expires_at": sub.expires_at.isoformat(),
                "reason": reason,
            },
            request_id=request_id,
        )

        return await self.sub_repo.get_by_tenant(tenant_id)  # type: ignore[return-value]

    async def change_plan(
        self,
        tenant_id: uuid.UUID,
        plan_id: uuid.UUID,
        reason: str | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> TenantSubscription:
        sub = await self.sub_repo.get_by_tenant(tenant_id)
        if not sub:
            raise NotFoundError("TenantSubscription", tenant_id)

        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("SubscriptionPlan", plan_id)

        old_plan_id = sub.plan_id
        sub.plan_id = plan_id

        history = SubscriptionHistory(
            tenant_id=tenant_id,
            subscription_id=sub.id,
            change_type=SubscriptionChangeType.PLAN_CHANGED,
            old_plan_id=old_plan_id,
            new_plan_id=plan_id,
            old_status=sub.status,
            new_status=sub.status,
            note=f"Admin plan change. Reason: {reason or 'N/A'}",
            changed_by_user_id=actor_id,
        )
        self.session.add(history)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PLAN_CHANGED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "old_plan_id": str(old_plan_id),
                "new_plan_id": str(plan_id),
                "reason": reason,
            },
            request_id=request_id,
        )

        return await self.sub_repo.get_by_tenant(tenant_id)  # type: ignore[return-value]
