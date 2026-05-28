from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    BranchStatus,
    EntityType,
    NotificationPriority,
    NotificationType,
    SubscriptionChangeType,
    SubscriptionStatus,
    TenantStatus,
    UserRole,
    UserStatus,
)
from app.core.config import settings
from app.core.exceptions import BusinessRuleError, ConflictError
from app.core.logging import get_logger
from app.core.rate_limit import check_ip_daily_abuse
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password
from app.models.branch import Branch
from app.models.tenant import Tenant, TenantSettings
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.repositories.user_repository import UserRepository
from app.repositories.tenant_repository import TenantRepository
from app.services.audit_service import AuditService
from app.subscriptions.repositories import SubscriptionPlanRepository, TenantSubscriptionRepository
from app.subscriptions.models import SubscriptionHistory, TenantSubscription
from app.subscriptions.schemas import RegisterRequest, RegistrationResponse

logger = get_logger(__name__)

_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # excludes I, O, 0, 1


def _generate_business_code() -> str:
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(8))



def _slug(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")[:100]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RegistrationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.tenant_repo = TenantRepository(session)
        self.auth_repo = AuthRepository(session)
        self.plan_repo = SubscriptionPlanRepository(session)
        self.sub_repo = TenantSubscriptionRepository(session)
        self.audit = AuditService(session)

    async def _check_abuse(
        self,
        data: RegisterRequest,
        redis: Redis | None,
        ip_address: str | None,
    ) -> None:
        """Run all pre-registration abuse checks. Raises ConflictError or RateLimitError."""
        # Email uniqueness
        if await self.user_repo.email_exists(data.email):
            raise ConflictError(f"An account with email '{data.email}' already exists")

        # Phone uniqueness (if provided)
        if data.phone:
            from sqlalchemy import select
            from app.models.user import User as _User
            stmt = select(_User).where(
                _User.phone == data.phone,
                _User.is_deleted.is_(False),
            ).limit(1)
            result = await self.session.execute(stmt)
            if result.scalar_one_or_none():
                raise ConflictError(
                    "An account with this phone number already exists"
                )

        # IP-based daily abuse prevention
        if redis and ip_address:
            await check_ip_daily_abuse(
                redis=redis,
                ip=ip_address,
                max_per_day=settings.REGISTRATION_ABUSE_MAX_PER_IP_PER_DAY,
            )

    async def register(
        self,
        data: RegisterRequest,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
        redis: Redis | None = None,
    ) -> RegistrationResponse:
        # abuse + uniqueness checks
        await self._check_abuse(data, redis, ip_address)

        trial_plan = await self.plan_repo.get_trial_plan()
        if not trial_plan:
            raise BusinessRuleError(
                "Self-service registration is not available yet. "
                "No active trial plan configured. Please contact support."
            )

        # slug generation
        base_slug = _slug(data.business_name)
        slug = base_slug
        counter = 1
        while await self.tenant_repo.slug_exists(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        # unique business code
        business_code = _generate_business_code()
        while await self.tenant_repo.get_by_business_code(business_code):
            business_code = _generate_business_code()

        # atomic entity creation (savepoint)
        async with self.session.begin_nested():
            tenant = Tenant(
                name=data.business_name,
                slug=slug,
                business_code=business_code,
                status=TenantStatus.TRIAL,
                email=data.email,
                phone=data.phone,
            )
            self.session.add(tenant)
            await self.session.flush()
            await self.session.refresh(tenant)

            self.session.add(TenantSettings(tenant_id=tenant.id))

            user = User(
                email=data.email,
                hashed_password=hash_password(data.password),
                first_name=data.first_name,
                last_name=data.last_name,
                phone=data.phone,
                role=UserRole.BUSINESS_OWNER,
                status=UserStatus.ACTIVE,
                tenant_id=tenant.id,
            )
            self.session.add(user)
            await self.session.flush()
            await self.session.refresh(user)

            tenant.owner_id = user.id

            branch = Branch(
                tenant_id=tenant.id,
                name="Main Branch",
                code="MAIN",
                status=BranchStatus.ACTIVE,
                manager_id=user.id,
            )
            self.session.add(branch)
            await self.session.flush()
            await self.session.refresh(branch)

            user.primary_branch_id = branch.id

            now = _now()
            trial_days = trial_plan.trial_days if trial_plan.trial_days > 0 else 14
            trial_ends_at = now + timedelta(days=trial_days)

            sub = TenantSubscription(
                tenant_id=tenant.id,
                plan_id=trial_plan.id,
                status=SubscriptionStatus.TRIAL,
                started_at=now,
                expires_at=trial_ends_at,
                trial_ends_at=trial_ends_at,
                auto_renew=True,
            )
            self.session.add(sub)
            await self.session.flush()
            await self.session.refresh(sub)

            history = SubscriptionHistory(
                tenant_id=tenant.id,
                subscription_id=sub.id,
                change_type=SubscriptionChangeType.TRIAL_STARTED,
                new_plan_id=trial_plan.id,
                new_status=SubscriptionStatus.TRIAL,
                note=f"Trial started via self-service registration. Expires {trial_ends_at.date()}.",
                changed_by_user_id=user.id,
            )
            self.session.add(history)
            await self.session.flush()

        # audit logs
        await self.audit.log(
            action=AuditAction.TENANT_CREATED,
            actor_user_id=user.id,
            tenant_id=tenant.id,
            entity_type=EntityType.TENANT,
            entity_id=tenant.id,
            after_state={
                "name": tenant.name,
                "slug": tenant.slug,
                "source": "self_registration",
            },
            ip_address=ip_address,
            request_id=request_id,
        )
        await self.audit.log(
            action=AuditAction.USER_CREATED,
            actor_user_id=user.id,
            tenant_id=tenant.id,
            entity_type=EntityType.USER,
            entity_id=user.id,
            after_state={
                "email": user.email,
                "role": UserRole.BUSINESS_OWNER,
                "source": "self_registration",
            },
            ip_address=ip_address,
            request_id=request_id,
        )
        await self.audit.log(
            action=AuditAction.SUBSCRIPTION_CREATED,
            actor_user_id=user.id,
            tenant_id=tenant.id,
            entity_type=EntityType.TENANT_SUBSCRIPTION,
            entity_id=sub.id,
            after_state={
                "status": SubscriptionStatus.TRIAL,
                "plan_id": str(trial_plan.id),
                "trial_days": trial_days,
                "expires_at": trial_ends_at.isoformat(),
            },
            ip_address=ip_address,
            request_id=request_id,
        )

        # Referral tracking — fail-open so registration is never blocked
        if data.referral_code:
            try:
                from app.reseller_finance.services.referral_service import ReferralService
                referral_svc = ReferralService(self.session)
                code_row = await referral_svc.validate_and_get_code(data.referral_code)
                await referral_svc.attach_referral_to_tenant(
                    tenant_id=tenant.id,
                    reseller_id=code_row.reseller_id,
                    referral_code_id=code_row.id,
                    code_snapshot=code_row.code,
                    registration_email=data.email,
                    actor_id=user.id,
                )
                # Try to upgrade to referral (promo) plan
                referral_plan = await self.plan_repo.get_referral_plan()
                if referral_plan and referral_plan.id != trial_plan.id:
                    sub.plan_id = referral_plan.id
                    promo_days = referral_plan.trial_days if referral_plan.trial_days > 0 else trial_days
                    sub.trial_ends_at = _now() + timedelta(days=promo_days)
                    sub.expires_at = sub.trial_ends_at
                    await self.session.flush()
            except Exception as exc:
                logger.warning(
                    "referral_attach_failed",
                    referral_code=data.referral_code,
                    tenant_id=str(tenant.id),
                    error=str(exc),
                )

        # trial start notification
        try:
            from app.notifications.services import NotificationService
            notif_svc = NotificationService(self.session)
            await notif_svc.create_notification(
                tenant_id=tenant.id,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.MEDIUM,
                title=f"Welcome! Your {trial_days}-day trial has started",
                message=(
                    f"Welcome to NexusPOS, {data.first_name}! "
                    f"Your free trial of {trial_plan.name} starts today and expires on "
                    f"{trial_ends_at.strftime('%B %d, %Y')}. "
                    "Complete your setup to get the most out of your trial."
                ),
                recipient_ids=[user.id],
                metadata={
                    "plan_code": trial_plan.code,
                    "trial_days": trial_days,
                    "expires_at": trial_ends_at.isoformat(),
                    "event": "trial_started",
                },
            )
        except Exception as exc:
            logger.warning("trial_start_notification_failed", error=str(exc), tenant_id=str(tenant.id))

        # notify super admins of new business registration
        try:
            from app.events.base import DomainEvent
            from app.events.publisher import event_publisher
            from app.events.types import EventType
            await event_publisher.publish(DomainEvent(
                event_type=EventType.BUSINESS_REGISTERED,
                tenant_id=tenant.id,
                actor_id=user.id,
                payload={
                    "business_name": tenant.name,
                    "owner_name": f"{data.first_name} {data.last_name}",
                    "owner_email": data.email,
                    "plan_name": trial_plan.name,
                    "trial_days": trial_days,
                },
            ))
        except Exception as exc:
            logger.warning("business_registered_event_failed", error=str(exc))

        # token generation
        access_token = create_access_token(
            subject=str(user.id),
            role=user.role,
            tenant_id=str(tenant.id),
        )
        refresh_token_str, family_id = create_refresh_token(subject=str(user.id))
        token_payload = decode_token(refresh_token_str)
        jti = token_payload["jti"]
        token_expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

        await self.auth_repo.store_refresh_token(
            user_id=user.id,
            token=refresh_token_str,
            jti=jti,
            family_id=family_id,
            expires_at=token_expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(
            "self_registration_complete",
            user_id=str(user.id),
            tenant_id=str(tenant.id),
            plan_code=trial_plan.code,
        )

        return RegistrationResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=str(user.id),
            tenant_id=str(tenant.id),
            onboarding_required=True,
        )
