from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.receipts.models import Receipt
from app.receipts.repositories import ReceiptRepository


class ReceiptService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.receipt_repo = ReceiptRepository(session)

    async def get_receipt(
        self,
        receipt_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Receipt:
        receipt = await self.receipt_repo.get_by_id_and_tenant(receipt_id, tenant_id)
        if not receipt:
            raise NotFoundError("Receipt", receipt_id)
        return receipt

    async def get_receipt_by_order(
        self,
        order_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Receipt:
        receipt = await self.receipt_repo.get_by_order(order_id)
        if not receipt or receipt.tenant_id != tenant_id:
            raise NotFoundError("Receipt", f"order={order_id}")
        return receipt

    async def get_receipt_by_number(
        self,
        receipt_number: str,
        tenant_id: uuid.UUID,
    ) -> Receipt:
        receipt = await self.receipt_repo.get_by_receipt_number(receipt_number)
        if not receipt or receipt.tenant_id != tenant_id:
            raise NotFoundError("Receipt", receipt_number)
        return receipt

    async def list_receipts(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[Receipt], int]:
        offset = (page - 1) * page_size
        return await self.receipt_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            branch_id=branch_id,
        )

    async def void_receipt(
        self,
        receipt_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Receipt:
        receipt = await self.receipt_repo.get_by_id_and_tenant(receipt_id, tenant_id)
        if not receipt:
            raise NotFoundError("Receipt", receipt_id)
        if receipt.voided_at:
            raise BusinessRuleError(f"Receipt {receipt.receipt_number} is already voided")
        receipt.voided_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(receipt)
        return receipt
