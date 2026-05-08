from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class DomainEvent:
    """
    Base class for all domain events.

    Events are lightweight value objects that describe something that happened.
    They are dispatched after the transaction commits so handlers don't need
    to worry about rollback scenarios.
    """

    event_type: str
    payload: dict[str, Any] = field(default_factory=dict)
    event_id: uuid.UUID = field(default_factory=uuid.uuid4)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    tenant_id: uuid.UUID | None = None
    actor_id: uuid.UUID | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": str(self.event_id),
            "event_type": self.event_type,
            "tenant_id": str(self.tenant_id) if self.tenant_id else None,
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "occurred_at": self.occurred_at.isoformat(),
            "payload": self.payload,
        }
