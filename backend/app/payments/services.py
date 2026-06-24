from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    EntityType,
    PaymentStatus,
)
from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.payments.models import Payment
from app.payments.repositories import PaymentRepository, RefundRepository
from app.sales.repositories import OrderRepository
from app.services.audit_service import AuditService


class PaymentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.payment_repo = PaymentRepository(session)
        self.refund_repo = RefundRepository(session)
        self.order_repo = OrderRepository(session)
        self.audit = AuditService(session)

    async def add_payment(
        self,
        order_id: uuid.UUID,
        tenant_id: uuid.UUID,
        payment_method: str,
        amount: Decimal,
        actor_user_id: uuid.UUID,
        reference_number: str | None = None,
        notes: str | None = None,
        request_id: str | None = None,
    ) -> Payment:
        """Add an additional payment to an existing order (partial payment flow)."""
        if amount <= Decimal("0"):
            raise ValidationError("Payment amount must be positive")

        order = await self.order_repo.get_with_details(order_id)
        if not order or order.tenant_id != tenant_id:
            raise NotFoundError("Order", order_id)

        from app.core.constants import OrderStatus
        if order.order_status == OrderStatus.VOIDED:
            raise BusinessRuleError("Cannot add payment to a voided order")

        now = datetime.now(timezone.utc)
        payment = Payment(
            order_id=order_id,
            tenant_id=tenant_id,
            payment_method=payment_method,
            amount=amount,
            payment_status=PaymentStatus.PAID,
            reference_number=reference_number,
            notes=notes,
            paid_at=now,
            processed_by=actor_user_id,
        )
        self.session.add(payment)
        await self.session.flush()
        await self.session.refresh(payment)

        # Recalculate order payment_status, accounting for any prior refunds
        all_payments = await self.payment_repo.get_by_order(order_id)
        total_paid = sum(p.amount for p in all_payments if p.payment_status == PaymentStatus.PAID)
        net_due = order.total_amount - order.refunded_amount
        if total_paid >= net_due:
            order.payment_status = PaymentStatus.PAID
        elif total_paid > Decimal("0"):
            order.payment_status = PaymentStatus.PARTIAL
        else:
            order.payment_status = PaymentStatus.PENDING
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PAYMENT_RECEIVED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=order.branch_id,
            entity_type=EntityType.PAYMENT,
            entity_id=payment.id,
            after_state={
                "order_id": str(order_id),
                "amount": str(amount),
                "method": payment_method,
            },
            request_id=request_id,
        )

        return payment

    async def get_payment(
        self,
        payment_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Payment:
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment or payment.tenant_id != tenant_id:
            raise NotFoundError("Payment", payment_id)
        return payment

    async def list_payments(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        order_id: uuid.UUID | None = None,
        payment_method: str | None = None,
        payment_status: str | None = None,
    ) -> tuple[list[Payment], int]:
        offset = (page - 1) * page_size
        return await self.payment_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            order_id=order_id,
            payment_method=payment_method,
            payment_status=payment_status,
        )
