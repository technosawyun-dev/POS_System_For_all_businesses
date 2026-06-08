import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { fmt, fmtDateTime } from '@/lib/utils'
import { getPaymentMethodLabel } from '@/lib/paymentMethod'
import { Spinner, StatCard } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import {
  useAnalyticsFilters, AnalyticsFilters, ChartCard,
  CHART_COLORS, PIE_COLORS, CHART_AXIS_TICK,
  CHART_TOOLTIP_STYLE, CHART_GRID_STROKE,
} from './analyticsHelpers'

type Granularity = 'daily' | 'weekly' | 'monthly'

export default function AnalyticsDashboardPage() {
  const filters = useAnalyticsFilters()
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const [dashboardQ, trendQ, paymentMethodsQ, byCategoryQ] = useQueries({
    queries: [
      {
        queryKey: ['analytics-dashboard', filters.branch],
        queryFn:  () => analyticsService.getDashboard(
          filters.branch ? { branch_id: filters.branch } : undefined,
        ),
      },
      {
        queryKey: ['sales-trend-dashboard', filters.from, filters.to, filters.branch, granularity],
        queryFn:  () => analyticsService.getSalesTrend({ ...filters.apiParams, granularity }),
      },
      {
        queryKey: ['sales-payment-methods-dashboard', filters.from, filters.to, filters.branch],
        queryFn:  () => analyticsService.getPaymentMethods(filters.apiParams),
      },
      {
        queryKey: ['sales-by-category-dashboard', filters.from, filters.to, filters.branch],
        queryFn:  () => analyticsService.getSalesByCategory(filters.apiParams),
      },
    ],
  })

  const data      = dashboardQ.data
  const isLoading = dashboardQ.isLoading
  const error     = dashboardQ.error

  const trendItems = trendQ.data?.items ?? []
  const trendData  = trendItems.map(t => ({
    period:  t.period,
    sales:   parseFloat(t.sales),
    revenue: parseFloat(t.revenue),
    orders:  t.orders,
  }))

  const paymentMethods = paymentMethodsQ.data ?? []
  const pmData = paymentMethods.map(p => ({
    name:  getPaymentMethodLabel(p.payment_method),
    value: parseFloat(p.amount),
    count: p.transaction_count,
  }))

  const categories  = byCategoryQ.data ?? []
  const categoryData = categories.slice(0, 8).map(c => ({
    name:  c.category_name,
    sales: parseFloat(c.sales),
  }))

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
          {/* Sales KPIs */}
          <section>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-0.5">Sales</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Sales Today"      value={fmt(data.sales_today)}      accent />
              <StatCard label="Sales This Month" value={fmt(data.sales_this_month)} />
              <StatCard label="Sales Yesterday"  value={fmt(data.sales_yesterday)}  />
              <StatCard label="Sales This Week"  value={fmt(data.sales_this_week)}  />
            </div>
          </section>

          {/* Sales Trend Chart */}
          <ChartCard
            title="Sales Trend"
            isLoading={trendQ.isLoading}
            isEmpty={trendData.length === 0}
            action={
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                      granularity === g
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {g[0].toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            }
          >
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="dashSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CHART_COLORS.amber} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="period" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={v => `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kyats`} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
                    labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
                    formatter={(v) => [fmt(Number(v ?? 0)), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke={CHART_COLORS.amber}
                    strokeWidth={2}
                    fill="url(#dashSalesGrad)"
                    dot={false}
                    name="Sales"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Payment Methods + Sales by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Payment Methods"
              isLoading={paymentMethodsQ.isLoading}
              isEmpty={pmData.length === 0}
            >
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pmData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {pmData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
                      formatter={(v) => [fmt(Number(v ?? 0)), '']}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Sales by Category"
              isLoading={byCategoryQ.isLoading}
              isEmpty={categoryData.length === 0}
            >
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ ...CHART_AXIS_TICK, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={CHART_AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kyats`}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
                      formatter={(v) => [fmt(Number(v ?? 0)), '']}
                    />
                    <Bar dataKey="sales" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Sales" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* Orders & Revenue */}
          <section>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-0.5">Orders & Revenue</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Orders Today"       value={data.orders_today.toLocaleString()}      />
              <StatCard label="Orders This Month"  value={data.orders_this_month.toLocaleString()} />
              <StatCard label="Revenue Today"      value={fmt(data.revenue_today)} accent />
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

          {/* Customer Debts */}
          <section>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-0.5">Customer Debts</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Total Outstanding"
                value={fmt(data.total_customer_outstanding)}
                accent={parseFloat(data.total_customer_outstanding) > 0}
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
