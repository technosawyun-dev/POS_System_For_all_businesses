#!/usr/bin/env python3
"""Create super admin for production.

Usage:
    python scripts/create_super_admin.py

Reads credentials from environment variables:
    SUPER_ADMIN_EMAIL
    SUPER_ADMIN_PASSWORD
    SUPER_ADMIN_FIRST_NAME (optional, defaults to "Super")
    SUPER_ADMIN_LAST_NAME  (optional, defaults to "Admin")

Works in any APP_ENV including production.
Exits with code 1 if the email already exists.
"""
from __future__ import annotations

import asyncio
import sys

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.core.constants import UserRole, UserStatus
from app.repositories.user_repository import UserRepository


async def main() -> None:
    configure_logging()

    if len(settings.SUPER_ADMIN_PASSWORD) < 12:
        print("ERROR: SUPER_ADMIN_PASSWORD must be at least 12 characters.", file=sys.stderr)
        sys.exit(1)

    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        existing = await user_repo.get_by_email(settings.SUPER_ADMIN_EMAIL)
        if existing:
            print(f"ERROR: A user with email '{settings.SUPER_ADMIN_EMAIL}' already exists.", file=sys.stderr)
            sys.exit(1)

        user = User(
            email=settings.SUPER_ADMIN_EMAIL,
            hashed_password=hash_password(settings.SUPER_ADMIN_PASSWORD),
            first_name=settings.SUPER_ADMIN_FIRST_NAME,
            last_name=settings.SUPER_ADMIN_LAST_NAME,
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
        )
        session.add(user)
        await session.commit()
        print(f"Super admin created: {settings.SUPER_ADMIN_EMAIL}")


if __name__ == "__main__":
    asyncio.run(main())
