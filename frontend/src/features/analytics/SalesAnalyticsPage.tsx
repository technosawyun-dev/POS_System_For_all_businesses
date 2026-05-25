import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { fmt } from '@/lib/utils'
import { StatCard, Table, Th, Td } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import {
  useAnalyticsFilters, AnalyticsFilters, ChartCard, ExportRow,
  CHART_COLORS, PIE_COLORS, CHART_AXIS_TICK, CHART_TOOLTIP_STYLE, CHART_GRID_STROKE,
} from './analyticsHelpers'

type Granularity = 'daily' | 'weekly' | 'monthly'

export default function SalesAnalyticsPage() {
  const filters = useAnalyticsFilters()
  const { from, to, branch, apiParams } = filters
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const [summaryQ, trendQ, topProductsQ, byCategoryQ, byCashierQ, paymentMethodsQ] = useQueries({
    queries: [
      {
        queryKey: ['sales-summary', from, to, branch],
        queryFn:  () => analyticsService.getSalesSummary(apiParams),
      },
      {
        queryKey: ['sales-trend', from, to, branch, granularity],
        queryFn:  () => analyticsService.getSalesTrend({ ...apiParams, granularity }),
      },
      {
        queryKey: ['sales-top-products', from, to, branch],
        queryFn:  () => analyticsService.getTopProducts({ ...apiParams, limit: 10 }),
      },
      {
        queryKey: ['sales-by-category', from, to, branch],
        queryFn:  () => analyticsService.getSalesByCategory(apiParams),
      },
      {
        queryKey: ['sales-by-cashier', from, to, branch],
        queryFn:  () => analyticsService.getSalesByCashier(apiParams),
      },
      {
        queryKey: ['sales-payment-methods', from, to, branch],
        queryFn:  () => analyticsService.getPaymentMethods(apiParams),
      },
    ],
  })

  const summary        = summaryQ.data
  const trendItems     = trendQ.data?.items ?? []
  const topProducts    = topProductsQ.data ?? []
  const categories     = byCategoryQ.data ?? []
  const cashiers       = byCashierQ.data ?? []
  const paymentMethods = paymentMethodsQ.data ?? []

  const trendData = trendItems.map(t => ({
    period:  t.period,
    sales:   parseFloat(t.sales),
    revenue: parseFloat(t.revenue),
    orders:  t.orders,
  }))

  const pmData = paymentMethods.map(p => ({
    name:  p.payment_method,
    value: parseFloat(p.amount),
    count: p.transaction_count,
  }))

  const categoryData = categories.slice(0, 8).map(c => ({
    name:  c.category_name,
    sales: parseFloat(c.sales),
  }))

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-100">Sales Analytics</h2>
        <AnalyticsFilters {...filters} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryQ.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ))
        ) : summary ? (
          <>
            <StatCard label="Orders"      value={summary.order_count.toLocaleString()} />
            <StatCard label="Gross Sales" value={fmt(summary.gross_sales)} accent />
            <StatCard label="Net Sales"   value={fmt(summary.net_sales)} />
            <StatCard label="Avg Order"   value={fmt(summary.average_order_value)} />
            <StatCard label="Customers"   value={summary.unique_customers.toLocaleString()} />
            <StatCard
              label="Refunds"
              value={fmt(summary.refund_amount)}
              accent={parseFloat(summary.refund_amount) > 0}
            />
          </>
        ) : null}
      </div>

      {/* Sales Trend */}
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
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.amber} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
              <XAxis dataKey="period" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
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
                fill="url(#salesGrad)"
                dot={false}
                name="Sales"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Payment Methods + By Category */}
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
                  tickFormatter={v => `$${v}`}
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

      {/* Top Products */}
      <ChartCard
        title="Top Products"
        isLoading={topProductsQ.isLoading}
        isEmpty={topProducts.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th right>Qty Sold</Th>
              <Th right>Revenue</Th>
              <Th right>Profit Est.</Th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={p.product_id} className="hover:bg-zinc-800/40 transition-colors">
                <Td muted>{i + 1}</Td>
                <Td>{p.product_name}</Td>
                <Td muted mono>{p.sku ?? '—'}</Td>
                <Td right><span className="font-mono">{p.quantity_sold}</span></Td>
                <Td right><span className="font-mono text-amber-400">{fmt(p.revenue)}</span></Td>
                <Td right><span className="font-mono text-green-400">{fmt(p.profit_estimate)}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartCard>

      {/* By Cashier */}
      <ChartCard
        title="Sales by Cashier"
        isLoading={byCashierQ.isLoading}
        isEmpty={cashiers.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>Cashier</Th>
              <Th right>Orders</Th>
              <Th right>Sales</Th>
              <Th right>Refunds</Th>
              <Th right>Avg Ticket</Th>
            </tr>
          </thead>
          <tbody>
            {cashiers.map(c => (
              <tr key={c.cashier_id} className="hover:bg-zinc-800/40 transition-colors">
                <Td>{c.cashier_name}</Td>
                <Td right><span className="font-mono">{c.orders}</span></Td>
                <Td right><span className="font-mono text-amber-400">{fmt(c.sales)}</span></Td>
                <Td right><span className="font-mono text-red-400">{fmt(c.refunds)}</span></Td>
                <Td right><span className="font-mono text-zinc-400">{fmt(c.average_ticket)}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartCard>

      <ExportRow />
    </div>
  )
}
