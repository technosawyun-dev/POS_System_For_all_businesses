from __future__ import annotations

"""
Sync Push Service — Idempotent Offline Operation Replay
=========================================================
Accepts a batch of offline operations from a device and replays them
against the live Phase 3 business services.

Idempotency guarantee:
  If an operation_uuid has already been processed (COMPLETED), the service
  returns the cached result_snapshot without re-executing — safe for retry.

Partial failure:
  Each operation runs inside a PostgreSQL SAVEPOINT so a single failure
  does not abort the entire batch. Successful operations commit their
  savepoints; failed ones rollback only their savepoint while the outer
  transaction remains open.

Security:
  Device and branch ownership are validated before any operation executes.
  Tenant isolation is enforced at every service call.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, SyncOperationStatus, SyncOperationType
from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.devices.repositories import DeviceRepository
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.events.types import EventType
from app.services.audit_service import AuditService
from app.sync.models import SyncOperation
from app.sync.repositories import SyncOperationRepository
from app.sync.schemas import (
    SyncOperationInput,
    SyncOperationResult,
    SyncPushRequest,
    SyncPushResponse,
)

logger = get_logger(__name__)

_MAX_ERROR_LEN = 500


class SyncPushService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.device_repo = DeviceRepository(session)
        self.op_repo = SyncOperationRepository(session)
        self.audit = AuditService(session)

    async def push(
        self,
        tenant_id: uuid.UUID,
        data: SyncPushRequest,
        actor_user_id: uuid.UUID,
    ) -> SyncPushResponse:
        # Validate device ownership and active status
        device = await self.device_repo.get_by_id_for_tenant(data.device_id, tenant_id)
        if not device:
            raise NotFoundError("Device", data.device_id)
        if not device.is_active:
            raise BusinessRuleError("Device is deactivated and cannot sync")

        # Enforce branch ownership
        if device.branch_id != data.branch_id:
            raise BusinessRuleError(
                "Device is not registered for the requested branch",
                details={"device_branch": str(device.branch_id), "request_branch": str(data.branch_id)},
            )

        results: list[SyncOperationResult] = []
        processed_count = 0
        failed_count = 0
        skipped_count = 0

        for op_input in data.operations:
            # Idempotent replay check
            existing = await self.op_repo.get_by_operation_uuid(op_input.operation_uuid, tenant_id)
            if existing:
                if existing.status == SyncOperationStatus.COMPLETED:
                    results.append(SyncOperationResult(
                        operation_uuid=op_input.operation_uuid,
                        status=SyncOperationStatus.COMPLETED,
                        replayed=True,
                        entity_id=existing.entity_id,
                        entity_type=existing.entity_type,
                        result_snapshot=existing.result_snapshot,
                    ))
                    processed_count += 1
                    logger.info(
                        "sync_operation_replayed",
                        operation_uuid=op_input.operation_uuid,
                        tenant_id=str(tenant_id),
                    )
                    await event_publisher.publish(DomainEvent(
                        event_type=EventType.OFFLINE_OPERATION_REPLAYED,
                        tenant_id=tenant_id,
                        actor_id=actor_user_id,
                        payload={"operation_uuid": op_input.operation_uuid, "entity_type": existing.entity_type},
                    ))
                    continue

                if existing.status == SyncOperationStatus.PROCESSING:
                    results.append(SyncOperationResult(
                        operation_uuid=op_input.operation_uuid,
                        status=SyncOperationStatus.PROCESSING,
                        error="Operation is currently being processed — retry shortly",
                    ))
                    skipped_count += 1
                    continue

                if existing.status == SyncOperationStatus.FAILED:
                    # Allow retry of a previously FAILED operation by updating it
                    op_record = existing
                    op_record.status = SyncOperationStatus.PROCESSING
                    op_record.retry_count = (op_record.retry_count or 0) + 1
                    op_record.error_message = None
                    op_record.failed_at = None
                    await self.session.flush()
                else:
                    op_record = existing
            else:
                # Create new operation record (BEFORE savepoint)
                op_record = await self.op_repo.create(
                    tenant_id=tenant_id,
                    branch_id=data.branch_id,
                    device_id=data.device_id,
                    operation_uuid=op_input.operation_uuid,
                    operation_type=op_input.operation_type,
                    entity_type=op_input.entity_type,
                    payload=op_input.payload,
                    operation_timestamp=op_input.operation_timestamp,
                    status=SyncOperationStatus.PROCESSING,
                    retry_count=0,
                )

            # Execute inside SAVEPOINT (allows partial batch failure)
            try:
                sp = await self.session.begin_nested()
                entity_id, result_snapshot = await self._execute(
                    op_input, tenant_id, device, actor_user_id
                )
                op_record.status = SyncOperationStatus.COMPLETED
                op_record.entity_id = entity_id
                op_record.result_snapshot = result_snapshot
                op_record.processed_at = datetime.now(timezone.utc)
                await self.session.flush()
                await sp.commit()

                processed_count += 1
                results.append(SyncOperationResult(
                    operation_uuid=op_input.operation_uuid,
                    status=SyncOperationStatus.COMPLETED,
                    entity_id=entity_id,
                    entity_type=op_input.entity_type,
                    result_snapshot=result_snapshot,
                ))
                logger.info(
                    "sync_operation_completed",
                    operation_uuid=op_input.operation_uuid,
                    operation_type=op_input.operation_type,
                    entity_id=str(entity_id) if entity_id else None,
                )

            except Exception as exc:
                await sp.rollback()
                # op_record was written before the savepoint — still in outer tx
                error_msg = str(exc)[:_MAX_ERROR_LEN]
                op_record.status = SyncOperationStatus.FAILED
                op_record.error_message = error_msg
                op_record.failed_at = datetime.now(timezone.utc)
                await self.session.flush()

                failed_count += 1
                results.append(SyncOperationResult(
                    operation_uuid=op_input.operation_uuid,
                    status=SyncOperationStatus.FAILED,
                    entity_type=op_input.entity_type,
                    error=error_msg,
                ))
                logger.warning(
                    "sync_operation_failed",
                    operation_uuid=op_input.operation_uuid,
                    operation_type=op_input.operation_type,
                    error=error_msg,
                )

        # Update device activity timestamps
        now = datetime.now(timezone.utc)
        device.last_seen_at = now
        if processed_count > 0:
            device.last_sync_at = now
        await self.session.flush()

        # Audit
        await self.audit.log(
            action=AuditAction.SYNC_PUSH_COMPLETED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=data.branch_id,
            entity_type=EntityType.DEVICE,
            entity_id=data.device_id,
            metadata={
                "total": len(data.operations),
                "processed": processed_count,
                "failed": failed_count,
                "skipped": skipped_count,
            },
        )

        sync_time = datetime.now(timezone.utc)
        await event_publisher.publish(DomainEvent(
            event_type=EventType.SYNC_COMPLETED if failed_count == 0 else EventType.SYNC_FAILED,
            tenant_id=tenant_id,
            actor_id=actor_user_id,
            payload={
                "device_id": str(data.device_id),
                "processed": processed_count,
                "failed": failed_count,
            },
        ))

        return SyncPushResponse(
            processed_count=processed_count,
            failed_count=failed_count,
            skipped_count=skipped_count,
            results=results,
            sync_timestamp=sync_time,
        )

    # Operation routers

    async def _execute(
        self,
        op: SyncOperationInput,
        tenant_id: uuid.UUID,
        device: Any,
        actor_user_id: uuid.UUID,
    ) -> tuple[uuid.UUID | None, dict[str, Any]]:
        if op.operation_type == SyncOperationType.SALE_CREATED:
            return await self._execute_sale(op.payload, tenant_id, actor_user_id)
        if op.operation_type == SyncOperationType.REFUND_CREATED:
            return await self._execute_refund(op.payload, tenant_id, actor_user_id)
        if op.operation_type == SyncOperationType.ORDER_VOIDED:
            return await self._execute_void_order(op.payload, tenant_id, actor_user_id)
        if op.operation_type == SyncOperationType.PAYMENT_CREATED:
            return await self._execute_payment(op.payload, tenant_id, actor_user_id)
        if op.operation_type == SyncOperationType.INVENTORY_ADJUSTED:
            return await self._execute_inventory_adjust(op.payload, tenant_id, actor_user_id)
        if op.operation_type == SyncOperationType.TRANSFER_EXECUTED:
            return await self._execute_transfer_execute(op.payload, tenant_id, actor_user_id)
        raise ValidationError(f"Unknown operation_type: {op.operation_type}")

    async def _execute_sale(
        self, payload: dict, tenant_id: uuid.UUID, actor_user_id: uuid.UUID
    ) -> tuple[uuid.UUID, dict]:
        from app.sales.services.checkout_service import (
            CheckoutInput,
            CheckoutItemInput,
            CheckoutPaymentInput,
            CheckoutService,
        )

        def _d(v: Any) -> Decimal:
            return Decimal(str(v))

        checkout_input = CheckoutInput(
            cashier_session_id=uuid.UUID(payload["cashier_session_id"]),
            items=[
                CheckoutItemInput(
                    product_id=uuid.UUID(item["product_id"]),
                    variant_id=uuid.UUID(item["variant_id"]) if item.get("variant_id") else None,
                    quantity=_d(item["quantity"]),
                    unit_price=_d(item["unit_price"]),
                    discount_amount=_d(item.get("discount_amount", 0)),
                    tax_rate=_d(item.get("tax_rate", 0)),
                    notes=item.get("notes"),
                )
                for item in payload["items"]
            ],
            payments=[
                CheckoutPaymentInput(
                    payment_method=pmt["payment_method"],
                    amount=_d(pmt["amount"]),
                    reference_number=pmt.get("reference_number"),
                    notes=pmt.get("notes"),
                )
                for pmt in payload["payments"]
            ],
            customer_id=uuid.UUID(payload["customer_id"]) if payload.get("customer_id") else None,
            order_discount_amount=_d(payload.get("discount_amount", 0)),
            notes=payload.get("notes"),
        )
        svc = CheckoutService(self.session)
        order = await svc.checkout(
            tenant_id=tenant_id,
            data=checkout_input,
            actor_user_id=actor_user_id,
        )
        snapshot = {
            "order_id": str(order.id),
            "order_number": order.order_number,
            "total_amount": str(order.total_amount),
            "order_status": order.order_status,
            "payment_status": order.payment_status,
        }
        return order.id, snapshot

    async def _execute_refund(
        self, payload: dict, tenant_id: uuid.UUID, actor_user_id: uuid.UUID
    ) -> tuple[uuid.UUID, dict]:
        from app.sales.services.refund_service import (
            RefundInput,
            RefundItemInput,
            RefundService,
        )

        refund_input = RefundInput(
            order_id=uuid.UUID(payload["order_id"]),
            reason=payload["reason"],
            items=[
                RefundItemInput(
                    order_item_id=uuid.UUID(item["order_item_id"]),
                    quantity=Decimal(str(item["quantity"])),
                    amount=Decimal(str(item["amount"])),
                )
                for item in payload["items"]
            ],
            notes=payload.get("notes"),
        )
        svc = RefundService(self.session)
        refund = await svc.process_refund(
            tenant_id=tenant_id,
            data=refund_input,
            actor_user_id=actor_user_id,
        )
        snapshot = {
            "refund_id": str(refund.id),
            "refund_number": refund.refund_number,
            "total_refunded": str(refund.total_refunded),
        }
        return refund.id, snapshot

    async def _execute_void_order(
        self, payload: dict, tenant_id: uuid.UUID, actor_user_id: uuid.UUID
    ) -> tuple[uuid.UUID, dict]:
        from app.sales.services.checkout_service import CheckoutService

        svc = CheckoutService(self.session)
        order = await svc.void_order(
            order_id=uuid.UUID(payload["order_id"]),
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            reason=payload.get("reason", ""),
        )
        snapshot = {
            "order_id": str(order.id),
            "order_number": order.order_number,
            "order_status": order.order_status,
        }
        return order.id, snapshot

    async def _execute_payment(
        self, payload: dict, tenant_id: uuid.UUID, actor_user_id: uuid.UUID
    ) -> tuple[uuid.UUID, dict]:
        from app.payments.services import PaymentService

        svc = PaymentService(self.session)
        payment = await svc.add_payment(
            order_id=uuid.UUID(payload["order_id"]),
            tenant_id=tenant_id,
            payment_method=payload["payment_method"],
            amount=Decimal(str(payload["amount"])),
            actor_user_id=actor_user_id,
            reference_number=payload.get("reference_number"),
            notes=payload.get("notes"),
        )
        snapshot = {
            "payment_id": str(payment.id),
            "amount": str(payment.amount),
            "payment_method": payment.payment_method,
        }
        return payment.id, snapshot

    async def _execute_inventory_adjust(
        self, payload: dict, tenant_id: uuid.UUID, actor_user_id: uuid.UUID
    ) -> tuple[uuid.UUID, dict]:
        from app.schemas.inventory import InventoryAdjustmentCreateRequest
        from app.services.inventory_service import InventoryService

        request = InventoryAdjustmentCreateRequest(**payload)
        svc = InventoryService(self.session)
        adjustment = await svc.create_adjustment(
            tenant_id=tenant_id,
            data=request,
            actor_user_id=actor_user_id,
        )
        snapshot = {
            "adjustment_id": str(adjustment.id),
            "status": adjustment.status,
        }
        return adjustment.id, snapshot

    async def _execute_transfer_execute(
        self, payload: dict, tenant_id: uuid.UUID, actor_user_id: uuid.UUID
    ) -> tuple[uuid.UUID, dict]:
        from app.services.inventory_service import InventoryService

        transfer_id = uuid.UUID(payload["transfer_id"])
        svc = InventoryService(self.session)
        transfer = await svc.execute_transfer(
            transfer_id=transfer_id,
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
        )
        snapshot = {
            "transfer_id": str(transfer.id),
            "status": transfer.status,
        }
        return transfer.id, snapshot
