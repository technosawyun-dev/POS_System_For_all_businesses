from __future__ import annotations

from typing import Any


class AppBaseException(Exception):
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class AuthenticationError(AppBaseException):
    def __init__(self, message: str = "Authentication failed", details: dict[str, Any] | None = None) -> None:
        super().__init__(message=message, code="AUTHENTICATION_ERROR", status_code=401, details=details)


class AuthorizationError(AppBaseException):
    def __init__(self, message: str = "Insufficient permissions", details: dict[str, Any] | None = None) -> None:
        super().__init__(message=message, code="AUTHORIZATION_ERROR", status_code=403, details=details)


class NotFoundError(AppBaseException):
    def __init__(self, resource: str = "Resource", resource_id: Any = None) -> None:
        message = f"{resource} not found"
        if resource_id is not None:
            message = f"{resource} with id '{resource_id}' not found"
        super().__init__(message=message, code="NOT_FOUND", status_code=404)


class ConflictError(AppBaseException):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message=message, code="CONFLICT", status_code=409, details=details)


class ValidationError(AppBaseException):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message=message, code="VALIDATION_ERROR", status_code=422, details=details)


class RateLimitError(AppBaseException):
    def __init__(self, message: str = "Rate limit exceeded") -> None:
        super().__init__(message=message, code="RATE_LIMIT_EXCEEDED", status_code=429)


class TenantError(AppBaseException):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message=message, code="TENANT_ERROR", status_code=400, details=details)


class TokenError(AppBaseException):
    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message=message, code="TOKEN_ERROR", status_code=401)


class BusinessRuleError(AppBaseException):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message=message, code="BUSINESS_RULE_ERROR", status_code=400, details=details)


class SubscriptionExpiredException(AppBaseException):
    def __init__(self, message: str = "Subscription has expired. Please renew to continue.") -> None:
        super().__init__(message=message, code="SUBSCRIPTION_EXPIRED", status_code=402)


class SubscriptionSuspendedException(AppBaseException):
    def __init__(self, message: str = "Subscription is suspended. Contact support.") -> None:
        super().__init__(message=message, code="SUBSCRIPTION_SUSPENDED", status_code=402)


class FeatureDisabledException(AppBaseException):
    def __init__(self, feature_code: str) -> None:
        super().__init__(
            message=f"Feature '{feature_code}' is not available on your current plan. Upgrade required.",
            code="FEATURE_DISABLED",
            status_code=403,
            details={"feature_code": feature_code},
        )


class UsageLimitExceededException(AppBaseException):
    def __init__(self, feature_code: str, current: int, allowed: int) -> None:
        super().__init__(
            message=(
                f"{feature_code.replace('_', ' ').title()} limit exceeded. "
                f"Current: {current}. Allowed: {allowed}. Upgrade required."
            ),
            code="USAGE_LIMIT_EXCEEDED",
            status_code=402,
            details={"feature_code": feature_code, "current": current, "allowed": allowed},
        )
