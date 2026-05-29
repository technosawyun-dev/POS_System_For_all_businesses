from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.core.constants import AuditAction, EntityType
from app.core.exceptions import ConflictError, NotFoundError
from app.models.supplier import Supplier, SupplierContact
from app.repositories.supplier_repository import SupplierContactRepository, SupplierRepository
from app.schemas.supplier import (
    SupplierContactCreateRequest,
    SupplierContactUpdateRequest,
    SupplierCreateRequest,
    SupplierUpdateRequest,
)
from app.services.audit_service import AuditService


class SupplierService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = SupplierRepository(session)
        self.contact_repo = SupplierContactRepository(session)
        self.audit = AuditService(session)

    async def _generate_supplier_code(self, tenant_id: uuid.UUID) -> str:
        result = await self.session.execute(
            select(func.count()).select_from(Supplier).where(Supplier.tenant_id == tenant_id)
        )
        count = result.scalar_one() or 0
        return f"SUP-{(count + 1):04d}"

    async def create_supplier(
        self,
        tenant_id: uuid.UUID,
        data: SupplierCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Supplier:
        code = data.code or await self._generate_supplier_code(tenant_id)

        if await self.repo.code_exists(tenant_id, code):
            code = f"SUP-{uuid.uuid4().hex[:6].upper()}"

        supplier = await self.repo.create(
            tenant_id=tenant_id,
            name=data.name,
            code=code,
            email=data.email,
            phone=data.phone,
            address=data.address,
            city=data.city,
            country=data.country,
            website=data.website,
            notes=data.notes,
        )

        await self.audit.log(
            action=AuditAction.SUPPLIER_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER,
            entity_id=supplier.id,
            after_state={"name": supplier.name, "code": supplier.code},
            request_id=request_id,
        )
        return await self.repo.get_with_contacts(supplier.id, tenant_id)

    async def get_supplier(
        self, supplier_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Supplier:
        supplier = await self.repo.get_with_contacts(supplier_id, tenant_id)
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)
        return supplier

    async def list_suppliers(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> tuple[list[Supplier], int]:
        offset = (page - 1) * page_size
        return await self.repo.get_by_tenant(
            tenant_id, offset=offset, limit=page_size, status=status
        )

    async def update_supplier(
        self,
        supplier_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: SupplierUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Supplier:
        supplier = await self.repo.get_active_by_id_and_tenant(supplier_id, tenant_id)
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)

        before = {"name": supplier.name, "status": supplier.status}
        update_data = data.model_dump(exclude_none=True)
        supplier = await self.repo.update(supplier, **update_data)

        await self.audit.log(
            action=AuditAction.SUPPLIER_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER,
            entity_id=supplier_id,
            before_state=before,
            after_state=update_data,
            request_id=request_id,
        )
        return await self.repo.get_with_contacts(supplier_id, tenant_id)

    async def delete_supplier(
        self,
        supplier_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        supplier = await self.repo.get_active_by_id_and_tenant(supplier_id, tenant_id)
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)
        await self.repo.soft_delete(supplier)
        await self.audit.log(
            action=AuditAction.SUPPLIER_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER,
            entity_id=supplier_id,
            request_id=request_id,
        )

    # Contacts

    async def add_contact(
        self,
        supplier_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: SupplierContactCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> SupplierContact:
        supplier = await self.repo.get_active_by_id_and_tenant(supplier_id, tenant_id)
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)

        if data.is_primary:
            await self.contact_repo.demote_primary(supplier_id)

        contact = await self.contact_repo.create(
            supplier_id=supplier_id,
            tenant_id=tenant_id,
            name=data.name,
            email=data.email,
            phone=data.phone,
            position=data.position,
            is_primary=data.is_primary,
        )
        await self.audit.log(
            action=AuditAction.SUPPLIER_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER,
            entity_id=supplier_id,
            after_state={"contact_added": data.name},
            request_id=request_id,
        )
        return contact

    async def update_contact(
        self,
        supplier_id: uuid.UUID,
        contact_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: SupplierContactUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> SupplierContact:
        supplier = await self.repo.get_active_by_id_and_tenant(supplier_id, tenant_id)
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)

        contact = await self.contact_repo.get_active_by_id_and_supplier(contact_id, supplier_id)
        if not contact:
            raise NotFoundError("SupplierContact", contact_id)

        update_data = data.model_dump(exclude_none=True)

        if update_data.get("is_primary"):
            await self.contact_repo.demote_primary(supplier_id)

        contact = await self.contact_repo.update(contact, **update_data)
        await self.audit.log(
            action=AuditAction.SUPPLIER_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER,
            entity_id=supplier_id,
            after_state={"contact_updated": str(contact_id)},
            request_id=request_id,
        )
        return contact

    async def delete_contact(
        self,
        supplier_id: uuid.UUID,
        contact_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        supplier = await self.repo.get_active_by_id_and_tenant(supplier_id, tenant_id)
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)

        contact = await self.contact_repo.get_active_by_id_and_supplier(contact_id, supplier_id)
        if not contact:
            raise NotFoundError("SupplierContact", contact_id)

        await self.contact_repo.soft_delete(contact)
        await self.audit.log(
            action=AuditAction.SUPPLIER_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.SUPPLIER,
            entity_id=supplier_id,
            before_state={"contact_deleted": str(contact_id)},
            request_id=request_id,
        )

    async def list_contacts(
        self, supplier_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> list[SupplierContact]:
        supplier = await self.repo.get_active_by_id_and_tenant(supplier_id, tenant_id)
        if not supplier:
            raise NotFoundError("Supplier", supplier_id)
        return await self.contact_repo.get_by_supplier(supplier_id)
