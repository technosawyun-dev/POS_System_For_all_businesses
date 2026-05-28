from __future__ import annotations

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.core.logging import get_logger
from app.reseller_finance.models import ResellerWallet, ResellerWalletTransaction
from app.reseller_finance.repositories import WalletRepository
from app.services.audit_service import AuditService

logger = get_logger(__name__)

_DEFAULT_COMMISSION_RATE = Decimal("10.00")   # 10 %
_DEFAULT_MIN_PAYOUT = Decimal("10000.00")  # 10,000 MMK
_DEFAULT_CURRENCY = "MMK"

_ALLOWED_MANUAL_TX_TYPES: frozenset[str] = frozenset({
    "MANUAL_ADJUSTMENT",
    "BONUS",
    "PENALTY",
})


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WalletService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.wallet_repo = WalletRepository(session)
        self.audit = AuditService(session)

    # Wallet retrieval / creation

    async def get_or_create_wallet(self, reseller_id: uuid.UUID) -> ResellerWallet:
        """Gets or creates wallet for a reseller with default settings."""
        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is not None:
            return wallet

        wallet = ResellerWallet(
            reseller_id=reseller_id,
            available_balance=Decimal("0.00"),
            locked_balance=Decimal("0.00"),
            pending_balance=Decimal("0.00"),
            total_paid_out=Decimal("0.00"),
            currency_code=_DEFAULT_CURRENCY,
            commission_rate_pct=_DEFAULT_COMMISSION_RATE,
            min_payout_amount=_DEFAULT_MIN_PAYOUT,
        )
        self.session.add(wallet)
        await self.session.flush()
        await self.session.refresh(wallet)

        logger.info(
            "reseller_wallet_created",
            reseller_id=str(reseller_id),
            wallet_id=str(wallet.id),
        )
        return wallet

    async def get_wallet(self, reseller_id: uuid.UUID) -> ResellerWallet:
        """Gets wallet. Raises NotFoundError if missing."""
        wallet = await self.wallet_repo.get_by_reseller(reseller_id)
        if wallet is None:
            raise NotFoundError("ResellerWallet", reseller_id)
        return wallet

    # Internal ledger helper

    def _create_tx(
        self,
        *,
        wallet: ResellerWallet,
        amount: Decimal,
        tx_type: str,
        balance_before: Decimal,
        balance_after: Decimal,
        reference_type: str | None,
        reference_id: uuid.UUID | None,
        notes: str | None,
        metadata: dict[str, Any] | None,
        created_by: uuid.UUID | None,
    ) -> ResellerWalletTransaction:
        tx = ResellerWalletTransaction(
            wallet_id=wallet.id,
            reseller_id=wallet.reseller_id,
            transaction_type=tx_type,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            currency_code=wallet.currency_code,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            metadata=metadata,
            created_at=_now(),
            created_by_user_id=created_by,
        )
        self.session.add(tx)
        return tx

    # Credit / Debit operations

    async def credit_available(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        tx_type: str,
        reference_type: str | None,
        reference_id: uuid.UUID | None,
        notes: str | None,
        metadata: dict[str, Any] | None,
        created_by: uuid.UUID | None,
    ) -> tuple[ResellerWallet, ResellerWalletTransaction]:
        """Credits available_balance with SELECT FOR UPDATE safety.
        Creates an immutable ledger entry.
        """
        if amount <= Decimal("0"):
            raise BusinessRuleError("Credit amount must be greater than zero.")

        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is None:
            wallet = await self.get_or_create_wallet(reseller_id)
            # Re-acquire lock after creation
            wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)

        balance_before = wallet.available_balance
        wallet.available_balance = balance_before + amount
        balance_after = wallet.available_balance

        await self.session.flush()

        tx = self._create_tx(
            wallet=wallet,
            amount=amount,
            tx_type=tx_type,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            metadata=metadata,
            created_by=created_by,
        )
        await self.session.flush()
        await self.session.refresh(tx)

        logger.info(
            "wallet_credited",
            reseller_id=str(reseller_id),
            tx_type=tx_type,
            amount=str(amount),
            balance_after=str(balance_after),
        )
        return wallet, tx

    async def debit_available(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        tx_type: str,
        reference_type: str | None,
        reference_id: uuid.UUID | None,
        notes: str | None,
        metadata: dict[str, Any] | None,
        created_by: uuid.UUID | None,
    ) -> tuple[ResellerWallet, ResellerWalletTransaction]:
        """Debits available_balance. Validates amount > 0."""
        if amount <= Decimal("0"):
            raise BusinessRuleError("Debit amount must be greater than zero.")

        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is None:
            raise NotFoundError("ResellerWallet", reseller_id)

        balance_before = wallet.available_balance
        wallet.available_balance = balance_before - amount
        balance_after = wallet.available_balance

        await self.session.flush()

        tx = self._create_tx(
            wallet=wallet,
            amount=amount,
            tx_type=tx_type,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            metadata=metadata,
            created_by=created_by,
        )
        await self.session.flush()
        await self.session.refresh(tx)

        logger.info(
            "wallet_debited",
            reseller_id=str(reseller_id),
            tx_type=tx_type,
            amount=str(amount),
            balance_after=str(balance_after),
        )
        return wallet, tx

    # Payout lifecycle wallet mutations

    async def lock_for_payout(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        payout_request_id: uuid.UUID,
        created_by: uuid.UUID | None,
    ) -> tuple[ResellerWallet, ResellerWalletTransaction]:
        """Atomically: available -= amount, locked += amount.
        Validates: available_balance >= amount (no overdraft on payout).
        """
        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is None:
            raise NotFoundError("ResellerWallet", reseller_id)

        if wallet.available_balance < amount:
            raise BusinessRuleError(
                f"Insufficient available balance. Available: {wallet.available_balance}, "
                f"requested: {amount}."
            )

        balance_before = wallet.available_balance
        wallet.available_balance -= amount
        wallet.locked_balance += amount
        balance_after = wallet.available_balance

        await self.session.flush()

        tx = self._create_tx(
            wallet=wallet,
            amount=amount,
            tx_type="PAYOUT_LOCKED",
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="PAYOUT_REQUEST",
            reference_id=payout_request_id,
            notes=f"Funds locked for payout request {payout_request_id}",
            metadata={"payout_request_id": str(payout_request_id)},
            created_by=created_by,
        )
        await self.session.flush()
        await self.session.refresh(tx)

        logger.info(
            "wallet_payout_locked",
            reseller_id=str(reseller_id),
            amount=str(amount),
            payout_request_id=str(payout_request_id),
        )
        return wallet, tx

    async def release_locked_for_payout(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        payout_request_id: uuid.UUID,
        created_by: uuid.UUID | None,
    ) -> tuple[ResellerWallet, ResellerWalletTransaction]:
        """On rejection: atomically locked -= amount, available += amount."""
        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is None:
            raise NotFoundError("ResellerWallet", reseller_id)

        balance_before = wallet.available_balance
        wallet.locked_balance -= amount
        wallet.available_balance += amount
        balance_after = wallet.available_balance

        await self.session.flush()

        tx = self._create_tx(
            wallet=wallet,
            amount=amount,
            tx_type="PAYOUT_REJECTED",
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="PAYOUT_REQUEST",
            reference_id=payout_request_id,
            notes=f"Locked funds released — payout request {payout_request_id} rejected",
            metadata={"payout_request_id": str(payout_request_id)},
            created_by=created_by,
        )
        await self.session.flush()
        await self.session.refresh(tx)

        logger.info(
            "wallet_payout_rejected_release",
            reseller_id=str(reseller_id),
            amount=str(amount),
            payout_request_id=str(payout_request_id),
        )
        return wallet, tx

    async def complete_payout(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        payout_request_id: uuid.UUID,
        created_by: uuid.UUID | None,
    ) -> tuple[ResellerWallet, ResellerWalletTransaction]:
        """On paid: locked -= amount, total_paid_out += amount."""
        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is None:
            raise NotFoundError("ResellerWallet", reseller_id)

        balance_before = wallet.available_balance
        wallet.locked_balance -= amount
        wallet.total_paid_out += amount
        # available_balance unchanged
        balance_after = wallet.available_balance

        await self.session.flush()

        tx = self._create_tx(
            wallet=wallet,
            amount=amount,
            tx_type="PAYOUT_COMPLETED",
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="PAYOUT_REQUEST",
            reference_id=payout_request_id,
            notes=f"Payout completed for request {payout_request_id}",
            metadata={"payout_request_id": str(payout_request_id)},
            created_by=created_by,
        )
        await self.session.flush()
        await self.session.refresh(tx)

        logger.info(
            "wallet_payout_completed",
            reseller_id=str(reseller_id),
            amount=str(amount),
            payout_request_id=str(payout_request_id),
            total_paid_out=str(wallet.total_paid_out),
        )
        return wallet, tx

    # Admin operations

    async def update_commission_rate(
        self,
        reseller_id: uuid.UUID,
        rate_pct: Decimal,
        min_payout: Decimal,
        actor_id: uuid.UUID,
    ) -> ResellerWallet:
        """SUPER_ADMIN updates commission rate and minimum payout threshold."""
        if rate_pct < Decimal("0") or rate_pct > Decimal("100"):
            raise BusinessRuleError("Commission rate must be between 0 and 100.")
        if min_payout < Decimal("0"):
            raise BusinessRuleError("Minimum payout amount cannot be negative.")

        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is None:
            raise NotFoundError("ResellerWallet", reseller_id)

        before_rate = wallet.commission_rate_pct
        before_min = wallet.min_payout_amount

        wallet.commission_rate_pct = rate_pct
        wallet.min_payout_amount = min_payout
        await self.session.flush()
        await self.session.refresh(wallet)

        await self.audit.log(
            action="WALLET_COMMISSION_RATE_UPDATED",
            actor_user_id=actor_id,
            entity_type="RESELLER_WALLET",
            entity_id=wallet.id,
            before_state={
                "commission_rate_pct": str(before_rate),
                "min_payout_amount": str(before_min),
            },
            after_state={
                "commission_rate_pct": str(rate_pct),
                "min_payout_amount": str(min_payout),
            },
        )
        logger.info(
            "wallet_commission_rate_updated",
            reseller_id=str(reseller_id),
            new_rate=str(rate_pct),
            new_min_payout=str(min_payout),
        )
        return wallet

    async def admin_manual_adjustment(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        tx_type: str,
        notes: str,
        actor_id: uuid.UUID,
        metadata: dict[str, Any] | None = None,
    ) -> tuple[ResellerWallet, ResellerWalletTransaction]:
        """Admin creates MANUAL_ADJUSTMENT, BONUS, or PENALTY transaction.

        For PENALTY and negative MANUAL_ADJUSTMENT, amount is debited.
        For BONUS and positive MANUAL_ADJUSTMENT, amount is credited.
        """
        if tx_type not in _ALLOWED_MANUAL_TX_TYPES:
            raise BusinessRuleError(
                f"Invalid manual transaction type '{tx_type}'. "
                f"Allowed: {sorted(_ALLOWED_MANUAL_TX_TYPES)}."
            )
        if amount == Decimal("0"):
            raise BusinessRuleError("Adjustment amount must not be zero.")

        wallet = await self.wallet_repo.get_wallet_for_update(reseller_id)
        if wallet is None:
            raise NotFoundError("ResellerWallet", reseller_id)

        balance_before = wallet.available_balance

        # PENALTY is always a debit; BONUS always a credit.
        # MANUAL_ADJUSTMENT: sign of amount determines direction.
        if tx_type == "PENALTY":
            applied_amount = abs(amount)
            wallet.available_balance -= applied_amount
        elif tx_type == "BONUS":
            applied_amount = abs(amount)
            wallet.available_balance += applied_amount
        else:  # MANUAL_ADJUSTMENT — honour the sign
            applied_amount = amount
            wallet.available_balance += amount  # amount may be negative

        balance_after = wallet.available_balance
        await self.session.flush()

        effective_amount = abs(applied_amount)
        tx = self._create_tx(
            wallet=wallet,
            amount=effective_amount,
            tx_type=tx_type,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=None,
            reference_id=None,
            notes=notes,
            metadata=metadata,
            created_by=actor_id,
        )
        await self.session.flush()
        await self.session.refresh(tx)

        await self.audit.log(
            action="WALLET_MANUAL_ADJUSTMENT",
            actor_user_id=actor_id,
            entity_type="RESELLER_WALLET",
            entity_id=wallet.id,
            after_state={
                "tx_type": tx_type,
                "amount": str(effective_amount),
                "balance_before": str(balance_before),
                "balance_after": str(balance_after),
                "notes": notes,
            },
        )
        logger.info(
            "wallet_manual_adjustment",
            reseller_id=str(reseller_id),
            tx_type=tx_type,
            amount=str(effective_amount),
            balance_after=str(balance_after),
        )
        return wallet, tx

    # Admin helper: wallet settings (alias that routes expect)

    async def update_wallet_settings(
        self,
        reseller_id: uuid.UUID,
        commission_rate_pct: Decimal,
        min_payout_amount: Decimal,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> "ResellerWallet":
        """Thin alias around ``update_commission_rate`` with the same signature
        that the admin routes call through ``UpdateWalletSettingsRequest``.
        """
        return await self.update_commission_rate(
            reseller_id=reseller_id,
            rate_pct=commission_rate_pct,
            min_payout=min_payout_amount,
            actor_id=actor_id,
        )

    async def apply_manual_adjustment(
        self,
        reseller_id: uuid.UUID,
        amount: Decimal,
        transaction_type: str,
        notes: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> "ResellerWalletTransaction":
        """Thin alias around ``admin_manual_adjustment`` that returns only the
        transaction (the route only needs the transaction response).
        """
        _, tx = await self.admin_manual_adjustment(
            reseller_id=reseller_id,
            amount=amount,
            tx_type=transaction_type,
            notes=notes,
            actor_id=actor_id,
        )
        return tx

    # Platform analytics helpers (admin /overview and /wallets)

    async def get_finance_overview(self) -> dict[str, Any]:
        """Return aggregate KPIs for the super-admin finance overview dashboard."""
        from sqlalchemy import func as _func, select as _select
        from app.reseller_finance.models import (
            ResellerPayoutRequest,
            ResellerWallet,
            ResellerWalletTransaction,
            TenantReferral,
        )

        # Wallet aggregates
        wallet_agg = await self.session.execute(
            _select(
                _func.count(ResellerWallet.id).label("total_resellers"),
                _func.coalesce(_func.sum(ResellerWallet.available_balance + ResellerWallet.locked_balance), 0).label("total_wallets_value"),
                _func.coalesce(_func.sum(ResellerWallet.total_paid_out), 0).label("total_paid_out"),
            )
        )
        wa = wallet_agg.one()

        # Commission aggregates
        commission_agg = await self.session.execute(
            _select(
                _func.coalesce(
                    _func.sum(ResellerWalletTransaction.amount), 0
                ).label("total_earned")
            ).where(
                ResellerWalletTransaction.transaction_type == "COMMISSION_EARNED"
            )
        )
        total_earned = Decimal(str(commission_agg.scalar_one() or 0))

        # Pending payouts
        payout_agg = await self.session.execute(
            _select(
                _func.count(ResellerPayoutRequest.id).label("count"),
                _func.coalesce(_func.sum(ResellerPayoutRequest.amount), 0).label("amount"),
            ).where(
                ResellerPayoutRequest.status.in_(["PENDING", "UNDER_REVIEW", "APPROVED"])
            )
        )
        pa = payout_agg.one()

        # Referrals
        ref_total = await self.session.execute(
            _select(_func.count()).select_from(TenantReferral)
        )
        ref_converted = await self.session.execute(
            _select(_func.count()).select_from(TenantReferral).where(
                TenantReferral.locked_at.isnot(None)
            )
        )

        # Derive currency from any wallet (default fallback)
        first_wallet = await self.session.execute(
            _select(ResellerWallet.currency_code).limit(1)
        )
        currency_code = first_wallet.scalar_one_or_none() or "MMK"

        return {
            "total_resellers": wa.total_resellers or 0,
            "total_wallets_value": Decimal(str(wa.total_wallets_value or 0)),
            "total_pending_payouts": pa.count or 0,
            "total_pending_payout_amount": Decimal(str(pa.amount or 0)),
            "total_commission_earned": total_earned,
            "total_commission_paid_out": Decimal(str(wa.total_paid_out or 0)),
            "total_referrals": ref_total.scalar_one() or 0,
            "converted_referrals": ref_converted.scalar_one() or 0,
            "currency_code": currency_code,
        }

    async def list_wallet_summaries(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> list[Any]:
        """Return a paginated list of denormalised wallet summary objects.

        Each item in the list is a plain object / dict with the fields expected
        by ``ResellerWalletSummary``.  The reseller name / email come from the
        ``users`` table via a JOIN.
        """
        from sqlalchemy import func as _func, select as _select
        from app.reseller_finance.models import ResellerReferralCode, ResellerWallet, TenantReferral
        from app.models.user import User
        from dataclasses import dataclass, field

        @dataclass
        class _WalletSummaryRow:
            reseller_id: uuid.UUID
            reseller_name: str
            reseller_email: str
            available_balance: Decimal
            locked_balance: Decimal
            total_paid_out: Decimal
            total_referrals: int
            commission_rate_pct: Decimal
            min_payout_amount: Decimal
            currency_code: str
            primary_code: str | None = field(default=None)

        offset = (page - 1) * page_size

        # Sub-query for referral counts
        ref_count_sub = (
            _select(
                TenantReferral.reseller_id.label("reseller_id"),
                _func.count(TenantReferral.id).label("cnt"),
            )
            .group_by(TenantReferral.reseller_id)
            .subquery()
        )

        # Sub-query for primary referral code (first active code per reseller)
        primary_code_sub = (
            _select(
                ResellerReferralCode.reseller_id.label("reseller_id"),
                _func.min(ResellerReferralCode.code).label("primary_code"),
            )
            .where(ResellerReferralCode.is_active.is_(True))
            .group_by(ResellerReferralCode.reseller_id)
            .subquery()
        )

        stmt = (
            _select(
                ResellerWallet.reseller_id,
                (User.first_name + " " + User.last_name).label("reseller_name"),
                User.email.label("reseller_email"),
                ResellerWallet.available_balance,
                ResellerWallet.locked_balance,
                ResellerWallet.total_paid_out,
                _func.coalesce(ref_count_sub.c.cnt, 0).label("total_referrals"),
                ResellerWallet.commission_rate_pct,
                ResellerWallet.min_payout_amount,
                ResellerWallet.currency_code,
                primary_code_sub.c.primary_code,
            )
            .join(User, User.id == ResellerWallet.reseller_id)
            .outerjoin(ref_count_sub, ref_count_sub.c.reseller_id == ResellerWallet.reseller_id)
            .outerjoin(primary_code_sub, primary_code_sub.c.reseller_id == ResellerWallet.reseller_id)
            .order_by(ResellerWallet.available_balance.desc())
            .offset(offset)
            .limit(page_size)
        )

        result = await self.session.execute(stmt)
        rows = result.fetchall()

        return [
            _WalletSummaryRow(
                reseller_id=r.reseller_id,
                reseller_name=r.reseller_name or "",
                reseller_email=r.reseller_email or "",
                available_balance=Decimal(str(r.available_balance or 0)),
                locked_balance=Decimal(str(r.locked_balance or 0)),
                total_paid_out=Decimal(str(r.total_paid_out or 0)),
                total_referrals=r.total_referrals or 0,
                commission_rate_pct=Decimal(str(r.commission_rate_pct or 0)),
                min_payout_amount=Decimal(str(r.min_payout_amount or 0)),
                currency_code=r.currency_code or "MMK",
                primary_code=r.primary_code,
            )
            for r in rows
        ]

    async def list_commission_transactions(
        self,
        reseller_id: uuid.UUID | None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list["ResellerWalletTransaction"], int]:
        """Return paginated COMMISSION_EARNED transactions.

        Scoped to a single reseller when *reseller_id* is provided.
        """
        from sqlalchemy import func as _func, select as _select

        offset = (page - 1) * page_size

        base_where = [ResellerWalletTransaction.transaction_type == "COMMISSION_EARNED"]
        if reseller_id is not None:
            base_where.append(ResellerWalletTransaction.reseller_id == reseller_id)

        count_stmt = (
            _select(_func.count())
            .select_from(ResellerWalletTransaction)
            .where(*base_where)
        )
        stmt = (
            _select(ResellerWalletTransaction)
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
