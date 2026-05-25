import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { useResellerStore } from '@/store/reseller.store'
import { useAuthStore } from '@/store/auth.store'
import { resellersService } from '@/services/resellers/resellers.service'
import { analyticsService } from '@/services/analytics/analytics.service'
import { notificationsService } from '@/services/notifications/notifications.service'
import { useResellerPermissions } from './ResellerPermissionContext'
import type { MyBusinessResponse } from '@/shared/types'


function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function assignmentStatus(b: MyBusinessResponse): 'active' | 'expiring' | 'expired' | 'inactive' {
  if (!b.is_active) return 'inactive'
  if (!b.is_access_valid) return 'expired'
  const days = daysUntil(b.access_expires_at)
  if (days !== null && days <= 7) return 'expiring'
  return 'active'
}

const STATUS_VARIANT = {
  active:   'success' as const,
  expiring: 'warning' as const,
  expired:  'danger'  as const,
  inactive: 'default' as const,
}

const STATUS_LABEL = {
  active:   'Active',
  expiring: 'Expiring Soon',
  expired:  'Expired',
  inactive: 'Inactive',
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


function NoBusiness() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-3xl">
        🏢
      </div>
      <div>
        <p className="text-zinc-200 font-semibold text-lg">Select a Business</p>
        <p className="text-zinc-500 text-sm mt-1">
          Choose a business from the sidebar to view your dashboard.
        </p>
      </div>
    </div>
  )
}


function DashboardContent({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate()
  const perms = useResellerPermissions()

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['reseller-dashboard', 'kpis', tenantId],
    queryFn: () => analyticsService.getDashboard({ tenant_id: tenantId } as never),
    enabled: perms.canViewRevenue() || perms.canViewAnalytics(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: lowStock } = useQuery({
    queryKey: ['reseller-dashboard', 'low-stock', tenantId],
    queryFn: () => analyticsService.getLowStock({ tenant_id: tenantId } as never),
    enabled: perms.canViewInventory(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: unreadData } = useQuery({
    queryKey: ['reseller-dashboard', 'notifications', 'unread'],
    queryFn: () => notificationsService.getUnreadCount(),
    staleTime: 60 * 1000,
  })

  const { data: businesses = [] } = useQuery({
    queryKey: ['reseller-businesses'],
    queryFn: resellersService.getMyBusinesses,
    staleTime: 5 * 60 * 1000,
  })

  const unreadCount = unreadData?.unread_count ?? 0
  const lowStockCount = lowStock?.length ?? 0
  const expiringCount = businesses.filter(b => assignmentStatus(b) === 'expiring').length

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Tenant: {tenantId.slice(0, 12)}…</p>
      </div>

      {/* Alerts */}
      {(expiringCount > 0 || lowStockCount > 0 || unreadCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {expiringCount > 0 && (
            <div className="bg-amber-950 border border-amber-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-amber-400 font-semibold text-sm">{expiringCount} expiring soon</p>
                <p className="text-amber-700 text-xs">Business assignment</p>
              </div>
            </div>
          )}
          {perms.canViewInventory() && lowStockCount > 0 && (
            <div className="bg-red-950 border border-red-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <p className="text-red-400 font-semibold text-sm">{lowStockCount} low stock</p>
                <p className="text-red-700 text-xs">Items need reorder</p>
              </div>
            </div>
          )}
          {unreadCount > 0 && (
            <button
              onClick={() => navigate('/reseller/notifications')}
              className="bg-blue-950 border border-blue-800 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-blue-900 transition-colors"
            >
              <span className="text-2xl">🔔</span>
              <div>
                <p className="text-blue-400 font-semibold text-sm">{unreadCount} unread</p>
                <p className="text-blue-700 text-xs">Notifications</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* KPI Grid */}
      {(perms.canViewRevenue() || perms.canViewProfit() || perms.canViewAnalytics()) && (
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {perms.canViewRevenue() && (
              <KpiCard
                label="Revenue (Today)"
                value={kpis ? `$${Number(kpis.revenue_today ?? 0).toFixed(0)}` : '—'}
                sub="Today's sales"
                isLoading={kpisLoading}
              />
            )}
            {perms.canViewProfit() && (
              <KpiCard
                label="Inventory Value"
                value={kpis ? `$${Number(kpis.inventory_value ?? 0).toFixed(0)}` : '—'}
                sub="Current"
                isLoading={kpisLoading}
              />
            )}
            <KpiCard
              label="Transactions"
              value={kpis?.orders_today ?? '—'}
              sub="Today"
              isLoading={kpisLoading}
            />
            {perms.canViewInventory() && (
              <KpiCard
                label="Low Stock Items"
                value={lowStockCount}
                sub="Needs attention"
              />
            )}
          </div>
        </div>
      )}

      {/* Assigned Businesses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assigned Businesses</h2>
          <button
            onClick={() => navigate('/reseller/businesses')}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            View all →
          </button>
        </div>
        <div className="space-y-2">
          {businesses.length === 0 ? (
            <p className="text-zinc-600 text-sm px-1">No businesses assigned.</p>
          ) : (
            businesses.map(b => {
              const status = assignmentStatus(b)
              const days = daysUntil(b.access_expires_at)
              return (
                <div
                  key={b.tenant_id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-zinc-200 text-sm font-medium truncate">
                      Business {b.tenant_id.slice(0, 12)}…
                    </p>
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {b.allowed_branch_ids.length
                        ? `${b.allowed_branch_ids.length} branch${b.allowed_branch_ids.length > 1 ? 'es' : ''}`
                        : 'All branches'}
                      {days !== null && days > 0 && ` · expires in ${days}d`}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[status]} size="xs">
                    {STATUS_LABEL[status]}
                  </Badge>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {perms.canViewAnalytics() && (
            <button
              onClick={() => navigate('/reseller/analytics')}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group"
            >
              <span className="text-2xl">📊</span>
              <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-medium">Analytics</span>
            </button>
          )}
          {perms.canViewCustomers() && (
            <button
              onClick={() => navigate('/reseller/customers')}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group"
            >
              <span className="text-2xl">👥</span>
              <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-medium">Customers</span>
            </button>
          )}
          {perms.canViewInventory() && (
            <button
              onClick={() => navigate('/reseller/inventory')}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group"
            >
              <span className="text-2xl">📦</span>
              <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-medium">Inventory</span>
            </button>
          )}
          {perms.canViewProcurement() && (
            <button
              onClick={() => navigate('/reseller/procurement')}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group"
            >
              <span className="text-2xl">🛒</span>
              <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-medium">Procurement</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


export default function ResellerDashboardPage() {
  const user = useAuthStore(s => s.user)
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)

  return (
    <div className="h-full">
      {!selectedTenantId ? (
        <NoBusiness />
      ) : (
        <DashboardContent tenantId={selectedTenantId} />
      )}
    </div>
  )
}
