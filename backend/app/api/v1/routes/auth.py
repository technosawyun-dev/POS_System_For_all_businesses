from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response

from app.api.deps import (
    ClientIp,
    CurrentUser,
    DbSession,
    RequestId,
    UserAgent,
)
from app.core.config import settings
from app.core.rate_limit import check_rate_limit, check_registration_rate_limit
from app.db.redis import get_redis_optional
from app.notifications.email import send_password_reset_email
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
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
    redis=Depends(get_redis_optional),
) -> TokenResponse:
    service = AuthService(db)
    token_response, refresh_token = await service.login(
        email=payload.email,
        phone=payload.phone,
        business_code=payload.business_code,
        identifier=payload.identifier,
        password=payload.password,
        ip_address=ip,
        user_agent=ua,
        request_id=request_id,
        redis=redis,
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
    request: Request,
    response: Response,
    db: DbSession,
    ip: ClientIp,
    ua: UserAgent,
    request_id: RequestId,
) -> TokenResponse:
    from app.core.exceptions import AuthenticationError as _AuthErr
    # Read refresh token from httponly cookie (preferred) or fall back to JSON body
    token_str: str | None = request.cookies.get(settings.JWT_REFRESH_TOKEN_COOKIE_NAME)
    if not token_str:
        try:
            body = await request.json()
            token_str = body.get("refresh_token")
        except Exception:
            pass
    if not token_str:
        raise _AuthErr("No refresh token provided")
    service = AuthService(db)
    token_response, new_refresh_token = await service.refresh_tokens(
        refresh_token=token_str,
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
    request: Request,
    response: Response,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    # Prefer cookie; fall back to JSON body for backward compatibility
    token_str: str | None = request.cookies.get(settings.JWT_REFRESH_TOKEN_COOKIE_NAME)
    if not token_str:
        try:
            body = await request.json()
            token_str = body.get("refresh_token")
        except Exception:
            pass
    service = AuthService(db)
    await service.logout(
        user_id=current_user.id,
        refresh_token=token_str,
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


@router.post("/forgot-password", response_model=SuccessResponse, summary="Request a password reset link")
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: DbSession,
    request_id: RequestId,
    ip: ClientIp,
    redis=Depends(get_redis_optional),
) -> SuccessResponse:
    # Rate limit: 5 attempts per email per hour to prevent abuse
    await check_rate_limit(
        redis=redis,
        key=f"rate:forgot_password:{payload.email.lower()}",
        max_requests=5,
        window_seconds=3600,
        error_message="Too many password reset requests. Please try again in an hour.",
    )
    service = AuthService(db)
    result = await service.create_password_reset_token(
        email=payload.email.lower().strip(),
        request_id=request_id,
    )
    if result:
        email, raw_token = result
        # Email is sent AFTER the DB session commits (BackgroundTask runs post-response)
        background_tasks.add_task(send_password_reset_email, email, raw_token)
    # Always return the same message to prevent user enumeration
    return SuccessResponse(message="If an account with that email exists, a password reset link has been sent.")


@router.post("/reset-password", response_model=SuccessResponse, summary="Reset password using a reset token")
async def reset_password(
    payload: ResetPasswordRequest,
    db: DbSession,
    request_id: RequestId,
    ip: ClientIp,
    redis=Depends(get_redis_optional),
) -> SuccessResponse:
    # Rate limit: 10 attempts per IP per hour — token entropy is high but limit anyway
    await check_rate_limit(
        redis=redis,
        key=f"rate:reset_password:{ip or 'unknown'}",
        max_requests=10,
        window_seconds=3600,
        error_message="Too many password reset attempts. Please try again in an hour.",
    )
    service = AuthService(db)
    await service.reset_password(
        token=payload.token,
        new_password=payload.new_password,
        request_id=request_id,
    )
    return SuccessResponse(message="Password reset successfully. You can now log in with your new password.")


@router.post("/register", response_model=RegistrationResponse, status_code=201, summary="Self-service business registration")
async def register(
    payload: RegisterRequest,
    response: Response,
    db: DbSession,
    ip: ClientIp,
    ua: UserAgent,
    request_id: RequestId,
    redis=Depends(get_redis_optional),
    ref: str | None = Query(default=None, description="Referral code from ?ref=CODE link"),
) -> RegistrationResponse:
    # Merge query-param referral code into payload (query param takes precedence)
    if ref and not payload.referral_code:
        payload.referral_code = ref.strip().upper()
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
