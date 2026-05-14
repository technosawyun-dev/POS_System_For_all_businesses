from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import UserRole, UserStatus
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.auth import RefreshToken
    from app.models.branch import Branch
    from app.models.permission import UserPermission
    from app.models.tenant import Tenant


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    role: Mapped[str] = mapped_column(
        String(50), nullable=False, default=UserRole.CASHIER, index=True
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=UserStatus.ACTIVE, index=True
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    primary_branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL", use_alter=True, name="fk_users_primary_branch_id_branches"),
        nullable=True,
        index=True,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)

    tenant: Mapped[Tenant | None] = relationship(
        "Tenant", back_populates="users", foreign_keys=[tenant_id]
    )
    primary_branch: Mapped[Branch | None] = relationship(
        "Branch", foreign_keys=[primary_branch_id]
    )
    branch_assignments: Mapped[list[UserBranchAssignment]] = relationship(
        "UserBranchAssignment", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    user_permissions: Mapped[list[UserPermission]] = relationship(
        "UserPermission",
        back_populates="user",
        cascade="all, delete-orphan",
        primaryjoin="User.id == UserPermission.user_id",
        foreign_keys="[UserPermission.user_id]",
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def is_super_admin(self) -> bool:
        return self.role == UserRole.SUPER_ADMIN

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE and not self.is_deleted

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"


class UserBranchAssignment(Base):
    __tablename__ = "user_branch_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "branch_id", name="uq_user_branch"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped[User] = relationship("User", back_populates="branch_assignments")
    branch: Mapped[Branch] = relationship("Branch", back_populates="user_assignments")

    def __repr__(self) -> str:
        return f"<UserBranchAssignment user={self.user_id} branch={self.branch_id}>"
