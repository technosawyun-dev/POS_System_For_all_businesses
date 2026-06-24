from __future__ import annotations

"""
Sync Pull Service — Delta Sync Engine
Returns only records that have changed since the device's last checkpoint
(updated_at > last_synced_at).  Each entity bundle is paginated to keep
payloads small on low-bandwidth connections.

Supported entity types:
  products    — Product master (tenant-scoped)
  variants    — ProductVariant (tenant-scoped)
  inventory   — BranchInventory (branch-scoped — device's branch only)
  categories  — Category (tenant-scoped)
  branches    — Branch (tenant-scoped)
  settings    — TenantSettings / BranchSettings (tenant-scoped)
  prices      — ProductPriceHistory (tenant-scoped)
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SyncEntityType
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.devices.repositories import DeviceRepository
from app.sync.repositories import SyncCheckpointRepository
from app.sync.schemas import (
    SyncCheckpointInfo,
    SyncEntityBundle,
    SyncPullResponse,
)

logger = get_logger(__name__)

_DEFAULT_PAGE_SIZE = 200


class SyncPullService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.device_repo = DeviceRepository(session)
        self.checkpoint_repo = SyncCheckpointRepository(session)

    async def pull(
        self,
        tenant_id: uuid.UUID,
        device_id: uuid.UUID,
        entity_types: list[str],
        since_at: datetime | None = None,
        page_size: int = _DEFAULT_PAGE_SIZE,
    ) -> SyncPullResponse:
        device = await self.device_repo.get_by_id_for_tenant(device_id, tenant_id)
        if not device:
            raise NotFoundError("Device", device_id)

        branch_id = device.branch_id
        checkpoints = await self.checkpoint_repo.get_for_device(device_id)
        checkpoint_map = {cp.entity_type: cp for cp in checkpoints}

        sync_time = datetime.now(timezone.utc)
        sync_version = int(sync_time.timestamp() * 1_000_000)

        entities: dict[str, SyncEntityBundle] = {}
        new_checkpoints: dict[str, SyncCheckpointInfo] = {}

        for entity_type in entity_types:
            cp = checkpoint_map.get(entity_type)
            effective_since: datetime | None = since_at or (cp.last_synced_at if cp else None)

            items, total = await self._fetch_delta(
                entity_type=entity_type,
                tenant_id=tenant_id,
                branch_id=branch_id,
                since_at=effective_since,
                page_size=page_size,
            )

            entities[entity_type] = SyncEntityBundle(
                entity_type=entity_type,
                items=items,
                total=total,
                has_more=total > page_size,
            )

            await self.checkpoint_repo.upsert(
                device_id=device_id,
                entity_type=entity_type,
                last_synced_at=sync_time,
                last_sync_version=sync_version,
            )
            new_checkpoints[entity_type] = SyncCheckpointInfo(
                entity_type=entity_type,
                last_synced_at=sync_time,
                last_sync_version=sync_version,
            )

        # Update device heartbeat
        device.last_seen_at = sync_time
        await self.session.flush()

        logger.info(
            "sync_pull_completed",
            device_id=str(device_id),
            tenant_id=str(tenant_id),
            entity_types=entity_types,
        )

        return SyncPullResponse(
            entities=entities,
            checkpoints=new_checkpoints,
            sync_timestamp=sync_time,
        )

    # Entity fetchers

    async def _fetch_delta(
        self,
        entity_type: str,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict[str, Any]], int]:
        dispatch = {
            SyncEntityType.PRODUCTS: self._fetch_products,
            SyncEntityType.VARIANTS: self._fetch_variants,
            SyncEntityType.INVENTORY: self._fetch_inventory,
            SyncEntityType.CATEGORIES: self._fetch_categories,
            SyncEntityType.BRANCHES: self._fetch_branches,
            SyncEntityType.SETTINGS: self._fetch_settings,
            SyncEntityType.PRICES: self._fetch_prices,
        }
        fetcher = dispatch.get(entity_type)
        if fetcher is None:
            logger.warning("sync_pull_unknown_entity", entity_type=entity_type)
            return [], 0
        return await fetcher(tenant_id=tenant_id, branch_id=branch_id, since_at=since_at, page_size=page_size)

    async def _fetch_products(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict], int]:
        from app.models.product import Product
        from sqlalchemy import func

        stmt = select(Product).where(Product.tenant_id == tenant_id, Product.is_deleted.is_(False))
        count_stmt = select(func.count()).select_from(Product).where(Product.tenant_id == tenant_id, Product.is_deleted.is_(False))
        if since_at:
            stmt = stmt.where(Product.updated_at > since_at)
            count_stmt = count_stmt.where(Product.updated_at > since_at)

        total_r = await self.session.execute(count_stmt)
        total = total_r.scalar_one()

        stmt = stmt.order_by(Product.updated_at.asc()).limit(page_size)
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [self._product_to_dict(r) for r in rows], total

    async def _fetch_variants(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict], int]:
        from app.models.product import Product, ProductVariant
        from sqlalchemy import func

        stmt = (
            select(ProductVariant)
            .join(Product, ProductVariant.product_id == Product.id)
            .where(
                Product.tenant_id == tenant_id,
                Product.is_deleted.is_(False),
                ProductVariant.is_deleted.is_(False),
            )
        )
        count_stmt = (
            select(func.count())
            .select_from(ProductVariant)
            .join(Product, ProductVariant.product_id == Product.id)
            .where(
                Product.tenant_id == tenant_id,
                Product.is_deleted.is_(False),
                ProductVariant.is_deleted.is_(False),
            )
        )
        if since_at:
            stmt = stmt.where(ProductVariant.updated_at > since_at)
            count_stmt = count_stmt.where(ProductVariant.updated_at > since_at)

        total_r = await self.session.execute(count_stmt)
        total = total_r.scalar_one()

        stmt = stmt.order_by(ProductVariant.updated_at.asc()).limit(page_size)
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [r.to_dict() for r in rows], total

    async def _fetch_inventory(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict], int]:
        from app.models.inventory import BranchInventory
        from sqlalchemy import func

        stmt = select(BranchInventory).where(BranchInventory.branch_id == branch_id)
        count_stmt = (
            select(func.count())
            .select_from(BranchInventory)
            .where(BranchInventory.branch_id == branch_id)
        )
        if since_at:
            stmt = stmt.where(BranchInventory.updated_at > since_at)
            count_stmt = count_stmt.where(BranchInventory.updated_at > since_at)

        total_r = await self.session.execute(count_stmt)
        total = total_r.scalar_one()

        stmt = stmt.order_by(BranchInventory.updated_at.asc()).limit(page_size)
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [r.to_dict() for r in rows], total

    async def _fetch_categories(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict], int]:
        from app.models.product import Category
        from sqlalchemy import func

        stmt = select(Category).where(Category.tenant_id == tenant_id, Category.is_deleted.is_(False))
        count_stmt = select(func.count()).select_from(Category).where(Category.tenant_id == tenant_id, Category.is_deleted.is_(False))
        if since_at:
            stmt = stmt.where(Category.updated_at > since_at)
            count_stmt = count_stmt.where(Category.updated_at > since_at)

        total_r = await self.session.execute(count_stmt)
        total = total_r.scalar_one()

        stmt = stmt.order_by(Category.updated_at.asc()).limit(page_size)
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [r.to_dict() for r in rows], total

    async def _fetch_branches(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict], int]:
        from app.models.branch import Branch
        from sqlalchemy import func

        stmt = select(Branch).where(Branch.tenant_id == tenant_id, Branch.is_deleted.is_(False))
        count_stmt = select(func.count()).select_from(Branch).where(Branch.tenant_id == tenant_id, Branch.is_deleted.is_(False))
        if since_at:
            stmt = stmt.where(Branch.updated_at > since_at)
            count_stmt = count_stmt.where(Branch.updated_at > since_at)

        total_r = await self.session.execute(count_stmt)
        total = total_r.scalar_one()

        stmt = stmt.order_by(Branch.updated_at.asc()).limit(page_size)
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [r.to_dict() for r in rows], total

    async def _fetch_settings(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict], int]:
        from app.models.tenant import TenantSettings
        from sqlalchemy import func

        stmt = select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
        count_stmt = select(func.count()).select_from(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
        if since_at:
            stmt = stmt.where(TenantSettings.updated_at > since_at)
            count_stmt = count_stmt.where(TenantSettings.updated_at > since_at)

        total_r = await self.session.execute(count_stmt)
        total = total_r.scalar_one()

        stmt = stmt.order_by(TenantSettings.updated_at.asc()).limit(page_size)
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [r.to_dict() for r in rows], total

    async def _fetch_prices(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        since_at: datetime | None,
        page_size: int,
    ) -> tuple[list[dict], int]:
        from app.models.product import Product, ProductPriceHistory
        from sqlalchemy import func

        stmt = (
            select(ProductPriceHistory)
            .join(Product, ProductPriceHistory.product_id == Product.id)
            .where(Product.tenant_id == tenant_id)
        )
        count_stmt = (
            select(func.count())
            .select_from(ProductPriceHistory)
            .join(Product, ProductPriceHistory.product_id == Product.id)
            .where(Product.tenant_id == tenant_id)
        )
        if since_at:
            stmt = stmt.where(ProductPriceHistory.updated_at > since_at)
            count_stmt = count_stmt.where(ProductPriceHistory.updated_at > since_at)

        total_r = await self.session.execute(count_stmt)
        total = total_r.scalar_one()

        stmt = stmt.order_by(ProductPriceHistory.updated_at.asc()).limit(page_size)
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        return [r.to_dict() for r in rows], total

    # Serialisation helpers

    @staticmethod
    def _product_to_dict(p: Any) -> dict:
        d = p.to_dict()
        # Include is_deleted flag so clients can tombstone soft-deleted records
        d.setdefault("is_deleted", getattr(p, "is_deleted", False))
        return d
