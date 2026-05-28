import { useQuery } from '@tanstack/react-query'
import { fmt } from '@/lib/utils'
import { Badge, Spinner } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import { useResellerStore } from '@/store/reseller.store'
import { useResellerPermissions } from './ResellerPermissionContext'

function NoBusiness() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-3xl">📊</div>
      <div>
        <p className="text-zinc-200 font-semibold text-lg">Select a Business</p>
        <p className="text-zinc-500 text-sm mt-1">Choose a business from the sidebar to view analytics.</p>
      </div>
    </div>
  )
}

function PermissionDenied({ section }: { section: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
      <span className="text-3xl">🔒</span>
      <p className="text-zinc-400 font-medium">{section}</p>
      <p className="text-zinc-600 text-sm">You do not have permission to view this section.</p>
    </div>
  )
}

function KpiCard({ label, value, sub, isLoading }: {
  label: string; value: React.ReactNode; sub?: string; isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="h-3 w-24 bg-zinc-800 animate-pulse rounded mb-3" />
        <div className="h-7 w-32 bg-zinc-800 animate-pulse rounded" />
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

function RevenueSection({ tenantId, branchId }: { tenantId: string; branchId?: string }) {
  const params = { tenant_id: tenantId, ...(branchId ? { branch_id: branchId } : {}) } as never

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reseller-analytics', 'sales-summary', tenantId, branchId],
    queryFn: () => analyticsService.getSalesSummary(params),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Revenue</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Gross Sales" value={fmt(summary?.gross_sales)} isLoading={isLoading} />
        <KpiCard label="Net Sales" value={fmt(summary?.net_sales)} isLoading={isLoading} />
        <KpiCard label="Transactions" value={summary?.order_count ?? '—'} isLoading={isLoading} />
        <KpiCard label="Avg. Order Value" value={fmt(summary?.average_order_value)} isLoading={isLoading} />
      </div>
    </div>
  )
}

function ProfitSection({ tenantId, branchId }: { tenantId: string; branchId?: string }) {
  const params = { tenant_id: tenantId, ...(branchId ? { branch_id: branchId } : {}) } as never

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reseller-analytics', 'financial-summary', tenantId, branchId],
    queryFn: () => analyticsService.getFinancialSummary(params),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Profit</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Gross Profit" value={fmt(summary?.gross_profit)} isLoading={isLoading} />
        <KpiCard label="Net Revenue" value={fmt(summary?.net_revenue)} isLoading={isLoading} />
        <KpiCard label="Gross Margin" value={summary ? `${Number(summary.gross_margin_pct ?? 0).toFixed(1)}%` : '—'} isLoading={isLoading} />
      </div>
    </div>
  )
}

function InventoryAnalyticsSection({ tenantId, branchId }: { tenantId: string; branchId?: string }) {
  const params = { tenant_id: tenantId, ...(branchId ? { branch_id: branchId } : {}) } as never

  const { data: valuation, isLoading: vLoading } = useQuery({
    queryKey: ['reseller-analytics', 'inventory-valuation', tenantId, branchId],
    queryFn: () => analyticsService.getInventoryValuation(params),
    staleTime: 5 * 60 * 1000,
  })

  const { data: lowStock } = useQuery({
    queryKey: ['reseller-analytics', 'low-stock', tenantId, branchId],
    queryFn: () => analyticsService.getLowStock(params),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Inventory</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total Valuation" value={fmt(valuation?.total_valuation)} isLoading={vLoading} />
        <KpiCard label="SKUs Tracked" value={valuation?.items?.length ?? '—'} isLoading={vLoading} />
        <KpiCard label="Low Stock Items" value={lowStock?.length ?? 0} />
      </div>
      {lowStock && lowStock.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Low Stock Alert</h3>
          </div>
          <div className="divide-y divide-zinc-800">
            {lowStock.slice(0, 10).map(item => (
              <div key={item.product_id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-zinc-300 text-sm">{item.product_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs">Qty: {item.quantity_on_hand}</span>
                  <Badge variant="danger" size="xs">Low Stock</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TopProductsSection({ tenantId, branchId }: { tenantId: string; branchId?: string }) {
  const params = { tenant_id: tenantId, ...(branchId ? { branch_id: branchId } : {}), limit: 10 } as never

  const { data: products, isLoading } = useQuery({
    queryKey: ['reseller-analytics', 'top-products', tenantId, branchId],
    queryFn: () => analyticsService.getTopProducts(params),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="h-3 w-24 bg-zinc-800 animate-pulse rounded mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-zinc-800 animate-pulse rounded mb-2" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Top Products</h3>
      </div>
      <div className="divide-y divide-zinc-800">
        {(products ?? []).slice(0, 10).map((item, idx) => (
          <div key={item.product_id} className="px-5 py-3 flex items-center gap-3">
            <span className="text-zinc-600 text-xs w-5 text-right">{idx + 1}.</span>
            <span className="flex-1 text-zinc-300 text-sm truncate">{item.product_name}</span>
            <span className="text-zinc-500 text-xs">{item.quantity_sold} sold</span>
            <span className="text-zinc-200 text-xs font-medium tabular-nums">{fmt(item.revenue)}</span>
          </div>
        ))}
        {(!products || products.length === 0) && (
          <div className="px-5 py-8 text-center text-zinc-600 text-sm">No data available</div>
        )}
      </div>
    </div>
  )
}

export default function ResellerAnalyticsPage() {
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)
  const selectedBranchId = useResellerStore(s => s.selectedBranchId)
  const perms = useResellerPermissions()

  if (!selectedTenantId) return <NoBusiness />

  const hasAnyAnalytics =
    perms.canViewRevenue() ||
    perms.canViewProfit() ||
    perms.canViewAnalytics() ||
    perms.canViewInventory() ||
    perms.canViewBranchReports()

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Analytics</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Business {selectedTenantId.slice(0, 12)}…
            {selectedBranchId ? ` · Branch ${selectedBranchId.slice(0, 8)}…` : ' · All Branches'}
          </p>
        </div>
      </div>

      {!hasAnyAnalytics ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
          <span className="text-4xl">🔒</span>
          <div>
            <p className="text-zinc-300 font-medium">No analytics access</p>
            <p className="text-zinc-600 text-sm mt-1">Contact your administrator to enable analytics permissions.</p>
          </div>
        </div>
      ) : (
        <>
          {perms.canViewRevenue()
            ? <RevenueSection tenantId={selectedTenantId} branchId={selectedBranchId ?? undefined} />
            : <PermissionDenied section="Revenue" />}

          {perms.canViewProfit()
            ? <ProfitSection tenantId={selectedTenantId} branchId={selectedBranchId ?? undefined} />
            : null}

          {perms.canViewInventory()
            ? <InventoryAnalyticsSection tenantId={selectedTenantId} branchId={selectedBranchId ?? undefined} />
            : null}

          {perms.canViewAnalytics()
            ? <TopProductsSection tenantId={selectedTenantId} branchId={selectedBranchId ?? undefined} />
            : null}
        </>
      )}
    </div>
  )
}
