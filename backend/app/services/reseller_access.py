from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError
from app.models.reseller import ResellerAssignment
from app.repositories.reseller_repository import ResellerRepository


class ResellerAccessService:
    """
    Enforces reseller scoping: tenant validity, branch visibility, permission checks.

    The model uses a deny-list (restricted_permissions): a permission is allowed
    unless its code appears in the assignment's restricted_permissions list.
    allowed_branch_ids == [] means the reseller can access ALL branches of the tenant.

    All require_* methods raise AuthorizationError on any violation.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._repo = ResellerRepository(db)


    async def get_valid_assignment(
        self, reseller_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> ResellerAssignment:
        """Return the assignment if active and within its access window. Raises otherwise."""
        assignment = await self._repo.get_by_reseller_and_tenant(reseller_id, tenant_id)
        if not assignment:
            raise AuthorizationError("No reseller assignment found for this tenant")
        if not assignment.is_access_valid():
            raise AuthorizationError("Reseller assignment is inactive or has expired")
        return assignment


    async def get_accessible_tenant_ids(
        self, reseller_id: uuid.UUID
    ) -> list[uuid.UUID]:
        """All tenants with a currently-valid assignment for this reseller."""
        assignments = await self._repo.get_by_reseller(reseller_id)
        return [a.tenant_id for a in assignments if a.is_access_valid()]

    async def get_all_valid_assignments(
        self, reseller_id: uuid.UUID
    ) -> list[ResellerAssignment]:
        """All currently-valid assignments (used by portal list endpoints)."""
        assignments = await self._repo.get_by_reseller(reseller_id)
        return [a for a in assignments if a.is_access_valid()]

    async def get_accessible_branch_ids(
        self, reseller_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> list[uuid.UUID]:
        """
        Branches the reseller can access within a tenant.
        Returns [] when allowed_branch_ids is empty (= all branches permitted).
        """
        assignment = await self.get_valid_assignment(reseller_id, tenant_id)
        if not assignment.allowed_branch_ids:
            return []
        return [uuid.UUID(str(b)) for b in assignment.allowed_branch_ids]


    async def require_tenant_access(
        self, reseller_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> ResellerAssignment:
        """Raises AuthorizationError if reseller has no valid assignment for tenant."""
        return await self.get_valid_assignment(reseller_id, tenant_id)

    async def require_branch_access(
        self,
        reseller_id: uuid.UUID,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
    ) -> None:
        """
        Raises AuthorizationError if branch is outside allowed_branch_ids.
        Empty allowed_branch_ids means all branches are permitted.
        """
        assignment = await self.get_valid_assignment(reseller_id, tenant_id)
        allowed = assignment.allowed_branch_ids
        if allowed and str(branch_id) not in [str(b) for b in allowed]:
            raise AuthorizationError(
                f"Reseller is not permitted to access branch {branch_id}"
            )

    async def has_permission(
        self,
        reseller_id: uuid.UUID,
        tenant_id: uuid.UUID,
        permission_code: str,
    ) -> bool:
        """True if permission_code is NOT in restricted_permissions."""
        try:
            assignment = await self.get_valid_assignment(reseller_id, tenant_id)
        except AuthorizationError:
            return False
        return permission_code not in assignment.restricted_permissions

    async def require_permission(
        self,
        reseller_id: uuid.UUID,
        tenant_id: uuid.UUID,
        permission_code: str,
    ) -> None:
        """Raises AuthorizationError if permission_code is in restricted_permissions."""
        assignment = await self.get_valid_assignment(reseller_id, tenant_id)
        if permission_code in assignment.restricted_permissions:
            raise AuthorizationError(
                f"Reseller permission denied: {permission_code}"
            )


    async def require_branch_and_permission(
        self,
        reseller_id: uuid.UUID,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        permission_code: str,
    ) -> None:
        """Validates branch access then permission in a single call."""
        await self.require_branch_access(reseller_id, tenant_id, branch_id)
        await self.require_permission(reseller_id, tenant_id, permission_code)
