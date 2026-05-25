from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import BillingCycle, PaymentProofStatus, SubscriptionStatus  # noqa: F401
from app.db.base import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        Index("ix_subscription_plans_code", "code"),
        Index("ix_subscription_plans_is_active", "is_active"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    billing_cycle: Mapped[str] = mapped_column(
        String(20), nullable=False, default=BillingCycle.MONTHLY
    )
    price: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_trial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    entitlements: Mapped[list[PlanEntitlement]] = relationship(
        "PlanEntitlement", back_populates="plan", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[list[TenantSubscription]] = relationship(
        "TenantSubscription", back_populates="plan"
    )

    def __repr__(self) -> str:
        return f"<SubscriptionPlan {self.code} price={self.price}>"


class PlanEntitlement(Base):
    __tablename__ = "plan_entitlements"
    __table_args__ = (
        UniqueConstraint("plan_id", "feature_code", name="uq_plan_entitlements_plan_feature"),
        Index("ix_plan_entitlements_plan_id", "plan_id"),
    )

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subscription_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    feature_code: Mapped[str] = mapped_column(String(100), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    limit_value: Mapped[int | None] = mapped_column(Integer, nullable=True)

    plan: Mapped[SubscriptionPlan] = relationship(
        "SubscriptionPlan", back_populates="entitlements"
    )

    def __repr__(self) -> str:
        return f"<PlanEntitlement plan={self.plan_id} feature={self.feature_code}>"


class TenantSubscription(Base):
    __tablename__ = "tenant_subscriptions"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_tenant_subscriptions_tenant_id"),
        Index("ix_tenant_subscriptions_tenant_id", "tenant_id"),
        Index("ix_tenant_subscriptions_plan_id", "plan_id"),
        Index("ix_tenant_subscriptions_status", "status"),
        Index("ix_tenant_subscriptions_expires_at", "expires_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=SubscriptionStatus.TRIAL
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_renew: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    plan: Mapped[SubscriptionPlan] = relationship(
        "SubscriptionPlan", back_populates="subscriptions"
    )
    history: Mapped[list[SubscriptionHistory]] = relationship(
        "SubscriptionHistory", back_populates="subscription"
    )
    payment_proofs: Mapped[list[PaymentProof]] = relationship(
        "PaymentProof", back_populates="subscription"
    )

    def __repr__(self) -> str:
        return f"<TenantSubscription tenant={self.tenant_id} status={self.status}>"


class SubscriptionHistory(Base):
    __tablename__ = "subscription_histories"
    __table_args__ = (
        Index("ix_subscription_histories_tenant_id", "tenant_id"),
        Index("ix_subscription_histories_subscription_id", "subscription_id"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    change_type: Mapped[str] = mapped_column(String(50), nullable=False)
    old_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subscription_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    new_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subscription_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    old_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    subscription: Mapped[TenantSubscription] = relationship(
        "TenantSubscription", back_populates="history"
    )
    old_plan: Mapped[SubscriptionPlan | None] = relationship(
        "SubscriptionPlan", foreign_keys=[old_plan_id]
    )
    new_plan: Mapped[SubscriptionPlan | None] = relationship(
        "SubscriptionPlan", foreign_keys=[new_plan_id]
    )

    def __repr__(self) -> str:
        return f"<SubscriptionHistory {self.change_type} tenant={self.tenant_id}>"


class PaymentProof(Base):
    __tablename__ = "payment_proofs"
    __table_args__ = (
        Index("ix_payment_proofs_tenant_id", "tenant_id"),
        Index("ix_payment_proofs_subscription_id", "subscription_id"),
        Index("ix_payment_proofs_status", "status"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proof_file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=PaymentProofStatus.PENDING
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    subscription: Mapped[TenantSubscription] = relationship(
        "TenantSubscription", back_populates="payment_proofs"
    )

    def __repr__(self) -> str:
        return f"<PaymentProof tenant={self.tenant_id} status={self.status}>"


class TenantEntitlementOverride(Base):
    __tablename__ = "tenant_entitlement_overrides"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "feature_code", name="uq_tenant_entitlement_overrides_tenant_feature"
        ),
        Index("ix_tenant_entitlement_overrides_tenant_id", "tenant_id"),
        Index("ix_tenant_entitlement_overrides_feature_code", "feature_code"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    feature_code: Mapped[str] = mapped_column(String(100), nullable=False)
    enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    limit_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<TenantEntitlementOverride tenant={self.tenant_id} feature={self.feature_code}>"
