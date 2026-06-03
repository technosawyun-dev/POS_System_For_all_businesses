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
        "app.tasks.sync_tasks",
        "app.notifications.tasks",
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
        "sync-retry-failed-operations-hourly": {
            "task": "app.tasks.sync_tasks.retry_failed_sync_operations",
            "schedule": 3600,  # every hour
        },
        "sync-cleanup-old-logs-daily": {
            "task": "app.tasks.sync_tasks.cleanup_old_sync_logs",
            "schedule": 86400,  # every 24 hours
        },
        "sync-cleanup-stale-devices-daily": {
            "task": "app.tasks.sync_tasks.cleanup_stale_devices",
            "schedule": 86400,  # every 24 hours
        },
        "subscriptions-expire-daily": {
            "task": "app.tasks.notification_tasks.process_expired_subscriptions",
            "schedule": 86400,
        },
        "subscriptions-trial-reminders-daily": {
            "task": "app.tasks.notification_tasks.send_trial_reminders",
            "schedule": 86400,
        },
        "check-subscription-expiring-daily": {
            "task": "app.notifications.tasks.check_subscription_expiring",
            "schedule": 86400,
        },
        "check-low-stock-every-6-hours": {
            "task": "app.notifications.tasks.check_low_stock",
            "schedule": 21600,  # every 6 hours; 24-h dedup prevents alert flooding
        },
        "check-payables-overdue-daily": {
            "task": "app.notifications.tasks.check_payables_overdue",
            "schedule": 86400,
        },
        "cleanup-expired-notifications-daily": {
            "task": "app.notifications.tasks.cleanup_expired_notifications",
            "schedule": 86400,
        },
    },
)
