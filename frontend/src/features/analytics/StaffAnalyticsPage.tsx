import { useQuery } from '@tanstack/react-query'
import { fmt } from '@/lib/utils'
import { StatCard, Table, Th, Td } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import { useAnalyticsFilters, AnalyticsFilters, ChartCard } from './analyticsHelpers'

export default function StaffAnalyticsPage() {
  const filters = useAnalyticsFilters()
  const { from, to, branch, apiParams } = filters

  const cashierQ = useQuery({
    queryKey: ['sales-by-cashier', from, to, branch],
    queryFn:  () => analyticsService.getSalesByCashier(apiParams),
  })

  const cashiers = cashierQ.data ?? []

  const totalOrders = cashiers.reduce((s, c) => s + c.orders, 0)
  const totalSales  = cashiers.reduce((s, c) => s + parseFloat(String(c.sales)), 0)

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-100">Staff Performance</h2>
        <AnalyticsFilters {...filters} />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Active Cashiers" value={cashiers.length.toString()} />
        <StatCard label="Total Orders"    value={totalOrders.toLocaleString()} />
        <StatCard label="Total Sales"     value={fmt(totalSales)} accent />
      </div>

      {/* Cashier breakdown table */}
      <ChartCard
        title="Cashier Sales Breakdown"
        isLoading={cashierQ.isLoading}
        isEmpty={cashiers.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Cashier</Th>
              <Th right>Orders</Th>
              <Th right>Sales</Th>
              <Th right>Refunds</Th>
              <Th right>Avg Ticket</Th>
            </tr>
          </thead>
          <tbody>
            {cashiers.map((c, i) => (
              <tr key={c.cashier_id} className="hover:bg-zinc-800/40 transition-colors">
                <Td muted>{i + 1}</Td>
                <Td>
                  <span className="text-sm font-medium text-zinc-100">{c.cashier_name}</span>
                </Td>
                <Td right>
                  <span className="font-mono text-zinc-200">{c.orders}</span>
                </Td>
                <Td right>
                  <span className="font-mono text-amber-400">{fmt(c.sales)}</span>
                </Td>
                <Td right>
                  <span className={`font-mono ${parseFloat(String(c.refunds)) > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                    {fmt(c.refunds)}
                  </span>
                </Td>
                <Td right>
                  <span className="font-mono text-zinc-400">{fmt(c.average_ticket)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartCard>

      {/* Manager & Inventory Staff — coming soon notice */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
        <p className="text-sm font-semibold text-zinc-300">Manager &amp; Inventory Staff Metrics</p>
        <p className="text-xs text-zinc-500">
          Coming soon — refunds processed, purchase orders created, and stock adjustments per manager/inventory staff.
        </p>
      </div>
    </div>
  )
}
