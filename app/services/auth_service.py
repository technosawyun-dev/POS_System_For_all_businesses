from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, UserRole, UserStatus
from app.core.exceptions import AuthenticationError, BusinessRuleError, TokenError
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_secure_token,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenResponse
from app.services.audit_service import AuditService

logger = get_logger(__name__)


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.auth_repo = AuthRepository(session)
        self.audit_service = AuditService(session)

    async def login(
        self,
        email: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> tuple[TokenResponse, str]:
        user = await self.user_repo.get_by_email(email)

        if not user or not verify_password(password, user.hashed_password):
            await self.audit_service.log(
                action=AuditAction.LOGIN_FAILED,
                entity_type=EntityType.AUTH_SESSION,
                metadata={"email": email, "reason": "Invalid credentials"},
                ip_address=ip_address,
                user_agent=user_agent,
                request_id=request_id,
            )
            raise AuthenticationError("Invalid email or password")

        if user.status != UserStatus.ACTIVE:
            raise AuthenticationError(f"Account is {user.status.lower()}. Contact support.")

        access_token = create_access_token(
            subject=str(user.id),
            role=user.role,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
        )
        refresh_token_str, family_id = create_refresh_token(subject=str(user.id))

        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

        from app.core.security import decode_token
        payload = decode_token(refresh_token_str)
        jti = payload["jti"]

        await self.auth_repo.store_refresh_token(
            user_id=user.id,
            token=refresh_token_str,
            jti=jti,
            family_id=family_id,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        await self.user_repo.update_last_login(user.id)

        await self.audit_service.log(
            action=AuditAction.LOGIN,
            actor_user_id=user.id,
            tenant_id=user.tenant_id,
            entity_type=EntityType.AUTH_SESSION,
            entity_id=str(user.id),
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )

        token_response = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        return token_response, refresh_token_str

    async def refresh_tokens(
        self,
        refresh_token: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> tuple[TokenResponse, str]:
        try:
            payload = decode_refresh_token(refresh_token)
        except Exception as exc:
            raise TokenError("Invalid refresh token") from exc

        jti = payload.get("jti")
        family_id = payload.get("fid")
        user_id = payload.get("sub")

        stored_token = await self.auth_repo.get_by_jti(jti)

        if not stored_token or stored_token.is_revoked or stored_token.is_expired:
            if stored_token and family_id:
                # Token reuse detected — revoke entire family
                await self.auth_repo.revoke_family(family_id)
            raise TokenError("Refresh token is invalid or expired")

        user = await self.user_repo.get_by_id_active(uuid.UUID(user_id))
        if not user or user.status != UserStatus.ACTIVE:
            raise AuthenticationError("User account is not active")

        await self.auth_repo.revoke_token(stored_token)

        access_token = create_access_token(
            subject=str(user.id),
            role=user.role,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
        )
        new_refresh_token, new_family_id = create_refresh_token(
            subject=str(user.id), family_id=family_id
        )

        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        from app.core.security import decode_token
        new_payload = decode_token(new_refresh_token)

        await self.auth_repo.store_refresh_token(
            user_id=user.id,
            token=new_refresh_token,
            jti=new_payload["jti"],
            family_id=new_family_id,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        await self.audit_service.log(
            action=AuditAction.TOKEN_REFRESHED,
            actor_user_id=user.id,
            tenant_id=user.tenant_id,
            entity_type=EntityType.AUTH_SESSION,
            request_id=request_id,
        )

        token_response = TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        return token_response, new_refresh_token

    async def logout(
        self,
        user_id: uuid.UUID,
        refresh_token: str | None = None,
        tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> None:
        if refresh_token:
            stored_token = await self.auth_repo.get_by_token_hash(refresh_token)
            if stored_token and not stored_token.is_revoked:
                await self.auth_repo.revoke_token(stored_token)
        else:
            await self.auth_repo.revoke_all_user_tokens(user_id)

        await self.audit_service.log(
            action=AuditAction.LOGOUT,
            actor_user_id=user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.AUTH_SESSION,
            entity_id=str(user_id),
            request_id=request_id,
        )

    async def change_password(
        self,
        user_id: uuid.UUID,
        current_password: str,
        new_password: str,
        tenant_id: uuid.UUID | None = None,
        request_id: str | None = None,
    ) -> None:
        user = await self.user_repo.get_by_id_active(user_id)
        if not user:
            raise AuthenticationError("User not found")

        if not verify_password(current_password, user.hashed_password):
            raise AuthenticationError("Current password is incorrect")

        user.hashed_password = hash_password(new_password)
        await self.auth_repo.revoke_all_user_tokens(user_id)

        await self.audit_service.log(
            action=AuditAction.PASSWORD_CHANGED,
            actor_user_id=user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.USER,
            entity_id=str(user_id),
            request_id=request_id,
        )
