import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fmt, fmtDate, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useTenantStore } from '@/store/tenant.store'
import { canAccess } from '@/shared/constants/rbac'
import { analyticsService } from '@/services/analytics/analytics.service'
import { notificationsService } from '@/services/notifications/notifications.service'
import { checkoutService } from '@/services/sales/sales.service'
import { procurementService } from '@/services/procurement/procurement.service'
import { tenantService } from '@/services/tenant/tenant.service'
import { KpiCard } from './widgets/KpiCard'
import { DashboardSection } from './widgets/DashboardSection'
import { ActivityFeed, type ActivityItem } from './widgets/ActivityFeed'
import { QuickActionGrid, type QuickAction } from './widgets/QuickActionGrid'
import { ActionCenter } from './widgets/ActionCenter'
import { RecentlyViewed } from './widgets/RecentlyViewed'
import { Favorites } from './widgets/Favorites'

const OWNER_ACTIONS: QuickAction[] = [
  { label: 'New Sale',       icon: '💰', path: '/app/pos',                       description: 'Open checkout' },
  { label: 'Products',       icon: '📦', path: '/app/products',                  description: 'Manage catalog'  },
  { label: 'Customers',      icon: '👥', path: '/app/customers',                 description: 'View accounts' },
  { label: 'Procurement',    icon: '🛒', path: '/app/procurement',               description: 'Purchase orders' },
  { label: 'Inventory',      icon: '🏭', path: '/app/inventory',                 description: 'Stock levels' },
  { label: 'Analytics',      icon: '📊', path: '/app/analytics',                 description: 'Revenue & trends' },
  { label: 'Notifications',  icon: '🔔', path: '/app/notifications',             description: 'Inbox' },
  { label: 'Subscription',   icon: '💳', path: '/app/subscription',              description: 'Plan & billing' },
]

const MANAGER_ACTIONS: QuickAction[] = [
  { label: 'New Sale',       icon: '💰', path: '/app/pos',                       description: 'Open checkout' },
  { label: 'Inventory',      icon: '🏭', path: '/app/inventory',                 description: 'Stock levels' },
  { label: 'Procurement',    icon: '🛒', path: '/app/procurement',               description: 'Purchase orders' },
  { label: 'Customers',      icon: '👥', path: '/app/customers',                 description: 'View accounts' },
  { label: 'Analytics',      icon: '📊', path: '/app/analytics',                 description: 'Revenue & trends' },
  { label: 'Notifications',  icon: '🔔', path: '/app/notifications',             description: 'Inbox' },
]

const OVERALL = '__overall__'

