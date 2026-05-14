from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from celery import shared_task

from app.core.logging import get_logger

logger = get_logger(__name__)

_MAX_RETRIES = 3
_STALE_DEVICE_DAYS = 30
_LOG_RETENTION_DAYS = 30


async def _retry_failed_operations_async() -> dict[str, Any]:
    from app.db.session import AsyncSessionLocal
    from app.sync.models import SyncOperation
    from app.core.constants import SyncOperationStatus

    async with AsyncSessionLocal() as session:
        try:
            from app.sync.repositories import SyncOperationRepository
            repo = SyncOperationRepository(session)
            failed_ops = await repo.get_retryable_failed(max_retries=_MAX_RETRIES)

            reset_count = 0
            for op in failed_ops:
                op.status = SyncOperationStatus.PENDING
                op.retry_count = (op.retry_count or 0) + 1
                reset_count += 1

            await session.commit()
            return {"reset_to_pending": reset_count}
        except Exception:
            await session.rollback()
            raise


async def _cleanup_old_logs_async(retention_days: int) -> dict[str, Any]:
    from sqlalchemy import delete
    from app.db.session import AsyncSessionLocal
    from app.sync.models import SyncOperation
    from app.core.constants import SyncOperationStatus

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    async with AsyncSessionLocal() as session:
        try:
            stmt = delete(SyncOperation).where(
                SyncOperation.status == SyncOperationStatus.COMPLETED,
                SyncOperation.processed_at < cutoff,
            )
            result = await session.execute(stmt)
            await session.commit()
            return {"deleted": result.rowcount}
        except Exception:
            await session.rollback()
            raise


async def _cleanup_stale_devices_async(stale_days: int) -> dict[str, Any]:
    from sqlalchemy import update
    from app.db.session import AsyncSessionLocal
    from app.devices.models import PosDevice

    cutoff = datetime.now(timezone.utc) - timedelta(days=stale_days)
    async with AsyncSessionLocal() as session:
        try:
            stmt = (
                update(PosDevice)
                .where(
                    PosDevice.is_active.is_(True),
                    PosDevice.last_seen_at < cutoff,
                )
                .values(is_active=False)
            )
            result = await session.execute(stmt)
            await session.commit()
            return {"deactivated": result.rowcount}
        except Exception:
            await session.rollback()
            raise


@shared_task(
    name="app.tasks.sync_tasks.retry_failed_sync_operations",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    soft_time_limit=120,
)
def retry_failed_sync_operations(self: Any) -> dict[str, Any]:
    """
    Reset FAILED sync operations (retry_count < MAX_RETRIES) back to PENDING
    so the next device push attempt can re-execute them.
    """
    import asyncio

    logger.info("sync_retry_task_started", task_id=self.request.id)
    try:
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(_retry_failed_operations_async())
        logger.info("sync_retry_task_completed", **result, task_id=self.request.id)
        return result
    except Exception as exc:
        logger.error("sync_retry_task_failed", error=str(exc), task_id=self.request.id)
        raise self.retry(exc=exc)


@shared_task(
    name="app.tasks.sync_tasks.cleanup_old_sync_logs",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
    soft_time_limit=300,
)
def cleanup_old_sync_logs(self: Any, retention_days: int = _LOG_RETENTION_DAYS) -> dict[str, Any]:
    """Delete COMPLETED sync operations older than retention_days (default 30)."""
    import asyncio

    logger.info("sync_cleanup_task_started", retention_days=retention_days, task_id=self.request.id)
    try:
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(_cleanup_old_logs_async(retention_days))
        logger.info("sync_cleanup_task_completed", **result, task_id=self.request.id)
        return result
    except Exception as exc:
        logger.error("sync_cleanup_task_failed", error=str(exc), task_id=self.request.id)
        raise self.retry(exc=exc)


@shared_task(
    name="app.tasks.sync_tasks.cleanup_stale_devices",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
    soft_time_limit=120,
)
def cleanup_stale_devices(self: Any, stale_days: int = _STALE_DEVICE_DAYS) -> dict[str, Any]:
    """Mark devices as inactive if last_seen_at is older than stale_days (default 30)."""
    import asyncio

    logger.info("stale_device_cleanup_started", stale_days=stale_days, task_id=self.request.id)
    try:
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(_cleanup_stale_devices_async(stale_days))
        logger.info("stale_device_cleanup_completed", **result, task_id=self.request.id)
        return result
    except Exception as exc:
        logger.error("stale_device_cleanup_failed", error=str(exc), task_id=self.request.id)
        raise self.retry(exc=exc)
