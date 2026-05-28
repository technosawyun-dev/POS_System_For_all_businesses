from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.reseller_finance.models.notes import ResellerNote
from app.reseller_finance.repositories.note_repository import NoteRepository
from app.services.audit_service import AuditService

logger = get_logger(__name__)


class NoteService:
    """CRUD service for internal reseller admin notes.

    Notes are immutable once created — they can only be listed or added.
    Notes are immutable once created — they can only be listed or added.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = NoteRepository(session)
        self.audit = AuditService(session)

    async def list_notes(self, reseller_id: uuid.UUID) -> list[ResellerNote]:
        """Return all notes for a reseller, newest first (no pagination cap)."""
        items, _ = await self.repo.list_notes_for_reseller(
            reseller_id=reseller_id,
            page=1,
            page_size=500,
        )
        return items

    async def create_note(
        self,
        reseller_id: uuid.UUID,
        note: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ResellerNote:
        """Persist a new immutable admin note on a reseller profile."""
        row = await self.repo.create_note(
            reseller_id=reseller_id,
            note=note,
            created_by=actor_id,
        )

        await self.audit.log(
            action="RESELLER_NOTE_CREATED",
            actor_user_id=actor_id,
            entity_type="RESELLER_NOTE",
            entity_id=row.id,
            after_state={
                "reseller_id": str(reseller_id),
                "note_length": len(note),
            },
            request_id=request_id,
        )

        logger.info(
            "reseller_note_created",
            note_id=str(row.id),
            reseller_id=str(reseller_id),
            actor_id=str(actor_id),
        )
        return row
