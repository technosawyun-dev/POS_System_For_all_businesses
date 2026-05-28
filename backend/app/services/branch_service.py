from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, BranchStatus, EntityType
from app.core.exceptions import ConflictError, NotFoundError
from app.models.branch import Branch
from app.repositories.branch_repository import BranchRepository
from app.services.audit_service import AuditService
from app.schemas.branch import BranchCreateRequest, BranchUpdateRequest


class BranchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.branch_repo = BranchRepository(session)
        self.audit_service = AuditService(session)

    async def create_branch(
        self,
        tenant_id: uuid.UUID,
        data: BranchCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Branch:
        if await self.branch_repo.code_exists_in_tenant(data.code, tenant_id):
            raise ConflictError(f"Branch with code '{data.code}' already exists in this tenant")

        branch = await self.branch_repo.create(
            tenant_id=tenant_id,
            name=data.name,
            code=data.code,
            address=data.address,
            city=data.city,
            country=data.country,
            phone=data.phone,
            email=data.email,
            timezone=data.timezone,
            currency=data.currency,
            is_main_branch=data.is_main_branch,
        )

        await self.branch_repo.create_settings(branch.id, tenant_id)

        await self.audit_service.log(
            action=AuditAction.BRANCH_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            branch_id=branch.id,
            entity_type=EntityType.BRANCH,
            entity_id=branch.id,
            after_state={"name": branch.name, "code": branch.code},
            request_id=request_id,
        )
        return branch

    async def get_branch(self, branch_id: uuid.UUID, tenant_id: uuid.UUID) -> Branch:
        branch = await self.branch_repo.get_active_by_id_and_tenant(branch_id, tenant_id)
        if not branch:
            raise NotFoundError("Branch", branch_id)
        return branch

    async def list_branches(
        self, tenant_id: uuid.UUID, page: int = 1, page_size: int = 20
    ) -> tuple[list[Branch], int]:
        offset = (page - 1) * page_size
        return await self.branch_repo.get_by_tenant(tenant_id, offset=offset, limit=page_size)

    async def update_branch(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: BranchUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Branch:
        branch = await self.branch_repo.get_active_by_id_and_tenant(branch_id, tenant_id)
        if not branch:
            raise NotFoundError("Branch", branch_id)

        before_state = {"name": branch.name}
        update_data = data.model_dump(exclude_none=True)
        branch = await self.branch_repo.update(branch, **update_data)

        await self.audit_service.log(
            action=AuditAction.BRANCH_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=EntityType.BRANCH,
            entity_id=branch_id,
            before_state=before_state,
            after_state=update_data,
            request_id=request_id,
        )
        return branch

    async def update_branch_status(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        status: BranchStatus,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Branch:
        branch = await self.branch_repo.get_active_by_id_and_tenant(branch_id, tenant_id)
        if not branch:
            raise NotFoundError("Branch", branch_id)
        old_status = branch.status
        branch = await self.branch_repo.update(branch, status=status.value)
        await self.audit_service.log(
            action=AuditAction.BRANCH_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=EntityType.BRANCH,
            entity_id=branch_id,
            before_state={"status": old_status},
            after_state={"status": status.value},
            request_id=request_id,
        )
        return branch

    async def soft_delete_branch(
        self,
        branch_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        branch = await self.branch_repo.get_active_by_id_and_tenant(branch_id, tenant_id)
        if not branch:
            raise NotFoundError("Branch", branch_id)
        await self.branch_repo.soft_delete(branch)

        await self.audit_service.log(
            action=AuditAction.BRANCH_DEACTIVATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=EntityType.BRANCH,
            entity_id=branch_id,
            request_id=request_id,
        )
