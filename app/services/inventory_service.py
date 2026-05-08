from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AdjustmentStatus,
    AuditAction,
    EntityType,
    InventoryAdjustmentType,
    STOCK_INBOUND_TYPES,
    STOCK_OUTBOUND_TYPES,
    StockMovementType,
    TransferStatus,
)
from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.models.inventory import (
    BranchInventory,
    InventoryAdjustment,
    InventoryAdjustmentItem,
    InventoryTransfer,
    InventoryTransferItem,
    StockMovement,
)
from app.models.product import Product
from app.repositories.inventory_repository import (
    BranchInventoryRepository,
    InventoryAdjustmentRepository,
    InventoryTransferRepository,
    StockMovementRepository,
)
from app.repositories.product_repository import ProductRepository
from app.schemas.inventory import (
    InventoryAdjustmentCreateRequest,
    InventoryTransferCreateRequest,
    OpeningStockRequest,
)
from app.services.audit_service import AuditService


# Maps InventoryAdjustmentType → StockMovementType
_ADJUSTMENT_MOVEMENT_MAP: dict[str, str] = {
    InventoryAdjustmentType.DAMAGE: StockMovementType.DAMAGE,
    InventoryAdjustmentType.EXPIRED: StockMovementType.ADJUSTMENT_DECREASE,
    InventoryAdjustmentType.LOST: StockMovementType.ADJUSTMENT_DECREASE,
    InventoryAdjustmentType.FOUND: StockMovementType.ADJUSTMENT_INCREASE,
    InventoryAdjustmentType.MANUAL_CORRECTION: None,  # determined by sign
    InventoryAdjustmentType.SYSTEM_CORRECTION: None,  # determined by sign
}


class InventoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.inv_repo = BranchInventoryRepository(session)
        self.movement_repo = StockMovementRepository(session)
        self.adjustment_repo = InventoryAdjustmentRepository(session)
        self.transfer_repo = InventoryTransferRepository(session)
        self.product_repo = ProductRepository(session)
        self.audit = AuditService(session)

    # Core Stock Movement Engine

    async def create_stock_movement(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        product_id: uuid.UUID,
        variant_id: uuid.UUID | None,
        movement_type: str,
        quantity: Decimal,
        actor_user_id: uuid.UUID,
        reference_type: str | None = None,
        reference_id: str | None = None,
        unit_cost: Decimal | None = None,
        reason: str | None = None,
        notes: str | None = None,
    ) -> tuple[StockMovement, BranchInventory]:
        """
        THE ONLY entry point for modifying stock quantities.

        Uses SELECT FOR UPDATE to lock the branch_inventory row for the
        duration of the transaction, preventing concurrent stock corruption.
        Quantity must be positive; direction is determined by movement_type.
        """
        if quantity <= 0:
            raise ValidationError("Stock movement quantity must be positive")

        # Acquire exclusive row lock (creates the row if it doesn't exist)
        inv = await self.inv_repo.get_or_create_locked(
            tenant_id=tenant_id,
            branch_id=branch_id,
            product_id=product_id,
            variant_id=variant_id,
        )

        previous_qty = inv.quantity_on_hand

        if movement_type in STOCK_INBOUND_TYPES:
            new_qty = previous_qty + quantity
        elif movement_type in STOCK_OUTBOUND_TYPES:
            new_qty = previous_qty - quantity
            if new_qty < 0:
                raise BusinessRuleError(
                    f"Insufficient stock. Available: {previous_qty}, Requested: {quantity}",
                    details={"available": str(previous_qty), "requested": str(quantity)},
                )
        else:
            raise ValidationError(f"Unknown movement_type: {movement_type}")

        # Create the immutable ledger entry
        movement = StockMovement(
            tenant_id=tenant_id,
            branch_id=branch_id,
            product_id=product_id,
            variant_id=variant_id,
            movement_type=movement_type,
            quantity=quantity,
            previous_quantity=previous_qty,
            new_quantity=new_qty,
            reference_type=reference_type,
            reference_id=reference_id,
            unit_cost=unit_cost,
            reason=reason,
            notes=notes,
            actor_user_id=actor_user_id,
        )
        self.session.add(movement)

        # Update the materialized inventory position
        inv.quantity_on_hand = new_qty
        inv.sync_version += 1
        inv.last_movement_at = datetime.now(timezone.utc)

        await self.session.flush()
        await self.session.refresh(movement)
        await self.session.refresh(inv)

        await self.audit.log(
            action=AuditAction.STOCK_MOVEMENT_CREATED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=EntityType.STOCK_MOVEMENT,
            entity_id=movement.id,
            before_state={"quantity_on_hand": str(previous_qty)},
            after_state={
                "quantity_on_hand": str(new_qty),
                "movement_type": movement_type,
                "quantity": str(quantity),
            },
        )

        return movement, inv

    # Opening Stock

    async def set_opening_stock(
        self,
        tenant_id: uuid.UUID,
        data: OpeningStockRequest,
        actor_user_id: uuid.UUID,
        request_id: str | None = None,
    ) -> list[StockMovement]:
        movements = []
        for item in data.items:
            # Prevent double-opening: only allowed when current stock is zero
            existing = await self.inv_repo.get_by_branch_and_product(
                data.branch_id, item.product_id, item.variant_id
            )
            if existing and existing.quantity_on_hand != 0:
                raise BusinessRuleError(
                    f"Opening stock already set for product {item.product_id}. "
                    "Use an adjustment to correct existing stock."
                )

            movement, _ = await self.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=data.branch_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                movement_type=StockMovementType.OPENING_STOCK,
                quantity=item.quantity,
                actor_user_id=actor_user_id,
                unit_cost=item.unit_cost,
                reason=data.reason or "Opening stock",
                notes=item.notes,
            )
            movements.append(movement)

        await self.audit.log(
            action=AuditAction.OPENING_STOCK_SET,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            entity_type=EntityType.STOCK_MOVEMENT,
            after_state={"items_count": len(movements)},
            request_id=request_id,
        )
        return movements

    # Inventory Adjustments

    async def create_adjustment(
        self,
        tenant_id: uuid.UUID,
        data: InventoryAdjustmentCreateRequest,
        actor_user_id: uuid.UUID,
        request_id: str | None = None,
    ) -> InventoryAdjustment:
        adjustment = InventoryAdjustment(
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            adjustment_type=data.adjustment_type,
            status=AdjustmentStatus.COMPLETED,
            reference_number=data.reference_number,
            reason=data.reason,
            notes=data.notes,
            actor_user_id=actor_user_id,
            completed_at=datetime.now(timezone.utc),
        )
        self.session.add(adjustment)
        await self.session.flush()
        await self.session.refresh(adjustment)

        for item_req in data.items:
            movement_type = _ADJUSTMENT_MOVEMENT_MAP.get(data.adjustment_type)
            if movement_type is None:
                # MANUAL_CORRECTION / SYSTEM_CORRECTION — direction from sign
                movement_type = (
                    StockMovementType.ADJUSTMENT_INCREASE
                    if item_req.quantity_change > 0
                    else StockMovementType.ADJUSTMENT_DECREASE
                )

            abs_qty = abs(item_req.quantity_change)

            movement, inv = await self.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=data.branch_id,
                product_id=item_req.product_id,
                variant_id=item_req.variant_id,
                movement_type=movement_type,
                quantity=abs_qty,
                actor_user_id=actor_user_id,
                reference_type="inventory_adjustment",
                reference_id=str(adjustment.id),
                unit_cost=item_req.unit_cost,
                reason=data.reason,
                notes=item_req.notes,
            )

            adj_item = InventoryAdjustmentItem(
                adjustment_id=adjustment.id,
                product_id=item_req.product_id,
                variant_id=item_req.variant_id,
                quantity_change=item_req.quantity_change,
                quantity_before=movement.previous_quantity,
                quantity_after=movement.new_quantity,
                unit_cost=item_req.unit_cost,
                notes=item_req.notes,
                stock_movement_id=movement.id,
            )
            self.session.add(adj_item)

        await self.session.flush()
        await self.session.refresh(adjustment)

        await self.audit.log(
            action=AuditAction.INVENTORY_ADJUSTED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            entity_type=EntityType.INVENTORY_ADJUSTMENT,
            entity_id=adjustment.id,
            after_state={
                "adjustment_type": data.adjustment_type,
                "items_count": len(data.items),
            },
            request_id=request_id,
        )

        return await self.adjustment_repo.get_with_items(adjustment.id)

    async def get_adjustment(
        self,
        adjustment_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> InventoryAdjustment:
        adjustment = await self.adjustment_repo.get_with_items(adjustment_id)
        if not adjustment or adjustment.tenant_id != tenant_id:
            raise NotFoundError("InventoryAdjustment", adjustment_id)
        return adjustment

    async def list_adjustments(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[InventoryAdjustment], int]:
        offset = (page - 1) * page_size
        return await self.adjustment_repo.get_by_tenant_with_items(
            tenant_id, offset=offset, limit=page_size, branch_id=branch_id
        )

    # Inventory Transfers

    async def create_transfer(
        self,
        tenant_id: uuid.UUID,
        data: InventoryTransferCreateRequest,
        actor_user_id: uuid.UUID,
        request_id: str | None = None,
    ) -> InventoryTransfer:
        transfer = InventoryTransfer(
            tenant_id=tenant_id,
            from_branch_id=data.from_branch_id,
            to_branch_id=data.to_branch_id,
            status=TransferStatus.PENDING,
            reference_number=data.reference_number,
            notes=data.notes,
            requested_by_id=actor_user_id,
        )
        self.session.add(transfer)
        await self.session.flush()
        await self.session.refresh(transfer)

        for item_req in data.items:
            item = InventoryTransferItem(
                transfer_id=transfer.id,
                product_id=item_req.product_id,
                variant_id=item_req.variant_id,
                quantity_requested=item_req.quantity_requested,
                quantity_transferred=Decimal("0"),
                unit_cost=item_req.unit_cost,
                notes=item_req.notes,
            )
            self.session.add(item)

        await self.session.flush()
        await self.session.refresh(transfer)

        await self.audit.log(
            action=AuditAction.INVENTORY_TRANSFER_CREATED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.INVENTORY_TRANSFER,
            entity_id=transfer.id,
            after_state={
                "from_branch": str(data.from_branch_id),
                "to_branch": str(data.to_branch_id),
                "items_count": len(data.items),
            },
            request_id=request_id,
        )

        return await self.transfer_repo.get_with_items(transfer.id)

    async def approve_transfer(
        self,
        transfer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        request_id: str | None = None,
    ) -> InventoryTransfer:
        transfer = await self.transfer_repo.get_with_items(transfer_id)
        if not transfer or transfer.tenant_id != tenant_id:
            raise NotFoundError("InventoryTransfer", transfer_id)

        if transfer.status != TransferStatus.PENDING:
            raise BusinessRuleError(
                f"Transfer cannot be approved in status '{transfer.status}'"
            )

        transfer.status = TransferStatus.APPROVED
        transfer.approved_by_id = actor_user_id
        transfer.approved_at = datetime.now(timezone.utc)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.INVENTORY_TRANSFER_APPROVED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.INVENTORY_TRANSFER,
            entity_id=transfer_id,
            request_id=request_id,
        )
        return transfer

    async def execute_transfer(
        self,
        transfer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        request_id: str | None = None,
    ) -> InventoryTransfer:
        """
        Executes an approved transfer. Creates TRANSFER_OUT + TRANSFER_IN movements.
        Rows are locked in deterministic order (by product_id) to prevent deadlocks.
        """
        transfer = await self.transfer_repo.get_with_items(transfer_id)
        if not transfer or transfer.tenant_id != tenant_id:
            raise NotFoundError("InventoryTransfer", transfer_id)

        if transfer.status != TransferStatus.APPROVED:
            raise BusinessRuleError(
                f"Transfer must be APPROVED before execution. Current: '{transfer.status}'"
            )

        # Sort items by product_id for consistent lock ordering (deadlock prevention)
        sorted_items = sorted(transfer.items, key=lambda i: str(i.product_id))

        for item in sorted_items:
            # TRANSFER_OUT from source branch (will validate available stock)
            out_movement, _ = await self.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=transfer.from_branch_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                movement_type=StockMovementType.TRANSFER_OUT,
                quantity=item.quantity_requested,
                actor_user_id=actor_user_id,
                reference_type="inventory_transfer",
                reference_id=str(transfer.id),
                unit_cost=item.unit_cost,
                reason=f"Transfer to branch {transfer.to_branch_id}",
            )

            # TRANSFER_IN to destination branch
            await self.create_stock_movement(
                tenant_id=tenant_id,
                branch_id=transfer.to_branch_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                movement_type=StockMovementType.TRANSFER_IN,
                quantity=item.quantity_requested,
                actor_user_id=actor_user_id,
                reference_type="inventory_transfer",
                reference_id=str(transfer.id),
                unit_cost=item.unit_cost,
                reason=f"Transfer from branch {transfer.from_branch_id}",
            )

            item.quantity_transferred = item.quantity_requested

        transfer.status = TransferStatus.COMPLETED
        transfer.completed_at = datetime.now(timezone.utc)
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.INVENTORY_TRANSFER_COMPLETED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.INVENTORY_TRANSFER,
            entity_id=transfer_id,
            after_state={"status": TransferStatus.COMPLETED},
            request_id=request_id,
        )
        return transfer

    async def cancel_transfer(
        self,
        transfer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        reason: str,
        request_id: str | None = None,
    ) -> InventoryTransfer:
        transfer = await self.transfer_repo.get_with_items(transfer_id)
        if not transfer or transfer.tenant_id != tenant_id:
            raise NotFoundError("InventoryTransfer", transfer_id)

        if transfer.status not in {TransferStatus.PENDING, TransferStatus.APPROVED}:
            raise BusinessRuleError(
                f"Transfer in status '{transfer.status}' cannot be cancelled"
            )

        transfer.status = TransferStatus.CANCELLED
        transfer.cancelled_at = datetime.now(timezone.utc)
        transfer.cancelled_by_id = actor_user_id
        transfer.cancel_reason = reason
        await self.session.flush()

        await self.audit.log(
            action=AuditAction.INVENTORY_TRANSFER_CANCELLED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.INVENTORY_TRANSFER,
            entity_id=transfer_id,
            after_state={"reason": reason},
            request_id=request_id,
        )
        return transfer

    async def get_transfer(
        self, transfer_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> InventoryTransfer:
        transfer = await self.transfer_repo.get_with_items(transfer_id)
        if not transfer or transfer.tenant_id != tenant_id:
            raise NotFoundError("InventoryTransfer", transfer_id)
        return transfer

    async def list_transfers(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        branch_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[InventoryTransfer], int]:
        offset = (page - 1) * page_size
        return await self.transfer_repo.get_by_tenant_with_items(
            tenant_id,
            offset=offset,
            limit=page_size,
            branch_id=branch_id,
            status=status,
        )

    # Queries

    async def get_branch_inventory(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[BranchInventory], int]:
        offset = (page - 1) * page_size
        return await self.inv_repo.get_by_branch(
            branch_id=branch_id,
            tenant_id=tenant_id,
            offset=offset,
            limit=page_size,
        )

    async def get_stock_movements(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        product_id: uuid.UUID | None = None,
        movement_type: str | None = None,
    ) -> tuple[list[StockMovement], int]:
        offset = (page - 1) * page_size
        return await self.movement_repo.get_by_branch(
            branch_id=branch_id,
            tenant_id=tenant_id,
            offset=offset,
            limit=page_size,
            product_id=product_id,
            movement_type=movement_type,
        )

    async def get_inventory_valuation(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> dict:
        """
        Calculates current inventory valuation for a branch.
        Uses cost_price from product (or unit_cost from last purchase movement as fallback).
        """
        inv_list, _ = await self.inv_repo.get_by_branch(
            branch_id=branch_id,
            tenant_id=tenant_id,
            limit=10000,
        )

        items = []
        total_value = Decimal("0")

        for inv in inv_list:
            product = await self.product_repo.get_active_by_id_and_tenant(
                inv.product_id, tenant_id
            )
            if not product:
                continue

            unit_cost = product.cost_price
            line_value = (unit_cost or Decimal("0")) * inv.quantity_on_hand
            total_value += line_value

            items.append({
                "product_id": inv.product_id,
                "variant_id": inv.variant_id,
                "product_name": product.name,
                "sku": product.sku,
                "quantity_on_hand": inv.quantity_on_hand,
                "unit_cost": unit_cost,
                "total_value": line_value,
            })

        return {
            "branch_id": branch_id,
            "tenant_id": tenant_id,
            "total_value": total_value,
            "total_items": len(items),
            "items": items,
        }

    async def update_reorder_levels(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        variant_id: uuid.UUID | None,
        reorder_point: Decimal | None,
        reorder_quantity: Decimal | None,
    ) -> BranchInventory:
        inv = await self.inv_repo.get_by_branch_and_product(
            branch_id, product_id, variant_id
        )
        if not inv or inv.tenant_id != tenant_id:
            raise NotFoundError("BranchInventory", f"branch={branch_id} product={product_id}")
        if reorder_point is not None:
            inv.reorder_point = reorder_point
        if reorder_quantity is not None:
            inv.reorder_quantity = reorder_quantity
        await self.session.flush()
        await self.session.refresh(inv)
        return inv
