from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.reseller_finance.models.payout import ResellerPayoutRequest, ResellerPayoutRequestItem


class PayoutRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ResellerPayoutRequest queries

    async def get_by_id(self, payout_id: uuid.UUID) -> ResellerPayoutRequest | None:
        """Return a payout request by its primary key."""
        result = await self.session.get(ResellerPayoutRequest, payout_id)
        return result

    async def get_by_id_for_update(
        self, payout_id: uuid.UUID
    ) -> ResellerPayoutRequest | None:
        """
        Acquire a row-level lock (SELECT … FOR UPDATE) on the payout request.
        Must be called inside an explicit transaction.
        """
        stmt = (
            select(ResellerPayoutRequest)
            .where(ResellerPayoutRequest.id == payout_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_payouts(
        self,
        reseller_id: uuid.UUID,
        status_filter: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ResellerPayoutRequest], int]:
        """Return a reseller's own payout requests, optionally filtered by status."""
        offset = (page - 1) * page_size

        base_where = [ResellerPayoutRequest.reseller_id == reseller_id]
        if status_filter:
            base_where.append(ResellerPayoutRequest.status == status_filter)

        count_stmt = (
            select(func.count())
            .select_from(ResellerPayoutRequest)
            .where(*base_where)
        )
        stmt = (
            select(ResellerPayoutRequest)
            .where(*base_where)
            .order_by(ResellerPayoutRequest.requested_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        result = await self.session.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def list_all_payouts(
        self,
        status_filter: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ResellerPayoutRequest], int]:
        """Return all payout requests (admin view), optionally filtered by status."""
        offset = (page - 1) * page_size

        count_stmt = select(func.count()).select_from(ResellerPayoutRequest)
        stmt = select(ResellerPayoutRequest)

        if status_filter:
            count_stmt = count_stmt.where(ResellerPayoutRequest.status == status_filter)
            stmt = stmt.where(ResellerPayoutRequest.status == status_filter)

        stmt = stmt.order_by(ResellerPayoutRequest.requested_at.desc()).offset(offset).limit(
            page_size
        )

        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        result = await self.session.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def create_payout_request(
        self,
        reseller_id: uuid.UUID,
        wallet_id: uuid.UUID,
        amount: Decimal,
        currency_code: str = "MMK",
        reason: str | None = None,
    ) -> ResellerPayoutRequest:
        """Persist a new PENDING payout request and return it."""
        obj = ResellerPayoutRequest(
            reseller_id=reseller_id,
            wallet_id=wallet_id,
            amount=amount,
            currency_code=currency_code,
            status="PENDING",
            reason=reason,
        )
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def count_pending_payouts_for_reseller(self, reseller_id: uuid.UUID) -> int:
        """
        Return the number of non-terminal payout requests for *reseller_id*.
        Used to guard against a reseller flooding the system with requests.
        """
        stmt = (
            select(func.count())
            .select_from(ResellerPayoutRequest)
            .where(
                ResellerPayoutRequest.reseller_id == reseller_id,
                ResellerPayoutRequest.status.notin_(["REJECTED", "PAID", "CANCELLED"]),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    # ResellerPayoutRequestItem queries

    async def add_payout_item(
        self,
        payout_request_id: uuid.UUID,
        wallet_transaction_id: uuid.UUID,
        amount: Decimal,
    ) -> ResellerPayoutRequestItem:
        """Link a wallet transaction to a payout request as a line item."""
        item = ResellerPayoutRequestItem(
            payout_request_id=payout_request_id,
            wallet_transaction_id=wallet_transaction_id,
            amount=amount,
        )
        self.session.add(item)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    # Aliases + helpers used by services

    async def count_pending(self, reseller_id: uuid.UUID) -> int:
        """Alias for count_pending_payouts_for_reseller."""
        return await self.count_pending_payouts_for_reseller(reseller_id)

    async def list_by_reseller(
        self,
        reseller_id: uuid.UUID,
        status_filter: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ResellerPayoutRequest], int]:
        """Alias for list_payouts."""
        return await self.list_payouts(reseller_id, status_filter, page, page_size)

    async def list_all(
        self,
        status_filter: str | None = None,
        page: int = 1,
        page_size: int = 20,
        reseller_id: uuid.UUID | None = None,
    ) -> tuple[list[ResellerPayoutRequest], int]:
        """Admin list with optional reseller filter."""
        offset = (page - 1) * page_size
        base_where = []
        if status_filter:
            base_where.append(ResellerPayoutRequest.status == status_filter)
        if reseller_id:
            base_where.append(ResellerPayoutRequest.reseller_id == reseller_id)

        count_stmt = select(func.count()).select_from(ResellerPayoutRequest)
        stmt = select(ResellerPayoutRequest)
        for cond in base_where:
            count_stmt = count_stmt.where(cond)
            stmt = stmt.where(cond)
        stmt = stmt.order_by(ResellerPayoutRequest.requested_at.desc()).offset(offset).limit(page_size)

        total = (await self.session.execute(count_stmt)).scalar_one()
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def get_reseller_user_id(self, reseller_id: uuid.UUID) -> uuid.UUID:
        """Reseller IS a user — just return reseller_id as the user_id."""
        return reseller_id

    async def get_super_admin_ids(self) -> list[uuid.UUID]:
        """Return IDs of all active SUPER_ADMIN users."""
        from sqlalchemy import select as _select
        from app.models.user import User
        from app.core.constants import UserRole, UserStatus
        stmt = _select(User.id).where(
            User.role == UserRole.SUPER_ADMIN.value,
            User.status == UserStatus.ACTIVE.value,
            User.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
