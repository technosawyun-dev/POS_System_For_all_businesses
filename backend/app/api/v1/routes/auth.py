from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.api.deps import (
    ClientIp,
    CurrentUser,
    DbSession,
    RequestId,
    UserAgent,
)
from app.core.config import settings
from app.core.rate_limit import check_registration_rate_limit
from app.db.redis import get_redis
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.common import SuccessResponse
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.subscriptions.schemas import RegisterRequest, RegistrationResponse
from app.services.registration_service import RegistrationService

router = APIRouter()


@router.post("/login", response_model=TokenResponse, summary="User login")
async def login(
    payload: LoginRequest,
    response: Response,
    db: DbSession,
    ip: ClientIp,
    ua: UserAgent,
    request_id: RequestId,
) -> TokenResponse:
    service = AuthService(db)
    token_response, refresh_token = await service.login(
        email=payload.email,
        business_code=payload.business_code,
        identifier=payload.identifier,
        password=payload.password,
        ip_address=ip,
        user_agent=ua,
        request_id=request_id,
    )
    response.set_cookie(
        key=settings.JWT_REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return token_response


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh_token(
    payload: RefreshTokenRequest,
    response: Response,
    db: DbSession,
    ip: ClientIp,
    ua: UserAgent,
    request_id: RequestId,
) -> TokenResponse:
    service = AuthService(db)
    token_response, new_refresh_token = await service.refresh_tokens(
        refresh_token=payload.refresh_token,
        ip_address=ip,
        user_agent=ua,
        request_id=request_id,
    )
    response.set_cookie(
        key=settings.JWT_REFRESH_TOKEN_COOKIE_NAME,
        value=new_refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return token_response


@router.post("/logout", response_model=SuccessResponse, summary="Logout user")
async def logout(
    payload: LogoutRequest,
    response: Response,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    service = AuthService(db)
    await service.logout(
        user_id=current_user.id,
        refresh_token=payload.refresh_token,
        tenant_id=current_user.tenant_id,
        request_id=request_id,
    )
    response.delete_cookie(key=settings.JWT_REFRESH_TOKEN_COOKIE_NAME)
    return SuccessResponse(message="Logged out successfully")


@router.post("/change-password", response_model=SuccessResponse, summary="Change password")
async def change_password(
    payload: ChangePasswordRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    service = AuthService(db)
    await service.change_password(
        user_id=current_user.id,
        current_password=payload.current_password,
        new_password=payload.new_password,
        tenant_id=current_user.tenant_id,
        request_id=request_id,
    )
    return SuccessResponse(message="Password changed successfully")


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/register", response_model=RegistrationResponse, status_code=201, summary="Self-service business registration")
async def register(
    payload: RegisterRequest,
    response: Response,
    db: DbSession,
    ip: ClientIp,
    ua: UserAgent,
    request_id: RequestId,
    redis=Depends(get_redis),
) -> RegistrationResponse:
    await check_registration_rate_limit(redis, ip or "unknown")
    svc = RegistrationService(db)
    result = await svc.register(
        data=payload,
        ip_address=ip,
        user_agent=ua,
        request_id=request_id,
        redis=redis,
    )
    response.set_cookie(
        key=settings.JWT_REFRESH_TOKEN_COOKIE_NAME,
        value=result.refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return result
