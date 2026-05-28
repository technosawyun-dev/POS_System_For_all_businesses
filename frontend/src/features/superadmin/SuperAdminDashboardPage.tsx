import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fmtDate, timeAgo } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { tenantService } from '@/services/tenant/tenant.service'
import { auditService } from '@/services/audit/audit.service'
import { resellerFinanceAdminService } from '@/services/reseller_finance/reseller_finance.service'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  SUSPENDED: 'warning',
  EXPIRED:   'danger',
  INACTIVE:  'default',
  PENDING:   'default',
}

const SUB_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  SUSPENDED: 'warning',
  EXPIRED:   'danger',
  PENDING:   'default',
  CANCELLED: 'default',
}

function KpiCard({ label, value, sub, isLoading }: {
  label: string; value: React.ReactNode; sub?: string; isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="h-3 w-20 bg-zinc-800 animate-pulse rounded mb-3" />
        <div className="h-7 w-28 bg-zinc-800 animate-pulse rounded mb-2" />
        <div className="h-2.5 w-16 bg-zinc-800 animate-pulse rounded" />
      </div>
    )
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: { label: string; path: string } }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h3>
      {action && (
        <button
          onClick={() => navigate(action.path)}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {action.label} →
        </button>
      )}
    </div>
  )
}

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate()

  const [overviewQuery, tenantsQuery, auditQuery, subsQuery, resellerQuery] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'overview'],
        queryFn: subscriptionsService.adminGetOverview,
      },
      {
        queryKey: ['admin', 'tenants-recent'],
        queryFn: () => tenantService.listTenants({ page: 1, page_size: 3 }),
      },
      {
        queryKey: ['audit', 'logs', 1, undefined, undefined, undefined],
        queryFn: () => auditService.listLogs({ page: 1, page_size: 3 }),
      },
      {
        queryKey: ['admin', 'subs-recent'],
        queryFn: () => subscriptionsService.adminListSubscriptions({ page: 1, page_size: 3 }),
      },
      {
        queryKey: ['admin', 'reseller-finance', 'overview'],
        queryFn: resellerFinanceAdminService.getOverview,
        staleTime: 120_000,
      },
    ],
  })

  const ov = overviewQuery.data
  const loading = overviewQuery.isLoading
  const resellerCount = resellerQuery.data?.total_resellers ?? '—'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-100">Super Admin Dashboard</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Platform overview</p>
      </div>

      <div className="p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto">

        {/* Platform KPIs */}
        <section>
          <SectionHeader title="Platform Overview" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KpiCard label="Total Businesses" value={ov?.total_tenants ?? '—'}           isLoading={loading} />
            <KpiCard label="Subscribed"        value={ov?.active_subscriptions ?? '—'}    isLoading={loading} sub="active plan" />
            <KpiCard label="Trial"             value={ov?.trial_subscriptions ?? '—'}     isLoading={loading} />
            <KpiCard label="Expired"           value={ov?.expired_subscriptions ?? '—'}   isLoading={loading} />
            <KpiCard label="Suspended"         value={ov?.suspended_subscriptions ?? '—'} isLoading={loading} />
            <KpiCard label="Total Users"       value={ov?.total_users ?? '—'}             isLoading={loading} />
            <KpiCard label="Total Branches"    value={ov?.total_branches ?? '—'}          isLoading={loading} />
            <KpiCard label="Resellers"         value={resellerCount}                       isLoading={resellerQuery.isLoading} />
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Businesses',     path: '/super-admin/businesses',    icon: '🏢' },
              { label: 'Manage Plans',   path: '/super-admin/plans',         icon: '📋' },
              { label: 'Users',          path: '/super-admin/users',         icon: '👤' },
              { label: 'Resellers',      path: '/super-admin/resellers',     icon: '🤝' },
              { label: 'Notifications',  path: '/super-admin/notifications', icon: '🔔' },
              { label: 'Audit Logs',     path: '/super-admin/audit-logs',    icon: '📝' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-4 text-left transition-colors group"
              >
                <span className="text-2xl block mb-2">{item.icon}</span>
                <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Two-column activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Businesses */}
          <section>
            <SectionHeader title="Recent Businesses" action={{ label: 'View all', path: '/super-admin/businesses' }} />
            {tenantsQuery.isLoading ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
                {[1, 2, 3].map(i => (
                  <div key={i} className="py-3 flex items-center gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-zinc-800 animate-pulse rounded w-2/3" />
                      <div className="h-2.5 bg-zinc-800 animate-pulse rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (tenantsQuery.data?.items ?? []).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-8 text-center">
                <p className="text-sm text-zinc-600">No businesses found</p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
                {(tenantsQuery.data?.items ?? []).map(tenant => (
                  <div
                    key={tenant.id}
                    onClick={() => navigate(`/super-admin/businesses/${tenant.id}`)}
                    className="py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/40 -mx-4 px-4 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{tenant.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 font-mono">{tenant.slug} · {tenant.subscription_plan}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={STATUS_VARIANT[tenant.status] ?? 'default'} size="xs">{tenant.status}</Badge>
                      <span className="text-xs text-zinc-600 hidden sm:inline">{fmtDate(tenant.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Subscription Changes */}
          <section>
            <SectionHeader title="Recent Subscriptions" action={{ label: 'View all', path: '/super-admin/businesses' }} />
            {subsQuery.isLoading ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
                {[1, 2, 3].map(i => (
                  <div key={i} className="py-3 flex items-center gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-zinc-800 animate-pulse rounded w-2/3" />
                      <div className="h-2.5 bg-zinc-800 animate-pulse rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (subsQuery.data?.items ?? []).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-8 text-center">
                <p className="text-sm text-zinc-600">No subscriptions</p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
                {(subsQuery.data?.items ?? []).map(sub => (
                  <div
                    key={sub.id}
                    onClick={() => navigate(`/super-admin/businesses/${sub.tenant_id}`)}
                    className="py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/40 -mx-4 px-4 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{sub.plan?.name ?? sub.plan_id}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{sub.tenant_id}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={SUB_STATUS_VARIANT[sub.status] ?? 'default'} size="xs">{sub.status}</Badge>
                      <span className="text-xs text-zinc-600 hidden sm:inline">{timeAgo(sub.updated_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Recent Audit Events */}
        <section>
          <SectionHeader title="Recent Audit Events" action={{ label: 'View all', path: '/super-admin/audit-logs' }} />
          {auditQuery.isLoading ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
              {[1, 2, 3].map(i => (
                <div key={i} className="py-3 flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-zinc-800 animate-pulse rounded w-3/4" />
                    <div className="h-2.5 bg-zinc-800 animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : auditQuery.isError ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-5 text-center">
              <p className="text-sm text-zinc-600">Audit logs unavailable in super admin context — tenant scope required.</p>
            </div>
          ) : (auditQuery.data?.items ?? []).length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-5 text-center">
              <p className="text-sm text-zinc-600">No audit events</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
              {(auditQuery.data?.items ?? []).map(log => (
                <div key={log.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{log.action}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {log.entity_type ?? 'System'}{log.entity_id ? ` · ${log.entity_id.slice(-8)}` : ''}
                      {log.actor_name ? ` · by ${log.actor_name}` : log.actor_user_id ? ` · by ${log.actor_user_id.slice(-8)}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600 flex-shrink-0">{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
