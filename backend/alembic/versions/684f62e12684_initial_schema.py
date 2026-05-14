"""initial_schema

Revision ID: 684f62e12684
Revises:
Create Date: 2026-05-07 20:38:01.404117

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '684f62e12684'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. permissions (no FK deps)
    op.create_table('permissions',
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('group', sa.String(length=100), nullable=False),
        sa.Column('scope', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_permissions')),
    )
    op.create_index(op.f('ix_permissions_code'), 'permissions', ['code'], unique=True)

    # 2. tenants (owner_id FK deferred — circular with users)
    op.create_table('tenants',
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('timezone', sa.String(length=100), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('locale', sa.String(length=20), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=True),
        sa.Column('subscription_plan', sa.String(length=100), nullable=False),
        sa.Column('subscription_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_tenants')),
    )
    op.create_index(op.f('ix_tenants_owner_id'), 'tenants', ['owner_id'], unique=False)
    op.create_index(op.f('ix_tenants_slug'), 'tenants', ['slug'], unique=True)

    # 3. users (tenant_id → tenants OK; primary_branch_id FK deferred)
    op.create_table('users',
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('primary_branch_id', sa.UUID(), nullable=True),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_users_tenant_id_tenants'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_primary_branch_id'), 'users', ['primary_branch_id'], unique=False)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_index(op.f('ix_users_status'), 'users', ['status'], unique=False)
    op.create_index(op.f('ix_users_tenant_id'), 'users', ['tenant_id'], unique=False)

    # 4. branches (tenant_id → tenants OK; manager_id FK deferred)
    op.create_table('branches',
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('manager_id', sa.UUID(), nullable=True),
        sa.Column('timezone', sa.String(length=100), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('is_main_branch', sa.Boolean(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_branches_tenant_id_tenants'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_branches')),
    )
    op.create_index(op.f('ix_branches_code'), 'branches', ['code'], unique=False)
    op.create_index(op.f('ix_branches_manager_id'), 'branches', ['manager_id'], unique=False)
    op.create_index(op.f('ix_branches_status'), 'branches', ['status'], unique=False)
    op.create_index(op.f('ix_branches_tenant_id'), 'branches', ['tenant_id'], unique=False)

    # 5. audit_logs
    op.create_table('audit_logs',
        sa.Column('actor_user_id', sa.UUID(), nullable=True),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('branch_id', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=100), nullable=True),
        sa.Column('entity_id', sa.String(length=255), nullable=True),
        sa.Column('before_state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('after_state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'],
            name=op.f('fk_audit_logs_actor_user_id_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'],
            name=op.f('fk_audit_logs_branch_id_branches'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_audit_logs_tenant_id_tenants'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_logs')),
    )
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'], unique=False)
    op.create_index('ix_audit_logs_actor_user_id', 'audit_logs', ['actor_user_id'], unique=False)
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False)
    op.create_index('ix_audit_logs_entity_type_entity_id', 'audit_logs', ['entity_type', 'entity_id'], unique=False)
    op.create_index('ix_audit_logs_tenant_id', 'audit_logs', ['tenant_id'], unique=False)

    # 6. branch_settings
    op.create_table('branch_settings',
        sa.Column('branch_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('opening_hours', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('receipt_header', sa.Text(), nullable=True),
        sa.Column('receipt_footer', sa.Text(), nullable=True),
        sa.Column('extra_settings', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'],
            name=op.f('fk_branch_settings_branch_id_branches'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_branch_settings_tenant_id_tenants'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_branch_settings')),
    )
    op.create_index(op.f('ix_branch_settings_branch_id'), 'branch_settings', ['branch_id'], unique=True)
    op.create_index(op.f('ix_branch_settings_tenant_id'), 'branch_settings', ['tenant_id'], unique=False)

    # 7. refresh_tokens
    op.create_table('refresh_tokens',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('family_id', sa.String(length=255), nullable=False),
        sa.Column('jti', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],
            name=op.f('fk_refresh_tokens_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_refresh_tokens')),
        sa.UniqueConstraint('jti', name=op.f('uq_refresh_tokens_jti')),
    )
    op.create_index(op.f('ix_refresh_tokens_family_id'), 'refresh_tokens', ['family_id'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_token_hash'), 'refresh_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)

    # 8. reseller_assignments
    op.create_table('reseller_assignments',
        sa.Column('reseller_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('allowed_branch_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('restricted_permissions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('access_starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('access_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('assigned_by_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id'],
            name=op.f('fk_reseller_assignments_assigned_by_id_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reseller_id'], ['users.id'],
            name=op.f('fk_reseller_assignments_reseller_id_users'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_reseller_assignments_tenant_id_tenants'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_reseller_assignments')),
        sa.UniqueConstraint('reseller_id', 'tenant_id', name='uq_reseller_tenant'),
    )
    op.create_index(op.f('ix_reseller_assignments_reseller_id'), 'reseller_assignments', ['reseller_id'], unique=False)
    op.create_index(op.f('ix_reseller_assignments_tenant_id'), 'reseller_assignments', ['tenant_id'], unique=False)

    # 9. role_permissions
    op.create_table('role_permissions',
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'],
            name=op.f('fk_role_permissions_permission_id_permissions'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_role_permissions')),
        sa.UniqueConstraint('role', 'permission_id', name='uq_role_permission'),
    )
    op.create_index(op.f('ix_role_permissions_role'), 'role_permissions', ['role'], unique=False)

    # 10. tenant_settings
    op.create_table('tenant_settings',
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('features_enabled', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('business_type', sa.String(length=100), nullable=True),
        sa.Column('tax_rate', sa.Float(), nullable=True),
        sa.Column('tax_inclusive', sa.Boolean(), nullable=False),
        sa.Column('extra_settings', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_tenant_settings_tenant_id_tenants'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_tenant_settings')),
    )
    op.create_index(op.f('ix_tenant_settings_tenant_id'), 'tenant_settings', ['tenant_id'], unique=True)

    # 11. user_branch_assignments
    op.create_table('user_branch_assignments',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'],
            name=op.f('fk_user_branch_assignments_branch_id_branches'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_user_branch_assignments_tenant_id_tenants'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],
            name=op.f('fk_user_branch_assignments_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user_branch_assignments')),
        sa.UniqueConstraint('user_id', 'branch_id', name='uq_user_branch'),
    )
    op.create_index(op.f('ix_user_branch_assignments_branch_id'), 'user_branch_assignments', ['branch_id'], unique=False)
    op.create_index(op.f('ix_user_branch_assignments_tenant_id'), 'user_branch_assignments', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_user_branch_assignments_user_id'), 'user_branch_assignments', ['user_id'], unique=False)

    # 12. user_permissions
    op.create_table('user_permissions',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('branch_id', sa.UUID(), nullable=True),
        sa.Column('is_granted', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('granted_by_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'],
            name=op.f('fk_user_permissions_branch_id_branches'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by_id'], ['users.id'],
            name=op.f('fk_user_permissions_granted_by_id_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'],
            name=op.f('fk_user_permissions_permission_id_permissions'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
            name=op.f('fk_user_permissions_tenant_id_tenants'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],
            name=op.f('fk_user_permissions_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user_permissions')),
        sa.UniqueConstraint('user_id', 'permission_id', 'tenant_id', 'branch_id',
            name='uq_user_permission_scoped'),
    )
    op.create_index(op.f('ix_user_permissions_branch_id'), 'user_permissions', ['branch_id'], unique=False)
    op.create_index(op.f('ix_user_permissions_tenant_id'), 'user_permissions', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_user_permissions_user_id'), 'user_permissions', ['user_id'], unique=False)

    # 13. Deferred circular FKs via ALTER TABLE
    op.create_foreign_key(
        'fk_tenants_owner_id_users', 'tenants', 'users',
        ['owner_id'], ['id'], ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_branches_manager_id_users', 'branches', 'users',
        ['manager_id'], ['id'], ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_users_primary_branch_id_branches', 'users', 'branches',
        ['primary_branch_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    # Drop deferred circular FKs first
    op.drop_constraint('fk_users_primary_branch_id_branches', 'users', type_='foreignkey')
    op.drop_constraint('fk_branches_manager_id_users', 'branches', type_='foreignkey')
    op.drop_constraint('fk_tenants_owner_id_users', 'tenants', type_='foreignkey')

    # Drop tables in reverse dependency order
    op.drop_index(op.f('ix_user_permissions_user_id'), table_name='user_permissions')
    op.drop_index(op.f('ix_user_permissions_tenant_id'), table_name='user_permissions')
    op.drop_index(op.f('ix_user_permissions_branch_id'), table_name='user_permissions')
    op.drop_table('user_permissions')

    op.drop_index(op.f('ix_user_branch_assignments_user_id'), table_name='user_branch_assignments')
    op.drop_index(op.f('ix_user_branch_assignments_tenant_id'), table_name='user_branch_assignments')
    op.drop_index(op.f('ix_user_branch_assignments_branch_id'), table_name='user_branch_assignments')
    op.drop_table('user_branch_assignments')

    op.drop_index(op.f('ix_tenant_settings_tenant_id'), table_name='tenant_settings')
    op.drop_table('tenant_settings')

    op.drop_index(op.f('ix_role_permissions_role'), table_name='role_permissions')
    op.drop_table('role_permissions')

    op.drop_index(op.f('ix_reseller_assignments_tenant_id'), table_name='reseller_assignments')
    op.drop_index(op.f('ix_reseller_assignments_reseller_id'), table_name='reseller_assignments')
    op.drop_table('reseller_assignments')

    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_token_hash'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_family_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')

    op.drop_index(op.f('ix_branch_settings_tenant_id'), table_name='branch_settings')
    op.drop_index(op.f('ix_branch_settings_branch_id'), table_name='branch_settings')
    op.drop_table('branch_settings')

    op.drop_index('ix_audit_logs_tenant_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_entity_type_entity_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_actor_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index(op.f('ix_branches_tenant_id'), table_name='branches')
    op.drop_index(op.f('ix_branches_status'), table_name='branches')
    op.drop_index(op.f('ix_branches_manager_id'), table_name='branches')
    op.drop_index(op.f('ix_branches_code'), table_name='branches')
    op.drop_table('branches')

    op.drop_index(op.f('ix_users_tenant_id'), table_name='users')
    op.drop_index(op.f('ix_users_status'), table_name='users')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_index(op.f('ix_users_primary_branch_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

    op.drop_index(op.f('ix_tenants_slug'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_owner_id'), table_name='tenants')
    op.drop_table('tenants')

    op.drop_index(op.f('ix_permissions_code'), table_name='permissions')
    op.drop_table('permissions')
