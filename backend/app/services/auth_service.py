from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, UserRole, UserStatus
from app.models.password_reset_token import PasswordResetToken
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
        password: str,
        email: str | None = None,
        phone: str | None = None,
        business_code: str | None = None,
        identifier: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
        redis=None,
    ) -> tuple[TokenResponse, str]:
        from app.repositories.tenant_repository import TenantRepository
        from app.core.rate_limit import (
            clear_failed_logins,
            is_account_locked,
            record_failed_login,
        )

        tenant_repo = TenantRepository(self.session)

        # Derive a stable, non-reversible key for per-account lockout tracking.
        # Normalise to lowercase so "User@Example.com" and "user@example.com" share one counter.
        _ident_raw = (email or phone or f"{business_code}:{identifier}" or "").lower().strip()
        _account_key = f"rl:account_lock:{hashlib.sha256(_ident_raw.encode()).hexdigest()[:32]}"

        # Check per-account lockout BEFORE hitting the DB or doing any bcrypt work.
        if redis and await is_account_locked(redis, _account_key):
            raise AuthenticationError(
                "Account temporarily locked due to too many failed login attempts. "
                "Please try again in 15 minutes."
            )

        user = None
        if business_code and identifier:
            tenant = await tenant_repo.get_by_business_code(business_code)
            if tenant:
                user = await self.user_repo.get_by_phone_and_tenant(identifier, tenant.id)
                if not user:
                    user = await self.user_repo.get_by_email_and_tenant(identifier, tenant.id)
        elif email:
            user = await self.user_repo.get_by_email(email)
        elif phone:
            user = await self.user_repo.get_by_phone(phone)

        if not user or not verify_password(password, user.hashed_password):
            _id_hash = hashlib.sha256(_ident_raw.encode()).hexdigest()[:16]
            # Record failure for account lockout BEFORE committing the audit log.
            if redis:
                await record_failed_login(redis, _account_key)
            try:
                # Use an independent session so the audit write is committed even
                # though we're about to raise (which rolls back the main session).
                from app.db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as _audit_session:
                    from app.services.audit_service import AuditService as _AuditSvc
                    await _AuditSvc(_audit_session).log(
                        action=AuditAction.LOGIN_FAILED,
                        entity_type=EntityType.AUTH_SESSION,
                        metadata={"identifier_hash": _id_hash, "reason": "Invalid credentials"},
                        ip_address=ip_address,
                        user_agent=user_agent,
                        request_id=request_id,
                    )
                    await _audit_session.commit()
            except Exception:
                pass  # audit failure must never block a login attempt
            raise AuthenticationError("Invalid credentials")

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

        # Clear the failure counter now that the user has authenticated successfully.
        if redis:
            await clear_failed_logins(redis, _account_key)

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

    async def create_password_reset_token(
        self,
        email: str,
        request_id: str | None = None,
    ) -> tuple[str, str] | None:
        """
        Look up the user by email, check eligibility (BUSINESS_OWNER or RESELLER only),
        create a hashed reset token in the DB, and return (email, raw_token).
        Returns None silently if the user doesn't exist or is not eligible —
        the route always responds with the same message to prevent user enumeration.
        """
        user = await self.user_repo.get_by_email(email)
        if not user or user.role not in (UserRole.BUSINESS_OWNER, UserRole.RESELLER):
            return None

        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )

        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.session.add(reset_record)

        await self.audit_service.log(
            action=AuditAction.PASSWORD_RESET_REQUESTED,
            actor_user_id=user.id,
            tenant_id=user.tenant_id,
            entity_type=EntityType.USER,
            entity_id=str(user.id),
            request_id=request_id,
        )

        return (user.email, raw_token)

    async def reset_password(
        self,
        token: str,
        new_password: str,
        request_id: str | None = None,
    ) -> None:
        """
        Validate the reset token, update the user's password, mark the token used,
        and revoke all existing sessions so old refresh tokens are invalidated.
        """
        from sqlalchemy import select

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        result = await self.session.execute(stmt)
        reset_record = result.scalar_one_or_none()

        if reset_record is None or not reset_record.is_valid:
            raise BusinessRuleError("Invalid or expired password reset link.")

        user = await self.user_repo.get_by_id_active(reset_record.user_id)
        if not user:
            raise BusinessRuleError("Invalid or expired password reset link.")

        user.hashed_password = hash_password(new_password)
        reset_record.is_used = True

        # Revoke all active sessions so the old password can't be used via cached tokens
        await self.auth_repo.revoke_all_user_tokens(user.id)

        await self.audit_service.log(
            action=AuditAction.PASSWORD_RESET_COMPLETED,
            actor_user_id=user.id,
            tenant_id=user.tenant_id,
            entity_type=EntityType.USER,
            entity_id=str(user.id),
            request_id=request_id,
        )
