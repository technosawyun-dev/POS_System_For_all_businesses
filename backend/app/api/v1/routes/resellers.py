from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    CurrentUser,
    DbSession,
    RequestId,
    require_super_admin,
)
from app.core.constants import AuditAction, EntityType
from app.core.exceptions import ConflictError, NotFoundError
from app.models.reseller import ResellerAssignment
from app.repositories.reseller_repository import ResellerRepository
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.reseller import (
    PaginatedResellerAssignments,
    ResellerAssignmentCreateRequest,
    ResellerAssignmentResponse,
    ResellerAssignmentUpdateRequest,
)
from app.services.audit_service import AuditService

router = APIRouter()


@router.post(
    "/assignments",
    response_model=ResellerAssignmentResponse,
    status_code=201,
    summary="Assign reseller to tenant",
    dependencies=[Depends(require_super_admin)],
)
async def create_reseller_assignment(
    payload: ResellerAssignmentCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> ResellerAssignmentResponse:
    repo = ResellerRepository(db)
    existing = await repo.get_by_reseller_and_tenant(payload.reseller_id, payload.tenant_id)
    if existing:
        raise ConflictError("Reseller is already assigned to this tenant")

    audit = AuditService(db)
    assignment = await repo.create(
        reseller_id=payload.reseller_id,
        tenant_id=payload.tenant_id,
        allowed_branch_ids=[str(b) for b in payload.allowed_branch_ids],
        restricted_permissions=payload.restricted_permissions,
        access_starts_at=payload.access_starts_at,
        access_expires_at=payload.access_expires_at,
        notes=payload.notes,
        assigned_by_id=current_user.id,
    )
    await audit.log(
        action=AuditAction.RESELLER_ASSIGNED,
        actor_user_id=current_user.id,
        tenant_id=payload.tenant_id,
        entity_type=EntityType.RESELLER_ASSIGNMENT,
        entity_id=assignment.id,
        request_id=request_id,
        metadata={
            "reseller_id": str(payload.reseller_id),
            "allowed_branch_ids": [str(b) for b in payload.allowed_branch_ids],
            "restricted_permissions": payload.restricted_permissions,
        },
    )
    return ResellerAssignmentResponse.model_validate(assignment)


@router.get(
    "/assignments",
    response_model=PaginatedResellerAssignments,
    summary="List reseller assignments",
    dependencies=[Depends(require_super_admin)],
)
async def list_reseller_assignments(
    db: DbSession,
    reseller_id: uuid.UUID | None = Query(default=None),
    tenant_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedResellerAssignments:
    from sqlalchemy import select, func
    from app.models.reseller import ResellerAssignment

    stmt = select(ResellerAssignment)
    if reseller_id:
        stmt = stmt.where(ResellerAssignment.reseller_id == reseller_id)
    if tenant_id:
        stmt = stmt.where(ResellerAssignment.tenant_id == tenant_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    assignments = list(result.scalars().all())

    return PaginatedResponse.create(
        items=[ResellerAssignmentResponse.model_validate(a) for a in assignments],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/assignments/{assignment_id}",
    response_model=ResellerAssignmentResponse,
    summary="Get reseller assignment",
    dependencies=[Depends(require_super_admin)],
)
async def get_reseller_assignment(
    assignment_id: uuid.UUID,
    db: DbSession,
) -> ResellerAssignmentResponse:
    repo = ResellerRepository(db)
    assignment = await repo.get_by_id(assignment_id)
    if not assignment:
        raise NotFoundError("ResellerAssignment", assignment_id)
    return ResellerAssignmentResponse.model_validate(assignment)


@router.patch(
    "/assignments/{assignment_id}",
    response_model=ResellerAssignmentResponse,
    summary="Update reseller assignment",
    dependencies=[Depends(require_super_admin)],
)
async def update_reseller_assignment(
    assignment_id: uuid.UUID,
    payload: ResellerAssignmentUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> ResellerAssignmentResponse:
    repo = ResellerRepository(db)
    assignment = await repo.get_by_id(assignment_id)
    if not assignment:
        raise NotFoundError("ResellerAssignment", assignment_id)

    update_data = payload.model_dump(exclude_none=True)
    if "allowed_branch_ids" in update_data:
        update_data["allowed_branch_ids"] = [str(b) for b in update_data["allowed_branch_ids"]]

    audit = AuditService(db)
    assignment = await repo.update(assignment, **update_data)

    # Determine which specific audit action to emit
    changed_fields = list(update_data.keys())
    if "restricted_permissions" in changed_fields:
        action = AuditAction.RESELLER_PERMISSIONS_CHANGED
    elif "allowed_branch_ids" in changed_fields:
        action = AuditAction.RESELLER_BRANCH_VISIBILITY_CHANGED
    else:
        action = AuditAction.RESELLER_ASSIGNMENT_UPDATED

    await audit.log(
        action=action,
        actor_user_id=current_user.id,
        tenant_id=assignment.tenant_id,
        entity_type=EntityType.RESELLER_ASSIGNMENT,
        entity_id=assignment_id,
        request_id=request_id,
        metadata={"changed_fields": changed_fields},
    )
    return ResellerAssignmentResponse.model_validate(assignment)


@router.delete(
    "/assignments/{assignment_id}",
    response_model=SuccessResponse,
    summary="Revoke reseller assignment",
    dependencies=[Depends(require_super_admin)],
)
async def revoke_reseller_assignment(
    assignment_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    request_id: RequestId,
) -> SuccessResponse:
    repo = ResellerRepository(db)
    assignment = await repo.get_by_id(assignment_id)
    if not assignment:
        raise NotFoundError("ResellerAssignment", assignment_id)

    audit = AuditService(db)
    await repo.delete(assignment)
    await audit.log(
        action=AuditAction.RESELLER_ACCESS_REVOKED,
        actor_user_id=current_user.id,
        tenant_id=assignment.tenant_id,
        entity_type=EntityType.RESELLER_ASSIGNMENT,
        entity_id=assignment_id,
        request_id=request_id,
        metadata={"reseller_id": str(assignment.reseller_id)},
    )
    return SuccessResponse(message="Reseller assignment revoked successfully")
