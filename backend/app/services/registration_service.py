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

        # Determine base trial plan (FREE or time-limited trial)
        trial_plan = await self.plan_repo.get_trial_plan()
        if not trial_plan:
            raise BusinessRuleError(
                "Self-service registration is not available yet. "
                "No active trial plan configured. Please contact support."
            )

        # Validate referral code early so we know whether to use REFERRAL_TRIAL plan.
        # Fail-open: any error falls back silently to the default trial plan.
        validated_referral_code_row = None
        if data.referral_code:
            try:
                from app.reseller_finance.services.referral_service import ReferralService
                _referral_svc_probe = ReferralService(self.session)
                validated_referral_code_row = await _referral_svc_probe.validate_and_get_code(
                    data.referral_code
                )
            except Exception as exc:
                logger.warning(
                    "referral_code_early_validation_failed",
                    referral_code=data.referral_code,
                    error=str(exc),
                )

        # Select the plan to assign: REFERRAL_TRIAL for valid referrals, else default trial.
        assigned_plan = trial_plan
        if validated_referral_code_row is not None:
            try:
                referral_trial_plan = await self.plan_repo.get_referral_plan()
                if referral_trial_plan:
                    assigned_plan = referral_trial_plan
                    logger.info(
                        "referral_trial_plan_selected",
                        plan_code=referral_trial_plan.code,
                        referral_code=data.referral_code,
                    )
                else:
                    logger.warning(
                        "referral_trial_plan_not_found",
                        detail="REFERRAL_TRIAL plan missing or inactive; falling back to default trial plan",
                        referral_code=data.referral_code,
                    )
            except Exception as exc:
                logger.warning(
                    "referral_trial_plan_lookup_failed",
                    referral_code=data.referral_code,
                    error=str(exc),
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
            fallback_trial_days = assigned_plan.trial_days if assigned_plan.trial_days > 0 else 14
            trial_end = now + timedelta(days=fallback_trial_days)
            sub_status = SubscriptionStatus.TRIAL
            sub_expires_at = trial_end
            sub_trial_ends_at = trial_end
            history_change_type = SubscriptionChangeType.TRIAL_STARTED
            via = "referral " if validated_referral_code_row is not None else ""
            history_note = (
                f"Trial started via {via}self-service registration. "
                f"Expires {trial_end.date()}."
            )

            # Keep denormalised tenant fields in sync
            tenant.subscription_plan = assigned_plan.code
            tenant.subscription_expires_at = sub_expires_at

            sub = TenantSubscription(
                tenant_id=tenant.id,
                plan_id=assigned_plan.id,
                status=sub_status,
                started_at=now,
                expires_at=sub_expires_at,
                trial_ends_at=sub_trial_ends_at,
                auto_renew=True,
            )
            self.session.add(sub)
            await self.session.flush()
            await self.session.refresh(sub)

            history = SubscriptionHistory(
                tenant_id=tenant.id,
                subscription_id=sub.id,
                change_type=history_change_type,
                new_plan_id=assigned_plan.id,
                new_status=sub_status,
                note=history_note,
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
                "status": sub_status,
                "plan_id": str(assigned_plan.id),
                "plan_code": assigned_plan.code,
                "trial_days": fallback_trial_days,
                "expires_at": sub_expires_at.isoformat() if sub_expires_at else None,
                "via_referral": validated_referral_code_row is not None,
            },
            ip_address=ip_address,
            request_id=request_id,
        )

        # Referral tracking — fail-open so registration is never blocked.
        # The plan has already been selected upfront; this block only records
        # the referral relationship and commission tracking (no plan changes here).
        if validated_referral_code_row is not None:
            try:
                from app.reseller_finance.services.referral_service import ReferralService
                referral_svc = ReferralService(self.session)
                await referral_svc.attach_referral_to_tenant(
                    tenant_id=tenant.id,
                    reseller_id=validated_referral_code_row.reseller_id,
                    referral_code_id=validated_referral_code_row.id,
                    code_snapshot=validated_referral_code_row.code,
                    registration_email=data.email,
                    actor_id=user.id,
                )
            except Exception as exc:
                logger.warning(
                    "referral_attach_failed",
                    referral_code=data.referral_code,
                    tenant_id=str(tenant.id),
                    error=str(exc),
                )

        # welcome notification
        try:
            from app.notifications.services import NotificationService
            notif_svc = NotificationService(self.session)
            notif_title = f"Welcome! Your {fallback_trial_days}-day trial has started"
            notif_message = (
                f"Welcome to NexusPOS, {data.first_name}! "
                f"Your free trial of {assigned_plan.name} starts today and expires on "
                f"{sub_expires_at.strftime('%B %d, %Y')}. "  # type: ignore[union-attr]
                "Complete your setup to get the most out of your trial."
            )
            notif_meta: dict = {
                "plan_code": assigned_plan.code,
                "trial_days": fallback_trial_days,
                "expires_at": sub_expires_at.isoformat(),  # type: ignore[union-attr]
                "event": "trial_started",
            }
            await notif_svc.create_notification(
                tenant_id=tenant.id,
                type=NotificationType.SUBSCRIPTION,
                priority=NotificationPriority.MEDIUM,
                title=notif_title,
                message=notif_message,
                recipient_ids=[user.id],
                metadata=notif_meta,
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
                    "plan_name": assigned_plan.name,
                    "trial_days": fallback_trial_days,
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
            plan_code=assigned_plan.code,
        )

        return RegistrationResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=str(user.id),
            tenant_id=str(tenant.id),
            onboarding_required=True,
        )
