import { type ReactNode, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, subDays, startOfMonth } from 'date-fns'
import { useTenantStore } from '@/store/tenant.store'
import { Spinner } from '@/components/ui'

export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedBranch } = useTenantStore()
  const from = searchParams.get('from') ?? ''
  const to   = searchParams.get('to')   ?? ''

  // branch key absent = first visit (fall back to selectedBranch)
  // branch key present with '' value = user explicitly chose "All Branches"
  // branch key present with uuid = user chose a specific branch
  const rawBranch = searchParams.get('branch')
  const branch = rawBranch !== null ? rawBranch : (selectedBranch?.id ?? '')

  // Whenever the globally selected branch changes, sync it to the URL so all
  // analytics queries immediately refetch for the new branch.
  useEffect(() => {
    if (!selectedBranch?.id) return
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (next.get('branch') === selectedBranch.id) return prev
      next.set('branch', selectedBranch.id)
      return next
    }, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch?.id])

  // When no explicit date is chosen, default to "This month" so analytics pages always
  // show a bounded, predictable range and the preset button always has an active state.
  const effectiveFrom = from || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const effectiveTo   = to   || format(new Date(), 'yyyy-MM-dd')

  const apiParams = {
    start_date: effectiveFrom,
    end_date:   effectiveTo,
    ...(branch && { branch_id: branch }),
  }

  function setFilters(updates: Partial<{ from: string; to: string; branch: string }>) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates) as [string, string][]) {
        if (k === 'branch') {
          // Always keep the branch key in the URL so empty string ("All Branches")
          // is distinguishable from absent (= first-visit default).
          next.set(k, v)
        } else {
          if (v) next.set(k, v); else next.delete(k)
        }
      }
      return next
    }, { replace: true })
  }

  return { from, to, branch, apiParams, effectiveFrom, effectiveTo, setFilters }
}

const today = () => format(new Date(), 'yyyy-MM-dd')

export const DATE_PRESETS = [
  { label: 'Today',      from: today, to: today },
  { label: '7 days',     from: () => format(subDays(new Date(), 6), 'yyyy-MM-dd'),        to: today },
  { label: '30 days',    from: () => format(subDays(new Date(), 29), 'yyyy-MM-dd'),       to: today },
  { label: 'This month', from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'),      to: today },
  { label: 'Last 90d',   from: () => format(subDays(new Date(), 89), 'yyyy-MM-dd'),       to: today },
]

export function AnalyticsFilters({
  from, to, branch, effectiveFrom, effectiveTo, setFilters, showBranch = true, showDateRange = true,
}: ReturnType<typeof useAnalyticsFilters> & { showBranch?: boolean; showDateRange?: boolean }) {
  const { availableBranches } = useTenantStore()

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {showDateRange && (
        <>
          <input
            type="date"
            value={from}
            onChange={e => setFilters({ from: e.target.value })}
            className="bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-200 text-sm px-3 py-1.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
          />
          <span className="text-zinc-600 text-sm">→</span>
          <input
            type="date"
            value={to}
            onChange={e => setFilters({ to: e.target.value })}
            className="bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-200 text-sm px-3 py-1.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
          />
          <div className="flex gap-1 flex-wrap">
            {DATE_PRESETS.map(p => {
              // Use effective dates so the implicit default ("This month") glows even
              // when the URL has no explicit from/to params.
              const isActive = effectiveFrom === p.from() && effectiveTo === p.to()
              return (
                <button
                  key={p.label}
                  onClick={() => setFilters({ from: p.from(), to: p.to() })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150 ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 ring-1 ring-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 border-zinc-700'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
            {(from || to) && (
              <button
                onClick={() => setFilters({ from: '', to: '' })}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-500 hover:text-red-400 hover:bg-red-950 border border-zinc-700 hover:border-red-900 transition-all duration-150"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
      {showBranch && availableBranches.length > 0 && (
        <select
          value={branch}
          onChange={e => setFilters({ branch: e.target.value })}
          className="bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-200 text-sm px-3 py-1.5 focus:outline-none focus:border-amber-500"
        >
          <option value="">All Branches</option>
          {availableBranches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}

export function ChartCard({
  title, isLoading, isEmpty, emptyMessage = 'No data for this period', children, action,
}: {
  title: string
  isLoading?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-44">
          <Spinner size={28} />
        </div>
      ) : isEmpty ? (
        <div className="flex items-center justify-center h-44 text-zinc-600 text-sm">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export function ExportRow() {
  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      <span className="text-xs text-zinc-600 font-medium uppercase tracking-wider">Export</span>
      {(['CSV', 'Excel', 'PDF'] as const).map(type => (
        <button
          key={type}
          disabled
          title="Export endpoint not yet available"
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-60"
        >
          {type}
        </button>
      ))}
      <span className="text-xs text-zinc-600 italic">Export endpoints not yet available</span>
    </div>
  )
}

export const CHART_COLORS = {
  amber:  '#f59e0b',
  blue:   '#60a5fa',
  green:  '#4ade80',
  violet: '#a78bfa',
  rose:   '#fb7185',
  orange: '#fb923c',
}

export const PIE_COLORS = [
  '#f59e0b', '#60a5fa', '#4ade80', '#a78bfa', '#fb7185', '#fb923c',
]

export const CHART_AXIS_TICK = { fill: '#71717a', fontSize: 11 }

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: '12px',
    color: '#f4f4f5',
    fontSize: '12px',
    padding: '8px 12px',
  },
  labelStyle: { color: '#a1a1aa' },
}

export const CHART_GRID_STROKE = '#27272a'
