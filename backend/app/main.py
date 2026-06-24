from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, AsyncGenerator

import os

import orjson
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, ORJSONResponse

from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.router import api_router
from app.api.deps import get_current_user
from app.models.user import User
from app.core.config import settings
from app.core.constants import API_V1_PREFIX
from app.core.exceptions import AppBaseException
from app.core.logging import configure_logging, get_logger
from app.db.redis import close_redis_pool, get_redis_pool
from app.db.session import engine, get_db
from app.events import handlers as _event_handlers  # noqa: F401 — registers handlers
from app.notifications import handlers as _notification_handlers  # noqa: F401 — registers notification handlers
from app.reseller_finance.events import handlers as _reseller_finance_handlers # noqa: F401 — handlers
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.middleware.idempotency import IdempotencyMiddleware
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limit import PerUserRateLimitMiddleware
from app.middleware.request_id import RequestIDMiddleware

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    configure_logging()
    logger.info("Starting POS SaaS API", version=settings.APP_VERSION, env=settings.APP_ENV)

    await get_redis_pool()
    logger.info("Redis connected")

    yield

    await close_redis_pool()
    await engine.dispose()
    logger.info("POS SaaS API shutdown complete")


def create_application() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Enterprise Multi-Tenant POS SaaS Backend API",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # Middleware — last added = outermost (executes first on request)
    # Execution order: CORS → RequestID → Logging → PerUserRateLimit → Idempotency → ErrorHandler → route
    app.add_middleware(ErrorHandlerMiddleware)
    app.add_middleware(IdempotencyMiddleware)
    app.add_middleware(PerUserRateLimitMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    # Exception handlers
    @app.exception_handler(AppBaseException)
    async def app_exception_handler(request: Request, exc: AppBaseException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        safe_errors = [
            {"field": " -> ".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": {"errors": safe_errors},
                },
            },
        )

    # Security headers on every response
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Routes
    app.include_router(api_router, prefix=API_V1_PREFIX)

    # Ensure upload directory exists
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    # Protected file serving — requires a valid JWT; SUPER_ADMIN can access any file.
    # Files are validated to stay within the upload root (path traversal prevention).
    @app.get("/uploads/proofs/{tenant_id}/{filename}", include_in_schema=False)
    async def serve_upload(
        tenant_id: str,
        filename: str,
        current_user: Annotated[User, Depends(get_current_user)],
        db: AsyncSession = Depends(get_db),
    ) -> FileResponse:
        from app.core.constants import UserRole
        from sqlalchemy import select

        if current_user.role == UserRole.SUPER_ADMIN:
            pass  # full access
        elif current_user.tenant_id and str(current_user.tenant_id) == tenant_id:
            pass  # own tenant
        elif current_user.role == UserRole.RESELLER:
            # Resellers may access proof files for their referred tenants
            from app.reseller_finance.models.referral import TenantReferral
            import uuid as _uuid
            try:
                tid = _uuid.UUID(tenant_id)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tenant_id")
            result = await db.execute(
                select(TenantReferral).where(
                    TenantReferral.reseller_id == current_user.id,
                    TenantReferral.tenant_id == tid,
                )
            )
            if not result.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        upload_root = Path(settings.UPLOAD_DIR).resolve()
        file_path = (upload_root / "proofs" / tenant_id / filename).resolve()

        # Prevent path traversal
        if not str(file_path).startswith(str(upload_root)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")

        if not file_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        return FileResponse(
            file_path,
            headers={"Content-Disposition": f"attachment; filename={file_path.name}"},
        )

    @app.get("/uploads/payment-icons/{filename}", include_in_schema=False)
    async def serve_payment_icon(filename: str) -> FileResponse:
        upload_root = Path(settings.UPLOAD_DIR).resolve()
        file_path = (upload_root / "payment-icons" / filename).resolve()
        if not str(file_path).startswith(str(upload_root)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")
        if not file_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        return FileResponse(file_path)

    @app.get("/health", tags=["Health"], include_in_schema=False)
    async def health_check() -> dict:
        """Basic liveness probe — returns 200 as long as the process is alive."""
        return {"status": "healthy"}

    @app.get("/health/ready", tags=["Health"], include_in_schema=False)
    async def readiness_check(request: Request) -> JSONResponse:
        """
        Readiness probe — verifies all dependencies are reachable.
        Returns 200 if ready, 503 if any dependency is unavailable.
        Load balancers should stop sending traffic on 503.
        """
        import time

        checks: dict[str, dict] = {}
        overall_ok = True

        # Database check
        try:
            db_start = time.perf_counter()
            async with engine.connect() as conn:
                from sqlalchemy import text

                await conn.execute(text("SELECT 1"))
            checks["database"] = {
                "status": "ok",
                "latency_ms": round((time.perf_counter() - db_start) * 1000, 2),
            }
        except Exception as exc:
            overall_ok = False
            logger.error("health_check_db_failed", error=str(exc))
            checks["database"] = {"status": "error"}

        # Redis check
        try:
            from app.db.redis import get_redis_pool

            redis_start = time.perf_counter()
            redis = await get_redis_pool()
            await redis.ping()
            checks["redis"] = {
                "status": "ok",
                "latency_ms": round((time.perf_counter() - redis_start) * 1000, 2),
            }
        except Exception as exc:
            overall_ok = False
            logger.error("health_check_redis_failed", error=str(exc))
            checks["redis"] = {"status": "error"}

        http_status = status.HTTP_200_OK if overall_ok else status.HTTP_503_SERVICE_UNAVAILABLE
        return JSONResponse(
            status_code=http_status,
            content={
                "status": "ready" if overall_ok else "not_ready",
                "version": settings.APP_VERSION,
                "checks": checks,
            },
        )

    @app.get("/health/live", tags=["Health"], include_in_schema=False)
    async def liveness_check() -> dict:
        """Kubernetes liveness probe — minimal check, just confirm process is alive."""
        return {"status": "alive"}

    @app.get("/", tags=["Root"], include_in_schema=False)
    async def root() -> dict:
        return {"name": settings.APP_NAME, "version": settings.APP_VERSION}

    return app


app = create_application()
