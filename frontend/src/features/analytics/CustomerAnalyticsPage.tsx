import { useQueries } from '@tanstack/react-query'
import { fmt } from '@/lib/utils'
import { StatCard, Table, Th, Td, Badge } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import { customersService } from '@/services/customers/customers.service'
import { useAnalyticsFilters, AnalyticsFilters, ChartCard } from './analyticsHelpers'

export default function CustomerAnalyticsPage() {
  const filters = useAnalyticsFilters()

  const [dashboardQ, totalQ, activeQ, topCustomersQ] = useQueries({
    queries: [
      {
        queryKey: ['analytics-dashboard', filters.branch],
        queryFn:  () => analyticsService.getDashboard(
          filters.branch ? { branch_id: filters.branch } : undefined,
        ),
      },
      {
        queryKey: ['customers-count-total'],
        queryFn:  () => customersService.list({ page_size: 1 }),
      },
      {
        queryKey: ['customers-count-active'],
        queryFn:  () => customersService.list({ is_active: true, page_size: 1 }),
      },
      {
        queryKey: ['customers-top-balance'],
        queryFn:  () => customersService.list({ page_size: 50 }),
      },
    ],
  })

  const dashboard   = dashboardQ.data
  const totalCount  = totalQ.data?.total ?? 0
  const activeCount = activeQ.data?.total ?? 0

  const topCustomers = (topCustomersQ.data?.items ?? [])
    .filter(c => parseFloat(c.balance) > 0)
    .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
    .slice(0, 10)

  const kpisLoading = dashboardQ.isLoading || totalQ.isLoading || activeQ.isLoading

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-100">Customer Analytics</h2>
        <AnalyticsFilters {...filters} showDateRange={false} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpisLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Total Customers"  value={totalCount.toLocaleString()} />
            <StatCard label="Active Customers" value={activeCount.toLocaleString()} accent />
            <StatCard label="New This Month"   value={(dashboard?.new_customers_month ?? 0).toLocaleString()} accent />
            <StatCard label="Inactive"         value={(totalCount - activeCount).toLocaleString()} />
          </>
        )}
      </div>

      {/* Top Customers by Balance */}
      <ChartCard
        title="Top Customers by Outstanding Balance"
        isLoading={topCustomersQ.isLoading}
        isEmpty={topCustomers.length === 0}
        emptyMessage="No customers with outstanding balances"
      >
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Customer</Th>
              <Th>Phone</Th>
              <Th>Status</Th>
              <Th right>Outstanding</Th>
            </tr>
          </thead>
          <tbody>
            {topCustomers.map((c, i) => (
              <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors">
                <Td muted>{i + 1}</Td>
                <Td>{c.name}</Td>
                <Td muted mono>{c.phone}</Td>
                <Td>
                  <Badge variant={c.is_active ? 'success' : 'default'} size="xs">
                    {c.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td right>
                  <span className="font-mono font-semibold text-amber-400">{fmt(c.balance)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartCard>

      <div className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
        Customer spending trends and receivable history require a dedicated customer analytics API endpoint — not yet available in the backend.
      </div>
    </div>
  )
}
