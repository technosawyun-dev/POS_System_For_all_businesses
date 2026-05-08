from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.supplier import Supplier, SupplierContact
from app.repositories.base import BaseRepository


class SupplierRepository(BaseRepository[Supplier]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Supplier, session)

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        status: str | None = None,
    ) -> tuple[list[Supplier], int]:
        filters = [Supplier.tenant_id == tenant_id, Supplier.is_deleted.is_(False)]
        if status:
            filters.append(Supplier.status == status)
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def get_active_by_id_and_tenant(
        self, supplier_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Supplier | None:
        stmt = select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == tenant_id,
            Supplier.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_contacts(
        self, supplier_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Supplier | None:
        stmt = (
            select(Supplier)
            .where(
                Supplier.id == supplier_id,
                Supplier.tenant_id == tenant_id,
                Supplier.is_deleted.is_(False),
            )
            .options(selectinload(Supplier.contacts))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def code_exists(
        self,
        tenant_id: uuid.UUID,
        code: str,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        stmt = select(Supplier.id).where(
            Supplier.tenant_id == tenant_id,
            Supplier.code == code,
            Supplier.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(Supplier.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def soft_delete(self, supplier: Supplier) -> None:
        supplier.is_deleted = True
        supplier.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()


class SupplierContactRepository(BaseRepository[SupplierContact]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SupplierContact, session)

    async def get_by_supplier(
        self, supplier_id: uuid.UUID
    ) -> list[SupplierContact]:
        stmt = select(SupplierContact).where(
            SupplierContact.supplier_id == supplier_id,
            SupplierContact.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_active_by_id_and_supplier(
        self, contact_id: uuid.UUID, supplier_id: uuid.UUID
    ) -> SupplierContact | None:
        stmt = select(SupplierContact).where(
            SupplierContact.id == contact_id,
            SupplierContact.supplier_id == supplier_id,
            SupplierContact.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def demote_primary(self, supplier_id: uuid.UUID) -> None:
        """Remove primary flag from all contacts of this supplier."""
        contacts = await self.get_by_supplier(supplier_id)
        for c in contacts:
            c.is_primary = False
        await self.session.flush()

    async def soft_delete(self, contact: SupplierContact) -> None:
        contact.is_deleted = True
        await self.session.flush()
