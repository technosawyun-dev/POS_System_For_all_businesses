from __future__ import annotations

import re
import secrets
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, TenantStatus
from app.core.exceptions import ConflictError, NotFoundError
from app.models.tenant import Tenant
from app.repositories.tenant_repository import TenantRepository
from app.services.audit_service import AuditService
from app.models.tenant import TenantSettings
from app.schemas.tenant import TenantCreateRequest, TenantSettingsUpdateRequest, TenantUpdateRequest


_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_business_code() -> str:
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(8))


def _generate_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:100]


class TenantService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.tenant_repo = TenantRepository(session)
        self.audit_service = AuditService(session)

    async def create_tenant(
        self,
        data: TenantCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Tenant:
        base_slug = _generate_slug(data.name)
        slug = base_slug
        counter = 1
        while await self.tenant_repo.slug_exists(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        business_code = _generate_business_code()
        while await self.tenant_repo.get_by_business_code(business_code):
            business_code = _generate_business_code()

        tenant = await self.tenant_repo.create(
            name=data.name,
            slug=slug,
            business_code=business_code,
            email=data.email,
            phone=data.phone,
            address=data.address,
            country=data.country,
            city=data.city,
            timezone=data.timezone,
            currency=data.currency,
            locale=data.locale,
            subscription_plan=data.subscription_plan,
        )

        await self.tenant_repo.create_settings(tenant.id)

        await self.audit_service.log(
            action=AuditAction.TENANT_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant.id,
            entity_type=EntityType.TENANT,
            entity_id=tenant.id,
            after_state={"name": tenant.name, "slug": tenant.slug},
            request_id=request_id,
        )
        return tenant

    async def get_tenant(self, tenant_id: uuid.UUID) -> Tenant:
        tenant = await self.tenant_repo.get_active_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant", tenant_id)
        return tenant

    async def list_tenants(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[Tenant], int]:
        offset = (page - 1) * page_size
        filters = [Tenant.is_deleted.is_(False)]
        return await self.tenant_repo.get_all(offset=offset, limit=page_size, filters=filters)

    async def update_tenant(
        self,
        tenant_id: uuid.UUID,
        data: TenantUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Tenant:
        tenant = await self.tenant_repo.get_active_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant", tenant_id)

        before_state = {"name": tenant.name, "status": tenant.status}
        update_data = data.model_dump(exclude_none=True)
        tenant = await self.tenant_repo.update(tenant, **update_data)

        await self.audit_service.log(
            action=AuditAction.TENANT_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT,
            entity_id=tenant_id,
            before_state=before_state,
            after_state=update_data,
            request_id=request_id,
        )
        return tenant

    async def update_tenant_status(
        self,
        tenant_id: uuid.UUID,
        status: TenantStatus,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Tenant:
        tenant = await self.tenant_repo.get_active_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant", tenant_id)

        old_status = tenant.status
        tenant = await self.tenant_repo.update(tenant, status=status)

        action = AuditAction.TENANT_ACTIVATED if status == TenantStatus.ACTIVE else AuditAction.TENANT_SUSPENDED
        await self.audit_service.log(
            action=action,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT,
            entity_id=tenant_id,
            before_state={"status": old_status},
            after_state={"status": status},
            request_id=request_id,
        )
        return tenant

    async def get_tenant_settings(self, tenant_id: uuid.UUID) -> TenantSettings:
        settings = await self.tenant_repo.get_settings(tenant_id)
        if not settings:
            settings = await self.tenant_repo.create_settings(tenant_id)
        return settings

    async def update_tenant_settings(
        self,
        tenant_id: uuid.UUID,
        data: TenantSettingsUpdateRequest,
    ) -> TenantSettings:
        update_kwargs: dict[str, object] = {}
        if data.tax_rate is not None:
            update_kwargs["tax_rate"] = data.tax_rate
        if data.tax_inclusive is not None:
            update_kwargs["tax_inclusive"] = data.tax_inclusive
        if data.extra_settings is not None:
            existing = await self.tenant_repo.get_settings(tenant_id)
            merged = dict(existing.extra_settings) if existing and existing.extra_settings else {}
            merged.update(data.extra_settings)
            update_kwargs["extra_settings"] = merged
        return await self.tenant_repo.update_settings(tenant_id, **update_kwargs)

    async def soft_delete_tenant(
        self,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        tenant = await self.tenant_repo.get_active_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant", tenant_id)
        await self.tenant_repo.soft_delete(tenant)
        await self.audit.log(
            action=AuditAction.TENANT_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.TENANT,
            entity_id=str(tenant_id),
            before_state={"name": tenant.name, "slug": tenant.slug},
            request_id=request_id,
        )
