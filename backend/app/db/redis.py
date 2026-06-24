from __future__ import annotations

from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis_pool: Redis | None = None


async def get_redis_pool() -> Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = await aioredis.from_url(
            settings.REDIS_URL,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            decode_responses=True,
        )
        logger.info("Redis connection pool created")
    return _redis_pool


async def close_redis_pool() -> None:
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None
        logger.info("Redis connection pool closed")


async def get_redis() -> AsyncGenerator[Redis, None]:
    pool = await get_redis_pool()
    yield pool


async def get_redis_optional() -> AsyncGenerator[Redis | None, None]:
    """Fail-open Redis dependency.

    Yields the Redis connection when available, None when Redis is unreachable.
    Use this for endpoints where Redis is used for rate-limiting or caching but
    must never block the primary operation (login, password reset, etc.).
    """
    try:
        pool = await get_redis_pool()
        yield pool
    except Exception:
        yield None
