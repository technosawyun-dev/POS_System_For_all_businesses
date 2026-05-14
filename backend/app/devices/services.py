from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType
from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.devices.models import PosDevice
from app.devices.repositories import DeviceRepository
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.events.types import EventType
from app.services.audit_service import AuditService

logger = get_logger(__name__)


class DeviceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = DeviceRepository(session)
        self.audit = AuditService(session)

    async def register_device(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        device_uuid: str,
        device_name: str,
        platform: str,
        app_version: str | None,
        actor_user_id: uuid.UUID,
    ) -> PosDevice:
        existing = await self.repo.get_by_device_uuid(device_uuid, tenant_id)
        if existing:
            raise ConflictError(
                f"Device with UUID '{device_uuid}' is already registered for this tenant",
                details={"device_id": str(existing.id), "is_active": existing.is_active},
            )

        device = await self.repo.create(
            tenant_id=tenant_id,
            branch_id=branch_id,
            device_uuid=device_uuid,
            device_name=device_name,
            platform=platform,
            app_version=app_version,
            is_active=True,
            created_by=actor_user_id,
            last_seen_at=datetime.now(timezone.utc),
        )

        await self.audit.log(
            action=AuditAction.DEVICE_REGISTERED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            branch_id=branch_id,
            entity_type=EntityType.DEVICE,
            entity_id=device.id,
            after_state={"device_uuid": device_uuid, "platform": platform},
        )

        await event_publisher.publish(DomainEvent(
            event_type=EventType.DEVICE_REGISTERED,
            tenant_id=tenant_id,
            actor_id=actor_user_id,
            payload={"device_id": str(device.id), "device_uuid": device_uuid, "branch_id": str(branch_id)},
        ))

        logger.info("device_registered", device_id=str(device.id), tenant_id=str(tenant_id))
        return device

    async def update_device(
        self,
        device_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        device_name: str | None = None,
        app_version: str | None = None,
    ) -> PosDevice:
        device = await self.repo.get_by_id_for_tenant(device_id, tenant_id)
        if not device:
            raise NotFoundError("Device", device_id)

        updates: dict = {}
        if device_name is not None:
            updates["device_name"] = device_name
        if app_version is not None:
            updates["app_version"] = app_version

        if updates:
            device = await self.repo.update(device, **updates)

        await self.audit.log(
            action=AuditAction.DEVICE_UPDATED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.DEVICE,
            entity_id=device_id,
            after_state=updates,
        )
        return device

    async def deactivate_device(
        self,
        device_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
    ) -> PosDevice:
        device = await self.repo.get_by_id_for_tenant(device_id, tenant_id)
        if not device:
            raise NotFoundError("Device", device_id)
        if not device.is_active:
            return device

        device = await self.repo.update(device, is_active=False)

        await self.audit.log(
            action=AuditAction.DEVICE_DEACTIVATED,
            actor_user_id=actor_user_id,
            tenant_id=tenant_id,
            entity_type=EntityType.DEVICE,
            entity_id=device_id,
        )
        logger.info("device_deactivated", device_id=str(device_id), tenant_id=str(tenant_id))
        return device

    async def get_device(self, device_id: uuid.UUID, tenant_id: uuid.UUID) -> PosDevice:
        device = await self.repo.get_by_id_for_tenant(device_id, tenant_id)
        if not device:
            raise NotFoundError("Device", device_id)
        return device

    async def list_devices(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PosDevice], int]:
        return await self.repo.get_for_tenant(
            tenant_id=tenant_id,
            branch_id=branch_id,
            is_active=is_active,
            page=page,
            page_size=page_size,
        )

    async def touch_heartbeat(self, device_id: uuid.UUID, tenant_id: uuid.UUID) -> PosDevice:
        device = await self.repo.get_by_id_for_tenant(device_id, tenant_id)
        if not device:
            raise NotFoundError("Device", device_id)
        device = await self.repo.update(device, last_seen_at=datetime.now(timezone.utc))
        return device
