from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.reseller_finance.models import ResellerReferralCode, TenantReferral
from app.reseller_finance.repositories import ReferralRepository
from app.services.audit_service import AuditService

logger = get_logger(__name__)

_RESERVED_KEYWORDS: frozenset[str] = frozenset({
    "admin", "super", "api", "system", "pos", "test", "demo",
    "free", "help", "support", "null", "undefined", "root",
    "official", "staff", "nexus", "saas", "platform", "app",
})

_CODE_ALPHABET: str = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No 0, O, I, 1


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_code() -> str:
    """Generate a random 8-character alphanumeric code (no 0, O, I, 1)."""
    return "".join(random.choices(_CODE_ALPHABET, k=8))


class ReferralService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.referral_repo = ReferralRepository(session)
        self.audit = AuditService(session)

    # Code management

    async def validate_and_get_code(self, code: str) -> ResellerReferralCode:
        """Validates code is active. Raises NotFoundError if not found/inactive."""
        normalized = code.strip().upper()
        row = await self.referral_repo.get_code_by_value(normalized)
        if row is None or not row.is_active:
            raise NotFoundError("ResellerReferralCode", normalized)
        return row

    async def create_referral_code(
        self,
        reseller_id: uuid.UUID,
        code: str | None,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerReferralCode:
        """Creates a new referral code. If code is None, auto-generates one."""
        if code is not None:
            normalized = code.strip().upper()
            # Validate reserved keywords
            if normalized.lower() in _RESERVED_KEYWORDS:
                raise BusinessRuleError(
                    f"Referral code '{normalized}' uses a reserved keyword."
                )
            # Validate alphanumeric only
            if not normalized.isalnum():
                raise BusinessRuleError(
                    "Referral code must contain only alphanumeric characters."
                )
            # Check uniqueness (case-insensitive)
            existing = await self.referral_repo.get_code_by_value(normalized)
            if existing is not None:
                raise ConflictError(
                    f"Referral code '{normalized}' already exists."
                )
        else:
            # Auto-generate, retry up to 10 times to avoid collision
            for _ in range(10):
                normalized = _generate_code()
                existing = await self.referral_repo.get_code_by_value(normalized)
                if existing is None:
                    break
            else:
                raise ConflictError("Could not generate a unique referral code. Please try again.")

        row = ResellerReferralCode(
            reseller_id=reseller_id,
            code=normalized,
            is_active=True,
        )
        self.session.add(row)
        await self.session.flush()
        await self.session.refresh(row)

        await self.audit.log(
            action="REFERRAL_CODE_CREATED",
            actor_user_id=actor_id,
            entity_type="REFERRAL_CODE",
            entity_id=row.id,
            after_state={"reseller_id": str(reseller_id), "code": normalized},
            request_id=request_id,
        )

        logger.info(
            "referral_code_created",
            reseller_id=str(reseller_id),
            code=normalized,
            code_id=str(row.id),
        )
        return row

    async def deactivate_code(
        self,
        code_id: uuid.UUID,
        reseller_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> ResellerReferralCode:
        """Deactivates a referral code. Only owner can deactivate."""
        row = await self.referral_repo.get_code_by_id(code_id)
        if row is None:
            raise NotFoundError("ResellerReferralCode", code_id)
        if row.reseller_id != reseller_id:
            raise BusinessRuleError("You do not own this referral code.")
        if not row.is_active:
            raise BusinessRuleError("Referral code is already inactive.")

        row.is_active = False
        await self.session.flush()
        await self.session.refresh(row)

        await self.audit.log(
            action="REFERRAL_CODE_DEACTIVATED",
            actor_user_id=actor_id,
            entity_type="REFERRAL_CODE",
            entity_id=code_id,
            after_state={"code": row.code, "is_active": False},
        )
        logger.info(
            "referral_code_deactivated",
            code_id=str(code_id),
            reseller_id=str(reseller_id),
        )
        return row

    # Tenant referral lifecycle

    async def attach_referral_to_tenant(
        self,
        tenant_id: uuid.UUID,
        reseller_id: uuid.UUID,
        referral_code_id: uuid.UUID | None,
        code_snapshot: str,
        registration_email: str,
        actor_id: uuid.UUID,
    ) -> TenantReferral:
        """Creates TenantReferral after registration.

        Prevents self-referral (reseller user email == registration_email).
        Fails-open: logs a warning if referral already exists.
        """
        # Self-referral check: look up reseller's email
        reseller_email = await self.referral_repo.get_reseller_email(reseller_id)
        if reseller_email and reseller_email.lower() == registration_email.lower():
            raise BusinessRuleError(
                "Self-referral is not allowed: a reseller cannot refer their own email."
            )

        # Idempotency: if a referral already exists for this tenant, log and return it
        existing = await self.referral_repo.get_referral_by_tenant(tenant_id)
        if existing is not None:
            logger.warning(
                "referral_already_exists_for_tenant",
                tenant_id=str(tenant_id),
                existing_referral_id=str(existing.id),
            )
            return existing

        referral = TenantReferral(
            tenant_id=tenant_id,
            reseller_id=reseller_id,
            referral_code_id=referral_code_id,
            referral_code_snapshot=code_snapshot,
            referred_at=_now(),
        )
        self.session.add(referral)
        await self.session.flush()
        await self.session.refresh(referral)

        await self.audit.log(
            action="TENANT_REFERRAL_ATTACHED",
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type="TENANT_REFERRAL",
            entity_id=referral.id,
            after_state={
                "reseller_id": str(reseller_id),
                "code_snapshot": code_snapshot,
            },
        )
        logger.info(
            "tenant_referral_attached",
            tenant_id=str(tenant_id),
            reseller_id=str(reseller_id),
            referral_id=str(referral.id),
        )
        return referral

    async def lock_referral(
        self,
        tenant_id: uuid.UUID,
        first_paid_at: datetime,
    ) -> TenantReferral | None:
        """Locks referral permanently on first paid subscription. Idempotent."""
        referral = await self.referral_repo.get_referral_by_tenant(tenant_id)
        if referral is None:
            return None

        # Idempotent: already locked
        if referral.locked_at is not None:
            return referral

        referral.locked_at = _now()
        referral.first_paid_subscription_at = first_paid_at
        await self.session.flush()

        logger.info(
            "tenant_referral_locked",
            tenant_id=str(tenant_id),
            referral_id=str(referral.id),
            first_paid_at=first_paid_at.isoformat(),
        )
        return referral

    async def try_add_referral_before_payment(
        self,
        tenant_id: uuid.UUID,
        reseller_code: str,
        requesting_user_id: uuid.UUID,
    ) -> TenantReferral:
        """Allows adding referral before first paid subscription.
        Raises BusinessRuleError if already locked (has paid subscription).
        """
        existing = await self.referral_repo.get_referral_by_tenant(tenant_id)
        if existing is not None and existing.locked_at is not None:
            raise BusinessRuleError(
                "Cannot add or change referral after a paid subscription has been activated."
            )

        # Validate the code
        code_row = await self.validate_and_get_code(reseller_code)

        # Self-referral guard
        reseller_email = await self.referral_repo.get_reseller_email(code_row.reseller_id)
        requesting_email = await self.referral_repo.get_user_email(requesting_user_id)
        if (
            reseller_email
            and requesting_email
            and reseller_email.lower() == requesting_email.lower()
        ):
            raise BusinessRuleError("Self-referral is not allowed.")

        if existing is not None:
            # Update the existing pre-payment referral
            existing.reseller_id = code_row.reseller_id
            existing.referral_code_id = code_row.id
            existing.referral_code_snapshot = code_row.code
            existing.referred_at = _now()
            await self.session.flush()
            await self.session.refresh(existing)
            logger.info(
                "tenant_referral_updated_before_payment",
                tenant_id=str(tenant_id),
                reseller_id=str(code_row.reseller_id),
            )
            return existing

        referral = TenantReferral(
            tenant_id=tenant_id,
            reseller_id=code_row.reseller_id,
            referral_code_id=code_row.id,
            referral_code_snapshot=code_row.code,
            referred_at=_now(),
        )
        self.session.add(referral)
        await self.session.flush()
        await self.session.refresh(referral)

        logger.info(
            "tenant_referral_added_before_payment",
            tenant_id=str(tenant_id),
            reseller_id=str(code_row.reseller_id),
            referral_id=str(referral.id),
        )
        return referral

    # Stats

    async def get_reseller_referral_stats(self, reseller_id: uuid.UUID) -> dict[str, Any]:
        """Returns aggregated referral statistics for a reseller."""
        total = await self.referral_repo.count_active_referrals_by_reseller(reseller_id)
        converted = await self.referral_repo.count_converted_referrals_by_reseller(reseller_id)
        active = total - converted
        trial = active  # trial referrals are the unconverted ones
        conversion_rate = round((converted / total) * 100, 2) if total > 0 else 0.0
        return {
            "total_referrals": total,
            "active_referrals": active,
            "converted_referrals": converted,
            "trial_referrals": trial,
            "conversion_rate": conversion_rate,
        }

    async def activate_code(
        self,
        code_id: uuid.UUID,
        reseller_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> ResellerReferralCode:
        """Re-activates a previously deactivated referral code.

        Only the owning reseller may activate their own codes.
        """
        from sqlalchemy import select as _select

        stmt = _select(ResellerReferralCode).where(ResellerReferralCode.id == code_id)
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None:
            raise NotFoundError("ResellerReferralCode", code_id)
        if row.reseller_id != reseller_id:
            raise BusinessRuleError("You do not own this referral code.")
        if row.is_active:
            raise BusinessRuleError("Referral code is already active.")

        row.is_active = True
        await self.session.flush()
        await self.session.refresh(row)

        await self.audit.log(
            action="REFERRAL_CODE_ACTIVATED",
            actor_user_id=actor_id,
            entity_type="REFERRAL_CODE",
            entity_id=code_id,
            after_state={"code": row.code, "is_active": True},
        )
        logger.info(
            "referral_code_activated",
            code_id=str(code_id),
            reseller_id=str(reseller_id),
        )
        return row

    async def get_referral_link(
        self,
        code_id: uuid.UUID,
        reseller_id: uuid.UUID,
    ) -> "ReferralLinkResponse":
        """Builds the shareable sign-up URL for a referral code.

        Raises NotFoundError when the code does not exist or does not belong
        to the requesting reseller.
        """
        from sqlalchemy import select as _select
        from app.core.config import settings
        from app.reseller_finance.schemas.referral import ReferralLinkResponse

        stmt = _select(ResellerReferralCode).where(ResellerReferralCode.id == code_id)
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None or row.reseller_id != reseller_id:
            raise NotFoundError("ResellerReferralCode", code_id)

        base_url = getattr(settings, "APP_BASE_URL", "https://app.nexuspos.com")
        referral_url = f"{base_url}/register?ref={row.code}"
        return ReferralLinkResponse(code=row.code, referral_url=referral_url)

    async def list_all_tenant_referrals(
        self,
        reseller_id: uuid.UUID | None,
        page: int,
        page_size: int,
    ) -> tuple[list[TenantReferral], int]:
        """Super-admin listing of all tenant referrals.

        When *reseller_id* is provided only referrals for that reseller are
        returned; otherwise all referrals across all resellers are listed.
        """
        from sqlalchemy import func as _func, select as _select

        offset = (page - 1) * page_size
        base_where = []
        if reseller_id is not None:
            base_where.append(TenantReferral.reseller_id == reseller_id)

        count_stmt = (
            _select(_func.count())
            .select_from(TenantReferral)
            .where(*base_where)
        )
        stmt = (
            _select(TenantReferral)
            .where(*base_where)
            .order_by(TenantReferral.referred_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        result = await self.session.execute(stmt)
        items = list(result.scalars().all())
        return items, total
