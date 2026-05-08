from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import ROLE_DEFAULT_PERMISSIONS, UserRole, UserStatus
from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.permission import Permission, RolePermission
from app.models.user import User
from app.repositories.permission_repository import PermissionRepository
from app.repositories.user_repository import UserRepository

logger = get_logger(__name__)


async def seed_permissions(session: AsyncSession) -> dict[str, Permission]:
    perm_repo = PermissionRepository(session)
    from app.core.constants import Permission as PermCode

    permission_map: dict[str, Permission] = {}

    PERMISSION_META: dict[str, tuple[str, str, str]] = {
        PermCode.USER_VIEW: ("View Users", "user", "TENANT"),
        PermCode.USER_CREATE: ("Create Users", "user", "TENANT"),
        PermCode.USER_UPDATE: ("Update Users", "user", "TENANT"),
        PermCode.USER_DELETE: ("Delete Users", "user", "TENANT"),
        PermCode.USER_MANAGE_ROLES: ("Manage User Roles", "user", "TENANT"),
        PermCode.TENANT_VIEW: ("View Tenants", "tenant", "GLOBAL"),
        PermCode.TENANT_CREATE: ("Create Tenants", "tenant", "GLOBAL"),
        PermCode.TENANT_UPDATE: ("Update Tenants", "tenant", "GLOBAL"),
        PermCode.TENANT_DELETE: ("Delete Tenants", "tenant", "GLOBAL"),
        PermCode.TENANT_MANAGE: ("Manage Tenants", "tenant", "GLOBAL"),
        PermCode.BRANCH_VIEW: ("View Branches", "branch", "TENANT"),
        PermCode.BRANCH_CREATE: ("Create Branches", "branch", "TENANT"),
        PermCode.BRANCH_UPDATE: ("Update Branches", "branch", "TENANT"),
        PermCode.BRANCH_DELETE: ("Delete Branches", "branch", "TENANT"),
        PermCode.BRANCH_MANAGE: ("Manage Branches", "branch", "TENANT"),
        PermCode.INVENTORY_VIEW: ("View Inventory", "inventory", "BRANCH"),
        PermCode.INVENTORY_CREATE: ("Create Inventory", "inventory", "BRANCH"),
        PermCode.INVENTORY_UPDATE: ("Update Inventory", "inventory", "BRANCH"),
        PermCode.INVENTORY_DELETE: ("Delete Inventory", "inventory", "BRANCH"),
        PermCode.POS_ACCESS: ("POS Access", "pos", "BRANCH"),
        PermCode.POS_SALE_CREATE: ("Create POS Sale", "pos", "BRANCH"),
        PermCode.POS_SALE_VOID: ("Void POS Sale", "pos", "BRANCH"),
        PermCode.POS_REFUND: ("POS Refund", "pos", "BRANCH"),
        PermCode.REPORT_VIEW: ("View Reports", "report", "TENANT"),
        PermCode.REPORT_PROFIT: ("View Profit Reports", "report", "TENANT"),
        PermCode.REPORT_EXPORT: ("Export Reports", "report", "TENANT"),
        PermCode.SYSTEM_ADMIN: ("System Admin", "system", "GLOBAL"),
        PermCode.AUDIT_VIEW: ("View Audit Logs", "audit", "TENANT"),
        PermCode.PERMISSION_MANAGE: ("Manage Permissions", "system", "GLOBAL"),
    }

    for code, (name, group, scope) in PERMISSION_META.items():
        existing = await perm_repo.get_by_code(code)
        if not existing:
            perm = Permission(code=code, name=name, group=group, scope=scope)
            session.add(perm)
            await session.flush()
            permission_map[code] = perm
            logger.info("seeded_permission", code=code)
        else:
            permission_map[code] = existing

    return permission_map


async def seed_role_permissions(
    session: AsyncSession, permission_map: dict[str, Permission]
) -> None:
    perm_repo = PermissionRepository(session)

    for role, perm_codes in ROLE_DEFAULT_PERMISSIONS.items():
        for code in perm_codes:
            perm = permission_map.get(code)
            if perm:
                await perm_repo.seed_role_permission(role=role, permission_id=perm.id)

    logger.info("seeded_role_permissions")


async def seed_super_admin(session: AsyncSession) -> User | None:
    user_repo = UserRepository(session)
    existing = await user_repo.get_by_email(settings.SUPER_ADMIN_EMAIL)
    if existing:
        logger.info("super_admin_already_exists", email=settings.SUPER_ADMIN_EMAIL)
        return existing

    user = User(
        email=settings.SUPER_ADMIN_EMAIL,
        hashed_password=hash_password(settings.SUPER_ADMIN_PASSWORD),
        first_name=settings.SUPER_ADMIN_FIRST_NAME,
        last_name=settings.SUPER_ADMIN_LAST_NAME,
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
    )
    session.add(user)
    await session.flush()
    logger.info("seeded_super_admin", email=settings.SUPER_ADMIN_EMAIL, user_id=str(user.id))
    return user


async def run_seeds(session: AsyncSession) -> None:
    logger.info("running_database_seeds")
    permission_map = await seed_permissions(session)
    await seed_role_permissions(session, permission_map)
    await seed_super_admin(session)
    await session.commit()
    logger.info("database_seeds_complete")
