from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.procurement.models import (
    GRCounter,
    GoodsReceipt,
    GoodsReceiptItem,
    POCounter,
    PurchaseOrder,
    PurchaseOrderItem,
    SupplierPayable,
    SupplierPayment,
)
from app.repositories.base import BaseRepository



class POCounterRepository(BaseRepository[POCounter]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(POCounter, session)

    async def get_or_create_locked(self, tenant_id: uuid.UUID) -> POCounter:
        stmt = (
            select(POCounter)
            .where(POCounter.tenant_id == tenant_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        counter = result.scalar_one_or_none()
        if counter is None:
            counter = POCounter(tenant_id=tenant_id, last_seq=0)
            self.session.add(counter)
            await self.session.flush()
        return counter

    async def increment(self, counter: POCounter) -> int:
        counter.last_seq += 1
        await self.session.flush()
        return counter.last_seq


class GRCounterRepository(BaseRepository[GRCounter]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(GRCounter, session)

    async def get_or_create_locked(self, tenant_id: uuid.UUID) -> GRCounter:
        stmt = (
            select(GRCounter)
            .where(GRCounter.tenant_id == tenant_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        counter = result.scalar_one_or_none()
        if counter is None:
            counter = GRCounter(tenant_id=tenant_id, last_seq=0)
            self.session.add(counter)
            await self.session.flush()
        return counter

    async def increment(self, counter: GRCounter) -> int:
        counter.last_seq += 1
        await self.session.flush()
        return counter.last_seq



class PurchaseOrderRepository(BaseRepository[PurchaseOrder]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(PurchaseOrder, session)

    async def get_with_items(self, po_id: uuid.UUID) -> PurchaseOrder | None:
        stmt = (
            select(PurchaseOrder)
            .where(PurchaseOrder.id == po_id, PurchaseOrder.deleted_at.is_(None))
            .options(selectinload(PurchaseOrder.items), selectinload(PurchaseOrder.payable))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant_and_id(
        self, po_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> PurchaseOrder | None:
        stmt = (
            select(PurchaseOrder)
            .where(
                PurchaseOrder.id == po_id,
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.deleted_at.is_(None),
            )
            .options(selectinload(PurchaseOrder.items), selectinload(PurchaseOrder.payable))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        branch_id: uuid.UUID | None = None,
        supplier_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[PurchaseOrder], int]:
        filters = [
            PurchaseOrder.tenant_id == tenant_id,
            PurchaseOrder.deleted_at.is_(None),
        ]
        if branch_id:
            filters.append(PurchaseOrder.branch_id == branch_id)
        if supplier_id:
            filters.append(PurchaseOrder.supplier_id == supplier_id)
        if status:
            filters.append(PurchaseOrder.status == status)
        return await self.get_all(offset=offset, limit=limit, filters=filters)



class GoodsReceiptRepository(BaseRepository[GoodsReceipt]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(GoodsReceipt, session)

    async def get_with_items(self, receipt_id: uuid.UUID) -> GoodsReceipt | None:
        stmt = (
            select(GoodsReceipt)
            .where(GoodsReceipt.id == receipt_id)
            .options(selectinload(GoodsReceipt.items))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant_and_id(
        self, receipt_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> GoodsReceipt | None:
        stmt = (
            select(GoodsReceipt)
            .where(
                GoodsReceipt.id == receipt_id,
                GoodsReceipt.tenant_id == tenant_id,
            )
            .options(selectinload(GoodsReceipt.items))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        purchase_order_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[GoodsReceipt], int]:
        filters = [GoodsReceipt.tenant_id == tenant_id]
        if purchase_order_id:
            filters.append(GoodsReceipt.purchase_order_id == purchase_order_id)
        if branch_id:
            filters.append(GoodsReceipt.branch_id == branch_id)
        return await self.get_all(offset=offset, limit=limit, filters=filters)



class SupplierPayableRepository(BaseRepository[SupplierPayable]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SupplierPayable, session)

    async def get_with_payments(self, payable_id: uuid.UUID) -> SupplierPayable | None:
        stmt = (
            select(SupplierPayable)
            .where(SupplierPayable.id == payable_id)
            .options(selectinload(SupplierPayable.payments))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant_and_id(
        self, payable_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> SupplierPayable | None:
        stmt = (
            select(SupplierPayable)
            .where(
                SupplierPayable.id == payable_id,
                SupplierPayable.tenant_id == tenant_id,
            )
            .options(selectinload(SupplierPayable.payments))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_po(self, purchase_order_id: uuid.UUID) -> SupplierPayable | None:
        stmt = select(SupplierPayable).where(
            SupplierPayable.purchase_order_id == purchase_order_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        supplier_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[SupplierPayable], int]:
        filters = [SupplierPayable.tenant_id == tenant_id]
        if supplier_id:
            filters.append(SupplierPayable.supplier_id == supplier_id)
        if status:
            filters.append(SupplierPayable.status == status)
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def get_open_by_supplier(
        self, supplier_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> list[SupplierPayable]:
        from app.core.constants import SupplierPayableStatus
        stmt = select(SupplierPayable).where(
            SupplierPayable.tenant_id == tenant_id,
            SupplierPayable.supplier_id == supplier_id,
            SupplierPayable.status.in_([SupplierPayableStatus.OPEN, SupplierPayableStatus.PARTIAL]),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_locked(self, payable_id: uuid.UUID) -> SupplierPayable | None:
        stmt = (
            select(SupplierPayable)
            .where(SupplierPayable.id == payable_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()



class PurchaseOrderItemRepository(BaseRepository[PurchaseOrderItem]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(PurchaseOrderItem, session)

    async def get_by_po(self, purchase_order_id: uuid.UUID) -> list[PurchaseOrderItem]:
        stmt = select(PurchaseOrderItem).where(
            PurchaseOrderItem.purchase_order_id == purchase_order_id
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_locked(self, item_id: uuid.UUID) -> PurchaseOrderItem | None:
        stmt = (
            select(PurchaseOrderItem)
            .where(PurchaseOrderItem.id == item_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
