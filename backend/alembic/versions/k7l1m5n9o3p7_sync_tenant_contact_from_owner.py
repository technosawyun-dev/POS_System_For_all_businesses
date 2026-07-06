"""sync_tenant_contact_from_owner

Revision ID: k7l1m5n9o3p7
Revises: j5k9l3m7n1o5
Create Date: 2026-07-07 00:00:00.000000

tenants.email/phone are denormalized copies of the owner's email/phone,
written once at registration and never re-synced afterward (UserService
now keeps them in sync going forward — see user_service.py/auth_service.py).
This is a one-time backfill for tenants created before that fix, whose
owner has since changed their email or phone via the Profile page: those
tenants would otherwise keep showing the stale registration-time value on
the Settings and Super Admin Overview pages forever.
"""
from __future__ import annotations

from alembic import op

revision = 'k7l1m5n9o3p7'
down_revision = 'j5k9l3m7n1o5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE tenants
        SET email = users.email,
            phone = users.phone
        FROM users
        WHERE users.id = tenants.owner_id
          AND tenants.is_deleted = false
          AND (tenants.email IS DISTINCT FROM users.email
               OR tenants.phone IS DISTINCT FROM users.phone)
        """
    )


def downgrade() -> None:
    # One-time data backfill — the pre-backfill stale values aren't worth
    # restoring, so this is intentionally a no-op.
    pass
