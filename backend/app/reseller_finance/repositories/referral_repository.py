from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.reseller_finance.models.referral import ResellerReferralCode, TenantReferral


class ReferralRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ResellerReferralCode queries

    async def get_by_code(self, code: str) -> ResellerReferralCode | None:
        """Lookup a referral code case-insensitively."""
        stmt = select(ResellerReferralCode).where(
            func.lower(ResellerReferralCode.code) == code.lower()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_reseller(
        self,
        reseller_id: uuid.UUID,
        active_only: bool = False,
    ) -> list[ResellerReferralCode]:
        """Return all referral codes for a reseller, optionally filtering to active ones."""
        stmt = select(ResellerReferralCode).where(
            ResellerReferralCode.reseller_id == reseller_id
        )
        if active_only:
            stmt = stmt.where(ResellerReferralCode.is_active.is_(True))
        stmt = stmt.order_by(ResellerReferralCode.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def code_exists_case_insensitive(self, code: str) -> bool:
        """Return True if any referral code matches *code* case-insensitively."""
        stmt = select(func.count()).select_from(ResellerReferralCode).where(
            func.lower(ResellerReferralCode.code) == code.lower()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() > 0

    async def create_referral_code(
        self,
        reseller_id: uuid.UUID,
        code: str,
    ) -> ResellerReferralCode:
        """Persist a new referral code and return it."""
        obj = ResellerReferralCode(
            reseller_id=reseller_id,
            code=code,
            is_active=True,
        )
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    # TenantReferral queries

    async def get_tenant_referral(self, tenant_id: uuid.UUID) -> TenantReferral | None:
        """Return the referral record for *tenant_id*, or None if not referred."""
        stmt = select(TenantReferral).where(TenantReferral.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_referrals_by_reseller(
        self,
        reseller_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[TenantReferral], int]:
        """Return a paginated list of referrals and total count for *reseller_id*."""
        offset = (page - 1) * page_size
        base_filter = TenantReferral.reseller_id == reseller_id

        count_stmt = (
            select(func.count())
            .select_from(TenantReferral)
            .where(base_filter)
        )
        stmt = (
            select(TenantReferral)
            .where(base_filter)
            .order_by(TenantReferral.referred_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        result = await self.session.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def create_tenant_referral(
        self,
        tenant_id: uuid.UUID,
        reseller_id: uuid.UUID,
        referral_code_id: uuid.UUID | None,
        code_snapshot: str,
    ) -> TenantReferral:
        """Record that *tenant_id* was referred by *reseller_id*."""
        obj = TenantReferral(
            tenant_id=tenant_id,
            reseller_id=reseller_id,
            referral_code_id=referral_code_id,
            referral_code_snapshot=code_snapshot,
            referred_at=datetime.now(tz=timezone.utc),
        )
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def lock_referral(self, tenant_id: uuid.UUID) -> TenantReferral | None:
        """
        Set locked_at and first_paid_subscription_at on the referral record for
        *tenant_id*.  Returns the updated record, or None if no record exists or
        it was already locked.
        """
        stmt = select(TenantReferral).where(
            TenantReferral.tenant_id == tenant_id,
            TenantReferral.locked_at.is_(None),
        )
        result = await self.session.execute(stmt)
        referral = result.scalar_one_or_none()
        if referral is None:
            return None

        now = datetime.now(tz=timezone.utc)
        referral.locked_at = now
        referral.first_paid_subscription_at = now
        await self.session.flush()
        await self.session.refresh(referral)
        return referral

    async def count_active_referrals_by_reseller(self, reseller_id: uuid.UUID) -> int:
        """Count all referral records (locked or not) for *reseller_id*."""
        stmt = (
            select(func.count())
            .select_from(TenantReferral)
            .where(TenantReferral.reseller_id == reseller_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def count_converted_referrals_by_reseller(self, reseller_id: uuid.UUID) -> int:
        """Count referrals for *reseller_id* that have been locked (first payment made)."""
        stmt = (
            select(func.count())
            .select_from(TenantReferral)
            .where(
                TenantReferral.reseller_id == reseller_id,
                TenantReferral.locked_at.isnot(None),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    # Aliases + helpers used by services

    async def get_code_by_value(self, code: str) -> ResellerReferralCode | None:
        """Alias for get_by_code (case-insensitive)."""
        return await self.get_by_code(code)

    async def get_code_by_id(self, code_id: uuid.UUID) -> ResellerReferralCode | None:
        """Return a referral code by its primary key."""
        result = await self.session.get(ResellerReferralCode, code_id)
        return result

    async def get_referral_by_tenant(self, tenant_id: uuid.UUID) -> TenantReferral | None:
        """Alias for get_tenant_referral."""
        return await self.get_tenant_referral(tenant_id)

    async def get_reseller_user_id(self, reseller_id: uuid.UUID) -> uuid.UUID:
        """Reseller IS a user — just return reseller_id as the notification recipient."""
        return reseller_id

    async def get_reseller_email(self, reseller_id: uuid.UUID) -> str | None:
        """Return the email of the user with the given reseller_id."""
        from app.models.user import User
        user = await self.session.get(User, reseller_id)
        return user.email if user else None

    async def get_user_email(self, user_id: uuid.UUID) -> str | None:
        """Return the email of any user by id."""
        from app.models.user import User
        user = await self.session.get(User, user_id)
        return user.email if user else None

    async def get_all_referrals_paginated(
        self,
        page: int = 1,
        page_size: int = 20,
        reseller_id: uuid.UUID | None = None,
    ) -> tuple[list[TenantReferral], int]:
        """Admin list of all tenant referrals with optional reseller filter."""
        offset = (page - 1) * page_size
        base_where = []
        if reseller_id:
            base_where.append(TenantReferral.reseller_id == reseller_id)

        count_stmt = select(func.count()).select_from(TenantReferral)
        stmt = select(TenantReferral)
        for cond in base_where:
            count_stmt = count_stmt.where(cond)
            stmt = stmt.where(cond)
        stmt = stmt.order_by(TenantReferral.referred_at.desc()).offset(offset).limit(page_size)

        total = (await self.session.execute(count_stmt)).scalar_one()
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total
