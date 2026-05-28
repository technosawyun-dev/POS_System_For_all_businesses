from __future__ import annotations

import time

from redis.asyncio import Redis

from app.core.exceptions import RateLimitError


async def check_rate_limit(
    redis: Redis,
    key: str,
    max_requests: int,
    window_seconds: int,
    error_message: str = "Rate limit exceeded. Please try again later.",
) -> None:
    """Sliding-window rate limiter backed by a Redis sorted set.

    Raises RateLimitError (HTTP 429) when the caller exceeds max_requests
    within window_seconds.  The key should be namespaced by caller identity
    (e.g. IP address).
    """
    now = int(time.time())
    window_start = now - window_seconds

    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    # Use a unique member per request to avoid collisions in the same second
    pipe.zadd(key, {f"{now}:{time.monotonic_ns()}": now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds + 1)
    results = await pipe.execute()

    count = results[2]
    if count > max_requests:
        raise RateLimitError(error_message)


async def check_registration_rate_limit(redis: Redis, ip: str) -> None:
    """Max 5 registration attempts per IP per hour."""
    from app.core.config import settings

    if not settings.RATE_LIMIT_ENABLED:
        return

    key = f"rate:register:{ip}"
    await check_rate_limit(
        redis=redis,
        key=key,
        max_requests=settings.REGISTRATION_MAX_PER_IP_PER_HOUR,
        window_seconds=3600,
        error_message=(
            "Too many registration attempts from this IP. "
            "Please try again in an hour."
        ),
    )


async def check_ip_daily_abuse(redis: Redis, ip: str, max_per_day: int) -> None:
    """Secondary abuse gate: max N registrations from the same IP per 24 hours."""
    from app.core.config import settings

    if not settings.RATE_LIMIT_ENABLED:
        return

    key = f"abuse:register_daily:{ip}"
    await check_rate_limit(
        redis=redis,
        key=key,
        max_requests=max_per_day,
        window_seconds=86400,
        error_message=(
            "Registration limit reached for this IP address. "
            "Contact support if you believe this is an error."
        ),
    )
