from __future__ import annotations

from app.core.logging import get_logger
from app.tasks.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="app.tasks.notification_tasks.send_notification", bind=True)
def send_notification(self, user_id: str, notification_type: str, payload: dict) -> dict:
    """Foundation task for future notification system."""
    logger.info(
        "notification_task",
        user_id=user_id,
        notification_type=notification_type,
    )
    # Future: integrate email/SMS/push notifications
    return {"status": "queued", "user_id": user_id, "type": notification_type}
