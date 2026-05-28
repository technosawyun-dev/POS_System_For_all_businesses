from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.reseller_finance.models.wallet import ResellerWallet, ResellerWalletTransaction


class WalletRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ResellerWallet queries

    async def get_by_reseller(self, reseller_id: uuid.UUID) -> ResellerWallet | None:
        """Return the wallet for *reseller_id*, or None if it does not exist."""
        stmt = select(ResellerWallet).where(ResellerWallet.reseller_id == reseller_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_reseller_for_update(
        self, reseller_id: uuid.UUID
    ) -> ResellerWallet | None:
        """
        Acquire a row-level lock (SELECT … FOR UPDATE) before mutating the
        wallet balance.  Must be called inside an explicit transaction.
        """
        stmt = (
            select(ResellerWallet)
            .where(ResellerWallet.reseller_id == reseller_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_create_wallet(
        self,
        reseller_id: uuid.UUID,
        currency_code: str = "MMK",
    ) -> ResellerWallet:
        """
        Return the existing wallet for *reseller_id*, or create a fresh one with
        zero balances.  Idempotent — safe to call multiple times.
        """
        wallet = await self.get_by_reseller(reseller_id)
        if wallet is not None:
            return wallet

        wallet = ResellerWallet(
            reseller_id=reseller_id,
            currency_code=currency_code,
            available_balance=Decimal("0"),
            locked_balance=Decimal("0"),
            pending_balance=Decimal("0"),
            total_paid_out=Decimal("0"),
        )
        self.session.add(wallet)
        await self.session.flush()
        await self.session.refresh(wallet)
        return wallet

    # ResellerWalletTransaction queries

    async def create_transaction(
        self,
        wallet_id: uuid.UUID,
        reseller_id: uuid.UUID,
        tx_type: str,
        amount: Decimal,
        balance_before: Decimal,
        balance_after: Decimal,
        currency_code: str = "MMK",
        reference_type: str | None = None,
        reference_id: uuid.UUID | None = None,
        notes: str | None = None,
        metadata: dict[str, Any] | None = None,
        created_by: uuid.UUID | None = None,
    ) -> ResellerWalletTransaction:
        """Append an immutable ledger entry and return it."""
        tx = ResellerWalletTransaction(
            wallet_id=wallet_id,
            reseller_id=reseller_id,
            transaction_type=tx_type,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            currency_code=currency_code,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            metadata_=metadata,
            created_by_user_id=created_by,
        )
        self.session.add(tx)
        await self.session.flush()
        await self.session.refresh(tx)
        return tx

    async def get_transactions(
        self,
        wallet_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        tx_type_filter: str | None = None,
    ) -> tuple[list[ResellerWalletTransaction], int]:
        """Return a paginated list of ledger entries for *wallet_id*."""
        offset = (page - 1) * page_size

        base_where = [ResellerWalletTransaction.wallet_id == wallet_id]
        if tx_type_filter:
            base_where.append(ResellerWalletTransaction.transaction_type == tx_type_filter)

        count_stmt = (
            select(func.count())
            .select_from(ResellerWalletTransaction)
            .where(*base_where)
        )
        stmt = (
            select(ResellerWalletTransaction)
            .where(*base_where)
            .order_by(ResellerWalletTransaction.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        result = await self.session.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def check_commission_already_earned(
        self,
        wallet_id: uuid.UUID,
        reference_type: str,
        reference_id: uuid.UUID,
    ) -> bool:
        """
        Return True if a COMMISSION_EARNED transaction already exists for the
        given (wallet_id, reference_type, reference_id) triple.  Used to prevent
        double-crediting before hitting the DB unique index.
        """
        stmt = (
            select(func.count())
            .select_from(ResellerWalletTransaction)
            .where(
                ResellerWalletTransaction.wallet_id == wallet_id,
                ResellerWalletTransaction.transaction_type == "COMMISSION_EARNED",
                ResellerWalletTransaction.reference_type == reference_type,
                ResellerWalletTransaction.reference_id == reference_id,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() > 0

    async def check_commission_reversal_exists(
        self,
        wallet_id: uuid.UUID,
        reference_type: str,
        reference_id: uuid.UUID,
    ) -> bool:
        """
        Return True if a COMMISSION_REVERSAL transaction already exists for the
        given triple.  Used to prevent double-reversals.
        """
        stmt = (
            select(func.count())
            .select_from(ResellerWalletTransaction)
            .where(
                ResellerWalletTransaction.wallet_id == wallet_id,
                ResellerWalletTransaction.transaction_type == "COMMISSION_REVERSAL",
                ResellerWalletTransaction.reference_type == reference_type,
                ResellerWalletTransaction.reference_id == reference_id,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() > 0

    async def get_total_earned(self, reseller_id: uuid.UUID) -> Decimal:
        """
        Return the cumulative sum of COMMISSION_EARNED amounts for *reseller_id*.
        Returns Decimal('0') when there are no earning transactions.
        """
        stmt = (
            select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0))
            .where(
                ResellerWalletTransaction.reseller_id == reseller_id,
                ResellerWalletTransaction.transaction_type == "COMMISSION_EARNED",
            )
        )
        result = await self.session.execute(stmt)
        raw = result.scalar_one()
        return Decimal(str(raw)) if raw is not None else Decimal("0")

    async def get_total_locked(self, reseller_id: uuid.UUID) -> Decimal:
        """
        Return the cumulative sum of PAYOUT_LOCKED amounts for *reseller_id*.
        This represents funds that have been earmarked for pending payouts.
        """
        stmt = (
            select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0))
            .where(
                ResellerWalletTransaction.reseller_id == reseller_id,
                ResellerWalletTransaction.transaction_type == "PAYOUT_LOCKED",
            )
        )
        result = await self.session.execute(stmt)
        raw = result.scalar_one()
        return Decimal(str(raw)) if raw is not None else Decimal("0")

    # Aliases used by services

    async def get_wallet_for_update(self, reseller_id: uuid.UUID) -> ResellerWallet | None:
        """Alias for get_by_reseller_for_update (SELECT FOR UPDATE)."""
        return await self.get_by_reseller_for_update(reseller_id)

    async def list_transactions(
        self,
        wallet_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        tx_type_filter: str | None = None,
    ) -> tuple[list[ResellerWalletTransaction], int]:
        """Alias for get_transactions."""
        return await self.get_transactions(wallet_id, page, page_size, tx_type_filter)

    async def get_transaction_by_reference(
        self,
        wallet_id: uuid.UUID,
        tx_type: str,
        reference_type: str,
        reference_id: uuid.UUID,
    ) -> ResellerWalletTransaction | None:
        """Return a single transaction matching all four criteria, or None."""
        stmt = (
            select(ResellerWalletTransaction)
            .where(
                ResellerWalletTransaction.wallet_id == wallet_id,
                ResellerWalletTransaction.transaction_type == tx_type,
                ResellerWalletTransaction.reference_type == reference_type,
                ResellerWalletTransaction.reference_id == reference_id,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_transactions_by_reseller(
        self,
        reseller_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        tx_type_filter: str | None = None,
    ) -> tuple[list[ResellerWalletTransaction], int]:
        """Return paginated transactions for a reseller regardless of wallet_id."""
        offset = (page - 1) * page_size
        base_where = [ResellerWalletTransaction.reseller_id == reseller_id]
        if tx_type_filter:
            base_where.append(ResellerWalletTransaction.transaction_type == tx_type_filter)

        count_stmt = (
            select(func.count())
            .select_from(ResellerWalletTransaction)
            .where(*base_where)
        )
        stmt = (
            select(ResellerWalletTransaction)
            .where(*base_where)
            .order_by(ResellerWalletTransaction.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total
