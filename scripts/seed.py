#!/usr/bin/env python3
"""Run database seeds standalone."""
from __future__ import annotations

import asyncio

from app.db.session import AsyncSessionLocal
from app.db.seed import run_seeds
from app.core.logging import configure_logging


async def main() -> None:
    configure_logging()
    async with AsyncSessionLocal() as session:
        await run_seeds(session)


if __name__ == "__main__":
    asyncio.run(main())
