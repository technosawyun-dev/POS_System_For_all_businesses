from __future__ import annotations

import asyncio
import functools
from typing import Any, Callable, TypeVar

from sqlalchemy.exc import OperationalError

from app.core.logging import get_logger

logger = get_logger(__name__)

F = TypeVar("F", bound=Callable[..., Any])

# PostgreSQL error codes that indicate a deadlock or serialization failure
_RETRYABLE_PG_CODES = frozenset({"40001", "40P01"})


def _is_retryable(exc: OperationalError) -> bool:
    cause = exc.__cause__
    if cause is not None:
        pg_code = getattr(cause, "pgcode", None) or getattr(cause, "sqlstate", None)
        if pg_code in _RETRYABLE_PG_CODES:
            return True
    return "deadlock" in str(exc).lower() or "serialization" in str(exc).lower()


def with_deadlock_retry(
    max_retries: int = 3,
    base_delay: float = 0.05,
    max_delay: float = 1.0,
) -> Callable[[F], F]:
    """
    Retry decorator for async functions that may hit PostgreSQL deadlocks or
    serialization failures.

    Only retries on OperationalError with deadlock/serialization PG codes.
    Uses exponential backoff capped at max_delay seconds.

    IMPORTANT: Only decorate idempotent operations. Do NOT use on functions
    with irreversible side effects outside the transaction.
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except OperationalError as exc:
                    if not _is_retryable(exc) or attempt >= max_retries - 1:
                        raise
                    delay = min(base_delay * (2**attempt), max_delay)
                    logger.warning(
                        "deadlock_retry",
                        func=func.__qualname__,
                        attempt=attempt + 1,
                        max_retries=max_retries,
                        delay_s=round(delay, 3),
                    )
                    await asyncio.sleep(delay)
            raise RuntimeError("unreachable")  # pragma: no cover

        return wrapper  # type: ignore[return-value]

    return decorator
