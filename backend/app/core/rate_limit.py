from __future__ import annotations

import time

from redis.asyncio import Redis

from app.core.exceptions import RateLimitError

# Per-account brute-force lockout: 5 consecutive failures → 15-minute lockout.
# Keyed by a hash of the login identifier so a rotating-IP attack still hits the ceiling.
_ACCOUNT_LOCKOUT_MAX_ATTEMPTS = 5
_ACCOUNT_LOCKOUT_SECONDS = 900  # 15 minutes


async def is_account_locked(redis: Redis, key: str) -> bool:
    """Return True if this account has exceeded the failed-login threshold."""
    try:
        count = await redis.get(key)
        return int(count or 0) >= _ACCOUNT_LOCKOUT_MAX_ATTEMPTS
    except Exception:
        return False  # fail-open: Redis outage must never block all logins


async def record_failed_login(redis: Redis, key: str) -> None:
    """Increment the per-account failure counter and (re)set its TTL."""
    try:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, _ACCOUNT_LOCKOUT_SECONDS)
        await pipe.execute()
    except Exception:
        pass


async def clear_failed_logins(redis: Redis, key: str) -> None:
    """Reset the failure counter immediately after a successful login."""
    try:
        await redis.delete(key)
    except Exception:
        pass


async def check_rate_limit(
    redis: Redis | None,
    key: str,
    max_requests: int,
    window_seconds: int,
    error_message: str = "Rate limit exceeded. Please try again later.",
) -> None:
    """Sliding-window rate limiter backed by a Redis sorted set.

    Raises RateLimitError (HTTP 429) when the caller exceeds max_requests
    within window_seconds.  The key should be namespaced by caller identity
    (e.g. IP address).

    No-ops silently when redis is None — fail-open so a Redis outage never
    blocks legitimate operations like login or password reset.
    """
    if redis is None:
        return

    try:
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
    except RateLimitError:
        raise
    except Exception:
        pass  # Redis error — fail open


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
