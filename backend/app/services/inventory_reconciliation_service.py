from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import STOCK_INBOUND_TYPES, STOCK_OUTBOUND_TYPES
from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.events.types import EventType
from app.models.inventory import BranchInventory, StockMovement

logger = get_logger(__name__)

_TOLERANCE = Decimal("0.0001")


@dataclass
class InventoryDiscrepancy:
    branch_inventory_id: uuid.UUID
    branch_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    recorded_quantity: Decimal
    calculated_quantity: Decimal
    discrepancy: Decimal  # recorded − calculated (positive = overcount)

    @property
    def is_significant(self) -> bool:
        return abs(self.discrepancy) > _TOLERANCE


@dataclass
class ReconciliationReport:
    tenant_id: uuid.UUID
    branch_id: uuid.UUID | None
    checked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    total_positions_checked: int = 0
    discrepancies: list[InventoryDiscrepancy] = field(default_factory=list)

    @property
    def has_discrepancies(self) -> bool:
        return bool(self.discrepancies)

    @property
    def discrepancy_count(self) -> int:
        return len(self.discrepancies)

    def summary(self) -> dict:
        return {
            "tenant_id": str(self.tenant_id),
            "branch_id": str(self.branch_id) if self.branch_id else None,
            "checked_at": self.checked_at.isoformat(),
            "total_positions_checked": self.total_positions_checked,
            "discrepancy_count": self.discrepancy_count,
            "discrepancies": [
                {
                    "branch_inventory_id": str(d.branch_inventory_id),
                    "branch_id": str(d.branch_id),
                    "product_id": str(d.product_id),
                    "variant_id": str(d.variant_id) if d.variant_id else None,
                    "recorded": str(d.recorded_quantity),
                    "calculated": str(d.calculated_quantity),
                    "discrepancy": str(d.discrepancy),
                }
                for d in self.discrepancies
            ],
        }


class InventoryReconciliationService:
    """
    Verifies that BranchInventory.quantity_on_hand matches the sum of all
    StockMovements (the immutable ledger).

    Usage:
        service = InventoryReconciliationService(session)
        report = await service.reconcile(tenant_id=tid)
        if report.has_discrepancies:
            # alert, log, or queue correction task
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def recalculate_from_ledger(
        self,
        *,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        product_id: uuid.UUID,
        variant_id: uuid.UUID | None,
    ) -> Decimal:
        """
        Sum all stock movements for this position to derive the true quantity.
        This is the authoritative calculation — the materialized view must match.
        """
        stmt = select(StockMovement).where(
            StockMovement.tenant_id == tenant_id,
            StockMovement.branch_id == branch_id,
            StockMovement.product_id == product_id,
        )
        if variant_id is not None:
            stmt = stmt.where(StockMovement.variant_id == variant_id)
        else:
            stmt = stmt.where(StockMovement.variant_id.is_(None))

        result = await self.session.execute(stmt)
        movements = result.scalars().all()

        total = Decimal("0")
        for m in movements:
            if m.movement_type in STOCK_INBOUND_TYPES:
                total += m.quantity
            elif m.movement_type in STOCK_OUTBOUND_TYPES:
                total -= m.quantity

        return total

    async def reconcile(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
    ) -> ReconciliationReport:
        """
        Run a full reconciliation pass for the tenant (optionally scoped to one branch).

        Returns a ReconciliationReport with all detected discrepancies.
        Fires INVENTORY_DISCREPANCY_DETECTED domain event if problems are found.
        """
        stmt = select(BranchInventory).where(
            BranchInventory.tenant_id == tenant_id
        )
        if branch_id:
            stmt = stmt.where(BranchInventory.branch_id == branch_id)

        result = await self.session.execute(stmt)
        inventories = result.scalars().all()

        report = ReconciliationReport(
            tenant_id=tenant_id,
            branch_id=branch_id,
            total_positions_checked=len(inventories),
        )

        for inv in inventories:
            calculated = await self.recalculate_from_ledger(
                tenant_id=tenant_id,
                branch_id=inv.branch_id,
                product_id=inv.product_id,
                variant_id=inv.variant_id,
            )
            discrepancy = inv.quantity_on_hand - calculated

            if abs(discrepancy) > _TOLERANCE:
                report.discrepancies.append(
                    InventoryDiscrepancy(
                        branch_inventory_id=inv.id,
                        branch_id=inv.branch_id,
                        product_id=inv.product_id,
                        variant_id=inv.variant_id,
                        recorded_quantity=inv.quantity_on_hand,
                        calculated_quantity=calculated,
                        discrepancy=discrepancy,
                    )
                )

        if report.has_discrepancies:
            logger.warning(
                "inventory_reconciliation_discrepancies",
                tenant_id=str(tenant_id),
                branch_id=str(branch_id) if branch_id else None,
                discrepancy_count=report.discrepancy_count,
                total_checked=report.total_positions_checked,
            )
            await event_publisher.publish(
                DomainEvent(
                    event_type=EventType.INVENTORY_DISCREPANCY_DETECTED,
                    tenant_id=tenant_id,
                    payload={
                        "count": report.discrepancy_count,
                        "total_checked": report.total_positions_checked,
                        "branch_id": str(branch_id) if branch_id else None,
                    },
                )
            )
        else:
            logger.info(
                "inventory_reconciliation_clean",
                tenant_id=str(tenant_id),
                branch_id=str(branch_id) if branch_id else None,
                total_checked=report.total_positions_checked,
            )
            await event_publisher.publish(
                DomainEvent(
                    event_type=EventType.INVENTORY_RECONCILED,
                    tenant_id=tenant_id,
                    payload={"total_checked": report.total_positions_checked},
                )
            )

        return report

    async def get_position_summary(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
    ) -> dict:
        """Return aggregate inventory position stats for monitoring."""
        stmt = select(
            func.count(BranchInventory.id).label("total_positions"),
            func.sum(BranchInventory.quantity_on_hand).label("total_qty"),
            func.count(BranchInventory.id).filter(
                BranchInventory.quantity_on_hand < 0
            ).label("negative_positions"),
        ).where(BranchInventory.tenant_id == tenant_id)

        if branch_id:
            stmt = stmt.where(BranchInventory.branch_id == branch_id)

        result = await self.session.execute(stmt)
        row = result.one()

        return {
            "total_positions": row.total_positions or 0,
            "total_quantity_on_hand": str(row.total_qty or Decimal("0")),
            "negative_stock_positions": row.negative_positions or 0,
        }
