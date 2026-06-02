import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fmt, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useSessionStore } from '@/store/session.store'
import { useTenantStore } from '@/store/tenant.store'
import { useLocaleStore } from '@/i18n/localeStore'
import { analyticsService } from '@/services/analytics/analytics.service'
import { notificationsService } from '@/services/notifications/notifications.service'
import { KpiCard } from './widgets/KpiCard'
import { DashboardSection } from './widgets/DashboardSection'
import { QuickActionGrid, type QuickAction } from './widgets/QuickActionGrid'
import { RecentlyViewed } from './widgets/RecentlyViewed'

const CASHIER_ACTIONS: QuickAction[] = [
  { labelKey: 'qa.open_pos',      descKey: 'qa.open_pos_desc',      icon: '💰', path: '/app/pos' },
  { labelKey: 'qa.customers',     descKey: 'qa.customers_desc',     icon: '👥', path: '/app/customers' },
  { labelKey: 'qa.sales_history', descKey: 'qa.sales_history_desc', icon: '🧾', path: '/app/sales' },
  { labelKey: 'qa.notifications', descKey: 'qa.inbox_desc',         icon: '🔔', path: '/app/notifications' },
]

const INVENTORY_ACTIONS: QuickAction[] = [
  { labelKey: 'qa.inventory',     descKey: 'qa.inventory_desc', icon: '🏭', path: '/app/inventory' },
  { labelKey: 'qa.products',      descKey: 'qa.catalog_desc',   icon: '📦', path: '/app/products' },
  { labelKey: 'qa.open_pos',      descKey: 'qa.open_pos_desc',  icon: '💰', path: '/app/pos' },
  { labelKey: 'qa.notifications', descKey: 'qa.inbox_desc',     icon: '🔔', path: '/app/notifications' },
]

export default function StaffDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { activeSession } = useSessionStore()
  const { selectedBranch } = useTenantStore()
  const t = useLocaleStore(s => s.t)
  const role = user?.role ?? 'CASHIER'
  const isInventoryStaff = role === 'INVENTORY_STAFF'
  const branchId = selectedBranch?.id

  const [kpiQuery, notifQuery, lowStockQuery] = useQueries({
    queries: [
      {
        queryKey: ['analytics', 'dashboard', branchId],
        queryFn: () => analyticsService.getDashboard({ branch_id: branchId }),
      },
      {
        queryKey: ['notifications', 'unread-count'],
        queryFn: notificationsService.getUnreadCount,
      },
      {
        queryKey: ['analytics', 'low-stock', branchId],
        queryFn: () => analyticsService.getLowStock({ branch_id: branchId }),
        enabled: isInventoryStaff,
      },
    ],
  })

  const kpi = kpiQuery.data
  const unread = notifQuery.data?.unread_count ?? 0
  const lowStock = lowStockQuery.data ?? []

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-100">
          Good {getGreeting()}, {user?.first_name ?? 'there'}
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {isInventoryStaff ? 'Inventory staff' : 'Cashier'}{branchId ? ` · ${selectedBranch?.name}` : ''}
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-6 max-w-5xl w-full mx-auto">

        {/* Active Session Banner */}
        {activeSession && (
          <div className="bg-green-950/30 border border-green-800/40 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-green-400">Session Open</p>
              <p className="text-xs text-green-300/70 mt-0.5">
                Started {timeAgo(activeSession.opened_at)} · Opening: {fmt(activeSession.opening_balance)}
              </p>
            </div>
            <button
              onClick={() => navigate('/app/pos')}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0"
            >
              Continue Selling →
            </button>
          </div>
        )}

        {/* KPI Row */}
        <DashboardSection title="Today at a Glance">
          {isInventoryStaff ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label="Orders Today"
                value={kpi?.orders_today ?? '—'}
                sub="transactions"
                icon="🧾"
                isLoading={kpiQuery.isLoading}
              />
              <KpiCard
                label="Notifications"
                value={unread > 0 ? unread : '0'}
                sub={unread > 0 ? 'unread' : 'all read'}
                icon="🔔"
                isLoading={notifQuery.isLoading}
              />
              <KpiCard
                label="Low Stock"
                value={lowStock.length}
                sub={lowStock.length > 0 ? 'need restock' : 'all stocked'}
                icon="⚠️"
                isLoading={lowStockQuery.isLoading}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Orders Today"
                value={kpi?.orders_today ?? '—'}
                sub="transactions"
                icon="🧾"
                isLoading={kpiQuery.isLoading}
              />
              <KpiCard
                label="Sales Today"
                value={fmt(kpi?.sales_today)}
                icon="💰"
                accent
                isLoading={kpiQuery.isLoading}
              />
              <KpiCard
                label="Notifications"
                value={unread > 0 ? unread : '0'}
                sub={unread > 0 ? 'unread' : 'all read'}
                icon="🔔"
                isLoading={notifQuery.isLoading}
              />
              <KpiCard
                label="This Month"
                value={fmt(kpi?.sales_this_month)}
                sub={`${kpi?.orders_this_month ?? 0} orders`}
                icon="📅"
                isLoading={kpiQuery.isLoading}
              />
            </div>
          )}
        </DashboardSection>

        {/* Quick Actions */}
        <DashboardSection title={t('dash.quick_actions')}>
          <QuickActionGrid actions={isInventoryStaff ? INVENTORY_ACTIONS : CASHIER_ACTIONS} />
        </DashboardSection>

        {/* Recently Viewed */}
        <RecentlyViewed />

        {/* Low Stock (Inventory Staff only) */}
        {isInventoryStaff && lowStock.length > 0 && (
          <DashboardSection
            title={`Low Stock Alerts (${lowStock.length})`}
            action={{ label: 'Manage', onClick: () => navigate('/app/inventory') }}
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
              {lowStock.slice(0, 10).map(item => (
                <div key={item.product_id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{item.product_name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {item.sku ? `SKU: ${item.sku} · ` : ''}{item.branch_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-400 tabular-nums">{item.quantity_on_hand}</p>
                      <p className="text-[10px] text-zinc-600">in stock</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-400 tabular-nums">{item.reorder_point}</p>
                      <p className="text-[10px] text-zinc-600">reorder at</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>
        )}

        {/* Notification nudge */}
        {unread > 0 && (
          <div
            onClick={() => navigate('/app/notifications')}
            className="bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-2xl px-4 py-3.5 cursor-pointer transition-colors flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-base flex-shrink-0">🔔</span>
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {unread} unread notification{unread !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-zinc-500">Tap to view your inbox</p>
              </div>
            </div>
            <span className="text-zinc-500 text-sm">→</span>
          </div>
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
