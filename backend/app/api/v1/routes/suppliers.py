from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    EffectiveTenantId,
    RequestId,
    require_inventory_access,
    require_manager_or_above,
    require_tenant_admin,
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.supplier import (
    SupplierContactCreateRequest,
    SupplierContactResponse,
    SupplierContactUpdateRequest,
    SupplierCreateRequest,
    SupplierResponse,
    SupplierSummaryResponse,
    SupplierUpdateRequest,
)
from app.services.supplier_service import SupplierService

router = APIRouter()


@router.post(
    "",
    response_model=SupplierResponse,
    status_code=201,
    summary="Create supplier",
    dependencies=[Depends(require_manager_or_above)],
)
async def create_supplier(
    payload: SupplierCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SupplierResponse:
    service = SupplierService(db)
    supplier = await service.create_supplier(
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SupplierResponse.model_validate(supplier)


@router.get(
    "",
    response_model=PaginatedResponse[SupplierSummaryResponse],
    summary="List suppliers",
    dependencies=[Depends(require_inventory_access)],
)
async def list_suppliers(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    status: str | None = Query(default=None),
) -> PaginatedResponse[SupplierSummaryResponse]:
    service = SupplierService(db)
    suppliers, total = await service.list_suppliers(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        status=status,
    )
    return PaginatedResponse.create(
        items=[SupplierSummaryResponse.model_validate(s) for s in suppliers],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Get supplier with contacts",
    dependencies=[Depends(require_inventory_access)],
)
async def get_supplier(
    supplier_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> SupplierResponse:
    service = SupplierService(db)
    supplier = await service.get_supplier(supplier_id, tenant_id)
    return SupplierResponse.model_validate(supplier)


@router.patch(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Update supplier",
    dependencies=[Depends(require_manager_or_above)],
)
async def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SupplierResponse:
    service = SupplierService(db)
    supplier = await service.update_supplier(
        supplier_id=supplier_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SupplierResponse.model_validate(supplier)


@router.delete(
    "/{supplier_id}",
    response_model=SuccessResponse,
    summary="Delete supplier",
    dependencies=[Depends(require_tenant_admin)],
)
async def delete_supplier(
    supplier_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SuccessResponse:
    service = SupplierService(db)
    await service.delete_supplier(
        supplier_id=supplier_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Supplier deleted successfully")


# Contacts

@router.post(
    "/{supplier_id}/contacts",
    response_model=SupplierContactResponse,
    status_code=201,
    summary="Add supplier contact",
    dependencies=[Depends(require_manager_or_above)],
)
async def add_contact(
    supplier_id: uuid.UUID,
    payload: SupplierContactCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SupplierContactResponse:
    service = SupplierService(db)
    contact = await service.add_contact(
        supplier_id=supplier_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SupplierContactResponse.model_validate(contact)


@router.get(
    "/{supplier_id}/contacts",
    response_model=list[SupplierContactResponse],
    summary="List supplier contacts",
    dependencies=[Depends(require_inventory_access)],
)
async def list_contacts(
    supplier_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: EffectiveTenantId,
) -> list[SupplierContactResponse]:
    service = SupplierService(db)
    contacts = await service.list_contacts(supplier_id, tenant_id)
    return [SupplierContactResponse.model_validate(c) for c in contacts]


@router.patch(
    "/{supplier_id}/contacts/{contact_id}",
    response_model=SupplierContactResponse,
    summary="Update supplier contact",
    dependencies=[Depends(require_manager_or_above)],
)
async def update_contact(
    supplier_id: uuid.UUID,
    contact_id: uuid.UUID,
    payload: SupplierContactUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SupplierContactResponse:
    service = SupplierService(db)
    contact = await service.update_contact(
        supplier_id=supplier_id,
        contact_id=contact_id,
        tenant_id=tenant_id,
        data=payload,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SupplierContactResponse.model_validate(contact)


@router.delete(
    "/{supplier_id}/contacts/{contact_id}",
    response_model=SuccessResponse,
    summary="Delete supplier contact",
    dependencies=[Depends(require_manager_or_above)],
)
async def delete_contact(
    supplier_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
    tenant_id: EffectiveTenantId,
) -> SuccessResponse:
    service = SupplierService(db)
    await service.delete_contact(
        supplier_id=supplier_id,
        contact_id=contact_id,
        tenant_id=tenant_id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Contact deleted successfully")
