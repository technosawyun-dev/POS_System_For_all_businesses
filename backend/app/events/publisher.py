from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, Awaitable, Callable

from app.core.logging import get_logger
from app.events.base import DomainEvent

logger = get_logger(__name__)

Handler = Callable[[DomainEvent], Awaitable[None]]


class EventPublisher:
    """
    In-process async event bus.

    Handlers are called concurrently via asyncio.gather. Failures in individual
    handlers are logged but do NOT propagate — domain logic must not depend on
    handler success.

    Usage:
        from app.events import event_publisher, EventType
        from app.events.base import DomainEvent

        # Register a handler (typically at startup)
        @event_publisher.on(EventType.PRODUCT_CREATED)
        async def handle_product_created(event: DomainEvent) -> None:
            ...

        # Publish an event (typically from a service after commit)
        await event_publisher.publish(DomainEvent(
            event_type=EventType.PRODUCT_CREATED,
            tenant_id=tenant_id,
            actor_id=actor_id,
            payload={"product_id": str(product.id), "name": product.name},
        ))
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)

    def on(self, event_type: str) -> Callable[[Handler], Handler]:
        """Decorator to register a handler for an event type."""

        def decorator(handler: Handler) -> Handler:
            self._handlers[event_type].append(handler)
            return handler

        return decorator

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, event: DomainEvent) -> None:
        handlers = self._handlers.get(event.event_type, [])
        if not handlers:
            return

        results = await asyncio.gather(
            *[h(event) for h in handlers],
            return_exceptions=True,
        )

        for handler, result in zip(handlers, results):
            if isinstance(result, Exception):
                logger.error(
                    "event_handler_error",
                    event_type=event.event_type,
                    event_id=str(event.event_id),
                    handler=getattr(handler, "__qualname__", repr(handler)),
                    error=str(result),
                )

    async def publish_many(self, events: list[DomainEvent]) -> None:
        for event in events:
            await self.publish(event)


# Process-level singleton
event_publisher = EventPublisher()
