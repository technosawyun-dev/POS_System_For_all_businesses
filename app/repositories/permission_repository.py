from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission import Permission, RolePermission, UserPermission
from app.repositories.base import BaseRepository


class PermissionRepository(BaseRepository[Permission]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Permission, session)

    async def get_by_code(self, code: str) -> Permission | None:
        stmt = select(Permission).where(Permission.code == code, Permission.is_active.is_(True))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_codes(self, codes: list[str]) -> list[Permission]:
        stmt = select(Permission).where(Permission.code.in_(codes), Permission.is_active.is_(True))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_role_permissions(self, role: str) -> list[Permission]:
        stmt = (
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role == role, RolePermission.is_active.is_(True))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_user_permissions(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> list[UserPermission]:
        stmt = select(UserPermission).where(
            UserPermission.user_id == user_id,
            UserPermission.is_granted.is_(True),
        )
        if tenant_id:
            stmt = stmt.where(
                (UserPermission.tenant_id == tenant_id) | (UserPermission.tenant_id.is_(None))
            )
        if branch_id:
            stmt = stmt.where(
                (UserPermission.branch_id == branch_id) | (UserPermission.branch_id.is_(None))
            )
        # Filter out expired
        stmt = stmt.where(
            (UserPermission.expires_at.is_(None)) | (UserPermission.expires_at > datetime.now(timezone.utc))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def grant_user_permission(
        self,
        user_id: uuid.UUID,
        permission_id: uuid.UUID,
        granted_by_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        expires_at: datetime | None = None,
    ) -> UserPermission:
        user_perm = UserPermission(
            user_id=user_id,
            permission_id=permission_id,
            granted_by_id=granted_by_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            is_granted=True,
            expires_at=expires_at,
        )
        self.session.add(user_perm)
        await self.session.flush()
        await self.session.refresh(user_perm)
        return user_perm

    async def seed_role_permission(self, role: str, permission_id: uuid.UUID) -> RolePermission:
        result = await self.session.execute(
            select(RolePermission).where(
                RolePermission.role == role,
                RolePermission.permission_id == permission_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing
        rp = RolePermission(role=role, permission_id=permission_id)
        self.session.add(rp)
        await self.session.flush()
        return rp
