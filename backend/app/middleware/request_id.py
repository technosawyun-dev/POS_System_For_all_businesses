from __future__ import annotations

import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.constants import HEADER_X_CORRELATION_ID, HEADER_X_REQUEST_ID


class RequestIDMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get(HEADER_X_REQUEST_ID) or str(uuid.uuid4())
        correlation_id = request.headers.get(HEADER_X_CORRELATION_ID) or request_id

        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        response = await call_next(request)

        response.headers[HEADER_X_REQUEST_ID] = request_id
        response.headers[HEADER_X_CORRELATION_ID] = correlation_id

        return response
