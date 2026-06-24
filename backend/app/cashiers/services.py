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
from app.events.publisher import EventPublisher
from app.events.types import EventType
from app.payments.repositories import PaymentRepository
from app.services.audit_service import AuditService


class CashierSessionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.session_repo = CashierSessionRepository(session)
        self.payment_repo = PaymentRepository(session)
        self.audit = AuditService(session)
        self.publisher = EventPublisher()

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

        await self.publisher.publish(DomainEvent(
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
        cash_sales_total = await self.payment_repo.get_cash_total_for_session(
            cashier_session_id=session_id,
            tenant_id=tenant_id,
        )
        cash_refunds_total = await self.payment_repo.get_cash_refunds_for_session(
            cashier_session_id=session_id,
            tenant_id=tenant_id,
        )
        expected_balance = cs.opening_balance + cash_sales_total - cash_refunds_total
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

        await self.publisher.publish(DomainEvent(
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
