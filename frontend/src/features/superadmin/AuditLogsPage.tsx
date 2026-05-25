import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { auditService } from '@/services/audit/audit.service'

const ACTION_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  CREATED:  'success',
  UPDATED:  'info',
  DELETED:  'danger',
  SUSPENDED:'warning',
  ACTIVATED:'success',
}

function actionVariant(action: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  for (const [key, variant] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return variant
  }
  return 'default'
}

interface Filters {
  action: string
  dateFrom: string
  dateTo: string
  tenantId: string
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<Filters>({ action: '', dateFrom: '', dateTo: '', tenantId: '' })
  const [applied, setApplied] = useState<Filters>({ action: '', dateFrom: '', dateTo: '', tenantId: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', 'logs', page, applied],
    queryFn: () =>
      auditService.listLogs({
        page,
        page_size: 25,
        action: applied.action || undefined,
        date_from: applied.dateFrom || undefined,
        date_to: applied.dateTo || undefined,
        tenant_id: applied.tenantId || undefined,
      }),
    retry: false,
  })

  function applyFilters() {
    setPage(1)
    setApplied({ ...draft })
  }

  function clearFilters() {
    const empty: Filters = { action: '', dateFrom: '', dateTo: '', tenantId: '' }
    setDraft(empty)
    setApplied(empty)
    setPage(1)
  }

  const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-100">Audit Logs</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Platform-wide activity trail</p>
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex gap-2 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Action</label>
          <input
            value={draft.action}
            onChange={e => setDraft(p => ({ ...p, action: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            placeholder="e.g. USER_CREATED"
            className={`${inputCls} w-44`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Tenant ID</label>
          <input
            value={draft.tenantId}
            onChange={e => setDraft(p => ({ ...p, tenantId: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            placeholder="Filter by tenant UUID"
            className={`${inputCls} w-52 font-mono text-xs`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">From</label>
          <input type="date" value={draft.dateFrom} onChange={e => setDraft(p => ({ ...p, dateFrom: e.target.value }))} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">To</label>
          <input type="date" value={draft.dateTo} onChange={e => setDraft(p => ({ ...p, dateTo: e.target.value }))} className={inputCls} />
        </div>
        <div className="flex gap-2">
          <Btn size="sm" onClick={applyFilters}>Apply</Btn>
          {(applied.action || applied.dateFrom || applied.dateTo || applied.tenantId) && (
            <Btn variant="secondary" size="sm" onClick={clearFilters}>Clear</Btn>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : error ? (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">Failed to load audit logs.</p>
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <Empty title="No audit logs found" subtitle="Try adjusting your filters" />
        ) : (
          <div className="max-w-5xl space-y-2">
            {(data?.items ?? []).map(log => (
              <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={actionVariant(log.action)} size="xs">{log.action}</Badge>
                      {log.entity_type && (
                        <span className="text-xs text-zinc-500">{log.entity_type}</span>
                      )}
                      {log.entity_id && (
                        <span className="text-xs font-mono text-zinc-600">{log.entity_id.slice(0, 8)}…</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {log.actor_user_id && (
                        <span className="text-xs text-zinc-500">By: <span className="font-mono">{log.actor_user_id.slice(0, 8)}…</span></span>
                      )}
                      {log.tenant_id && (
                        <span className="text-xs text-zinc-500">Tenant: <span className="font-mono">{log.tenant_id.slice(0, 8)}…</span></span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-600 flex-shrink-0">{fmtDate(log.created_at)}</span>
                </div>
              </div>
            ))}

            {(data?.total_pages ?? 0) > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-500 self-center">{page} / {data?.total_pages}</span>
                <Btn variant="secondary" size="xs" disabled={!data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
