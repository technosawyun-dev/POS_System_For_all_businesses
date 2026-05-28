from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, OptionalEffectiveTenantId
from app.core.constants import UserRole
from app.core.exceptions import FeatureDisabledException
from app.subscriptions.entitlements import EntitlementService, TenantSubscriptionValidator


def require_feature(feature_code: str):
    """Return a FastAPI dependency callable that enforces subscription + feature access."""

    async def _gate(
        db: DbSession,
        current_user: CurrentUser,
        tenant_id: OptionalEffectiveTenantId,
    ) -> None:
        if current_user.role == UserRole.SUPER_ADMIN:
            return
        validator = TenantSubscriptionValidator(db)
        await validator.validate_subscription_active(tenant_id)
        svc = EntitlementService(db)
        enabled = await svc.is_feature_enabled(tenant_id, feature_code)
        if not enabled:
            raise FeatureDisabledException(feature_code)

    return _gate


def require_subscription_active():
    """Return a FastAPI dependency callable that validates subscription is not expired/suspended."""

    async def _gate(
        db: DbSession,
        current_user: CurrentUser,
        tenant_id: OptionalEffectiveTenantId,
    ) -> None:
        if current_user.role == UserRole.SUPER_ADMIN:
            return
        validator = TenantSubscriptionValidator(db)
        await validator.validate_subscription_active(tenant_id)

    return _gate



async def validate_branch_limit(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: OptionalEffectiveTenantId,
) -> None:
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    from app.core.constants import BranchStatus
    from app.models.branch import Branch

    result = await db.execute(
        select(func.count())
        .select_from(Branch)
        .where(Branch.tenant_id == tenant_id, Branch.status != BranchStatus.CLOSED)
    )
    count = result.scalar_one()
    svc = EntitlementService(db)
    await svc.validate_limit(tenant_id, "branches", count)


async def validate_user_limit(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: OptionalEffectiveTenantId,
) -> None:
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    from app.core.constants import UserStatus
    from app.models.user import User

    result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(
            User.tenant_id == tenant_id,
            User.status == UserStatus.ACTIVE,
            User.is_deleted.is_(False),
        )
    )
    count = result.scalar_one()
    svc = EntitlementService(db)
    await svc.validate_limit(tenant_id, "users", count)


async def validate_product_limit(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: OptionalEffectiveTenantId,
) -> None:
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    from app.models.product import Product

    result = await db.execute(
        select(func.count())
        .select_from(Product)
        .where(Product.tenant_id == tenant_id, Product.is_active.is_(True))
    )
    count = result.scalar_one()
    svc = EntitlementService(db)
    await svc.validate_limit(tenant_id, "products", count)


async def validate_customer_limit(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: OptionalEffectiveTenantId,
) -> None:
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    from app.customers.models import Customer

    result = await db.execute(
        select(func.count())
        .select_from(Customer)
        .where(Customer.tenant_id == tenant_id, Customer.is_active.is_(True))
    )
    count = result.scalar_one()
    svc = EntitlementService(db)
    await svc.validate_limit(tenant_id, "customers", count)


async def validate_device_limit(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: OptionalEffectiveTenantId,
) -> None:
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    from app.devices.models import PosDevice

    result = await db.execute(
        select(func.count())
        .select_from(PosDevice)
        .where(PosDevice.tenant_id == tenant_id, PosDevice.is_active.is_(True))
    )
    count = result.scalar_one()
    svc = EntitlementService(db)
    await svc.validate_limit(tenant_id, "devices", count)
