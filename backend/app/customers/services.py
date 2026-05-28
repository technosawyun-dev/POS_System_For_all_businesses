from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, CustomerLedgerEntryType, EntityType
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.customers.models import Customer, CustomerContact, CustomerLedger, CustomerNote
from app.customers.repositories import (
    CustomerContactRepository,
    CustomerCounterRepository,
    CustomerLedgerRepository,
    CustomerNoteRepository,
    CustomerRepository,
)
from app.customers.schemas import (
    AddContactRequest,
    AddNoteRequest,
    AdjustBalanceRequest,
    CreateCustomerRequest,
    CustomerStatementResponse,
    RecordPaymentRequest,
    UpdateCustomerRequest,
)
from app.services.audit_service import AuditService


def _format_customer_code(seq: int) -> str:
    return f"CUS-{seq:06d}"


class CustomerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CustomerRepository(session)
        self.contact_repo = CustomerContactRepository(session)
        self.note_repo = CustomerNoteRepository(session)
        self.ledger_repo = CustomerLedgerRepository(session)
        self.counter_repo = CustomerCounterRepository(session)
        self.audit = AuditService(session)


    async def create_customer(
        self,
        tenant_id: uuid.UUID,
        data: CreateCustomerRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Customer:
        if await self.repo.phone_exists(tenant_id, data.phone):
            raise ConflictError(
                f"A customer with phone '{data.phone}' already exists in this tenant"
            )

        # Transaction-safe sequential code via locked counter row
        counter = await self.counter_repo.get_or_create_locked(tenant_id)
        seq = await self.counter_repo.increment(counter)
        customer_code = _format_customer_code(seq)

        customer = await self.repo.create(
            tenant_id=tenant_id,
            customer_code=customer_code,
            name=data.name,
            phone=data.phone,
            email=str(data.email) if data.email else None,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            address=data.address,
            notes=data.notes,
            credit_limit=Decimal("0"),
            current_balance=Decimal("0"),
        )

        await self.audit.log(
            action=AuditAction.CUSTOMER_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CUSTOMER,
            entity_id=customer.id,
            after_state={"customer_code": customer_code, "name": customer.name, "phone": customer.phone},
            request_id=request_id,
        )
        return await self.repo.get_with_contacts(customer.id, tenant_id)

    async def get_customer(
        self, customer_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Customer:
        customer = await self.repo.get_with_contacts(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)
        return customer

    async def list_customers(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        is_active: bool | None = None,
    ) -> tuple[list[Customer], int]:
        offset = (page - 1) * page_size
        return await self.repo.get_by_tenant(
            tenant_id, offset=offset, limit=page_size, is_active=is_active
        )

    async def search_customers(
        self,
        tenant_id: uuid.UUID,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Customer], int]:
        offset = (page - 1) * page_size
        return await self.repo.search(tenant_id, query, offset=offset, limit=page_size)

    async def update_customer(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: UpdateCustomerRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Customer:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)

        update_data = data.model_dump(exclude_none=True)

        if "phone" in update_data:
            if await self.repo.phone_exists(tenant_id, update_data["phone"], exclude_id=customer_id):
                raise ConflictError(
                    f"A customer with phone '{update_data['phone']}' already exists in this tenant"
                )

        if "email" in update_data and update_data["email"] is not None:
            update_data["email"] = str(update_data["email"])

        before = {"name": customer.name, "phone": customer.phone, "is_active": customer.is_active}
        customer = await self.repo.update(customer, **update_data)

        await self.audit.log(
            action=AuditAction.CUSTOMER_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CUSTOMER,
            entity_id=customer_id,
            before_state=before,
            after_state=update_data,
            request_id=request_id,
        )
        return await self.repo.get_with_contacts(customer_id, tenant_id)

    async def soft_delete_customer(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)
        if customer.current_balance != Decimal("0"):
            raise BusinessRuleError(
                "Cannot delete a customer with an outstanding balance. "
                "Clear the balance first."
            )
        await self.repo.soft_delete(customer)
        await self.audit.log(
            action=AuditAction.CUSTOMER_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CUSTOMER,
            entity_id=customer_id,
            request_id=request_id,
        )


    async def add_contact(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: AddContactRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> CustomerContact:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)

        contact = await self.contact_repo.create(
            customer_id=customer_id,
            contact_name=data.contact_name,
            contact_phone=data.contact_phone,
            contact_relationship=data.contact_relationship,
            notes=data.notes,
        )
        await self.audit.log(
            action=AuditAction.CUSTOMER_CONTACT_ADDED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CUSTOMER_CONTACT,
            entity_id=contact.id,
            after_state={"customer_id": str(customer_id), "contact_name": data.contact_name},
            request_id=request_id,
        )
        return contact


    async def add_note(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: AddNoteRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> CustomerNote:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)

        note = await self.note_repo.create(
            customer_id=customer_id,
            note=data.note,
            created_by_user_id=actor_id,
        )
        await self.audit.log(
            action=AuditAction.CUSTOMER_NOTE_ADDED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CUSTOMER_NOTE,
            entity_id=note.id,
            after_state={"customer_id": str(customer_id)},
            request_id=request_id,
        )
        return note


    async def _create_ledger_entry(
        self,
        customer: Customer,
        tenant_id: uuid.UUID,
        entry_type: CustomerLedgerEntryType,
        amount: Decimal,
        actor_id: uuid.UUID,
        note: str | None = None,
        reference_type: str | None = None,
        reference_id: str | None = None,
    ) -> CustomerLedger:
        """
        Core ledger mutation. Computes balance_after based on entry_type,
        persists the immutable ledger row, and updates customer.current_balance.
        Must be called inside an open transaction.
        """
        balance_before = customer.current_balance

        if entry_type == CustomerLedgerEntryType.SALE_DEBT:
            balance_after = balance_before + amount
        elif entry_type in (CustomerLedgerEntryType.PAYMENT, CustomerLedgerEntryType.REFUND_CREDIT):
            balance_after = balance_before - amount
        else:
            # ADJUSTMENT: amount is signed
            balance_after = balance_before + amount

        entry = await self.ledger_repo.create(
            customer_id=customer.id,
            tenant_id=tenant_id,
            entry_type=entry_type,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            note=note,
            created_by_user_id=actor_id,
        )

        # Update the materialized balance on the customer row
        customer.current_balance = balance_after
        await self.session.flush()
        return entry

    async def record_payment(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: RecordPaymentRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> CustomerLedger:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)

        entry = await self._create_ledger_entry(
            customer=customer,
            tenant_id=tenant_id,
            entry_type=CustomerLedgerEntryType.PAYMENT,
            amount=data.amount,
            actor_id=actor_id,
            note=data.note,
            reference_type=data.reference_type,
            reference_id=data.reference_id,
        )
        await self.audit.log(
            action=AuditAction.CUSTOMER_PAYMENT_RECORDED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CUSTOMER_LEDGER,
            entity_id=entry.id,
            after_state={
                "customer_id": str(customer_id),
                "amount": str(data.amount),
                "balance_after": str(entry.balance_after),
            },
            request_id=request_id,
        )
        return entry

    async def adjust_balance(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: AdjustBalanceRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> CustomerLedger:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)

        entry = await self._create_ledger_entry(
            customer=customer,
            tenant_id=tenant_id,
            entry_type=CustomerLedgerEntryType.ADJUSTMENT,
            amount=data.amount,
            actor_id=actor_id,
            note=data.note,
            reference_type=data.reference_type,
            reference_id=data.reference_id,
        )
        await self.audit.log(
            action=AuditAction.CUSTOMER_BALANCE_ADJUSTED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CUSTOMER_LEDGER,
            entity_id=entry.id,
            after_state={
                "customer_id": str(customer_id),
                "adjustment": str(data.amount),
                "balance_after": str(entry.balance_after),
            },
            request_id=request_id,
        )
        return entry

    async def get_customer_balance(
        self, customer_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Decimal:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)
        return customer.current_balance

    async def get_ledger(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[CustomerLedger]:
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)
        return await self.ledger_repo.get_by_customer(customer_id, date_from, date_to)

    async def get_customer_statement(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> CustomerStatementResponse:
        customer = await self.repo.get_with_contacts(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)

        opening_balance = (
            await self.ledger_repo.get_opening_balance(customer_id, date_from)
            if date_from
            else Decimal("0")
        )
        entries = await self.ledger_repo.get_by_customer(customer_id, date_from, date_to)
        debited, credited = await self.ledger_repo.get_totals_in_range(
            customer_id, date_from, date_to
        )

        from app.customers.schemas import CustomerResponse, CustomerLedgerResponse
        return CustomerStatementResponse(
            customer=CustomerResponse.model_validate(customer),
            current_balance=customer.current_balance,
            opening_balance=opening_balance,
            total_debited=debited,
            total_credited=credited,
            ledger_entries=[CustomerLedgerResponse.model_validate(e) for e in entries],
            date_from=date_from,
            date_to=date_to,
        )

    # These are called by the sales/refund modules; not exposed directly as API.

    async def create_sale_debt(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        amount: Decimal,
        actor_id: uuid.UUID,
        order_id: str,
    ) -> CustomerLedger:
        """Called by CheckoutService when a sale is placed on credit."""
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)
        return await self._create_ledger_entry(
            customer=customer,
            tenant_id=tenant_id,
            entry_type=CustomerLedgerEntryType.SALE_DEBT,
            amount=amount,
            actor_id=actor_id,
            note=f"Sale #{order_id}",
            reference_type="ORDER",
            reference_id=order_id,
        )

    async def create_refund_credit(
        self,
        customer_id: uuid.UUID,
        tenant_id: uuid.UUID,
        amount: Decimal,
        actor_id: uuid.UUID,
        refund_id: str,
    ) -> CustomerLedger:
        """Called by RefundService when a refund reduces customer's outstanding balance."""
        customer = await self.repo.get_active_by_id_and_tenant(customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer", customer_id)
        return await self._create_ledger_entry(
            customer=customer,
            tenant_id=tenant_id,
            entry_type=CustomerLedgerEntryType.REFUND_CREDIT,
            amount=amount,
            actor_id=actor_id,
            note=f"Refund #{refund_id}",
            reference_type="REFUND",
            reference_id=refund_id,
        )
