from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CustomerGender, CustomerLedgerEntryType
from app.db.base import Base


class CustomerCounter(Base):
    """
    Per-tenant sequence counter for generating customer codes (CUS-000001).
    One row per tenant, locked with SELECT FOR UPDATE during customer creation.
    """

    __tablename__ = "customer_counters"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_customer_counters_tenant_id"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    last_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<CustomerCounter tenant={self.tenant_id} last_seq={self.last_seq}>"


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "customer_code", name="uq_customers_tenant_code"),
        UniqueConstraint("tenant_id", "phone", name="uq_customers_tenant_phone"),
        Index("ix_customers_tenant_id", "tenant_id"),
        Index("ix_customers_phone", "phone"),
        Index("ix_customers_customer_code", "customer_code"),
        Index("ix_customers_is_active", "is_active"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Financial tracking — balance = total outstanding debt
    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )
    current_balance: Mapped[Decimal] = mapped_column(
        Numeric(15, 4), nullable=False, default=Decimal("0")
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    contacts: Mapped[list[CustomerContact]] = relationship(
        "CustomerContact", back_populates="customer", cascade="all, delete-orphan"
    )
    notes_list: Mapped[list[CustomerNote]] = relationship(
        "CustomerNote", back_populates="customer", cascade="all, delete-orphan"
    )
    ledger_entries: Mapped[list[CustomerLedger]] = relationship(
        "CustomerLedger", back_populates="customer", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Customer code={self.customer_code} name={self.name}>"


class CustomerContact(Base):
    __tablename__ = "customer_contacts"
    __table_args__ = (
        Index("ix_customer_contacts_customer_id", "customer_id"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    # Column named "contact_relationship" to avoid shadowing SQLAlchemy's relationship()
    contact_relationship: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer: Mapped[Customer] = relationship("Customer", back_populates="contacts")

    def __repr__(self) -> str:
        return f"<CustomerContact name={self.contact_name} phone={self.contact_phone}>"


class CustomerNote(Base):
    __tablename__ = "customer_notes"
    __table_args__ = (
        Index("ix_customer_notes_customer_id", "customer_id"),
        Index("ix_customer_notes_created_by", "created_by_user_id"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    customer: Mapped[Customer] = relationship("Customer", back_populates="notes_list")

    def __repr__(self) -> str:
        return f"<CustomerNote customer={self.customer_id}>"


class CustomerLedger(Base):
    """
    Immutable financial ledger for customer balance tracking.
    Every balance change creates one record here — never updated after creation.

    Balance semantics:
      current_balance > 0  →  customer owes money (debt)
      current_balance < 0  →  customer has credit

    Entry direction:
      SALE_DEBT      → balance_after = balance_before + amount  (debt increases)
      PAYMENT        → balance_after = balance_before - amount  (debt decreases)
      REFUND_CREDIT  → balance_after = balance_before - amount  (credit reduces debt)
      ADJUSTMENT     → amount is signed; positive = debt increase, negative = decrease
    """

    __tablename__ = "customer_ledger"
    __table_args__ = (
        Index("ix_customer_ledger_customer_id", "customer_id"),
        Index("ix_customer_ledger_tenant_id", "tenant_id"),
        Index("ix_customer_ledger_entry_type", "entry_type"),
        Index("ix_customer_ledger_created_at", "created_at"),
        Index("ix_customer_ledger_reference", "reference_type", "reference_id"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    entry_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Always stored as a positive absolute value; direction is inferred from entry_type
    # Exception: ADJUSTMENT uses a signed amount (positive = debt, negative = credit)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    balance_before: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    reference_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    customer: Mapped[Customer] = relationship("Customer", back_populates="ledger_entries")

    def __repr__(self) -> str:
        return (
            f"<CustomerLedger type={self.entry_type} "
            f"amount={self.amount} after={self.balance_after}>"
        )
