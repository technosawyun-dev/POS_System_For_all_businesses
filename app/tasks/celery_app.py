from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "pos_saas",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.audit_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.inventory_tasks",
    ],
)

celery_app.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    accept_content=["json"],
    timezone=settings.CELERY_TIMEZONE,
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
    beat_schedule={
        "cleanup-expired-tokens-daily": {
            "task": "app.tasks.audit_tasks.cleanup_expired_refresh_tokens",
            "schedule": 86400,  # every 24 hours
        },
        # Inventory reconciliation is triggered per-tenant via admin API;
        # the beat entry below is a placeholder for a future global sweep task.
        # Uncomment and configure tenant_id when ready:
        # "inventory-reconciliation-nightly": {
        #     "task": "app.tasks.inventory_tasks.reconcile_tenant_inventory",
        #     "schedule": 86400,
        #     "kwargs": {"tenant_id": "<uuid>"},
        # },
    },
)
