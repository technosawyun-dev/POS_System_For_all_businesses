from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.core.constants import UserRole, UserStatus
from app.schemas.common import BaseSchema, TimestampedSchema


_ASSIGNABLE_ROLES = {
    UserRole.BUSINESS_OWNER,
    UserRole.MANAGER,
    UserRole.CASHIER,
    UserRole.INVENTORY_STAFF,
    UserRole.RESELLER,
}


class UserCreateRequest(BaseSchema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    role: UserRole = UserRole.CASHIER
    primary_branch_id: uuid.UUID | None = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: UserRole) -> UserRole:
        if v not in _ASSIGNABLE_ROLES:
            raise ValueError(f"Role '{v}' cannot be assigned. Allowed: {[r.value for r in _ASSIGNABLE_ROLES]}")
        return v


class UserUpdateRequest(BaseSchema):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    avatar_url: str | None = None
    primary_branch_id: uuid.UUID | None = None


class UserStatusUpdateRequest(BaseSchema):
    status: UserStatus


class UserRoleUpdateRequest(BaseSchema):
    role: UserRole

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: UserRole) -> UserRole:
        if v not in _ASSIGNABLE_ROLES:
            raise ValueError(f"Role '{v}' cannot be assigned. Allowed: {[r.value for r in _ASSIGNABLE_ROLES]}")
        return v


class UserResponse(TimestampedSchema):
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: str | None
    role: str
    status: str
    tenant_id: uuid.UUID | None
    primary_branch_id: uuid.UUID | None
    last_login_at: datetime | None
    is_deleted: bool


class UserSummaryResponse(BaseSchema):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    status: str
    tenant_id: uuid.UUID | None


class UserPasswordResetRequest(BaseSchema):
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


class UserBranchAssignmentRequest(BaseSchema):
    branch_id: uuid.UUID
    is_primary: bool = False


class UserBranchAssignmentResponse(TimestampedSchema):
    user_id: uuid.UUID
    branch_id: uuid.UUID
    tenant_id: uuid.UUID
    is_primary: bool
