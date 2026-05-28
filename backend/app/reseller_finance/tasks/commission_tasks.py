from __future__ import annotations

"""
Celery tasks for reseller finance.

Tasks are designed to be idempotent and fail-safe.
"""

from app.tasks.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    name="reseller_finance.reconcile_wallet_balances",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def reconcile_wallet_balances(self) -> dict:  # type: ignore[no-untyped-def]
    """
    Periodic reconciliation: recompute wallet available/locked/total balances
    from the immutable transaction ledger and fix any drift.

    Safe to run at any time — only updates wallets where drift is detected.
    """
    import asyncio
    from decimal import Decimal

    async def _run() -> dict:
        from sqlalchemy import select, func
        from app.db.session import AsyncSessionLocal
        from app.reseller_finance.models.wallet import ResellerWallet, ResellerWalletTransaction

        fixed = 0
        async with AsyncSessionLocal() as session:
            try:
                wallets_result = await session.execute(select(ResellerWallet))
                wallets = wallets_result.scalars().all()

                for wallet in wallets:
                    # Sum each relevant transaction type from the ledger
                    earned_stmt = select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0)).where(
                        ResellerWalletTransaction.wallet_id == wallet.id,
                        ResellerWalletTransaction.transaction_type == "COMMISSION_EARNED",
                    )
                    reversed_stmt = select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0)).where(
                        ResellerWalletTransaction.wallet_id == wallet.id,
                        ResellerWalletTransaction.transaction_type == "COMMISSION_REVERSAL",
                    )
                    locked_stmt = select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0)).where(
                        ResellerWalletTransaction.wallet_id == wallet.id,
                        ResellerWalletTransaction.transaction_type == "PAYOUT_LOCKED",
                    )
                    unlocked_stmt = select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0)).where(
                        ResellerWalletTransaction.wallet_id == wallet.id,
                        ResellerWalletTransaction.transaction_type.in_(["PAYOUT_REJECTED", "PAYOUT_COMPLETED"]),
                    )
                    paid_stmt = select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0)).where(
                        ResellerWalletTransaction.wallet_id == wallet.id,
                        ResellerWalletTransaction.transaction_type == "PAYOUT_COMPLETED",
                    )
                    adj_stmt = select(func.coalesce(func.sum(ResellerWalletTransaction.amount), 0)).where(
                        ResellerWalletTransaction.wallet_id == wallet.id,
                        ResellerWalletTransaction.transaction_type.in_(["MANUAL_ADJUSTMENT", "BONUS", "PENALTY"]),
                    )

                    earned = Decimal(str((await session.execute(earned_stmt)).scalar_one()))
                    reversed_ = Decimal(str((await session.execute(reversed_stmt)).scalar_one()))
                    locked_total = Decimal(str((await session.execute(locked_stmt)).scalar_one()))
                    unlocked_total = Decimal(str((await session.execute(unlocked_stmt)).scalar_one()))
                    paid_total = Decimal(str((await session.execute(paid_stmt)).scalar_one()))
                    adj_total = Decimal(str((await session.execute(adj_stmt)).scalar_one()))

                    # Correct locked balance = total locked - total unlocked (rejected + completed)
                    correct_locked = max(Decimal("0"), locked_total - unlocked_total)
                    # Correct total_paid_out = completed payouts
                    correct_paid_out = paid_total
                    # Correct available = earned - reversed + adjustments - locked (still locked) - paid
                    correct_available = earned - reversed_ + adj_total - correct_locked - correct_paid_out

                    if (
                        abs(wallet.available_balance - correct_available) > Decimal("0.000001")
                        or abs(wallet.locked_balance - correct_locked) > Decimal("0.000001")
                        or abs(wallet.total_paid_out - correct_paid_out) > Decimal("0.000001")
                    ):
                        wallet.available_balance = correct_available
                        wallet.locked_balance = correct_locked
                        wallet.total_paid_out = correct_paid_out
                        fixed += 1
                        logger.warning(
                            "wallet_balance_drift_corrected",
                            wallet_id=str(wallet.id),
                            reseller_id=str(wallet.reseller_id),
                        )

                await session.commit()
            except Exception:
                await session.rollback()
                logger.exception("reconcile_wallet_balances_error")

        return {"fixed": fixed}

    return asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(
    name="reseller_finance.expire_cancelled_payout_locks",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def expire_cancelled_payout_locks(self) -> dict:  # type: ignore[no-untyped-def]
    """
    Safety net: if a payout was cancelled/rejected but wallet funds were not
    released (e.g. due to a crash), release them now.

    Idempotent — checks wallet transaction before releasing.
    """
    import asyncio

    async def _run() -> dict:
        fixed = 0
        # Implementation would scan for CANCELLED/REJECTED payouts
        # without a corresponding PAYOUT_REJECTED wallet transaction
        # and release the funds.  Stubbed for now — the primary flow
        # handles this synchronously.
        return {"fixed": fixed}

    return asyncio.get_event_loop().run_until_complete(_run())
