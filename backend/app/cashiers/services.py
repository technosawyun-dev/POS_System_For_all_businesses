from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.cashiers.models import CashierSession
from app.cashiers.repositories import CashierSessionRepository
from app.core.constants import (
    AuditAction,
    CashierSessionStatus,
    EntityType,
)
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.events.types import EventType
from app.payments.repositories import PaymentRepository
from app.sales.repositories import OrderRepository
from app.services.audit_service import AuditService


class CashierSessionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.session_repo = CashierSessionRepository(session)
        self.payment_repo = PaymentRepository(session)
        self.order_repo = OrderRepository(session)
        self.audit = AuditService(session)

    async def open_session(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        cashier_user_id: uuid.UUID,
        opening_balance: Decimal,
        notes: str | None = None,
        actor_user_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> CashierSession:
        existing = await self.session_repo.get_open_session(cashier_user_id, branch_id)
        if existing:
            raise BusinessRuleError(
                "Cashier already has an open session at this branch. "
                f"Close session {existing.id} before opening a new one."
            )

        now = datetime.now(timezone.utc)
        cs = CashierSession(
            tenant_id=tenant_id,
            branch_id=branch_id,
            cashier_user_id=cashier_user_id,
            opening_balance=opening_balance,
            status=CashierSessionStatus.OPEN,
            opened_at=now,
            notes=notes,
        )
        self.session.add(cs)
        await self.session.flush()
        await self.session.refresh(cs)

        await self.audit.log(
            action=AuditAction.CASHIER_SESSION_OPENED,
            actor_user_id=actor_user_id or cashier_user_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=EntityType.CASHIER_SESSION,
            entity_id=cs.id,
            after_state={
                "opening_balance": str(opening_balance),
                "opened_at": now.isoformat(),
            },
            request_id=request_id,
        )

        await event_publisher.publish(DomainEvent(
            event_type=EventType.CASHIER_SESSION_OPENED,
            payload={
                "session_id": str(cs.id),
                "branch_id": str(branch_id),
                "cashier_user_id": str(cashier_user_id),
                "opening_balance": str(opening_balance),
            },
            tenant_id=tenant_id,
            actor_id=actor_user_id or cashier_user_id,
        ))

        return cs

    async def close_session(
        self,
        session_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actual_balance: Decimal,
        closing_notes: str | None = None,
        actor_user_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> CashierSession:
        cs = await self.session_repo.get_by_id_and_tenant(session_id, tenant_id)
        if not cs:
            raise NotFoundError("CashierSession", session_id)
        if cs.status != CashierSessionStatus.OPEN:
            raise BusinessRuleError(
                f"Session is not OPEN (current: '{cs.status}'). Cannot close."
            )

        now = datetime.now(timezone.utc)

        # Calculate expected balance: opening + cash sales - cash refunds
        expected_balance = await self._compute_expected_cash_balance(cs, tenant_id)
        discrepancy = actual_balance - expected_balance

        cs.status = CashierSessionStatus.CLOSED
        cs.actual_balance = actual_balance
        cs.expected_balance = expected_balance
        cs.discrepancy_amount = discrepancy
        cs.closing_balance = actual_balance
        cs.closed_at = now
        if closing_notes:
            cs.notes = closing_notes

        await self.session.flush()
        await self.session.refresh(cs)

        await self.audit.log(
            action=AuditAction.CASHIER_SESSION_CLOSED,
            actor_user_id=actor_user_id or cs.cashier_user_id,
            tenant_id=tenant_id,
            branch_id=cs.branch_id,
            entity_type=EntityType.CASHIER_SESSION,
            entity_id=session_id,
            before_state={"status": CashierSessionStatus.OPEN},
            after_state={
                "status": CashierSessionStatus.CLOSED,
                "expected_balance": str(expected_balance),
                "actual_balance": str(actual_balance),
                "discrepancy": str(discrepancy),
            },
            request_id=request_id,
        )

        await event_publisher.publish(DomainEvent(
            event_type=EventType.CASHIER_SESSION_CLOSED,
            payload={
                "session_id": str(session_id),
                "branch_id": str(cs.branch_id),
                "expected_balance": str(expected_balance),
                "actual_balance": str(actual_balance),
                "discrepancy": str(discrepancy),
            },
            tenant_id=tenant_id,
            actor_id=actor_user_id or cs.cashier_user_id,
        ))

        return cs

    async def get_session(
        self,
        session_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> CashierSession:
        cs = await self.session_repo.get_by_id_and_tenant(session_id, tenant_id)
        if not cs:
            raise NotFoundError("CashierSession", session_id)
        return cs

    async def _compute_expected_cash_balance(
        self, cs: CashierSession, tenant_id: uuid.UUID,
    ) -> Decimal:
        """Opening float + cash sales - cash refunds. Shared by close_session
        (the authoritative figure recorded on close) and get_close_preview
        (the same figure shown to the cashier before they commit to closing)
        so the two can never drift apart."""
        cash_sales_total = await self.payment_repo.get_cash_total_for_session(
            cashier_session_id=cs.id,
            tenant_id=tenant_id,
        )
        cash_refunds_total = await self.payment_repo.get_cash_refunds_for_session(
            cashier_session_id=cs.id,
            tenant_id=tenant_id,
        )
        return cs.opening_balance + cash_sales_total - cash_refunds_total

    async def get_close_preview(
        self,
        session_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> dict:
        """Everything the close-session screen needs to show *before* the
        cashier commits: net revenue, order count, and the same
        opening+cash-sales-minus-refunds expected cash balance that
        close_session() will actually record. Read-only — computed live from
        current orders/payments, valid as of the moment it's requested (a
        sale that lands between viewing this and clicking "Close Session"
        won't retroactively appear — the same is true of any point-in-time
        reconciliation figure)."""
        cs = await self.get_session(session_id, tenant_id)

        expected_cash_balance = await self._compute_expected_cash_balance(cs, tenant_id)
        net_revenue, order_count = await self.order_repo.get_revenue_summary_for_session(
            cashier_session_id=session_id,
            tenant_id=tenant_id,
        )
        payment_method_totals = await self.payment_repo.get_totals_by_method_for_session(
            cashier_session_id=session_id,
            tenant_id=tenant_id,
        )

        return {
            "opening_balance": cs.opening_balance,
            "expected_cash_balance": expected_cash_balance,
            "net_revenue": net_revenue,
            "order_count": order_count,
            "payment_method_totals": payment_method_totals,
        }

    async def get_my_open_sessions(self, cashier_user_id: uuid.UUID) -> list[CashierSession]:
        return await self.session_repo.get_open_sessions_for_user(cashier_user_id)

    async def list_sessions(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        branch_id: uuid.UUID | None = None,
        cashier_user_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[CashierSession], int]:
        offset = (page - 1) * page_size
        return await self.session_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            branch_id=branch_id,
            cashier_user_id=cashier_user_id,
            status=status,
        )
