import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { fmt } from '@/lib/utils'
import { StatCard, Table, Th, Td } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import { useAnalyticsFilters, AnalyticsFilters, ChartCard, ExportRow } from './analyticsHelpers'

type ProfitBy = 'product' | 'category' | 'branch'

export default function FinancialAnalyticsPage() {
  const filters = useAnalyticsFilters()
  const { from, to, branch, apiParams } = filters
  const [profitBy, setProfitBy] = useState<ProfitBy>('product')

  const [summaryQ, profitQ] = useQueries({
    queries: [
      {
        queryKey: ['financial-summary', from, to, branch],
        queryFn:  () => analyticsService.getFinancialSummary(apiParams),
      },
      {
        queryKey: ['financial-profit', from, to, branch, profitBy],
        queryFn:  () => analyticsService.getProfitReport({ ...apiParams, by: profitBy }),
      },
    ],
  })

  const summary     = summaryQ.data
  const profitItems = profitQ.data?.items ?? []

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-100">Financial Analytics</h2>
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
            <StatCard label="Gross Revenue" value={fmt(summary.gross_revenue)} accent />
            <StatCard label="Net Revenue"   value={fmt(summary.net_revenue)} />
            <StatCard label="COGS"          value={fmt(summary.cost_of_goods_sold)} />
            <StatCard label="Gross Profit"  value={fmt(summary.gross_profit)} accent />
            <StatCard
              label="Margin %"
              value={`${parseFloat(summary.gross_margin_pct).toFixed(1)}%`}
              accent={parseFloat(summary.gross_margin_pct) > 20}
            />
            <StatCard
              label="Refunds"
              value={fmt(summary.refund_amount)}
              accent={parseFloat(summary.refund_amount) > 0}
            />
          </>
        ) : null}
      </div>

      {/* Profit Report */}
      <ChartCard
        title="Profit Report"
        isLoading={profitQ.isLoading}
        isEmpty={profitItems.length === 0}
        action={
          <div className="flex gap-1">
            {(['product', 'category', 'branch'] as ProfitBy[]).map(b => (
              <button
                key={b}
                onClick={() => setProfitBy(b)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  profitBy === b
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {b[0].toUpperCase() + b.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        <Table>
          <thead>
            <tr>
              <Th>{profitBy[0].toUpperCase() + profitBy.slice(1)}</Th>
              <Th right>Revenue</Th>
              <Th right>COGS</Th>
              <Th right>Profit</Th>
              <Th right>Margin</Th>
            </tr>
          </thead>
          <tbody>
            {profitItems.map((item, i) => {
              const margin = parseFloat(item.margin_pct)
              return (
                <tr key={item.dimension_id ?? i} className="hover:bg-zinc-800/40 transition-colors">
                  <Td>{item.dimension_name}</Td>
                  <Td right><span className="font-mono text-amber-400">{fmt(item.revenue)}</span></Td>
                  <Td right><span className="font-mono text-zinc-400">{fmt(item.cogs)}</span></Td>
                  <Td right><span className="font-mono text-green-400">{fmt(item.profit)}</span></Td>
                  <Td right>
                    <span className={`font-mono font-semibold ${
                      margin >= 20 ? 'text-green-400' : margin >= 10 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {margin.toFixed(1)}%
                    </span>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </ChartCard>

      <ExportRow />
    </div>
  )
}