export default function BusinessDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { selectedBranch, setSelectedBranch } = useTenantStore()
  const role = user?.role ?? 'MANAGER'
  const tenantId = user?.tenant_id
  const isOwner = role === 'BUSINESS_OWNER'
  const isManager = role === 'MANAGER'
  const isStaff = role === 'CASHIER' || role === 'INVENTORY_STAFF'
  const canProcure = canAccess(role, 'procurement')
  const canSwitchBranches = isOwner || isManager

  // Branch switcher state: null = selectedBranch (default), '__overall__' = no filter
  const [dashBranchId, setDashBranchId] = useState<string | null>(
    selectedBranch?.id ?? null,
  )

  // Load available branches for switcher (owner/manager only)
  const { data: branchesData } = useQuery({
    queryKey: ['tenant', tenantId, 'branches'],
    queryFn: () => tenantService.getBranches(tenantId!, { page_size: 50 }),
    enabled: !!tenantId && canSwitchBranches,
  })
  const availableBranches = (branchesData?.items ?? []).filter(b => b.status === 'ACTIVE')

  // For staff: always use their registered branch
  const effectiveBranchId = isStaff
    ? selectedBranch?.id
    : dashBranchId === OVERALL ? undefined : (dashBranchId ?? selectedBranch?.id)

  const currentBranchName = dashBranchId === OVERALL
    ? 'All Branches'
    : availableBranches.find(b => b.id === dashBranchId)?.name ?? selectedBranch?.name

  const [kpiQuery, notifsQuery, ordersQuery, lowStockQuery, procQuery] = useQueries({
    queries: [
      {
        queryKey: ['analytics', 'dashboard', effectiveBranchId],
        queryFn: () => analyticsService.getDashboard({ branch_id: effectiveBranchId }),
      },
      {
        queryKey: ['notifications', 'list', 1],
        queryFn: () => notificationsService.list({ page: 1, page_size: 5 }),
      },
      {
        queryKey: ['sales', 'orders', 1, effectiveBranchId],
        queryFn: () => checkoutService.listOrders({ branch_id: effectiveBranchId, page: 1, page_size: 5 }),
      },
      {
        queryKey: ['analytics', 'low-stock', effectiveBranchId],
        queryFn: () => analyticsService.getLowStock({ branch_id: effectiveBranchId }),
      },
      {
        queryKey: ['procurement', 'orders', { status: 'PENDING' }],
        queryFn: () => procurementService.listOrders({ status: 'PENDING', page: 1, page_size: 5 }),
        enabled: canProcure,
      },
    ],
  })

  const kpi = kpiQuery.data
  const kpiLoading = kpiQuery.isLoading

  const recentOrders: ActivityItem[] = (ordersQuery.data?.items ?? []).map(o => ({
    id: o.id,
    label: `Order #${o.order_number ?? o.id.slice(-6).toUpperCase()}`,
    sub: `${fmt(o.total_amount)} · ${o.order_status}`,
    time: timeAgo(o.created_at),
    icon: '🧾',
    onClick: () => navigate('/app/sales'),
  }))

  const recentNotifs: ActivityItem[] = (notifsQuery.data?.items ?? []).map(n => ({
    id: n.id,
    label: n.title,
    sub: n.message,
    time: timeAgo(n.created_at),
    icon: n.is_read ? '🔔' : '🔴',
    onClick: () => navigate(`/app/notifications/${n.id}`),
  }))

  const pendingPOs: ActivityItem[] = (procQuery.data?.items ?? []).map(po => ({
    id: po.id,
    label: `PO ${po.po_number}`,
    sub: `${po.supplier_id.slice(-8)} · ${fmt(po.total_amount)}`,
    time: fmtDate(po.created_at),
    icon: '📋',
    onClick: () => navigate(`/app/procurement/purchase-orders/${po.id}`),
  }))

  const lowStock = lowStockQuery.data ?? []

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Good {getGreeting()}, {user?.first_name ?? 'there'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isOwner ? 'Business overview' : 'Manager dashboard'}
              {currentBranchName ? ` · ${currentBranchName}` : ''}
            </p>
          </div>

          {/* Branch switcher (owner/manager only) */}
          {canSwitchBranches && availableBranches.length >= 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setDashBranchId(OVERALL)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  dashBranchId === OVERALL
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 bg-zinc-900'
                }`}
              >
                All Branches
              </button>
              {availableBranches.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setDashBranchId(b.id)
                    setSelectedBranch({ id: b.id, name: b.name, code: b.code })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    dashBranchId === b.id || (dashBranchId !== OVERALL && !dashBranchId && selectedBranch?.id === b.id)
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 bg-zinc-900'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto">

        {/* KPI Grid */}
        <DashboardSection title="Today's Performance">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Revenue Today"
              value={fmt(kpi?.revenue_today)}
              sub={`${kpi?.orders_today ?? '—'} orders`}
              icon="💰"
              accent
              isLoading={kpiLoading}
            />
            <KpiCard
              label="Month Revenue"
              value={fmt(kpi?.revenue_month)}
              sub={`${kpi?.orders_this_month ?? '—'} orders`}
              icon="📈"
              isLoading={kpiLoading}
            />
            <KpiCard
              label="Inventory Value"
              value={fmt(kpi?.inventory_value)}
              sub="total valuation"
              icon="🏭"
              isLoading={kpiLoading}
            />
            <KpiCard
              label="Low Stock"
              value={kpi?.low_stock_products ?? '—'}
              sub={kpi?.low_stock_products ? 'products need restock' : 'no alerts'}
              icon="⚠️"
              isLoading={kpiLoading}
            />
          </div>
        </DashboardSection>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Total Customers"
            value={kpi?.total_customers ?? '—'}
            sub={`+${kpi?.new_customers_month ?? 0} this month`}
            icon="👥"
            isLoading={kpiLoading}
          />
          <KpiCard
            label="Refunds (Month)"
            value={kpi?.refund_count_month ?? '—'}
            sub={fmt(kpi?.refund_amount_month)}
            icon="↩️"
            isLoading={kpiLoading}
          />
          {canProcure && (
            <KpiCard
              label="Pending POs"
              value={procQuery.data?.total ?? 0}
              sub="purchase orders"
              icon="🛒"
              isLoading={procQuery.isLoading}
            />
          )}
          <KpiCard
            label="Sales This Week"
            value={fmt(kpi?.sales_this_week)}
            sub={`yesterday: ${fmt(kpi?.sales_yesterday)}`}
            icon="📅"
            isLoading={kpiLoading}
          />
        </div>

        {/* Action Center */}
        <ActionCenter />

        {/* Favorites + Recently Viewed */}
        <Favorites />
        <RecentlyViewed />

        {/* Quick Actions */}
        <DashboardSection title="Quick Actions">
          <QuickActionGrid actions={isOwner ? OWNER_ACTIONS : MANAGER_ACTIONS} />
        </DashboardSection>

        {/* Two-column activity layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Sales */}
          <DashboardSection
            title="Recent Sales"
            action={{ label: 'View all', onClick: () => navigate('/app/sales') }}
          >
            <ActivityFeed
              items={recentOrders}
              isLoading={ordersQuery.isLoading}
              emptyText="No orders yet today"
            />
          </DashboardSection>

          {/* Recent Notifications */}
          <DashboardSection
            title="Recent Notifications"
            action={{ label: 'View all', onClick: () => navigate('/app/notifications') }}
          >
            <ActivityFeed
              items={recentNotifs}
              isLoading={notifsQuery.isLoading}
              emptyText="No notifications"
            />
          </DashboardSection>

        </div>

        {/* Low Stock Alerts */}
        {(lowStock.length > 0 || lowStockQuery.isLoading) && (
          <DashboardSection
            title={`Low Stock Alerts${lowStock.length ? ` (${lowStock.length})` : ''}`}
            action={{ label: 'Manage Inventory', onClick: () => navigate('/app/inventory') }}
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
              {lowStockQuery.isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-zinc-800 rounded animate-pulse w-2/3" />
                        <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))
                : lowStock.slice(0, 8).map(item => (
                    <div key={item.product_id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{item.product_name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {item.sku ? `SKU: ${item.sku} · ` : ''}{item.branch_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-right">
                        <div>
                          <p className="text-sm font-semibold text-red-400 tabular-nums">
                            {item.quantity_on_hand}
                          </p>
                          <p className="text-[10px] text-zinc-600">in stock</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-400 tabular-nums">
                            {item.reorder_point}
                          </p>
                          <p className="text-[10px] text-zinc-600">reorder at</p>
                        </div>
                      </div>
                    </div>
                  ))
              }
            </div>
          </DashboardSection>
        )}

        {/* Pending Procurement Activity */}
        {canProcure && (pendingPOs.length > 0 || procQuery.isLoading) && (
          <DashboardSection
            title="Pending Purchase Orders"
            action={{ label: 'View all', onClick: () => navigate('/app/procurement/purchase-orders') }}
          >
            <ActivityFeed
              items={pendingPOs}
              isLoading={procQuery.isLoading}
              emptyText="No pending purchase orders"
            />
          </DashboardSection>
        )}

      </div>
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
