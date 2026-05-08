from __future__ import annotations

from app.core.logging import get_logger
from app.tasks.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="app.tasks.audit_tasks.cleanup_expired_refresh_tokens", bind=True)
def cleanup_expired_refresh_tokens(self) -> dict:
    """Scheduled task: remove expired/revoked refresh tokens older than 30 days."""
    import asyncio
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import delete

    from app.db.session import AsyncSessionLocal
    from app.models.auth import RefreshToken

    async def _cleanup() -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                delete(RefreshToken).where(
                    (RefreshToken.expires_at < cutoff) | (RefreshToken.is_revoked.is_(True))
                )
            )
            await session.commit()
            return result.rowcount

    count = asyncio.get_event_loop().run_until_complete(_cleanup())
    logger.info("cleanup_expired_refresh_tokens", deleted_count=count)
    return {"deleted": count}
