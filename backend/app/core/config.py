from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated, Any

from pydantic import AnyHttpUrl, Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "POS_SaaS"
    APP_ENV: str = "development"
    APP_DEBUG: bool = False
    APP_SECRET_KEY: str
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    APP_VERSION: str = "1.0.0"

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    JWT_ISSUER: str = "pos-saas"
    JWT_AUDIENCE: str = "pos-saas-users"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_TIMEZONE: str = "UTC"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    CORS_ALLOW_HEADERS: list[str] = [
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Request-ID",
        "Idempotency-Key",
    ]

    # Proxy trust — set True only when running behind a trusted reverse proxy (Nginx/LB)
    # that correctly sets X-Forwarded-For. When False the real connection IP is always used.
    TRUST_PROXY_HEADERS: bool = False

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 120
    RATE_LIMIT_BURST: int = 100
    REGISTRATION_MAX_PER_IP_PER_HOUR: int = 5
    REGISTRATION_ABUSE_MAX_PER_IP_PER_DAY: int = 10

    # File Uploads
    UPLOAD_DIR: str = "./uploads"
    UPLOAD_MAX_FILE_SIZE_MB: int = 10
    UPLOAD_ALLOWED_CONTENT_TYPES: list[str] = [
        "image/jpeg",
        "image/png",
        "application/pdf",
    ]

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = "logs/app.log"

    # Email / Mailtrap
    EMAIL_ENABLED: bool = True
    MAILTRAP_API_TOKEN: str = ""
    EMAIL_FROM: str = "noreply@demo.com"        # TODO: change to your real sender email
    EMAIL_FROM_NAME: str = "POS System"         # TODO: change to your real sender name
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # Super Admin seed
    SUPER_ADMIN_EMAIL: str = "superadmin@pos-saas.com"
    SUPER_ADMIN_PASSWORD: str
    SUPER_ADMIN_FIRST_NAME: str = "Super"
    SUPER_ADMIN_LAST_NAME: str = "Admin"

    @field_validator("JWT_SECRET_KEY", "APP_SECRET_KEY")
    @classmethod
    def validate_secret_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters for security")
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [origin.strip() for origin in v.split(",")]
        return v

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
