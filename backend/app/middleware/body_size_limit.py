from __future__ import annotations

from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Matches the Nginx client_max_body_size this replaces, now that Cloudflare
# Tunnel forwards straight to the API with no reverse proxy in between.
_MAX_BODY_BYTES = 16 * 1024 * 1024


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects requests whose declared Content-Length exceeds _MAX_BODY_BYTES."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                too_large = int(content_length) > _MAX_BODY_BYTES
            except ValueError:
                too_large = False  # malformed header — let the app handle it normally
            if too_large:
                return JSONResponse(
                    status_code=413,
                    content={
                        "success": False,
                        "error": {
                            "code": "PAYLOAD_TOO_LARGE",
                            "message": f"Request body exceeds the {_MAX_BODY_BYTES // (1024 * 1024)} MB limit.",
                            "details": {},
                        },
                    },
                )
        return await call_next(request)
