from __future__ import annotations

"""
Refund Engine
=============
Refund flow:
  validate order is COMPLETED (or PARTIALLY_REFUNDED)
  → validate refund items against original order items
  → create Refund header
  → create RefundItems
  → create REFUND StockMovements (inventory engine — THE ONLY way to restore stock)
  → update order.refunded_amount
  → recalculate order.order_status (PARTIALLY_REFUNDED vs REFUNDED)
  → recalculate order.payment_status
  → audit log
  → publish REFUND_CREATED event
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    EntityType,
    OrderStatus,
    PaymentStatus,
    StockMovementType,
)
from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import EventPublisher
from app.events.types import EventType
from app.payments.models import Refund, RefundItem
from app.payments.repositories import RefundRepository
from app.sales.models import Order, OrderItem
from app.sales.repositories import BranchCounterRepository, OrderRepository
from app.services.audit_service import AuditService
from app.services.inventory_service import InventoryService

logger = get_logger(__name__)


class RefundItemInput:
    __slots__ = ("order_item_id", "quantity", "amount")

    def __init__(
        self,
        order_item_id: uuid.UUID,
        quantity: Decimal,
        amount: Decimal,
    ) -> None:
        self.order_item_id = order_item_id
        self.quantity = quantity
        self.amount = amount


class RefundInput:
    __slots__ = ("order_id", "reason", "items", "notes")

    def __init__(
        self,
        order_id: uuid.UUID,
        reason: str,
        items: list[RefundItemInput],
        notes: str | None = None,
    ) -> None:
        self.order_id = order_id
        self.reason = reason
        self.items = items
        self.notes = notes


def _derive_order_status_after_refund(
    total_amount: Decimal, refunded_amount: Decimal
) -> str:
    if refunded_amount >= total_amount:
        return OrderStatus.REFUNDED
    return OrderStatus.PARTIALLY_REFUNDED


def _derive_payment_status_after_refund(
    total_amount: Decimal, total_paid: Decimal, refunded_amount: Decimal
) -> str:
    net = total_paid - refunded_amount
    if net <= Decimal("0"):
        return PaymentStatus.REFUNDED
    elif net < total_amount:
        return PaymentStatus.PARTIAL
    return PaymentStatus.PAID


class RefundService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.order_repo = OrderRepository(session)
        self.refund_repo = RefundRepository(session)
        self.counter_repo = BranchCounterRepository(session)
        self.inventory_svc = InventoryService(session)
        self.audit = AuditService(session)
        self.publisher = EventPublisher()

    async def process_refund(
        self,
        tenant_id: uuid.UUID,
        data: RefundInput,
        actor_user_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Refund:
        """
        ALL-OR-NOTHING refund. Caller must wrap in a transaction.
        """
        order = await self.order_repo.get_with_details(data.order_id)
        if not order or order.tenant_id != tenant_id:
            raise NotFoundError("Order", data.order_id)

        if order.order_status not in {
            OrderStatus.COMPLETED,
            OrderStatus.PARTIALLY_REFUNDED,
        }:
            raise BusinessRuleError(
                f"Refunds can only be applied to COMPLETED or PARTIALLY_REFUNDED orders. "
                f"Current: '{order.order_status}'"
            )

        if not data.items:
            raise ValidationError("Refund must specify at least one item")

        now = datetime.now(timezone.utc)

        # 1. Validate refund items
        order_items_by_id = {str(oi.id): oi for oi in order.items}
        validated: list[dict[str, Any]] = []
        total_refund_amount = Decimal("0")

        for ri in data.items:
            oi = order_items_by_id.get(str(ri.order_item_id))
            if not oi:
                raise NotFoundError("OrderItem", ri.order_item_id)
            if ri.quantity <= Decimal("0"):
                raise ValidationError(f"Refund quantity must be positive for item {ri.order_item_id}")
            if ri.quantity > oi.quantity:
                raise BusinessRuleError(
                    f"Refund quantity {ri.quantity} exceeds original quantity {oi.quantity} "
                    f"for product '{oi.product_name}'"
                )
            if ri.amount <= Decimal("0"):
                raise ValidationError(f"Refund amount must be positive for item {ri.order_item_id}")
            if ri.amount > oi.total:
                raise BusinessRuleError(
                    f"Refund amount {ri.amount} exceeds item total {oi.total} "
                    f"for product '{oi.product_name}'"
                )

            total_refund_amount += ri.amount
            validated.append({"input": ri, "order_item": oi})

        # Ensure refunded_amount + this refund does not exceed total_amount
        new_refunded_total = order.refunded_amount + total_refund_amount
        if new_refunded_total > order.total_amount:
            raise BusinessRuleError(
                f"Total refunded amount ({new_refunded_total}) would exceed "
                f"order total ({order.total_amount})"
            )

        # 2. Generate refund number
        branch_code = str(order.branch_id).replace("-", "")[:8].upper()
        refund_number = f"REF-{branch_code}-{str(data.order_id).replace('-','')[:8].upper()}-{int(now.timestamp())}"

        # 3. Determine refund type
        from app.core.constants import RefundType
        is_full = new_refunded_total >= order.total_amount
        refund_type = RefundType.FULL if is_full else RefundType.PARTIAL

        # 4. Create Refund header
        refund = Refund(
            order_id=data.order_id,
            tenant_id=tenant_id,
            refund_number=refund_number,
            reason=data.reason,
            refund_type=refund_type,
            amount=total_refund_amount,
            notes=data.notes,
            processed_by=actor_user_id,
            processed_at=now,
        )
        self.session.add(refund)
        await self.session.flush()
        await self.session.refresh(refund)

        # 5. Create RefundItems + REFUND StockMovements
        for entry in validated:
            ri: RefundItemInput = entry["input"]
            oi: OrderItem = entry["order_item"]

            # REFUND stock movement restores inventory — THE ONLY WAY
            movement, _ = await self.inventory_svc.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=order.branch_id,
                product_id=oi.product_id,
                variant_id=oi.variant_id,
                movement_type=StockMovementType.REFUND,
                quantity=ri.quantity,
                actor_user_id=actor_user_id,
                reference_type="refund",
                reference_id=str(refund.id),
                unit_cost=oi.unit_cost_snapshot,
                reason=f"Refund: {refund_number} — {data.reason}",
            )

            refund_item = RefundItem(
                refund_id=refund.id,
                order_item_id=oi.id,
                product_id=oi.product_id,
                variant_id=oi.variant_id,
                quantity=ri.quantity,
                amount=ri.amount,
                stock_movement_id=movement.id,
            )
            self.session.add(refund_item)

        # 6. Update Order
        order.refunded_amount = new_refunded_total
        order.order_status = _derive_order_status_after_refund(
            order.total_amount, new_refunded_total
        )

        # Recalculate payment_status: sum all PAID payments
        from app.payments.repositories import PaymentRepository
        from app.core.constants import PaymentStatus as PS
        payment_repo = PaymentRepository(self.session)
        payments = await payment_repo.get_by_order(data.order_id)
        total_paid = sum(
            p.amount for p in payments if p.payment_status == PS.PAID
        )
        order.payment_status = _derive_payment_status_after_refund(
            order.total_amount, total_paid, new_refunded_total
        )

        await self.session.flush()
        await self.session.refresh(refund)

        # 7. Audit
        await self.audit.log(
            action=AuditAction.REFUND_CREATED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=order.branch_id,
            entity_type=EntityType.REFUND,
            entity_id=refund.id,
            after_state={
                "refund_number": refund_number,
                "amount": str(total_refund_amount),
                "reason": data.reason,
                "order_id": str(data.order_id),
                "items_count": len(data.items),
            },
            request_id=request_id,
        )

        # 8. Publish event
        await self.publisher.publish(DomainEvent(
            event_type=EventType.REFUND_CREATED,
            payload={
                "refund_id": str(refund.id),
                "refund_number": refund_number,
                "order_id": str(data.order_id),
                "amount": str(total_refund_amount),
                "reason": data.reason,
            },
            tenant_id=tenant_id,
            actor_id=actor_user_id,
        ))

        logger.info(
            "refund.processed",
            refund_id=str(refund.id),
            order_id=str(data.order_id),
            amount=str(total_refund_amount),
        )

        return await self.refund_repo.get_with_items(refund.id)

    async def get_refund(
        self,
        refund_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Refund:
        refund = await self.refund_repo.get_with_items(refund_id)
        if not refund or refund.tenant_id != tenant_id:
            raise NotFoundError("Refund", refund_id)
        return refund

    async def list_refunds(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        order_id: uuid.UUID | None = None,
    ) -> tuple[list[Refund], int]:
        offset = (page - 1) * page_size
        return await self.refund_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            order_id=order_id,
        )
