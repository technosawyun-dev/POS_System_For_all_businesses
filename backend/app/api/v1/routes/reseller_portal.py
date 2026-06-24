"""
Reseller Portal endpoints  (Section 14)
Routes for a logged-in RESELLER to inspect their own assignments,
accessible branches, and permission summaries.

All endpoints are guarded by require_reseller_only and require no
?tenant_id param — they read from the reseller's JWT identity directly.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_reseller_only
from app.core.constants import RESELLER_PERMISSION_MAP
from app.models.branch import Branch
from app.schemas.reseller import MyBranchResponse, MyBusinessResponse, MyPermissionsResponse
from app.services.reseller_access import ResellerAccessService

router = APIRouter()


@router.get(
    "/me/businesses",
    response_model=list[MyBusinessResponse],
    summary="List my assigned businesses",
    dependencies=[Depends(require_reseller_only)],
)
async def list_my_businesses(
    db: DbSession,
    current_user: CurrentUser,
) -> list[MyBusinessResponse]:
    """Returns all tenants the reseller currently has (or has had) an assignment for."""
    svc = ResellerAccessService(db)
    assignments = await svc.get_all_valid_assignments(current_user.id)
    return [
        MyBusinessResponse(
            id=a.id,
            tenant_id=a.tenant_id,
            allowed_branch_ids=[uuid.UUID(str(b)) for b in a.allowed_branch_ids],
            restricted_permissions=list(a.restricted_permissions),
            access_starts_at=a.access_starts_at,
            access_expires_at=a.access_expires_at,
            is_active=a.is_active,
            is_access_valid=a.is_access_valid(),
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in assignments
    ]


@router.get(
    "/me/branches",
    response_model=MyBranchResponse,
    summary="List my accessible branches for a tenant",
    dependencies=[Depends(require_reseller_only)],
)
async def list_my_branches(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: uuid.UUID = Query(..., description="Target tenant"),
) -> MyBranchResponse:
    """
    Returns the branch IDs accessible to this reseller for the given tenant.
    When allowed_branch_ids is empty, all active branches of the tenant are returned
    and all_branches_allowed is set to True.
    """
    svc = ResellerAccessService(db)
    # Validates assignment is active (raises 403 if not)
    assignment = await svc.require_tenant_access(current_user.id, tenant_id)

    if assignment.allowed_branch_ids:
        branch_ids = [uuid.UUID(str(b)) for b in assignment.allowed_branch_ids]
        return MyBranchResponse(
            tenant_id=tenant_id,
            branch_ids=branch_ids,
            all_branches_allowed=False,
        )

    # Empty allowed_branch_ids → fetch all active, non-deleted branches for the tenant
    stmt = select(Branch).where(
        Branch.tenant_id == tenant_id,
        Branch.status != "CLOSED",
        Branch.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    branches = list(result.scalars().all())
    return MyBranchResponse(
        tenant_id=tenant_id,
        branch_ids=[b.id for b in branches],
        all_branches_allowed=True,
    )


@router.get(
    "/me/permissions",
    response_model=MyPermissionsResponse,
    summary="Get my permission summary for a tenant",
    dependencies=[Depends(require_reseller_only)],
)
async def get_my_permissions(
    db: DbSession,
    current_user: CurrentUser,
    tenant_id: uuid.UUID = Query(..., description="Target tenant"),
) -> MyPermissionsResponse:
    """
    Returns a named permission summary using the F9 portal permission names.
    True = allowed (not in restricted_permissions), False = denied.
    """
    svc = ResellerAccessService(db)
    assignment = await svc.require_tenant_access(current_user.id, tenant_id)
    restricted = set(assignment.restricted_permissions)

    permissions = {
        spec_name: permission_code not in restricted
        for spec_name, permission_code in RESELLER_PERMISSION_MAP.items()
    }
    return MyPermissionsResponse(tenant_id=tenant_id, permissions=permissions)
