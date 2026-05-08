from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Header, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import AuthenticationError, AuthorizationError, ValidationError
from app.core.logging import get_logger
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

logger = get_logger(__name__)

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    token: str | None = None

    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        # Try cookie fallback
        token = request.cookies.get("access_token")

    if not token:
        raise AuthenticationError("No authentication token provided")

    payload = decode_access_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AuthenticationError("Invalid token payload")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise AuthenticationError("Invalid user identifier in token")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id_active(user_id)

    if not user:
        raise AuthenticationError("User not found or deactivated")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    async def _checker(current_user: CurrentUser) -> User:
        if current_user.role not in [r.value for r in roles]:
            raise AuthorizationError(
                f"Role '{current_user.role}' is not authorized for this operation"
            )
        return current_user
    return Depends(_checker)


async def require_super_admin(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.SUPER_ADMIN.value:
        raise AuthorizationError("Super admin access required")
    return current_user


async def require_reseller_or_above(current_user: CurrentUser) -> User:
    allowed = {UserRole.SUPER_ADMIN.value, UserRole.RESELLER.value}
    if current_user.role not in allowed:
        raise AuthorizationError("Reseller or higher access required")
    return current_user


async def require_tenant_admin(current_user: CurrentUser) -> User:
    allowed = {UserRole.SUPER_ADMIN.value, UserRole.RESELLER.value, UserRole.BUSINESS_OWNER.value}
    if current_user.role not in allowed:
        raise AuthorizationError("Business owner or higher access required")
    return current_user


async def require_manager_or_above(current_user: CurrentUser) -> User:
    allowed = {
        UserRole.SUPER_ADMIN.value,
        UserRole.RESELLER.value,
        UserRole.BUSINESS_OWNER.value,
        UserRole.MANAGER.value,
    }
    if current_user.role not in allowed:
        raise AuthorizationError("Manager or higher access required")
    return current_user


async def require_inventory_access(current_user: CurrentUser) -> User:
    """INVENTORY_STAFF, MANAGER, BUSINESS_OWNER, RESELLER, SUPER_ADMIN"""
    allowed = {
        UserRole.SUPER_ADMIN.value,
        UserRole.RESELLER.value,
        UserRole.BUSINESS_OWNER.value,
        UserRole.MANAGER.value,
        UserRole.INVENTORY_STAFF.value,
    }
    if current_user.role not in allowed:
        raise AuthorizationError("Inventory staff or higher access required")
    return current_user


DbSession = Annotated[AsyncSession, Depends(get_db)]


def get_request_id(request: Request) -> str:
    return request.state.request_id if hasattr(request.state, "request_id") else ""


def get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("User-Agent")


RequestId = Annotated[str, Depends(get_request_id)]
ClientIp = Annotated[str | None, Depends(get_client_ip)]
UserAgent = Annotated[str | None, Depends(get_user_agent)]


def get_effective_tenant_id(
    current_user: CurrentUser,
    tenant_id: str | None = Query(default=None, description="Target tenant (SUPER_ADMIN only)"),
) -> uuid.UUID:
    """
    Resolves the tenant_id for the current request.
    - Regular users: always use their own tenant_id from JWT
    - SUPER_ADMIN: must pass ?tenant_id= query param
    """
    if current_user.tenant_id:
        return current_user.tenant_id
    if current_user.role == UserRole.SUPER_ADMIN and tenant_id:
        try:
            return uuid.UUID(tenant_id)
        except ValueError:
            raise ValidationError("Invalid tenant_id format")
    raise ValidationError("tenant_id query param is required for SUPER_ADMIN")


EffectiveTenantId = Annotated[uuid.UUID, Depends(get_effective_tenant_id)]
