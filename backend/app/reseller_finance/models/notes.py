from __future__ import annotations

import uuid
from typing import ClassVar

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ResellerNote(Base):
    """
    An internal, admin-authored note attached to a reseller account.
    Notes are immutable once created (no updated_at column).
    """

    __tablename__ = "reseller_notes"
    __table_args__ = (
        Index(
            "ix_reseller_notes_reseller_id_created_at",
            "reseller_id",
            # DESC ordering hint is advisory at the model layer; enforced in
            # the migration via sa.text("created_at DESC").
            "created_at",
        ),
    )

    # Immutable record — ClassVar tells SQLAlchemy to skip this attribute.
    updated_at: ClassVar[None] = None

    reseller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ResellerNote reseller={self.reseller_id} "
            f"created_by={self.created_by}>"
        )
