from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import (
    BranchInventory,
    InventoryAdjustment,
    InventoryAdjustmentItem,
    InventoryTransfer,
    InventoryTransferItem,
    StockMovement,
)
from app.repositories.base import BaseRepository


class BranchInventoryRepository(BaseRepository[BranchInventory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(BranchInventory, session)

    async def get_or_create_locked(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        product_id: uuid.UUID,
        variant_id: uuid.UUID | None,
    ) -> BranchInventory:
        """
        Ensures a branch_inventory row exists, then acquires a row-level lock (SELECT FOR UPDATE).
        This is the only correct entry point for any stock mutation.
        """
        # Upsert to ensure the row exists — on conflict, does nothing (idempotent)
        await self.session.execute(
            pg_insert(BranchInventory)
            .values(
                tenant_id=tenant_id,
                branch_id=branch_id,
                product_id=product_id,
                variant_id=variant_id,
                quantity_on_hand=Decimal("0"),
                quantity_reserved=Decimal("0"),
                sync_version=0,
            )
            .on_conflict_do_nothing()
        )
        await self.session.flush()

        # Now lock the row for the duration of this transaction
        variant_filter = (
            BranchInventory.variant_id == variant_id
            if variant_id is not None
            else BranchInventory.variant_id.is_(None)
        )
        stmt = (
            select(BranchInventory)
            .where(
                BranchInventory.tenant_id == tenant_id,
                BranchInventory.branch_id == branch_id,
                BranchInventory.product_id == product_id,
                variant_filter,
            )
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_by_branch(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[BranchInventory], int]:
        filters = [
            BranchInventory.branch_id == branch_id,
            BranchInventory.tenant_id == tenant_id,
        ]
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def get_by_branch_and_product(
        self,
        branch_id: uuid.UUID,
        product_id: uuid.UUID,
        variant_id: uuid.UUID | None = None,
    ) -> BranchInventory | None:
        stmt = select(BranchInventory).where(
            BranchInventory.branch_id == branch_id,
            BranchInventory.product_id == product_id,
            BranchInventory.variant_id == variant_id
            if variant_id is not None
            else BranchInventory.variant_id.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class StockMovementRepository(BaseRepository[StockMovement]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(StockMovement, session)

    async def get_by_branch(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        product_id: uuid.UUID | None = None,
        movement_type: str | None = None,
    ) -> tuple[list[StockMovement], int]:
        filters = [
            StockMovement.branch_id == branch_id,
            StockMovement.tenant_id == tenant_id,
        ]
        if product_id:
            filters.append(StockMovement.product_id == product_id)
        if movement_type:
            filters.append(StockMovement.movement_type == movement_type)
        return await self.get_all(
            offset=offset, limit=limit, filters=filters,
            order_by=StockMovement.created_at.desc()
        )

    async def get_by_reference(
        self,
        reference_type: str,
        reference_id: str,
        tenant_id: uuid.UUID,
    ) -> list[StockMovement]:
        stmt = select(StockMovement).where(
            StockMovement.reference_type == reference_type,
            StockMovement.reference_id == reference_id,
            StockMovement.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class InventoryAdjustmentRepository(BaseRepository[InventoryAdjustment]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(InventoryAdjustment, session)

    async def get_by_tenant_with_items(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[InventoryAdjustment], int]:
        filters = [InventoryAdjustment.tenant_id == tenant_id]
        if branch_id:
            filters.append(InventoryAdjustment.branch_id == branch_id)

        count_stmt = select(func.count()).select_from(InventoryAdjustment)
        for f in filters:
            count_stmt = count_stmt.where(f)
        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = (
            select(InventoryAdjustment)
            .options(selectinload(InventoryAdjustment.items))
            .order_by(InventoryAdjustment.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        for f in filters:
            stmt = stmt.where(f)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def get_with_items(
        self, adjustment_id: uuid.UUID
    ) -> InventoryAdjustment | None:
        stmt = (
            select(InventoryAdjustment)
            .where(InventoryAdjustment.id == adjustment_id)
            .options(selectinload(InventoryAdjustment.items))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class InventoryTransferRepository(BaseRepository[InventoryTransfer]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(InventoryTransfer, session)

    async def get_by_tenant_with_items(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        branch_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[InventoryTransfer], int]:
        filters = [InventoryTransfer.tenant_id == tenant_id]
        if branch_id:
            filters.append(
                (InventoryTransfer.from_branch_id == branch_id)
                | (InventoryTransfer.to_branch_id == branch_id)
            )
        if status:
            filters.append(InventoryTransfer.status == status)

        count_stmt = select(func.count()).select_from(InventoryTransfer)
        for f in filters:
            count_stmt = count_stmt.where(f)
        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = (
            select(InventoryTransfer)
            .options(selectinload(InventoryTransfer.items))
            .order_by(InventoryTransfer.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        for f in filters:
            stmt = stmt.where(f)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def get_with_items(
        self, transfer_id: uuid.UUID
    ) -> InventoryTransfer | None:
        stmt = (
            select(InventoryTransfer)
            .where(InventoryTransfer.id == transfer_id)
            .options(selectinload(InventoryTransfer.items))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
