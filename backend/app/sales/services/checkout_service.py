from __future__ import annotations

"""
Transactional Checkout Engine
ALL-OR-NOTHING: every checkout operation runs inside a single database
transaction. On any failure the entire transaction is rolled back, leaving
inventory, orders, payments, and receipts in a consistent state.

Flow:
  validate cashier session
  → validate items & products
  → lock BranchInventory rows (SELECT FOR UPDATE)
  → generate order number
  → create Order
  → create OrderItems (with immutable price/cost snapshots)
  → create SALE StockMovements (via InventoryService — THE ONLY way to touch stock)
  → create Payment records
  → recalculate payment_status
  → generate receipt number
  → create Receipt snapshot
  → audit log
  → publish domain events
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.cashiers.models import CashierSession
from app.cashiers.repositories import CashierSessionRepository
from app.core.constants import (
    AuditAction,
    CashierSessionStatus,
    EntityType,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    StockMovementType,
)
from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import EventPublisher
from app.events.types import EventType
from app.models.product import Product, ProductVariant
from app.payments.models import Payment
from app.payments.repositories import PaymentRepository
from app.receipts.models import Receipt
from app.receipts.repositories import ReceiptRepository
from app.repositories.product_repository import ProductRepository
from app.sales.models import Order, OrderItem
from app.sales.repositories import BranchCounterRepository, OrderRepository
from app.services.audit_service import AuditService
from app.services.inventory_service import InventoryService

logger = get_logger(__name__)


class CheckoutItemInput:
    __slots__ = (
        "product_id", "variant_id", "quantity",
        "unit_price", "discount_amount", "tax_rate", "notes",
    )

    def __init__(
        self,
        product_id: uuid.UUID,
        quantity: Decimal,
        unit_price: Decimal,
        variant_id: uuid.UUID | None = None,
        discount_amount: Decimal = Decimal("0"),
        tax_rate: Decimal = Decimal("0"),
        notes: str | None = None,
    ) -> None:
        self.product_id = product_id
        self.variant_id = variant_id
        self.quantity = quantity
        self.unit_price = unit_price
        self.discount_amount = discount_amount
        self.tax_rate = tax_rate
        self.notes = notes


class CheckoutPaymentInput:
    __slots__ = ("payment_method", "amount", "reference_number", "notes")

    def __init__(
        self,
        payment_method: str,
        amount: Decimal,
        reference_number: str | None = None,
        notes: str | None = None,
    ) -> None:
        self.payment_method = payment_method
        self.amount = amount
        self.reference_number = reference_number
        self.notes = notes


class CheckoutInput:
    __slots__ = (
        "cashier_session_id", "items", "payments",
        "customer_id", "order_discount_amount", "notes",
    )

    def __init__(
        self,
        cashier_session_id: uuid.UUID,
        items: list[CheckoutItemInput],
        payments: list[CheckoutPaymentInput],
        customer_id: uuid.UUID | None = None,
        order_discount_amount: Decimal = Decimal("0"),
        notes: str | None = None,
    ) -> None:
        self.cashier_session_id = cashier_session_id
        self.items = items
        self.payments = payments
        self.customer_id = customer_id
        self.order_discount_amount = order_discount_amount
        self.notes = notes


def _compute_order_totals(
    items: list[CheckoutItemInput],
    order_discount: Decimal,
) -> dict[str, Decimal]:
    subtotal = Decimal("0")
    item_discount_total = Decimal("0")
    tax_amount = Decimal("0")

    for item in items:
        item_subtotal = item.unit_price * item.quantity
        subtotal += item_subtotal
        item_discount_total += item.discount_amount
        # Tax computed on (item_subtotal - item_discount) before order discount
        taxable = item_subtotal - item.discount_amount
        tax_amount += taxable * item.tax_rate

    # The order-level discount reduces the tax base proportionally across items.
    # Without this, the backend charges tax on the order discount itself, causing
    # a mismatch with the frontend (which applies order discount before tax).
    # e.g. 100 Ks order discount at 10% tax → 10 Ks overcharge on every order.
    item_taxable_total = subtotal - item_discount_total
    if item_taxable_total > Decimal("0") and order_discount > Decimal("0"):
        effective_disc = min(order_discount, item_taxable_total)
        # Scale tax down proportionally (works for both uniform and mixed rates)
        tax_amount = tax_amount * (item_taxable_total - effective_disc) / item_taxable_total

    total_discount = item_discount_total + order_discount
    total_amount = subtotal - total_discount + tax_amount
    if total_amount < Decimal("0"):
        total_amount = Decimal("0")

    return {
        "subtotal": subtotal.quantize(Decimal("0.0001")),
        "tax_amount": tax_amount.quantize(Decimal("0.0001")),
        "discount_amount": total_discount.quantize(Decimal("0.0001")),
        "total_amount": total_amount.quantize(Decimal("0.0001")),
    }


def _derive_payment_status(total_amount: Decimal, amount_paid: Decimal) -> str:
    if amount_paid >= total_amount:
        return PaymentStatus.PAID
    elif amount_paid > Decimal("0"):
        return PaymentStatus.PARTIAL
    return PaymentStatus.PENDING


class CheckoutService:
    """
    Transactional checkout engine.
    Must be called within an active database transaction (caller controls commit).
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.session_repo = CashierSessionRepository(session)
        self.counter_repo = BranchCounterRepository(session)
        self.order_repo = OrderRepository(session)
        self.payment_repo = PaymentRepository(session)
        self.receipt_repo = ReceiptRepository(session)
        self.product_repo = ProductRepository(session)
        self.inventory_svc = InventoryService(session)
        self.audit = AuditService(session)
        self.publisher = EventPublisher()

    async def checkout(
        self,
        tenant_id: uuid.UUID,
        data: CheckoutInput,
        actor_user_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Order:
        """
        ALL-OR-NOTHING checkout. Caller must wrap in a transaction.

        Returns the completed Order with items, payments, and receipt loaded.
        """
        now = datetime.now(timezone.utc)

        # 1. Validate cashier session
        cashier_session = await self.session_repo.get_by_id_and_tenant(
            data.cashier_session_id, tenant_id
        )
        if not cashier_session:
            raise NotFoundError("CashierSession", data.cashier_session_id)
        if cashier_session.status != CashierSessionStatus.OPEN:
            raise BusinessRuleError(
                "Sales require an OPEN cashier session. "
                f"Current status: '{cashier_session.status}'"
            )

        # 2. Validate input
        if not data.items:
            raise ValidationError("Order must contain at least one item")
        # On-account sales (customer_id set, no payment) are allowed — balance is tracked on ledger
        if not data.payments and not data.customer_id:
            raise ValidationError("Order must have at least one payment, or assign a customer for on-account sale")
        for pmt in data.payments:
            if pmt.amount <= Decimal("0"):
                raise ValidationError("Payment amount must be positive")

        branch_id = cashier_session.branch_id

        # 3. Load & validate products (also lock branch inventory rows)
        enriched_items = await self._validate_and_load_items(
            tenant_id=tenant_id,
            branch_id=branch_id,
            items=data.items,
        )

        # 4. Compute order totals
        totals = _compute_order_totals(data.items, data.order_discount_amount)
        total_amount = totals["total_amount"]
        amount_paid = sum((p.amount for p in data.payments), Decimal("0")).quantize(Decimal("0.0001"))

        # 5. Generate order number (uses locked counter row)
        branch_code = str(branch_id).replace("-", "")[:8].upper()
        order_number = await self.counter_repo.next_order_number(branch_id, branch_code)

        # 6. Create Order
        order = Order(
            tenant_id=tenant_id,
            branch_id=branch_id,
            cashier_session_id=data.cashier_session_id,
            customer_id=data.customer_id,
            order_number=order_number,
            order_status=OrderStatus.COMPLETED,
            payment_status=_derive_payment_status(total_amount, amount_paid),
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            discount_amount=totals["discount_amount"],
            total_amount=total_amount,
            refunded_amount=Decimal("0"),
            notes=data.notes,
            completed_at=now,
            created_by=actor_user_id,
        )
        self.session.add(order)
        await self.session.flush()
        await self.session.refresh(order)

        # 7. Create OrderItems + SALE StockMovements
        order_items = await self._create_order_items_and_movements(
            order=order,
            enriched_items=enriched_items,
            tenant_id=tenant_id,
            branch_id=branch_id,
            actor_user_id=actor_user_id,
            now=now,
        )

        # 8. Create Payment records
        payments = await self._create_payments(
            order=order,
            payment_inputs=data.payments,
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            now=now,
        )

        # 8b. Update customer ledger for on-account / partial / full sales
        if data.customer_id and total_amount > Decimal("0"):
            from app.customers.services import CustomerService
            from app.customers.schemas import RecordPaymentRequest as CustPaymentRequest
            customer_svc = CustomerService(self.session)
            await customer_svc.create_sale_debt(
                customer_id=data.customer_id,
                tenant_id=tenant_id,
                amount=total_amount,
                actor_id=actor_user_id,
                order_id=str(order.id),
            )
            if amount_paid > Decimal("0"):
                pmt_label = ", ".join(p.payment_method for p in data.payments)
                await customer_svc.record_payment(
                    customer_id=data.customer_id,
                    tenant_id=tenant_id,
                    data=CustPaymentRequest(
                        amount=amount_paid,
                        note=f"Payment for Order #{order_number} ({pmt_label})",
                        reference_type="ORDER",
                        reference_id=str(order.id),
                    ),
                    actor_id=actor_user_id,
                )

        # 9. Create Receipt
        receipt = await self._create_receipt(
            order=order,
            order_items=order_items,
            payments=payments,
            cashier_session=cashier_session,
            amount_paid=amount_paid,
            total_amount=total_amount,
            branch_id=branch_id,
            tenant_id=tenant_id,
            now=now,
        )

        await self.session.flush()

        # 10. Audit
        await self.audit.log(
            action=AuditAction.ORDER_CREATED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=EntityType.ORDER,
            entity_id=order.id,
            after_state={
                "order_number": order_number,
                "total_amount": str(total_amount),
                "payment_status": order.payment_status,
                "items_count": len(order_items),
            },
            request_id=request_id,
        )

        # 11. Publish events
        await self.publisher.publish(DomainEvent(
            event_type=EventType.ORDER_CREATED,
            payload={
                "order_id": str(order.id),
                "order_number": order_number,
                "branch_id": str(branch_id),
                "total_amount": str(total_amount),
                "payment_status": order.payment_status,
            },
            tenant_id=tenant_id,
            actor_id=actor_user_id,
        ))
        await self.publisher.publish(DomainEvent(
            event_type=EventType.ORDER_COMPLETED,
            payload={"order_id": str(order.id), "order_number": order_number},
            tenant_id=tenant_id,
            actor_id=actor_user_id,
        ))
        for pmt in payments:
            await self.publisher.publish(DomainEvent(
                event_type=EventType.PAYMENT_RECEIVED,
                payload={
                    "order_id": str(order.id),
                    "payment_id": str(pmt.id),
                    "method": pmt.payment_method,
                    "amount": str(pmt.amount),
                },
                tenant_id=tenant_id,
                actor_id=actor_user_id,
            ))

        logger.info(
            "checkout.completed",
            order_id=str(order.id),
            order_number=order_number,
            total=str(total_amount),
            items=len(order_items),
        )

        # Return order with related data loaded
        await self.session.refresh(order, attribute_names=["items", "payments", "refunds"])
        return order

    # Private helpers

    async def _validate_and_load_items(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        items: list[CheckoutItemInput],
    ) -> list[dict[str, Any]]:
        """
        Load product/variant data and acquire inventory row locks.
        Raises BusinessRuleError if any item has insufficient stock.
        Sorts by product_id for consistent lock ordering (deadlock prevention).
        """
        # Deduplicate and sort items by product_id for consistent lock ordering
        sorted_items = sorted(items, key=lambda i: (str(i.product_id), str(i.variant_id or "")))
        enriched: list[dict[str, Any]] = []

        for item in sorted_items:
            product = await self.product_repo.get_active_by_id_and_tenant(
                item.product_id, tenant_id
            )
            if not product:
                raise NotFoundError("Product", item.product_id)

            variant: ProductVariant | None = None
            if item.variant_id:
                from sqlalchemy import select as sa_select
                result = await self.session.execute(
                    sa_select(ProductVariant).where(
                        ProductVariant.id == item.variant_id,
                        ProductVariant.product_id == item.product_id,
                    )
                )
                variant = result.scalar_one_or_none()
                if not variant:
                    raise NotFoundError("ProductVariant", item.variant_id)

            # Acquire inventory lock (same as create_stock_movement will do later,
            # but we want to do stock validation here before committing anything)
            inv = await self.inventory_svc.inv_repo.get_or_create_locked(
                tenant_id=tenant_id,
                branch_id=branch_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
            )

            available = inv.quantity_on_hand - inv.quantity_reserved
            if available < item.quantity:
                raise BusinessRuleError(
                    f"Insufficient stock for '{product.name}'. "
                    f"Available: {available}, Requested: {item.quantity}",
                    details={
                        "product_id": str(item.product_id),
                        "available": str(available),
                        "requested": str(item.quantity),
                    },
                )

            enriched.append({
                "item": item,
                "product": product,
                "variant": variant,
                "unit_cost_snapshot": product.cost_price,
            })

        return enriched

    async def _create_order_items_and_movements(
        self,
        order: Order,
        enriched_items: list[dict[str, Any]],
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        now: datetime,
    ) -> list[OrderItem]:
        order_items: list[OrderItem] = []

        for entry in enriched_items:
            item: CheckoutItemInput = entry["item"]
            product: Product = entry["product"]
            variant: ProductVariant | None = entry["variant"]

            item_subtotal = (item.unit_price * item.quantity).quantize(Decimal("0.0001"))
            taxable_amount = item_subtotal - item.discount_amount
            item_tax = (taxable_amount * item.tax_rate).quantize(Decimal("0.0001"))
            item_total = (taxable_amount + item_tax).quantize(Decimal("0.0001"))

            order_item = OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                product_name=product.name,
                variant_name=variant.name if variant else None,
                sku=variant.sku if variant else product.sku,
                quantity=item.quantity,
                unit_price=item.unit_price,
                unit_cost_snapshot=entry["unit_cost_snapshot"],
                tax_rate=item.tax_rate,
                discount_amount=item.discount_amount,
                subtotal=item_subtotal,
                total=item_total,
            )
            self.session.add(order_item)
            order_items.append(order_item)

            # SALE stock movement — the ONLY way to deduct inventory
            _, inv_after = await self.inventory_svc.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=branch_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                movement_type=StockMovementType.SALE,
                quantity=item.quantity,
                actor_user_id=actor_user_id,
                reference_type="order",
                reference_id=str(order.id),
                unit_cost=entry["unit_cost_snapshot"],
                reason=f"Sale: {order.order_number}",
            )

            # Fire low stock alert if stock just hit or crossed the reorder point
            if (
                inv_after.reorder_point is not None
                and inv_after.quantity_on_hand <= inv_after.reorder_point
            ):
                await self.publisher.publish(
                    DomainEvent(
                        event_type=EventType.LOW_STOCK,
                        tenant_id=tenant_id,
                        payload={
                            "product_id":    str(product.id),
                            "product_name":  product.name,
                            "sku":           product.sku or "",
                            "current_stock": float(inv_after.quantity_on_hand),
                            "reorder_level": float(inv_after.reorder_point),
                            "branch_id":     str(branch_id),
                        },
                    )
                )

        await self.session.flush()
        return order_items

    async def _create_payments(
        self,
        order: Order,
        payment_inputs: list[CheckoutPaymentInput],
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        now: datetime,
    ) -> list[Payment]:
        payments: list[Payment] = []
        for pmt_input in payment_inputs:
            payment = Payment(
                order_id=order.id,
                tenant_id=tenant_id,
                payment_method=pmt_input.payment_method,
                amount=pmt_input.amount,
                payment_status=PaymentStatus.PAID,
                reference_number=pmt_input.reference_number,
                notes=pmt_input.notes,
                paid_at=now,
                processed_by=actor_user_id,
            )
            self.session.add(payment)
            payments.append(payment)

        await self.session.flush()
        return payments

    async def _create_receipt(
        self,
        order: Order,
        order_items: list[OrderItem],
        payments: list[Payment],
        cashier_session: CashierSession,
        amount_paid: Decimal,
        total_amount: Decimal,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        now: datetime,
    ) -> Receipt:
        branch_code = str(branch_id).replace("-", "")[:8].upper()
        receipt_number = await self.counter_repo.next_receipt_number(branch_id, branch_code)

        change_amount = max(amount_paid - total_amount, Decimal("0")).quantize(Decimal("0.0001"))

        # Fetch branch/tenant names for denormalized snapshot
        from app.models.branch import Branch
        from app.models.tenant import Tenant
        from app.models.user import User
        from sqlalchemy import select as sa_select

        branch_result = await self.session.execute(
            sa_select(Branch).where(Branch.id == branch_id)
        )
        branch = branch_result.scalar_one_or_none()

        tenant_result = await self.session.execute(
            sa_select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()

        cashier_result = await self.session.execute(
            sa_select(User).where(User.id == cashier_session.cashier_user_id)
        )
        cashier = cashier_result.scalar_one_or_none()

        items_snapshot = [
            {
                "product_name": oi.product_name,
                "variant_name": oi.variant_name,
                "sku": oi.sku,
                "quantity": str(oi.quantity),
                "unit_price": str(oi.unit_price),
                "discount_amount": str(oi.discount_amount),
                "tax_rate": str(oi.tax_rate),
                "subtotal": str(oi.subtotal),
                "total": str(oi.total),
            }
            for oi in order_items
        ]

        payment_methods_snapshot = [
            {
                "method": p.payment_method,
                "amount": str(p.amount),
                "reference_number": p.reference_number,
                "notes": p.notes,
            }
            for p in payments
        ]

        receipt = Receipt(
            order_id=order.id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            receipt_number=receipt_number,
            subtotal=order.subtotal,
            tax_amount=order.tax_amount,
            discount_amount=order.discount_amount,
            total_amount=total_amount,
            amount_paid=amount_paid,
            change_amount=change_amount,
            cashier_name=f"{cashier.first_name} {cashier.last_name}" if cashier else "Unknown",
            branch_name=branch.name if branch else "Unknown",
            tenant_name=tenant.name if tenant else "Unknown",
            payment_methods=payment_methods_snapshot,
            items_snapshot=items_snapshot,
            issued_at=now,
        )
        self.session.add(receipt)
        await self.session.flush()
        return receipt

    async def void_order(
        self,
        order_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        reason: str,
        request_id: str | None = None,
    ) -> Order:
        """
        Void a COMPLETED order. Creates REFUND stock movements for all items.
        Can only void orders that have no existing refunds.
        """
        order = await self.order_repo.get_with_details(order_id)
        if not order or order.tenant_id != tenant_id:
            raise NotFoundError("Order", order_id)

        if order.order_status not in {OrderStatus.COMPLETED, OrderStatus.PENDING}:
            raise BusinessRuleError(
                f"Order cannot be voided in status '{order.order_status}'"
            )
        if order.refunds:
            raise BusinessRuleError(
                "Cannot void an order with existing refunds. Process a refund instead."
            )

        now = datetime.now(timezone.utc)

        # Restore inventory: create REFUND movements for each item
        for item in order.items:
            await self.inventory_svc.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=order.branch_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                movement_type=StockMovementType.REFUND,
                quantity=item.quantity,
                actor_user_id=actor_user_id,
                reference_type="order_void",
                reference_id=str(order.id),
                unit_cost=item.unit_cost_snapshot,
                reason=f"Void: {order.order_number} — {reason}",
            )

        order.order_status = OrderStatus.VOIDED
        order.voided_at = now
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.ORDER_VOIDED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=order.branch_id,
            entity_type=EntityType.ORDER,
            entity_id=order_id,
            before_state={"order_status": OrderStatus.COMPLETED},
            after_state={"order_status": OrderStatus.VOIDED, "reason": reason},
            request_id=request_id,
        )

        await self.publisher.publish(DomainEvent(
            event_type=EventType.ORDER_VOIDED,
            payload={
                "order_id": str(order_id),
                "order_number": order.order_number,
                "reason": reason,
            },
            tenant_id=tenant_id,
            actor_id=actor_user_id,
        ))

        await self.session.refresh(order, attribute_names=["items", "payments", "refunds"])
        return order
