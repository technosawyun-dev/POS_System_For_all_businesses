from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, UserRole, UserStatus
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError, AuthorizationError
from app.core.security import hash_password_async, normalize_phone
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.branch_repository import BranchRepository
from app.repositories.tenant_repository import TenantRepository
from app.services.audit_service import AuditService
from app.schemas.user import UserCreateRequest, UserUpdateRequest


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.branch_repo = BranchRepository(session)
        self.tenant_repo = TenantRepository(session)
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

        # Staff (manager/cashier/inventory) only ever log in via business code +
        # phone, so their email only needs to be unique within their own
        # business — see uq_users_email_per_tenant_staff. Owner/reseller emails
        # log in with plain email+password and must stay globally unique.
        is_staff_role = data.role in (UserRole.MANAGER, UserRole.CASHIER, UserRole.INVENTORY_STAFF)
        email_scope_tenant_id = actor_tenant_id if is_staff_role else None
        if await self.user_repo.email_exists(data.email, tenant_id=email_scope_tenant_id):
            raise ConflictError(f"User with email '{data.email}' already exists")

        user = await self.user_repo.create(
            email=data.email,
            hashed_password=await hash_password_async(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=normalize_phone(data.phone),
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

    async def _assert_not_last_active_owner(self, user: User) -> None:
        """Raise if `user` is a BUSINESS_OWNER and removing/demoting them would
        leave their tenant with zero active owners — with no one left who can
        undo it (MANAGER can't reach the status/role/delete endpoints)."""
        if user.role != UserRole.BUSINESS_OWNER or user.tenant_id is None:
            return
        result = await self.session.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.tenant_id == user.tenant_id,
                User.role == UserRole.BUSINESS_OWNER,
                User.status == UserStatus.ACTIVE,
                User.is_deleted.is_(False),
                User.id != user.id,
            )
        )
        other_active_owners = result.scalar_one()
        if other_active_owners == 0:
            raise BusinessRuleError(
                "Cannot remove the last active owner of this business. "
                "Promote another user to owner first."
            )

    def _assert_same_tenant(
        self,
        user: User,
        actor_id: uuid.UUID | None,
        actor_tenant_id: uuid.UUID | None,
        actor_role: str,
    ) -> None:
        """Raise AuthorizationError if actor cannot access a user from another tenant."""
        if actor_role == UserRole.SUPER_ADMIN.value:
            return
        # Always allow reading/writing one's own record
        if actor_id is not None and user.id == actor_id:
            return
        if actor_tenant_id is None or user.tenant_id != actor_tenant_id:
            raise AuthorizationError("User not found")

    async def get_user(
        self,
        user_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        actor_tenant_id: uuid.UUID | None = None,
        actor_role: str = "",
    ) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        self._assert_same_tenant(user, actor_id, actor_tenant_id, actor_role)
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
        actor_role: str = "",
        request_id: str | None = None,
    ) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        self._assert_same_tenant(user, actor_id, tenant_id, actor_role)

        update_data = data.model_dump(exclude_none=True)
        if "phone" in update_data:
            update_data["phone"] = normalize_phone(update_data["phone"])

        # primary_branch_id drives branch-scoping for CASHIER/INVENTORY_STAFF
        # (assert_branch_access, cashier-session open, checkout, adjustments).
        # Letting anyone reassign it — including a staff member changing their
        # own — would let them grant themselves access to any branch. Only the
        # business owner (or platform admin) may move a user between branches.
        if "primary_branch_id" in update_data and actor_role not in (
            UserRole.SUPER_ADMIN.value, UserRole.BUSINESS_OWNER.value,
        ):
            raise AuthorizationError(
                "Only the business owner can reassign a user's branch"
            )

        before_state = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "primary_branch_id": str(user.primary_branch_id) if user.primary_branch_id else None,
        }

        user = await self.user_repo.update(user, **update_data)

        # The tenant's own contact phone is a denormalized copy of its owner's
        # phone, set once at registration (see registration_service.py) and
        # never touched again. Keep it in sync so Settings/Admin Overview
        # don't keep showing a phone number the owner changed long ago.
        if "phone" in update_data and user.tenant_id:
            tenant = await self.tenant_repo.get_active_by_id(user.tenant_id)
            if tenant and tenant.owner_id == user.id and tenant.phone != user.phone:
                await self.tenant_repo.update(tenant, phone=user.phone)

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
        actor_role: str = "",
        request_id: str | None = None,
    ) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        self._assert_same_tenant(user, actor_id, tenant_id, actor_role)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be modified")

        old_status = user.status
        if old_status == UserStatus.ACTIVE and status != UserStatus.ACTIVE:
            await self._assert_not_last_active_owner(user)

        # Reactivating a previously-deactivated user re-adds them to the active
        # headcount — re-run the same max-users entitlement check create_user()
        # enforces, or a tenant at its plan's limit can bypass it by suspending
        # one user and reactivating a different one.
        if old_status != UserStatus.ACTIVE and status == UserStatus.ACTIVE and user.tenant_id is not None:
            from app.subscriptions.entitlements import EntitlementService
            result = await self.session.execute(
                select(func.count())
                .select_from(User)
                .where(
                    User.tenant_id == user.tenant_id,
                    User.status == UserStatus.ACTIVE,
                    User.is_deleted.is_(False),
                )
            )
            active_count = result.scalar_one()
            ent_svc = EntitlementService(self.session)
            await ent_svc.validate_limit(user.tenant_id, "users", active_count)

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
        actor_role: str = "",
        request_id: str | None = None,
    ) -> User:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        self._assert_same_tenant(user, actor_id, tenant_id, actor_role)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be modified")
        if role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("Cannot assign SUPER_ADMIN role")
        if role == UserRole.RESELLER and user.tenant_id is not None:
            raise AuthorizationError("Cannot assign RESELLER role to a tenant-scoped user. Create a new RESELLER account instead.")
        if user.role == UserRole.RESELLER and role != UserRole.RESELLER:
            raise AuthorizationError("Cannot change a RESELLER's role to a tenant-scoped role. Create a new user account instead.")
        if user.role == UserRole.BUSINESS_OWNER and role != UserRole.BUSINESS_OWNER and user.status == UserStatus.ACTIVE:
            await self._assert_not_last_active_owner(user)

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
        actor_role: str = "",
        request_id: str | None = None,
    ) -> None:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        self._assert_same_tenant(user, actor_id, tenant_id, actor_role)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be modified")

        await self.user_repo.update(user, hashed_password=await hash_password_async(new_password))

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
        actor_role: str = "",
        request_id: str | None = None,
    ) -> None:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        self._assert_same_tenant(user, actor_id, tenant_id, actor_role)
        if user.role == UserRole.SUPER_ADMIN:
            raise AuthorizationError("SUPER_ADMIN account cannot be deleted")
        if user.status == UserStatus.ACTIVE:
            await self._assert_not_last_active_owner(user)

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
