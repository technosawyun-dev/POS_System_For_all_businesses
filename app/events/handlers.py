from __future__ import annotations

"""
Domain event handlers.

Import this module at application startup to register all handlers.
Handlers are intentionally lightweight — they log, fan out to Celery tasks,
or prepare notifications. They must not perform synchronous DB writes.
"""

from app.core.logging import get_logger
from app.events.base import DomainEvent
from app.events.publisher import event_publisher
from app.events.types import EventType

logger = get_logger(__name__)


@event_publisher.on(EventType.STOCK_MOVEMENT_CREATED)
async def log_stock_movement(event: DomainEvent) -> None:
    logger.info(
        "domain_event",
        event_type=event.event_type,
        tenant_id=str(event.tenant_id) if event.tenant_id else None,
        payload=event.payload,
    )


@event_publisher.on(EventType.INVENTORY_DISCREPANCY_DETECTED)
async def alert_on_discrepancy(event: DomainEvent) -> None:
    logger.warning(
        "inventory_discrepancy_alert",
        tenant_id=str(event.tenant_id) if event.tenant_id else None,
        discrepancy_count=event.payload.get("count"),
        details=event.payload,
    )


@event_publisher.on(EventType.TRANSFER_EXECUTED)
async def log_transfer_executed(event: DomainEvent) -> None:
    logger.info(
        "domain_event",
        event_type=event.event_type,
        tenant_id=str(event.tenant_id) if event.tenant_id else None,
        transfer_id=event.payload.get("transfer_id"),
    )


@event_publisher.on(EventType.USER_LOGGED_IN)
async def log_user_login(event: DomainEvent) -> None:
    logger.info(
        "domain_event",
        event_type=event.event_type,
        tenant_id=str(event.tenant_id) if event.tenant_id else None,
        user_id=event.payload.get("user_id"),
    )
