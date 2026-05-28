"""
Thin Redis cache helpers — JSON-based, TTL-aware.

Only use for read-heavy, non-sensitive, eventually-consistent data
(e.g. dashboard aggregates, plan lists). Never cache wallet balances,
financial ledgers, or any write-path data.
"""
from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis


async def cache_get(redis: Redis, key: str) -> Any | None:
    raw = await redis.get(key)
    return json.loads(raw) if raw is not None else None


async def cache_set(redis: Redis, key: str, value: Any, ttl: int = 120) -> None:
    await redis.setex(key, ttl, json.dumps(value, default=str))


async def cache_delete(redis: Redis, key: str) -> None:
    await redis.delete(key)


async def cache_delete_pattern(redis: Redis, pattern: str) -> None:
    """Delete all keys matching a glob pattern. Use sparingly — scans keyspace."""
    keys = [k async for k in redis.scan_iter(match=pattern, count=100)]
    if keys:
        await redis.delete(*keys)
