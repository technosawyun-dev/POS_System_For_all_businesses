from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant, TenantSettings
from app.repositories.base import BaseRepository


class TenantRepository(BaseRepository[Tenant]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Tenant, session)

    async def get_by_slug(self, slug: str) -> Tenant | None:
        stmt = select(Tenant).where(Tenant.slug == slug, Tenant.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_business_code(self, business_code: str) -> Tenant | None:
        stmt = select(Tenant).where(
            Tenant.business_code == business_code.upper(),
            Tenant.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_by_id(self, tenant_id: uuid.UUID) -> Tenant | None:
        stmt = select(Tenant).where(Tenant.id == tenant_id, Tenant.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def slug_exists(self, slug: str, exclude_id: uuid.UUID | None = None) -> bool:
        stmt = select(Tenant.id).where(Tenant.slug == slug, Tenant.is_deleted.is_(False))
        if exclude_id:
            stmt = stmt.where(Tenant.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def soft_delete(self, tenant: Tenant) -> Tenant:
        tenant.is_deleted = True
        tenant.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
        return tenant

    async def get_settings(self, tenant_id: uuid.UUID) -> TenantSettings | None:
        stmt = select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_settings(self, tenant_id: uuid.UUID) -> TenantSettings:
        settings = TenantSettings(tenant_id=tenant_id)
        self.session.add(settings)
        await self.session.flush()
        await self.session.refresh(settings)
        return settings

    async def update_settings(self, tenant_id: uuid.UUID, **kwargs: object) -> TenantSettings:
        settings = await self.get_settings(tenant_id)
        if not settings:
            settings = await self.create_settings(tenant_id)
        for key, value in kwargs.items():
            if value is not None or key in ("tax_rate",):
                setattr(settings, key, value)
        await self.session.flush()
        await self.session.refresh(settings)
        return settings
