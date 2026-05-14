from __future__ import annotations

import json
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.logging import get_logger

logger = get_logger(__name__)

IDEMPOTENCY_HEADER = "Idempotency-Key"
IDEMPOTENCY_TTL = 86_400  # 24 hours in seconds
_PROCESSING_TTL = 60       # 60-second window for in-flight requests

# Paths where idempotency enforcement is active (POST only)
_IDEMPOTENT_PATHS: frozenset[str] = frozenset(
    {
        "/api/v1/inventory/adjustments",
        "/api/v1/inventory/transfers",
        "/api/v1/inventory/opening-stock",
    }
)


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    Redis-backed idempotency guard for mutation endpoints.

    On the first request with a given Idempotency-Key:
      - Marks the key as "processing" in Redis (60 s TTL)
      - Executes the handler
      - On 2xx: stores the full response body + status code (24 h TTL)

    On a duplicate request with the same key:
      - If still processing: returns 409 REQUEST_IN_PROGRESS
      - If completed: replays the stored response with X-Idempotent-Replayed: true

    Keys are namespaced per tenant so key collisions across tenants are
    impossible. If Redis is unavailable the request is passed through
    unguarded (fail-open) to avoid blocking legitimate traffic.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method != "POST" or request.url.path not in _IDEMPOTENT_PATHS:
            return await call_next(request)

        idempotency_key = request.headers.get(IDEMPOTENCY_HEADER)
        if not idempotency_key:
            return await call_next(request)

        # Tenant context injected by auth middleware via request.state
        tenant_id = str(getattr(request.state, "tenant_id", "global"))
        redis_key = f"idempotency:{tenant_id}:{idempotency_key}"

        try:
            from app.db.redis import get_redis_pool  # local import avoids circular dep

            redis = await get_redis_pool()

            cached_raw = await redis.get(redis_key)
            if cached_raw:
                cached = json.loads(cached_raw)
                if cached.get("status") == "processing":
                    return JSONResponse(
                        status_code=409,
                        content={
                            "success": False,
                            "error": {
                                "code": "REQUEST_IN_PROGRESS",
                                "message": (
                                    "A request with this Idempotency-Key is already "
                                    "being processed. Retry after a few seconds."
                                ),
                                "details": {"idempotency_key": idempotency_key},
                            },
                        },
                    )
                # Replay stored response
                logger.info(
                    "idempotency_replay",
                    key=idempotency_key,
                    tenant_id=tenant_id,
                    status_code=cached["status_code"],
                )
                return JSONResponse(
                    status_code=cached["status_code"],
                    content=cached["body"],
                    headers={"X-Idempotent-Replayed": "true"},
                )

            # Mark as processing
            await redis.setex(
                redis_key,
                _PROCESSING_TTL,
                json.dumps({"status": "processing"}),
            )

        except Exception as exc:
            # Fail-open: if Redis is unavailable, process normally
            logger.warning("idempotency_redis_unavailable", error=str(exc))
            return await call_next(request)

        # Execute the actual handler
        response = await call_next(request)

        # Cache 2xx responses only
        if 200 <= response.status_code < 300:
            try:
                body_chunks: list[bytes] = []
                async for chunk in response.body_iterator:
                    body_chunks.append(chunk)
                body = b"".join(body_chunks)

                await redis.setex(
                    redis_key,
                    IDEMPOTENCY_TTL,
                    json.dumps(
                        {
                            "status": "completed",
                            "status_code": response.status_code,
                            "body": json.loads(body),
                        }
                    ),
                )

                return Response(
                    content=body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
            except Exception as exc:
                logger.warning("idempotency_cache_store_error", error=str(exc))
        else:
            # On errors, remove the processing lock so the client can retry
            try:
                await redis.delete(redis_key)
            except Exception:
                pass

        return response
