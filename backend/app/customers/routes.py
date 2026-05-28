from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    check_reseller_access,
    require_cashier_or_above,
    require_manager_or_above,
    require_tenant_admin,
)
from app.customers.schemas import (
    AddContactRequest,
    AddNoteRequest,
    AdjustBalanceRequest,
    CreateCustomerRequest,
    CustomerContactResponse,
    CustomerLedgerResponse,
    CustomerNoteResponse,
    CustomerResponse,
    CustomerStatementResponse,
    CustomerSummaryResponse,
    PaginatedCustomerResponse,
    RecordPaymentRequest,
    UpdateCustomerRequest,
)
from app.customers.services import CustomerService
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.subscriptions.gates import validate_customer_limit

router = APIRouter()


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=201,
    summary="Create customer",
    dependencies=[Depends(require_cashier_or_above), Depends(validate_customer_limit), check_reseller_access("customer:view", check_branch=False)],
)
async def create_customer(
    payload: CreateCustomerRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CustomerResponse:
    service = CustomerService(db)
    customer = await service.create_customer(
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CustomerResponse.model_validate(customer)


@router.get(
    "",
    response_model=PaginatedCustomerResponse,
    summary="List customers",
    dependencies=[Depends(require_cashier_or_above), check_reseller_access("customer:view", check_branch=False)],
)
async def list_customers(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    is_active: bool | None = Query(default=None),
) -> PaginatedCustomerResponse:
    service = CustomerService(db)
    customers, total = await service.list_customers(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        is_active=is_active,
    )
    return PaginatedResponse.create(
        items=[CustomerSummaryResponse.model_validate(c) for c in customers],
        total=total,
        page=page,
        page_size=page_size,
    )


# NOTE: /search must be declared before /{customer_id} so FastAPI does not
# attempt to parse the literal string "search" as a UUID path parameter.
@router.get(
    "/search",
    response_model=PaginatedCustomerResponse,
    summary="Search customers by name, phone, code or email",
    dependencies=[Depends(require_cashier_or_above), check_reseller_access("customer:view", check_branch=False)],
)
async def search_customers(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    q: str = Query(min_length=1, description="Search term"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedCustomerResponse:
    service = CustomerService(db)
    customers, total = await service.search_customers(
        tenant_id=tenant_id,
        query=q,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[CustomerSummaryResponse.model_validate(c) for c in customers],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Get customer with contacts",
    dependencies=[Depends(require_cashier_or_above), check_reseller_access("customer:view", check_branch=False)],
)
async def get_customer(
    customer_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> CustomerResponse:
    service = CustomerService(db)
    customer = await service.get_customer(customer_id, tenant_id)
    return CustomerResponse.model_validate(customer)


@router.patch(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update customer",
    dependencies=[Depends(require_cashier_or_above), check_reseller_access("customer:view", check_branch=False)],
)
async def update_customer(
    customer_id: uuid.UUID,
    payload: UpdateCustomerRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CustomerResponse:
    service = CustomerService(db)
    customer = await service.update_customer(
        customer_id=customer_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CustomerResponse.model_validate(customer)


@router.delete(
    "/{customer_id}",
    response_model=SuccessResponse,
    summary="Delete customer (soft)",
    dependencies=[Depends(require_manager_or_above)],
)
async def delete_customer(
    customer_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SuccessResponse:
    service = CustomerService(db)
    await service.soft_delete_customer(
        customer_id=customer_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Customer deleted successfully")



@router.post(
    "/{customer_id}/contacts",
    response_model=CustomerContactResponse,
    status_code=201,
    summary="Add contact to customer",
    dependencies=[Depends(require_cashier_or_above)],
)
async def add_contact(
    customer_id: uuid.UUID,
    payload: AddContactRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CustomerContactResponse:
    service = CustomerService(db)
    contact = await service.add_contact(
        customer_id=customer_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CustomerContactResponse.model_validate(contact)



@router.post(
    "/{customer_id}/notes",
    response_model=CustomerNoteResponse,
    status_code=201,
    summary="Add note to customer",
    dependencies=[Depends(require_cashier_or_above)],
)
async def add_note(
    customer_id: uuid.UUID,
    payload: AddNoteRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CustomerNoteResponse:
    service = CustomerService(db)
    note = await service.add_note(
        customer_id=customer_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CustomerNoteResponse.model_validate(note)



@router.post(
    "/{customer_id}/payments",
    response_model=CustomerLedgerResponse,
    status_code=201,
    summary="Record a customer payment (reduces outstanding balance)",
    dependencies=[Depends(require_cashier_or_above), check_reseller_access("customer:payment", check_branch=False)],
)
async def record_payment(
    customer_id: uuid.UUID,
    payload: RecordPaymentRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CustomerLedgerResponse:
    service = CustomerService(db)
    entry = await service.record_payment(
        customer_id=customer_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CustomerLedgerResponse.model_validate(entry)


@router.post(
    "/{customer_id}/adjustments",
    response_model=CustomerLedgerResponse,
    status_code=201,
    summary="Manual balance adjustment (manager+)",
    dependencies=[Depends(require_manager_or_above)],
)
async def adjust_balance(
    customer_id: uuid.UUID,
    payload: AdjustBalanceRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> CustomerLedgerResponse:
    service = CustomerService(db)
    entry = await service.adjust_balance(
        customer_id=customer_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return CustomerLedgerResponse.model_validate(entry)



@router.get(
    "/{customer_id}/ledger",
    response_model=list[CustomerLedgerResponse],
    summary="Get customer ledger entries",
    dependencies=[Depends(require_cashier_or_above), check_reseller_access("customer:view", check_branch=False)],
)
async def get_ledger(
    customer_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
) -> list[CustomerLedgerResponse]:
    service = CustomerService(db)
    entries = await service.get_ledger(
        customer_id=customer_id,
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to,
    )
    return [CustomerLedgerResponse.model_validate(e) for e in entries]


@router.get(
    "/{customer_id}/statement",
    response_model=CustomerStatementResponse,
    summary="Get full customer statement with running balance summary",
    dependencies=[Depends(require_manager_or_above)],
)
async def get_statement(
    customer_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
) -> CustomerStatementResponse:
    service = CustomerService(db)
    return await service.get_customer_statement(
        customer_id=customer_id,
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to,
    )
