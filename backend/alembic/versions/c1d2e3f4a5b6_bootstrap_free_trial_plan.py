"""Bootstrap FREE_TRIAL plan for fresh installs

Revision ID: c1d2e3f4a5b6
Revises: 79ffbfd7de44
Create Date: 2026-07-02

The BASIC -> FREE -> FREE_TRIAL rename chain (r3s4t5u6v7, x5y6z7a8b9c0) only ever
UPDATEs an existing row by code. On a database that was never hand-seeded with a
BASIC plan (i.e. every fresh install), those renames are no-ops and FREE_TRIAL is
never created. This migration inserts FREE_TRIAL directly if it's missing, matching
the state x5y6z7a8b9c0 produces for databases where the rename chain did fire.

Before inserting, it also relaxes uq_subscription_plans_single_active_trial
(added by f1a2b3c4d5e6, before is_referral_plan existed). As written that index
allows only one is_trial=true AND is_active=true row in the whole table — but
u2v3w4x5y6z7 already seeds REFERRAL_TRIAL with exactly those flags, so any
attempt to also activate a FREE_TRIAL plan (here, or via the original rename
chain on a database where it fired) hits a unique violation. The two trial
plans are meant to coexist (REFERRAL_TRIAL is documented as "slightly better
than FREE"), so the index is re-scoped to exclude referral plans instead of
enforcing global uniqueness.

Safe to re-run: the index rebuild is DROP-then-CREATE-if-missing and both
inserts are ON CONFLICT DO NOTHING.
"""
from __future__ import annotations

from alembic import op

revision = "c1d2e3f4a5b6"
down_revision = "79ffbfd7de44"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0. Re-scope the single-active-trial constraint to exclude referral plans,
    #    so FREE_TRIAL and REFERRAL_TRIAL can both be is_trial=true/is_active=true.
    op.execute("DROP INDEX IF EXISTS uq_subscription_plans_single_active_trial")
    op.execute("""
        CREATE UNIQUE INDEX uq_subscription_plans_single_active_trial
        ON subscription_plans (is_trial)
        WHERE is_trial = TRUE AND is_active = TRUE AND is_referral_plan = FALSE
    """)

    # 1. Insert the FREE_TRIAL plan (idempotent)
    op.execute("""
        INSERT INTO subscription_plans
            (id, name, code, description, billing_cycle, price, currency,
             trial_days, is_active, is_trial, is_referral_plan, is_public,
             is_custom, sort_order, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'Free Trial',
            'FREE_TRIAL',
            '14-day free trial. Upgrade to a paid plan to continue after expiry.',
            'MONTHLY',
            0,
            'MMK',
            14,
            true,
            true,
            false,
            false,
            false,
            0,
            now(),
            now()
        )
        ON CONFLICT (code) DO NOTHING
    """)

    # 2. Seed entitlements for FREE_TRIAL (same limits the FREE plan had)
    op.execute("""
        INSERT INTO plan_entitlements
            (id, plan_id, feature_code, enabled, limit_value, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            sp.id,
            e.feature_code,
            e.enabled,
            e.limit_value,
            now(),
            now()
        FROM subscription_plans sp
        CROSS JOIN (
            VALUES
                ('branches',    true,  1),
                ('users',       true,  3),
                ('products',    true,  50),
                ('customers',   true,  100),
                ('analytics',   false, NULL::int),
                ('procurement', false, NULL::int)
        ) AS e(feature_code, enabled, limit_value)
        WHERE sp.code = 'FREE_TRIAL'
        ON CONFLICT (plan_id, feature_code) DO NOTHING
    """)


def downgrade() -> None:
    # Only remove what this migration would have created; if the rename chain
    # already produced FREE_TRIAL (existing deployments), leave it alone.
    op.execute("""
        DELETE FROM plan_entitlements
        WHERE plan_id = (SELECT id FROM subscription_plans WHERE code = 'FREE_TRIAL')
          AND NOT EXISTS (
              SELECT 1 FROM tenant_subscriptions ts
              JOIN subscription_plans sp ON ts.plan_id = sp.id
              WHERE sp.code = 'FREE_TRIAL'
          )
    """)
    op.execute("""
        DELETE FROM subscription_plans
        WHERE code = 'FREE_TRIAL'
          AND NOT EXISTS (
              SELECT 1 FROM tenant_subscriptions ts
              JOIN subscription_plans sp ON ts.plan_id = sp.id
              WHERE sp.code = 'FREE_TRIAL'
          )
    """)

    # Restore the original global constraint only if it would still hold
    # (i.e. at most one is_trial=true AND is_active=true row remains).
    op.execute("""
        DO $$
        BEGIN
            IF (SELECT count(*) FROM subscription_plans
                WHERE is_trial = TRUE AND is_active = TRUE) <= 1 THEN
                EXECUTE 'DROP INDEX IF EXISTS uq_subscription_plans_single_active_trial';
                EXECUTE '
                    CREATE UNIQUE INDEX uq_subscription_plans_single_active_trial
                    ON subscription_plans (is_trial)
                    WHERE is_trial = TRUE AND is_active = TRUE
                ';
            END IF;
        END $$;
    """)
