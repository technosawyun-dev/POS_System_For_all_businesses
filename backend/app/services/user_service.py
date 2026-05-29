from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, UserRole, UserStatus
from app.core.exceptions import ConflictError, NotFoundError, AuthorizationError
from app.core.security import hash_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.branch_repository import BranchRepository
from app.services.audit_service import AuditService
from app.schemas.user import UserCreateRequest, UserUpdateRequest


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.branch_repo = BranchRepository(session)
        self.audit_service = AuditService(session)

    async def create_user(
        self,
        data: UserCreateRequest,
        actor_id: uuid.UUID,
        actor_tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> User:
        if data.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("Cannot create a SUPER_ADMIN user")
        if await self.user_repo.email_exists(data.email):
            raise ConflictError(f"User with email '{data.email}' already exists")

        user = await self.user_repo.create(
            email=data.email,
            hashed_password=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            role=data.role,
            tenant_id=actor_tenant_id,
            primary_branch_id=data.primary_branch_id,
        )

        await self.audit_service.log(
            action=AuditAction.USER_CREATED,
            actor_user_id=actor_id,
            tenant_id=actor_tenant_id,
            entity_type=EntityType.USER,
            entity_id=user.id,
            after_state={"email": user.email, "role": user.role},
            request_id=request_id,
        )
        # Auto-generate a referral code for new resellers
        if data.role == UserRole.RESELLER:
            try:
                from app.reseller_finance.services.referral_service import ReferralService
                referral_svc = ReferralService(self.session)
                await referral_svc.create_referral_code(
                    reseller_id=user.id,
                    code=None,  # auto-generate
                    actor_id=actor_id,
                    request_id=request_id,
                )
            except Exception:
                pass  # fail-open, don't break user creation
        return user

    async def get_user(self, user_id: uuid.UUID) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        return user

    async def list_users(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[User], int]:
        offset = (page - 1) * page_size
        return await self.user_repo.get_by_tenant(tenant_id, offset=offset, limit=page_size)

    async def list_all_users(
        self,
        page: int = 1,
        page_size: int = 20,
        role: str | None = None,
    ) -> tuple[list[User], int]:
        offset = (page - 1) * page_size
        return await self.user_repo.get_all_users(offset=offset, limit=page_size, role=role)

    async def update_user(
        self,
        user_id: uuid.UUID,
        data: UserUpdateRequest,
        actor_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)

        before_state = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
        }

        update_data = data.model_dump(exclude_none=True)
        user = await self.user_repo.update(user, **update_data)

        # JSONB columns require JSON-serializable types; convert uuid.UUID → str
        audit_data = {k: str(v) if isinstance(v, uuid.UUID) else v for k, v in update_data.items()}
        await self.audit_service.log(
            action=AuditAction.USER_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.USER,
            entity_id=user_id,
            before_state=before_state,
            after_state=audit_data,
            request_id=request_id,
        )
        return user

    async def update_user_status(
        self,
        user_id: uuid.UUID,
        status: UserStatus,
        actor_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be modified")

        old_status = user.status
        user = await self.user_repo.update(user, status=status)

        action = {
            UserStatus.ACTIVE: AuditAction.USER_ACTIVATED,
            UserStatus.SUSPENDED: AuditAction.USER_SUSPENDED,
        }.get(status, AuditAction.USER_DEACTIVATED)
        await self.audit_service.log(
            action=action,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.USER,
            entity_id=user_id,
            before_state={"status": old_status},
            after_state={"status": status},
            request_id=request_id,
        )
        return user

    async def update_user_role(
        self,
        user_id: uuid.UUID,
        role: UserRole,
        actor_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be modified")
        if role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("Cannot assign SUPER_ADMIN role")
        if role == UserRole.RESELLER and user.tenant_id is not None:
            raise AuthorizationError("Cannot assign RESELLER role to a tenant-scoped user. Create a new RESELLER account instead.")
        if user.role == UserRole.RESELLER and role != UserRole.RESELLER:
            raise AuthorizationError("Cannot change a RESELLER's role to a tenant-scoped role. Create a new user account instead.")

        old_role = user.role
        user = await self.user_repo.update(user, role=role)

        await self.audit_service.log(
            action=AuditAction.USER_ROLE_CHANGED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.USER,
            entity_id=user_id,
            before_state={"role": old_role},
            after_state={"role": role},
            request_id=request_id,
        )
        return user

    async def reset_user_password(
        self,
        user_id: uuid.UUID,
        new_password: str,
        actor_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> None:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be modified")

        await self.user_repo.update(user, hashed_password=hash_password(new_password))

        await self.audit_service.log(
            action=AuditAction.PASSWORD_CHANGED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.USER,
            entity_id=user_id,
            after_state={"password_reset_by_admin": str(actor_id)},
            request_id=request_id,
        )

    async def soft_delete_user(
        self,
        user_id: uuid.UUID,
        actor_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> None:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be deleted")

        await self.user_repo.soft_delete(user)

        await self.audit_service.log(
            action=AuditAction.USER_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.USER,
            entity_id=user_id,
            before_state={"email": user.email, "role": user.role},
            request_id=request_id,
        )
