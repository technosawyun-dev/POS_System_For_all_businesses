"""Rename FREE plan to FREE_TRIAL (14-day trial), deactivate old plans

Revision ID: x5y6z7a8b9c0
Revises: w4x5y6z7a8b9
Create Date: 2026-06-02

Changes:
  - FREE plan renamed: code='FREE_TRIAL', name='Free Trial', trial_days=14,
    is_trial=True, is_public=False.
  - OLD trial plan (code='TRIAL') deactivated — it has 0 entitlements and was
    superseded by the FREE plan. Any tenants still on it are moved to FREE_TRIAL.
  - Existing tenants on the FREE plan that are ACTIVE with expires_at=NULL are
    migrated to TRIAL status with a 14-day window from now.
  - Any plan with is_referral_plan=True AND is_trial=False (the permanent
    "Referral Plan", code='REFERRAL') is deactivated.
  - Tenants on a deactivated plan are moved to FREE_TRIAL with 14 days.
  - The denormalised tenants.subscription_plan field is updated accordingly.
"""
from __future__ import annotations

from alembic import op

revision = "x5y6z7a8b9c0"
down_revision = "w4x5y6z7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0. Rename the old 'TRIAL' plan name to avoid the unique-name constraint
    #    before we rename FREE → 'Free Trial'. We'll deactivate it in step 3.
    op.execute("""
        UPDATE subscription_plans
        SET name       = 'Free Trial (Legacy)',
            updated_at = now()
        WHERE code = 'TRIAL'
    """)

    # 1. Rename FREE → FREE_TRIAL and give it a 14-day trial period
    op.execute("""
        UPDATE subscription_plans
        SET
            code        = 'FREE_TRIAL',
            name        = 'Free Trial',
            description = '14-day free trial. Upgrade to a paid plan to continue after expiry.',
            trial_days  = 14,
            is_trial    = true,
            is_active   = true,
            is_public   = false,
            updated_at  = now()
        WHERE code = 'FREE'
    """)

    # 2. Update denormalised tenants.subscription_plan  FREE → FREE_TRIAL
    op.execute("""
        UPDATE tenants
        SET subscription_plan = 'FREE_TRIAL',
            updated_at        = now()
        WHERE subscription_plan = 'FREE'
    """)

    # 3. Deactivate the old 'TRIAL' plan (30-day, 0 entitlements — superseded).
    #    Tenants still on it are moved to FREE_TRIAL with 14 days.
    op.execute("""
        UPDATE tenant_subscriptions ts
        SET
            plan_id       = sp_free.id,
            status        = 'TRIAL',
            expires_at    = now() + INTERVAL '14 days',
            trial_ends_at = now() + INTERVAL '14 days',
            updated_at    = now()
        FROM subscription_plans sp_old,
             subscription_plans sp_free
        WHERE ts.plan_id    = sp_old.id
          AND sp_old.code   = 'TRIAL'
          AND sp_free.code  = 'FREE_TRIAL'
    """)

    op.execute("""
        UPDATE tenants t
        SET subscription_plan       = 'FREE_TRIAL',
            subscription_expires_at = now() + INTERVAL '14 days',
            updated_at              = now()
        WHERE t.subscription_plan = 'TRIAL'
          AND t.is_deleted        = false
    """)

    op.execute("""
        UPDATE subscription_plans
        SET is_active  = false,
            updated_at = now()
        WHERE code = 'TRIAL'
    """)

    # 4. Migrate existing FREE_TRIAL-plan tenants from ACTIVE/no-expiry → TRIAL
    #    (covers tenants that were on the old FREE plan with no expiry set)
    op.execute("""
        UPDATE tenant_subscriptions ts
        SET
            status        = 'TRIAL',
            expires_at    = now() + INTERVAL '14 days',
            trial_ends_at = now() + INTERVAL '14 days',
            updated_at    = now()
        FROM subscription_plans sp
        WHERE ts.plan_id      = sp.id
          AND sp.code         = 'FREE_TRIAL'
          AND ts.status       = 'ACTIVE'
          AND ts.expires_at   IS NULL
    """)

    op.execute("""
        UPDATE tenants t
        SET subscription_expires_at = ts.expires_at,
            status                  = 'TRIAL',
            updated_at              = now()
        FROM tenant_subscriptions ts
        JOIN subscription_plans sp ON ts.plan_id = sp.id
        WHERE t.id           = ts.tenant_id
          AND sp.code        = 'FREE_TRIAL'
          AND ts.status      = 'TRIAL'
          AND t.status       = 'ACTIVE'
          AND t.is_deleted   = false
    """)

    # 5. Deactivate permanent "Referral Plan" (is_referral_plan=True, is_trial=False)
    #    Move affected tenants to FREE_TRIAL with 14 days.
    op.execute("""
        UPDATE tenant_subscriptions ts
        SET
            plan_id       = sp_free.id,
            status        = 'TRIAL',
            expires_at    = now() + INTERVAL '14 days',
            trial_ends_at = now() + INTERVAL '14 days',
            updated_at    = now()
        FROM subscription_plans sp_old,
             subscription_plans sp_free
        WHERE ts.plan_id              = sp_old.id
          AND sp_old.is_referral_plan = true
          AND sp_old.is_trial         = false
          AND sp_free.code            = 'FREE_TRIAL'
    """)

    op.execute("""
        UPDATE tenants t
        SET subscription_plan       = 'FREE_TRIAL',
            subscription_expires_at = now() + INTERVAL '14 days',
            updated_at              = now()
        FROM tenant_subscriptions ts
        JOIN subscription_plans sp_old ON sp_old.is_referral_plan = true
                                       AND sp_old.is_trial         = false
        WHERE t.subscription_plan = sp_old.code
          AND t.is_deleted        = false
    """)

    op.execute("""
        UPDATE subscription_plans
        SET is_active  = false,
            updated_at = now()
        WHERE is_referral_plan = true
          AND is_trial         = false
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE subscription_plans
        SET is_active = true, updated_at = now()
        WHERE is_referral_plan = true AND is_trial = false
    """)
    op.execute("""
        UPDATE subscription_plans
        SET is_active = true, updated_at = now()
        WHERE code = 'TRIAL'
    """)
    op.execute("""
        UPDATE subscription_plans
        SET code = 'FREE', name = 'Free',
            description = 'Free plan with basic features. Upgrade anytime.',
            trial_days = 0, updated_at = now()
        WHERE code = 'FREE_TRIAL'
    """)
    op.execute("""
        UPDATE tenants SET subscription_plan = 'FREE', updated_at = now()
        WHERE subscription_plan = 'FREE_TRIAL'
    """)
