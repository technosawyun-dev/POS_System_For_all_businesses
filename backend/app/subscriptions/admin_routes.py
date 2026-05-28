from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import DbSession, RequestId, require_super_admin
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.subscriptions.entitlements import (
    AdminSubscriptionService,
    EntitlementService,
    TenantOverrideService,
)
from app.subscriptions.schemas import (
    AdminChangePlanRequest,
    EffectiveEntitlementResponse,
    ExtendSubscriptionRequest,
    PaginatedAdminSubscriptions,
    PaginatedPaymentProofs,
    PaymentProofResponse,
    SubscriptionOverviewResponse,
    SubscriptionResponse,
    TenantEntitlementOverrideCreateRequest,
    TenantEntitlementOverrideResponse,
    TenantEntitlementOverrideUpdateRequest,
)

router = APIRouter()


@router.get("/overview", response_model=SubscriptionOverviewResponse)
async def get_admin_overview(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> SubscriptionOverviewResponse:
    svc = AdminSubscriptionService(db)
    data = await svc.get_overview()
    return SubscriptionOverviewResponse(**data)


@router.get("/tenants", response_model=PaginatedAdminSubscriptions)
async def list_all_subscriptions(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedAdminSubscriptions:
    svc = AdminSubscriptionService(db)
    items, total = await svc.list_all_subscriptions(page=page, page_size=page_size)
    return PaginatedResponse.create(
        items=[SubscriptionResponse.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tenants/{tenant_id}", response_model=SubscriptionResponse)
async def get_tenant_subscription(
    tenant_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> SubscriptionResponse:
    from app.subscriptions.services import SubscriptionService

    svc = SubscriptionService(db)
    sub = await svc.get_subscription(tenant_id)
    return SubscriptionResponse.model_validate(sub)


@router.get("/tenants/{tenant_id}/entitlements", response_model=list[EffectiveEntitlementResponse])
async def get_tenant_effective_entitlements(
    tenant_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> list[EffectiveEntitlementResponse]:
    svc = EntitlementService(db)
    entitlements = await svc.get_all_effective_entitlements(tenant_id)
    return [
        EffectiveEntitlementResponse(
            feature_code=e.feature_code,
            enabled=e.enabled,
            limit_value=e.limit_value,
            source=e.source,
        )
        for e in entitlements
    ]


@router.post(
    "/tenants/{tenant_id}/overrides",
    response_model=TenantEntitlementOverrideResponse,
    status_code=201,
)
async def create_override(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: TenantEntitlementOverrideCreateRequest,
) -> TenantEntitlementOverrideResponse:
    svc = TenantOverrideService(db)
    override = await svc.create_override(
        tenant_id=tenant_id,
        feature_code=data.feature_code,
        enabled=data.enabled,
        limit_value=data.limit_value,
        reason=data.reason,
        expires_at=data.expires_at,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return TenantEntitlementOverrideResponse.model_validate(override)


@router.get(
    "/tenants/{tenant_id}/overrides",
    response_model=list[TenantEntitlementOverrideResponse],
)
async def list_tenant_overrides(
    tenant_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> list[TenantEntitlementOverrideResponse]:
    svc = TenantOverrideService(db)
    overrides = await svc.list_overrides(tenant_id)
    return [TenantEntitlementOverrideResponse.model_validate(o) for o in overrides]


@router.patch("/overrides/{override_id}", response_model=TenantEntitlementOverrideResponse)
async def update_override(
    override_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: TenantEntitlementOverrideUpdateRequest,
) -> TenantEntitlementOverrideResponse:
    svc = TenantOverrideService(db)
    override = await svc.update_override(
        override_id=override_id,
        enabled=data.enabled,
        limit_value=data.limit_value,
        reason=data.reason,
        expires_at=data.expires_at,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return TenantEntitlementOverrideResponse.model_validate(override)


@router.delete("/overrides/{override_id}", status_code=204, response_class=Response)
async def remove_override(
    override_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
) -> Response:
    svc = TenantOverrideService(db)
    await svc.remove_override(
        override_id=override_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return Response(status_code=204)


@router.post("/tenants/{tenant_id}/suspend", response_model=SubscriptionResponse)
async def admin_suspend_subscription(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
) -> SubscriptionResponse:
    from app.subscriptions.services import SubscriptionService
    svc = SubscriptionService(db)
    sub = await svc.suspend_subscription(
        tenant_id=tenant_id, actor_id=current_user.id, request_id=request_id
    )
    return SubscriptionResponse.model_validate(sub)


@router.post("/tenants/{tenant_id}/expire", response_model=SubscriptionResponse)
async def admin_expire_subscription(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
) -> SubscriptionResponse:
    from app.subscriptions.services import SubscriptionService
    svc = SubscriptionService(db)
    sub = await svc.expire_subscription(
        tenant_id=tenant_id, actor_id=current_user.id, request_id=request_id
    )
    return SubscriptionResponse.model_validate(sub)


@router.post("/tenants/{tenant_id}/extend", response_model=SubscriptionResponse)
async def extend_subscription(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: ExtendSubscriptionRequest,
) -> SubscriptionResponse:
    svc = AdminSubscriptionService(db)
    sub = await svc.extend_subscription(
        tenant_id=tenant_id,
        days=data.days,
        reason=data.reason,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SubscriptionResponse.model_validate(sub)


@router.post("/tenants/{tenant_id}/change-plan", response_model=SubscriptionResponse)
async def admin_change_plan(
    tenant_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: AdminChangePlanRequest,
) -> SubscriptionResponse:
    svc = AdminSubscriptionService(db)
    sub = await svc.change_plan(
        tenant_id=tenant_id,
        plan_id=data.plan_id,
        reason=data.reason,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SubscriptionResponse.model_validate(sub)


@router.get("/payment-proofs", response_model=PaginatedPaymentProofs)
async def admin_list_all_payment_proofs(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    tenant_id: str | None = Query(default=None),
) -> PaginatedPaymentProofs:
    from app.subscriptions.services import PaymentProofService
    svc = PaymentProofService(db)
    tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
    items, total = await svc.list_all_proofs(
        status=status, page=page, page_size=page_size, tenant_id=tenant_uuid
    )
    return PaginatedResponse.create(
        items=[PaymentProofResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/repair-statuses")
async def repair_subscription_statuses(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> dict:
    """One-time repair: promote TRIAL subscriptions on paid plans to ACTIVE and sync tenant fields."""
    from sqlalchemy import select
    from app.core.constants import TenantStatus, SubscriptionStatus
    from app.models.tenant import Tenant
    from app.subscriptions.models import SubscriptionPlan, TenantSubscription

    result = await db.execute(
        select(TenantSubscription).where(TenantSubscription.status == SubscriptionStatus.TRIAL)
    )
    subs = result.scalars().all()

    fixed = 0
    for sub in subs:
        plan = await db.get(SubscriptionPlan, sub.plan_id)
        if plan and plan.price > 0 and not plan.is_referral_plan:
            sub.status = SubscriptionStatus.ACTIVE
            sub.trial_ends_at = None
            tenant = await db.get(Tenant, sub.tenant_id)
            if tenant:
                tenant.status = TenantStatus.ACTIVE
                tenant.subscription_plan = plan.code
            fixed += 1

    await db.flush()
    return {"fixed": fixed, "message": f"Repaired {fixed} subscription(s)"}
