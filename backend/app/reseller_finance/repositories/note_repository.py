from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.reseller_finance.models.notes import ResellerNote


class NoteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_notes_for_reseller(
        self,
        reseller_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ResellerNote], int]:
        offset = (page - 1) * page_size
        count_stmt = (
            select(func.count())
            .select_from(ResellerNote)
            .where(ResellerNote.reseller_id == reseller_id)
        )
        stmt = (
            select(ResellerNote)
            .where(ResellerNote.reseller_id == reseller_id)
            .order_by(ResellerNote.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        total = (await self.session.execute(count_stmt)).scalar_one()
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def create_note(
        self,
        reseller_id: uuid.UUID,
        note: str,
        created_by: uuid.UUID,
    ) -> ResellerNote:
        obj = ResellerNote(reseller_id=reseller_id, note=note, created_by=created_by)
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj
