import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { fmt, fmtDate } from '@/lib/utils'
import { StatCard, Table, Th, Td } from '@/components/ui'
import { analyticsService } from '@/services/analytics/analytics.service'
import {
  useAnalyticsFilters, AnalyticsFilters, ChartCard,
  CHART_COLORS, CHART_AXIS_TICK, CHART_TOOLTIP_STYLE, CHART_GRID_STROKE,
} from './analyticsHelpers'

const PAGE_SIZE = 30

export default function InventoryAnalyticsPage() {
  const filters = useAnalyticsFilters()
  const { from, to, branch, apiParams } = filters
  const [deadDays, setDeadDays] = useState(90)
  const [lowStockPage, setLowStockPage]     = useState(1)
  const [fastMovingPage, setFastMovingPage] = useState(1)
  const [deadStockPage, setDeadStockPage]   = useState(1)
  const [valuationPage, setValuationPage]   = useState(1)

  const branchParam = branch ? { branch_id: branch } : {}

  const [valuationQ, lowStockQ, fastMovingQ, deadStockQ, movementsQ] = useQueries({
    queries: [
      {
        queryKey: ['inv-valuation', branch],
        queryFn:  () => analyticsService.getInventoryValuation(branchParam),
      },
      {
        queryKey: ['inv-low-stock', branch],
        queryFn:  () => analyticsService.getLowStock(branchParam),
      },
      {
        queryKey: ['inv-fast-moving', from, to, branch],
        queryFn:  () => analyticsService.getFastMoving({ ...apiParams, limit: 100 }),
      },
      {
        queryKey: ['inv-dead-stock', branch, deadDays],
        queryFn:  () => analyticsService.getDeadStock({ ...branchParam, days: deadDays }),
      },
      {
        queryKey: ['inv-movements', from, to, branch],
        queryFn:  () => analyticsService.getInventoryMovements(apiParams),
      },
    ],
  })

  const valuation  = valuationQ.data
  const lowStock   = lowStockQ.data   ?? []
  const fastMoving = fastMovingQ.data ?? []
  const deadStock  = deadStockQ.data  ?? []
  const movements  = movementsQ.data  ?? []
  const valuationItems = valuation?.items ?? []

  const lowStockTotalPages  = Math.max(1, Math.ceil(lowStock.length / PAGE_SIZE))
  const fastMovingTotalPages = Math.max(1, Math.ceil(fastMoving.length / PAGE_SIZE))
  const deadStockTotalPages = Math.max(1, Math.ceil(deadStock.length / PAGE_SIZE))
  const valuationTotalPages = Math.max(1, Math.ceil(valuationItems.length / PAGE_SIZE))

  const paginatedLowStock  = lowStock.slice((lowStockPage - 1) * PAGE_SIZE, lowStockPage * PAGE_SIZE)
  const paginatedFastMoving = fastMoving.slice((fastMovingPage - 1) * PAGE_SIZE, fastMovingPage * PAGE_SIZE)
  const paginatedDeadStock = deadStock.slice((deadStockPage - 1) * PAGE_SIZE, deadStockPage * PAGE_SIZE)
  const paginatedValuation = valuationItems.slice((valuationPage - 1) * PAGE_SIZE, valuationPage * PAGE_SIZE)

  const movementsData = movements.map(m => ({
    type:  m.movement_type,
    count: m.count,
  }))

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-100">Inventory Analytics</h2>
        <AnalyticsFilters {...filters} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {valuationQ.isLoading || lowStockQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Inventory Value" value={fmt(valuation?.total_valuation ?? 0)} accent />
            <StatCard label="Product Lines"   value={(valuation?.items.length ?? 0).toLocaleString()} />
            <StatCard
              label="Low Stock Alerts"
              value={lowStock.length.toLocaleString()}
              accent={lowStock.length > 0}
            />
            <StatCard
              label="Dead Stock Items"
              value={deadStock.length.toLocaleString()}
              accent={deadStock.length > 0}
            />
          </>
        )}
      </div>

      {/* Stock Movements Chart */}
      <ChartCard
        title="Stock Movements"
        isLoading={movementsQ.isLoading}
        isEmpty={movementsData.length === 0}
      >
        <div className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={movementsData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="type"
                tick={{ ...CHART_AXIS_TICK, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
                labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
              />
              <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Low Stock + Fast Moving */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title={`Low Stock (${lowStock.length})`}
          isLoading={lowStockQ.isLoading}
          isEmpty={lowStock.length === 0}
          emptyMessage="No low stock items"
        >
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Branch</Th>
                <Th right>On Hand</Th>
                <Th right>Reorder Pt.</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedLowStock.map(p => (
                <tr key={`${p.product_id}-${p.branch_id}`} className="hover:bg-zinc-800/40 transition-colors">
                  <Td>{p.product_name}</Td>
                  <Td muted>{p.branch_name}</Td>
                  <Td right><span className="font-mono text-amber-400">{p.quantity_on_hand}</span></Td>
                  <Td right><span className="font-mono text-zinc-500">{p.reorder_point}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">{lowStock.length === 0 ? '0 items' : `${(lowStockPage-1)*PAGE_SIZE+1}–${Math.min(lowStockPage*PAGE_SIZE, lowStock.length)} of ${lowStock.length}`}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setLowStockPage(p => Math.max(1, p-1))} disabled={lowStockPage===1} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
              <span className="text-xs text-zinc-500 px-2">{lowStockPage} / {lowStockTotalPages}</span>
              <button onClick={() => setLowStockPage(p => Math.min(lowStockTotalPages, p+1))} disabled={lowStockPage>=lowStockTotalPages} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Fast Moving Products"
          isLoading={fastMovingQ.isLoading}
          isEmpty={fastMoving.length === 0}
        >
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Product</Th>
                <Th right>Qty Sold</Th>
                <Th right>Orders</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedFastMoving.map(p => (
                <tr key={p.product_id} className="hover:bg-zinc-800/40 transition-colors">
                  <Td muted>{p.rank}</Td>
                  <Td>{p.product_name}</Td>
                  <Td right><span className="font-mono text-green-400">{p.quantity_sold}</span></Td>
                  <Td right><span className="font-mono text-zinc-400">{p.order_count}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">{fastMoving.length === 0 ? '0 items' : `${(fastMovingPage-1)*PAGE_SIZE+1}–${Math.min(fastMovingPage*PAGE_SIZE, fastMoving.length)} of ${fastMoving.length}`}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setFastMovingPage(p => Math.max(1, p-1))} disabled={fastMovingPage===1} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
              <span className="text-xs text-zinc-500 px-2">{fastMovingPage} / {fastMovingTotalPages}</span>
              <button onClick={() => setFastMovingPage(p => Math.min(fastMovingTotalPages, p+1))} disabled={fastMovingPage>=fastMovingTotalPages} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Dead Stock */}
      <ChartCard
        title={`Dead Stock — no sales in ${deadDays} days`}
        isLoading={deadStockQ.isLoading}
        isEmpty={deadStock.length === 0}
        emptyMessage="No dead stock items"
        action={
          <select
            value={deadDays}
            onChange={e => { setDeadDays(Number(e.target.value)); setDeadStockPage(1) }}
            className="bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs px-2 py-1 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
          >
            {[30, 60, 90, 180].map(d => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        }
      >
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th right>On Hand</Th>
              <Th right>Last Sold</Th>
              <Th right>Days Idle</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedDeadStock.map(p => (
              <tr key={p.product_id} className="hover:bg-zinc-800/40 transition-colors">
                <Td>{p.product_name}</Td>
                <Td muted mono>{p.sku ?? '—'}</Td>
                <Td right><span className="font-mono">{p.quantity_on_hand}</span></Td>
                <Td right muted>{p.last_sold_at ? fmtDate(p.last_sold_at) : 'Never'}</Td>
                <Td right>
                  <span className={`font-mono font-semibold ${p.days_without_sale > 180 ? 'text-red-400' : 'text-amber-400'}`}>
                    {p.days_without_sale}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">{deadStock.length === 0 ? '0 items' : `${(deadStockPage-1)*PAGE_SIZE+1}–${Math.min(deadStockPage*PAGE_SIZE, deadStock.length)} of ${deadStock.length}`}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setDeadStockPage(p => Math.max(1, p-1))} disabled={deadStockPage===1} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
            <span className="text-xs text-zinc-500 px-2">{deadStockPage} / {deadStockTotalPages}</span>
            <button onClick={() => setDeadStockPage(p => Math.min(deadStockTotalPages, p+1))} disabled={deadStockPage>=deadStockTotalPages} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
          </div>
        </div>
      </ChartCard>

      {/* Valuation Table */}
      <ChartCard
        title="Inventory Valuation"
        isLoading={valuationQ.isLoading}
        isEmpty={valuationItems.length === 0}
      >
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th right>On Hand</Th>
              <Th right>Cost Price</Th>
              <Th right>Valuation</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedValuation.map(p => (
              <tr key={p.product_id} className="hover:bg-zinc-800/40 transition-colors">
                <Td>{p.product_name}</Td>
                <Td muted mono>{p.sku ?? '—'}</Td>
                <Td right><span className="font-mono">{p.quantity_on_hand}</span></Td>
                <Td right><span className="font-mono text-zinc-400">{fmt(p.cost_price)}</span></Td>
                <Td right><span className="font-mono text-amber-400">{fmt(p.valuation)}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">{valuationItems.length === 0 ? '0 items' : `${(valuationPage-1)*PAGE_SIZE+1}–${Math.min(valuationPage*PAGE_SIZE, valuationItems.length)} of ${valuationItems.length}`}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setValuationPage(p => Math.max(1, p-1))} disabled={valuationPage===1} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
            <span className="text-xs text-zinc-500 px-2">{valuationPage} / {valuationTotalPages}</span>
            <button onClick={() => setValuationPage(p => Math.min(valuationTotalPages, p+1))} disabled={valuationPage>=valuationTotalPages} className="px-2 py-1 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
          </div>
        </div>
      </ChartCard>

    </div>
  )
}
