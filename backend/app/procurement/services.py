from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    EntityType,
    GoodsReceiptStatus,
    PurchaseOrderStatus,
    StockMovementType,
    SupplierPayableStatus,
    SupplierPaymentStatus,
)
from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.procurement.models import (
    GoodsReceipt,
    GoodsReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
    SupplierPayable,
    SupplierPayment,
)
from app.procurement.repositories import (
    GRCounterRepository,
    GoodsReceiptRepository,
    POCounterRepository,
    PurchaseOrderItemRepository,
    PurchaseOrderRepository,
    SupplierPayableRepository,
)
from app.procurement.schemas import (
    GoodsReceiptCreate,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    SupplierPaymentCreate,
)
from app.services.audit_service import AuditService
from app.services.inventory_service import InventoryService


def _now() -> datetime:
    return datetime.now(timezone.utc)



class PurchaseOrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.po_repo = PurchaseOrderRepository(session)
        self.po_item_repo = PurchaseOrderItemRepository(session)
        self.po_counter_repo = POCounterRepository(session)
        self.payable_repo = SupplierPayableRepository(session)
        self.audit = AuditService(session)

    async def _generate_po_number(self, tenant_id: uuid.UUID) -> str:
        counter = await self.po_counter_repo.get_or_create_locked(tenant_id)
        seq = await self.po_counter_repo.increment(counter)
        return f"PO-{seq:06d}"

    async def create_po(
        self,
        tenant_id: uuid.UUID,
        data: PurchaseOrderCreate,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        po_number = await self._generate_po_number(tenant_id)

        subtotal = sum(
            (item.ordered_quantity * item.unit_cost) for item in data.items
        )
        total_amount = subtotal - data.discount_amount + data.tax_amount

        now = _now()
        po = PurchaseOrder(
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            supplier_id=data.supplier_id,
            po_number=po_number,
            status=PurchaseOrderStatus.APPROVED,
            order_date=data.order_date,
            expected_date=data.expected_date,
            subtotal=subtotal,
            discount_amount=data.discount_amount,
            tax_amount=data.tax_amount,
            total_amount=total_amount,
            notes=data.notes,
            created_by=actor_id,
            approved_by=actor_id,
            approved_at=now,
        )
        self.session.add(po)
        await self.session.flush()
        await self.session.refresh(po)

        for item_data in data.items:
            line_total = item_data.ordered_quantity * item_data.unit_cost
            item = PurchaseOrderItem(
                purchase_order_id=po.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                ordered_quantity=item_data.ordered_quantity,
                received_quantity=Decimal("0"),
                unit_cost=item_data.unit_cost,
                line_total=line_total,
            )
            self.session.add(item)

        await self.session.flush()

        # Auto-create payable so owner can pay immediately (before or after receiving)
        payable = SupplierPayable(
            tenant_id=tenant_id,
            supplier_id=data.supplier_id,
            purchase_order_id=po.id,
            total_amount=total_amount,
            paid_amount=Decimal("0"),
            remaining_amount=total_amount,
            status=SupplierPayableStatus.OPEN,
        )
        self.session.add(payable)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PURCHASE_ORDER_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            entity_type=EntityType.PURCHASE_ORDER,
            entity_id=po.id,
            after_state={
                "po_number": po_number,
                "supplier_id": str(data.supplier_id),
                "total_amount": str(total_amount),
                "items_count": len(data.items),
            },
            request_id=request_id,
        )

        return await self.po_repo.get_with_items(po.id)  # type: ignore[return-value]

    async def update_po(
        self,
        po_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: PurchaseOrderUpdate,
        actor_id: uuid.UUID,
    ) -> PurchaseOrder:
        po = await self._get_editable(po_id, tenant_id)

        if data.order_date is not None:
            po.order_date = data.order_date
        if data.expected_date is not None:
            po.expected_date = data.expected_date
        if data.notes is not None:
            po.notes = data.notes
        if data.discount_amount is not None:
            po.discount_amount = data.discount_amount
        if data.tax_amount is not None:
            po.tax_amount = data.tax_amount

        if data.items is not None:
            # Replace all items
            existing = await self.po_item_repo.get_by_po(po_id)
            for old_item in existing:
                await self.session.delete(old_item)
            await self.session.flush()

            subtotal = Decimal("0")
            for item_data in data.items:
                line_total = item_data.ordered_quantity * item_data.unit_cost
                subtotal += line_total
                new_item = PurchaseOrderItem(
                    purchase_order_id=po_id,
                    product_id=item_data.product_id,
                    variant_id=item_data.variant_id,
                    ordered_quantity=item_data.ordered_quantity,
                    received_quantity=Decimal("0"),
                    unit_cost=item_data.unit_cost,
                    line_total=line_total,
                )
                self.session.add(new_item)
            po.subtotal = subtotal
            po.total_amount = subtotal - po.discount_amount + po.tax_amount

        await self.session.flush()
        return await self.po_repo.get_with_items(po_id)  # type: ignore[return-value]

    async def submit_po(
        self,
        po_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        po = await self._get_editable(po_id, tenant_id)

        po.status = PurchaseOrderStatus.SUBMITTED
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PURCHASE_ORDER_SUBMITTED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PURCHASE_ORDER,
            entity_id=po_id,
            request_id=request_id,
        )
        return await self.po_repo.get_with_items(po_id)  # type: ignore[return-value]

    async def approve_po(
        self,
        po_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        po = await self._require_tenant(po_id, tenant_id)

        if po.status != PurchaseOrderStatus.SUBMITTED:
            raise BusinessRuleError(
                f"Purchase order must be SUBMITTED to approve. Current: '{po.status}'"
            )

        po.status = PurchaseOrderStatus.APPROVED
        po.approved_by = actor_id
        po.approved_at = _now()
        await self.session.flush()

        # Create SupplierPayable upon approval
        payable = SupplierPayable(
            tenant_id=tenant_id,
            supplier_id=po.supplier_id,
            purchase_order_id=po_id,
            total_amount=po.total_amount,
            paid_amount=Decimal("0"),
            remaining_amount=po.total_amount,
            status=SupplierPayableStatus.OPEN,
        )
        self.session.add(payable)
        await self.session.flush()
        await self.session.refresh(payable)

        await self.audit.log(
            action=AuditAction.PURCHASE_ORDER_APPROVED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PURCHASE_ORDER,
            entity_id=po_id,
            after_state={"approved_by": str(actor_id)},
            request_id=request_id,
        )
        await self.audit.log(
            action=AuditAction.PAYABLE_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER_PAYABLE,
            entity_id=payable.id,
            after_state={
                "purchase_order_id": str(po_id),
                "total_amount": str(po.total_amount),
            },
            request_id=request_id,
        )

        return await self.po_repo.get_with_items(po_id)  # type: ignore[return-value]

    async def cancel_po(
        self,
        po_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        po = await self._require_tenant(po_id, tenant_id)

        cancellable = {
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.SUBMITTED,
            PurchaseOrderStatus.APPROVED,
        }
        if po.status not in cancellable:
            raise BusinessRuleError(
                f"Cannot cancel a purchase order in status '{po.status}'. "
                "Receiving has already begun."
            )

        po.status = PurchaseOrderStatus.CANCELLED

        if po.payable and po.payable.status != SupplierPayableStatus.PAID:
            po.payable.status = SupplierPayableStatus.VOIDED

        await self.session.flush()

        await self.audit.log(
            action=AuditAction.PURCHASE_ORDER_CANCELLED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PURCHASE_ORDER,
            entity_id=po_id,
            request_id=request_id,
        )
        return await self.po_repo.get_with_items(po_id)  # type: ignore[return-value]

    async def get_po(self, po_id: uuid.UUID, tenant_id: uuid.UUID) -> PurchaseOrder:
        po = await self.po_repo.get_by_tenant_and_id(po_id, tenant_id)
        if not po:
            raise NotFoundError("PurchaseOrder", po_id)
        return po

    async def list_pos(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        branch_id: uuid.UUID | None = None,
        supplier_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[PurchaseOrder], int]:
        offset = (page - 1) * page_size
        return await self.po_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            branch_id=branch_id,
            supplier_id=supplier_id,
            status=status,
        )


    async def _require_tenant(
        self, po_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> PurchaseOrder:
        po = await self.po_repo.get_by_tenant_and_id(po_id, tenant_id)
        if not po:
            raise NotFoundError("PurchaseOrder", po_id)
        return po

    async def _get_editable(
        self, po_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> PurchaseOrder:
        po = await self._require_tenant(po_id, tenant_id)
        if po.status != PurchaseOrderStatus.DRAFT:
            raise BusinessRuleError(
                f"Purchase order can only be edited in DRAFT status. Current: '{po.status}'"
            )
        return po



class ReceivingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.po_repo = PurchaseOrderRepository(session)
        self.po_item_repo = PurchaseOrderItemRepository(session)
        self.gr_repo = GoodsReceiptRepository(session)
        self.gr_counter_repo = GRCounterRepository(session)
        self.audit = AuditService(session)
        self.inv_service = InventoryService(session)

    async def _generate_receipt_number(self, tenant_id: uuid.UUID) -> str:
        counter = await self.gr_counter_repo.get_or_create_locked(tenant_id)
        seq = await self.gr_counter_repo.increment(counter)
        return f"GR-{seq:06d}"

    async def create_goods_receipt(
        self,
        tenant_id: uuid.UUID,
        data: GoodsReceiptCreate,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> GoodsReceipt:
        # Load PO with tenant check
        po = await self.po_repo.get_by_tenant_and_id(data.purchase_order_id, tenant_id)
        if not po:
            raise NotFoundError("PurchaseOrder", data.purchase_order_id)

        receivable_statuses = {
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
        }
        if po.status not in receivable_statuses:
            raise BusinessRuleError(
                f"Cannot receive goods for PO in status '{po.status}'. "
                "PO must be APPROVED or PARTIALLY_RECEIVED."
            )

        # Validate receipt branch matches PO branch
        if data.branch_id != po.branch_id:
            raise ValidationError("Receipt branch must match the purchase order branch")

        # Build lookup: po_item_id → POItem (locked)
        po_items_by_id: dict[uuid.UUID, PurchaseOrderItem] = {}
        for item_data in data.items:
            poi = await self.po_item_repo.get_locked(item_data.purchase_order_item_id)
            if poi is None or poi.purchase_order_id != po.id:
                raise ValidationError(
                    f"Purchase order item {item_data.purchase_order_item_id} "
                    "does not belong to this purchase order"
                )
            po_items_by_id[item_data.purchase_order_item_id] = poi

        # Validate quantities before touching inventory
        for item_data in data.items:
            poi = po_items_by_id[item_data.purchase_order_item_id]
            remaining = poi.ordered_quantity - poi.received_quantity
            if item_data.received_quantity > remaining:
                raise BusinessRuleError(
                    f"Cannot receive {item_data.received_quantity} units for item "
                    f"{item_data.purchase_order_item_id}. "
                    f"Remaining quantity: {remaining}"
                )

        receipt_number = await self._generate_receipt_number(tenant_id)

        receipt = GoodsReceipt(
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            purchase_order_id=po.id,
            receipt_number=receipt_number,
            receipt_date=data.receipt_date,
            status=GoodsReceiptStatus.RECEIVED,
            notes=data.notes,
            received_by=actor_id,
        )
        self.session.add(receipt)
        await self.session.flush()
        await self.session.refresh(receipt)

        # Process each item: create receipt item + inventory movement
        for item_data in data.items:
            poi = po_items_by_id[item_data.purchase_order_item_id]
            line_total = item_data.received_quantity * item_data.unit_cost

            gr_item = GoodsReceiptItem(
                goods_receipt_id=receipt.id,
                purchase_order_item_id=poi.id,
                received_quantity=item_data.received_quantity,
                unit_cost=item_data.unit_cost,
                line_total=line_total,
            )
            self.session.add(gr_item)

            # Update received_quantity on PO item
            poi.received_quantity += item_data.received_quantity
            await self.session.flush()

            # Create inventory movement (increases stock)
            await self.inv_service.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=data.branch_id,
                product_id=poi.product_id,
                variant_id=poi.variant_id,
                movement_type=StockMovementType.PURCHASE_RECEIPT,
                quantity=item_data.received_quantity,
                actor_user_id=actor_id,
                reference_type="goods_receipt",
                reference_id=str(receipt.id),
                unit_cost=item_data.unit_cost,
                reason=f"Goods receipt {receipt_number} from PO {po.po_number}",
            )

        await self.session.flush()

        # Update PO status based on received totals
        all_items = await self.po_item_repo.get_by_po(po.id)
        fully_received = all(
            item.received_quantity >= item.ordered_quantity for item in all_items
        )
        po.status = (
            PurchaseOrderStatus.RECEIVED
            if fully_received
            else PurchaseOrderStatus.PARTIALLY_RECEIVED
        )
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.GOODS_RECEIPT_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            entity_type=EntityType.GOODS_RECEIPT,
            entity_id=receipt.id,
            after_state={
                "receipt_number": receipt_number,
                "po_number": po.po_number,
                "items_count": len(data.items),
                "po_status": po.status,
            },
            request_id=request_id,
        )

        return await self.gr_repo.get_with_items(receipt.id)  # type: ignore[return-value]

    async def get_receipt(
        self, receipt_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> GoodsReceipt:
        receipt = await self.gr_repo.get_by_tenant_and_id(receipt_id, tenant_id)
        if not receipt:
            raise NotFoundError("GoodsReceipt", receipt_id)
        return receipt

    async def list_receipts(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        purchase_order_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[GoodsReceipt], int]:
        offset = (page - 1) * page_size
        return await self.gr_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            purchase_order_id=purchase_order_id,
            branch_id=branch_id,
        )



class SupplierPayableService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.payable_repo = SupplierPayableRepository(session)
        self.audit = AuditService(session)

    async def get_payable(
        self, payable_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> SupplierPayable:
        payable = await self.payable_repo.get_by_tenant_and_id(payable_id, tenant_id)
        if not payable:
            raise NotFoundError("SupplierPayable", payable_id)
        return payable

    async def list_payables(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        supplier_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[SupplierPayable], int]:
        offset = (page - 1) * page_size
        return await self.payable_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            supplier_id=supplier_id,
            status=status,
        )

    async def record_payment(
        self,
        payable_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: SupplierPaymentCreate,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> SupplierPayment:
        payable = await self.payable_repo.get_locked(payable_id)
        if not payable or payable.tenant_id != tenant_id:
            raise NotFoundError("SupplierPayable", payable_id)

        if payable.status == SupplierPayableStatus.PAID:
            raise BusinessRuleError("This payable is already fully paid")

        if data.amount > payable.remaining_amount:
            raise BusinessRuleError(
                f"Payment amount {data.amount} exceeds remaining balance "
                f"{payable.remaining_amount}"
            )

        payment = SupplierPayment(
            tenant_id=tenant_id,
            supplier_id=payable.supplier_id,
            supplier_payable_id=payable_id,
            payment_method=data.payment_method,
            reference_number=data.reference_number,
            amount=data.amount,
            payment_date=data.payment_date,
            status=SupplierPaymentStatus.CONFIRMED,
            notes=data.notes,
            recorded_by=actor_id,
        )
        self.session.add(payment)

        payable.paid_amount += data.amount
        payable.remaining_amount -= data.amount

        if payable.remaining_amount <= Decimal("0"):
            payable.remaining_amount = Decimal("0")
            payable.status = SupplierPayableStatus.PAID
        else:
            payable.status = SupplierPayableStatus.PARTIAL

        await self.session.flush()
        await self.session.refresh(payment)

        await self.audit.log(
            action=AuditAction.SUPPLIER_PAYMENT_RECORDED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER_PAYMENT,
            entity_id=payment.id,
            after_state={
                "payable_id": str(payable_id),
                "amount": str(data.amount),
                "payment_method": data.payment_method,
                "payable_status": payable.status,
            },
            request_id=request_id,
        )

        return payment

    async def supplier_balance(
        self, supplier_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> dict[str, Any]:
        from app.models.supplier import Supplier
        from sqlalchemy import select as _select

        # Validate supplier exists and belongs to tenant
        stmt = _select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == tenant_id,
            Supplier.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        supplier = result.scalar_one_or_none()
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)

        open_payables = await self.payable_repo.get_open_by_supplier(supplier_id, tenant_id)

        total_payable = sum(p.total_amount for p in open_payables)
        total_paid = sum(p.paid_amount for p in open_payables)
        outstanding = sum(p.remaining_amount for p in open_payables)
        open_count = sum(1 for p in open_payables if p.status == SupplierPayableStatus.OPEN)
        partial_count = sum(
            1 for p in open_payables if p.status == SupplierPayableStatus.PARTIAL
        )

        return {
            "supplier_id": supplier_id,
            "tenant_id": tenant_id,
            "total_payable": total_payable,
            "total_paid": total_paid,
            "outstanding_balance": outstanding,
            "open_count": open_count,
            "partial_count": partial_count,
        }
