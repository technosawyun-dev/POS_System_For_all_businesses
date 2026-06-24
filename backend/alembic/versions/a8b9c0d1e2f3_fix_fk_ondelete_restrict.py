"""fix FK ondelete SET NULL to RESTRICT on not-null user reference columns

Revision ID: a8b9c0d1e2f3
Revises: z7a8b9c0d1e2
Create Date: 2026-06-24

These columns declared ondelete="SET NULL" but are nullable=False — a contradiction
that causes PostgreSQL to raise a NOT NULL constraint violation when deleting a user
who owns any of these records. Changing to RESTRICT so deletion is blocked instead of
silently crashing. Staff/users in this system are deactivated rather than hard-deleted,
so RESTRICT is the correct intent.
"""
from __future__ import annotations

from alembic import op

revision = 'a8b9c0d1e2f3'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None

# (table, column, references_table)
_FIXES = [
    ('orders',               'created_by',          'users'),
    ('payments',             'processed_by',        'users'),
    ('refunds',              'processed_by',        'users'),
    ('stock_movements',      'actor_user_id',       'users'),
    ('inventory_adjustments','actor_user_id',       'users'),
    ('inventory_transfers',  'requested_by_id',     'users'),
    ('purchase_orders',      'created_by',          'users'),
    ('goods_receipts',       'received_by',         'users'),
    ('supplier_payments',    'recorded_by',         'users'),
    ('customer_notes',       'created_by_user_id',  'users'),
    ('customer_ledger',      'created_by_user_id',  'users'),
    ('pos_devices',          'created_by',          'users'),
    ('product_price_history','changed_by_id',       'users'),
]


def _fix_constraint(table: str, column: str, ref_table: str, ondelete: str) -> None:
    """Drop the existing FK on table.column and recreate it with the given ondelete."""
    op.execute(f"""
        DO $$
        DECLARE v_constraint text;
        BEGIN
            SELECT tc.constraint_name INTO v_constraint
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.table_name   = '{table}'
              AND kcu.column_name = '{column}'
              AND tc.constraint_type = 'FOREIGN KEY';
            IF v_constraint IS NOT NULL THEN
                EXECUTE 'ALTER TABLE {table} DROP CONSTRAINT ' || quote_ident(v_constraint);
            END IF;
        END $$;
    """)
    op.execute(f"""
        ALTER TABLE {table}
        ADD CONSTRAINT {table}_{column}_fkey
        FOREIGN KEY ({column}) REFERENCES {ref_table}(id) ON DELETE {ondelete}
    """)


def upgrade() -> None:
    for table, column, ref_table in _FIXES:
        _fix_constraint(table, column, ref_table, 'RESTRICT')


def downgrade() -> None:
    for table, column, ref_table in _FIXES:
        _fix_constraint(table, column, ref_table, 'SET NULL')
