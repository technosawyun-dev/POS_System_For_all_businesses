import { useQuery } from '@tanstack/react-query'
import { fmt, fmtDateTime } from '@/lib/utils'
import { Spinner, StatCard } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import { useAnalyticsFilters, AnalyticsFilters } from './analyticsHelpers'

export default function AnalyticsDashboardPage() {
  const filters = useAnalyticsFilters()

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-dashboard', filters.branch],
    queryFn:  () => analyticsService.getDashboard(
      filters.branch ? { branch_id: filters.branch } : undefined,
    ),
  })

  const isFeatureDisabled = (error as any)?.response?.data?.error?.code === 'FEATURE_DISABLED'

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-zinc-100">Analytics Dashboard</h2>
          {data?.generated_at && (
            <p className="text-xs text-zinc-500 mt-0.5">Updated {fmtDateTime(data.generated_at)}</p>
          )}
        </div>
        <AnalyticsFilters {...filters} showDateRange={false} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
      ) : error ? (
        <div className={`rounded-2xl px-4 py-5 border text-sm ${isFeatureDisabled ? 'bg-amber-950/30 border-amber-800 text-amber-300' : 'bg-red-950/40 border-red-900 text-red-400'}`}>
          {isFeatureDisabled
            ? 'Analytics is not included in your current plan. Upgrade to unlock dashboards and reports.'
            : 'Failed to load dashboard data'}
        </div>
      ) : !data ? null : (
        <div className="space-y-5">
          {/* Sales */}
          <section>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-0.5">Sales</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Sales Today"      value={fmt(data.sales_today)}      accent />
              <StatCard label="Sales This Month" value={fmt(data.sales_this_month)} />
              <StatCard label="Sales Yesterday"  value={fmt(data.sales_yesterday)}  />
              <StatCard label="Sales This Week"  value={fmt(data.sales_this_week)}  />
            </div>
          </section>

          {/* Orders & Revenue */}
          <section>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-0.5">Orders & Revenue</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Orders Today"      value={data.orders_today.toLocaleString()}       />
              <StatCard label="Orders This Month" value={data.orders_this_month.toLocaleString()}   />
              <StatCard label="Revenue Today"     value={fmt(data.revenue_today)} accent />
              <StatCard label="Revenue This Month" value={fmt(data.revenue_month)}                 />
            </div>
          </section>

          {/* Customers & Inventory */}
          <section>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-0.5">Customers & Inventory</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Customers" value={data.total_customers.toLocaleString()} />
              <StatCard label="New This Month"  value={data.new_customers_month.toLocaleString()} accent />
              <StatCard label="Inventory Value" value={fmt(data.inventory_value)} />
              <StatCard
                label="Low Stock Items"
                value={data.low_stock_products.toLocaleString()}
                accent={data.low_stock_products > 0}
              />
            </div>
          </section>

          {/* Refunds */}
          <section>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-0.5">Refunds</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Refund Count"
                value={data.refund_count_month.toLocaleString()}
                accent={data.refund_count_month > 0}
              />
              <StatCard
                label="Refund Amount"
                value={fmt(data.refund_amount_month)}
                accent={parseFloat(data.refund_amount_month) > 0}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
