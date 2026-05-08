from __future__ import annotations

import logging
import sys
import uuid
from contextlib import contextmanager
from typing import Any, Generator

import structlog

from app.core.config import settings


def configure_logging() -> None:
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.LOG_FORMAT == "json":
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
    else:
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    return structlog.get_logger(name)


def bind_request_context(
    *,
    request_id: str | None = None,
    tenant_id: str | uuid.UUID | None = None,
    user_id: str | uuid.UUID | None = None,
    branch_id: str | uuid.UUID | None = None,
    service_name: str | None = None,
) -> None:
    """
    Bind structured fields to the current async context.
    All subsequent log calls in this request will include these fields.
    Call this from middleware after authentication resolves the user/tenant.
    """
    ctx: dict[str, Any] = {}
    if request_id:
        ctx["request_id"] = request_id
    if tenant_id:
        ctx["tenant_id"] = str(tenant_id)
    if user_id:
        ctx["user_id"] = str(user_id)
    if branch_id:
        ctx["branch_id"] = str(branch_id)
    if service_name:
        ctx["service_name"] = service_name
    if ctx:
        structlog.contextvars.bind_contextvars(**ctx)


def clear_request_context() -> None:
    structlog.contextvars.clear_contextvars()


@contextmanager
def log_operation(
    operation: str,
    logger: Any,
    **extra: Any,
) -> Generator[None, None, None]:
    """
    Context manager that logs operation start/end and measures duration.

    Usage:
        with log_operation("stock_adjustment", logger, product_id=str(pid)):
            await do_work()
    """
    import time

    start = time.perf_counter()
    logger.debug(f"{operation}_started", **extra)
    try:
        yield
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(f"{operation}_completed", duration_ms=duration_ms, **extra)
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.error(
            f"{operation}_failed",
            duration_ms=duration_ms,
            error=str(exc),
            **extra,
        )
        raise
