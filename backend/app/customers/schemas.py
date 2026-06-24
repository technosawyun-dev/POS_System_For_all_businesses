from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import EmailStr, Field, computed_field, field_validator

from app.core.constants import CustomerGender, CustomerLedgerEntryType
from app.schemas.common import BaseSchema, PaginatedResponse, TimestampedSchema



class CreateCustomerRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=50)
    email: EmailStr | None = None
    date_of_birth: date | None = None
    gender: CustomerGender | None = None
    address: str | None = None
    notes: str | None = None
    credit_limit: Decimal = Field(default=Decimal("0"), ge=0)

    @field_validator("phone")
    @classmethod
    def phone_strip(cls, v: str) -> str:
        return v.strip()


class UpdateCustomerRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=1, max_length=50)
    email: EmailStr | None = None
    date_of_birth: date | None = None
    gender: CustomerGender | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("phone")
    @classmethod
    def phone_strip(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class AddContactRequest(BaseSchema):
    contact_name: str = Field(min_length=1, max_length=255)
    contact_phone: str = Field(min_length=1, max_length=50)
    contact_relationship: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class AddNoteRequest(BaseSchema):
    note: str = Field(min_length=1, max_length=2000)


class RecordPaymentRequest(BaseSchema):
    amount: Decimal = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)
    reference_type: str | None = Field(default=None, max_length=100)
    reference_id: str | None = Field(default=None, max_length=255)


class AdjustBalanceRequest(BaseSchema):
    # Signed amount: positive = increase debt, negative = decrease debt / grant credit
    amount: Decimal
    note: str | None = Field(default=None, max_length=500)
    reference_type: str | None = Field(default=None, max_length=100)
    reference_id: str | None = Field(default=None, max_length=255)



class CustomerContactResponse(TimestampedSchema):
    customer_id: uuid.UUID
    contact_name: str
    contact_phone: str
    contact_relationship: str | None
    notes: str | None


class CustomerNoteResponse(TimestampedSchema):
    customer_id: uuid.UUID
    note: str
    created_by_user_id: uuid.UUID


class CustomerLedgerResponse(TimestampedSchema):
    customer_id: uuid.UUID
    tenant_id: uuid.UUID
    entry_type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    reference_type: str | None
    reference_id: str | None
    note: str | None
    created_by_user_id: uuid.UUID


class CustomerResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    customer_code: str
    name: str
    phone: str
    email: str | None
    date_of_birth: date | None
    gender: str | None
    address: str | None
    notes: str | None
    credit_limit: Decimal
    current_balance: Decimal
    is_active: bool
    deleted_at: datetime | None
    contacts: list[CustomerContactResponse] = Field(default_factory=list)


class CustomerSummaryResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    customer_code: str
    name: str
    phone: str
    email: str | None
    current_balance: Decimal
    credit_limit: Decimal
    is_active: bool

    @computed_field
    @property
    def balance(self) -> Decimal:
        return self.current_balance


class CustomerStatementResponse(BaseSchema):
    customer: CustomerResponse
    current_balance: Decimal
    opening_balance: Decimal
    total_debited: Decimal
    total_credited: Decimal
    ledger_entries: list[CustomerLedgerResponse]
    date_from: datetime | None
    date_to: datetime | None


PaginatedCustomerResponse = PaginatedResponse[CustomerSummaryResponse]
