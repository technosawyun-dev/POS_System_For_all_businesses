from __future__ import annotations

import uuid
from typing import Any

from celery import shared_task
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.services.inventory_reconciliation_service import InventoryReconciliationService

logger = get_logger(__name__)


async def _run_reconciliation(tenant_id_str: str, branch_id_str: str | None) -> dict[str, Any]:
    """Run reconciliation in its own session (called from sync Celery task)."""
    async with AsyncSessionLocal() as session:
        try:
            service = InventoryReconciliationService(session)
            tenant_id = uuid.UUID(tenant_id_str)
            branch_id = uuid.UUID(branch_id_str) if branch_id_str else None
            report = await service.reconcile(tenant_id=tenant_id, branch_id=branch_id)
            await session.commit()
            return report.summary()
        except Exception:
            await session.rollback()
            raise


@shared_task(
    name="app.tasks.inventory_tasks.reconcile_tenant_inventory",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
    soft_time_limit=600,
)
def reconcile_tenant_inventory(
    self: Any,
    tenant_id: str,
    branch_id: str | None = None,
) -> dict[str, Any]:
    """
    Celery task: reconcile inventory for one tenant (or one branch).

    Scheduled via Celery Beat or triggered manually via admin API.
    """
    import asyncio

    logger.info(
        "reconciliation_task_started",
        tenant_id=tenant_id,
        branch_id=branch_id,
        task_id=self.request.id,
    )

    try:
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(_run_reconciliation(tenant_id, branch_id))

        logger.info(
            "reconciliation_task_completed",
            tenant_id=tenant_id,
            discrepancy_count=result.get("discrepancy_count", 0),
            total_checked=result.get("total_positions_checked", 0),
            task_id=self.request.id,
        )
        return result

    except Exception as exc:
        logger.error(
            "reconciliation_task_failed",
            tenant_id=tenant_id,
            error=str(exc),
            task_id=self.request.id,
        )
        raise self.retry(exc=exc)
