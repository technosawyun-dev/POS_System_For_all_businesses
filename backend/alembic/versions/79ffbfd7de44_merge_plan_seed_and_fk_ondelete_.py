"""merge plan seed and FK ondelete hardening branches

Revision ID: 79ffbfd7de44
Revises: a8b9c0d1e2f3, b1c2d3e4f5a6
Create Date: 2026-07-02 18:48:55.768124

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79ffbfd7de44'
down_revision: Union[str, None] = ('a8b9c0d1e2f3', 'b1c2d3e4f5a6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
