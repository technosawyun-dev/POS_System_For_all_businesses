from __future__ import annotations

import uuid

from pydantic import EmailStr, Field, field_validator, model_validator

from app.schemas.common import BaseSchema


class LoginRequest(BaseSchema):
    # Owner/admin login
    email: str | None = None
    # Staff login: business_code + phone (or email)
    business_code: str | None = None
    identifier: str | None = None  # phone number or email for staff
    password: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_mode(self) -> "LoginRequest":
        if self.business_code:
            if not self.identifier:
                raise ValueError("identifier (phone or email) is required for staff login")
        elif not self.email:
            raise ValueError("email is required for owner/admin login")
        return self


class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseSchema):
    refresh_token: str


class LogoutRequest(BaseSchema):
    refresh_token: str | None = None


class ChangePasswordRequest(BaseSchema):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class TokenPayload(BaseSchema):
    sub: str
    role: str
    tenant_id: str | None = None
    type: str
    jti: str
