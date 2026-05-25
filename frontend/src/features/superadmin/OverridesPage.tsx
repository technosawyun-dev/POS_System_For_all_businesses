import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { tenantService } from '@/services/tenant/tenant.service'
import type { TenantEntitlementOverride } from '@/shared/types'

function OverrideModal({
  tenantId,
  existing,
  onClose,
}: {
  tenantId: string
  existing?: TenantEntitlementOverride
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    feature_code: existing?.feature_code ?? '',
    enabled: existing?.enabled === null ? '' : existing?.enabled === true ? 'true' : existing?.enabled === false ? 'false' : '',
    limit_value: existing?.limit_value !== null && existing?.limit_value !== undefined ? String(existing.limit_value) : '',
    reason: existing?.reason ?? '',
    expires_at: existing?.expires_at ? existing.expires_at.split('T')[0] : '',
  })

  const createMutation = useMutation({
    mutationFn: () => subscriptionsService.adminCreateOverride(tenantId, {
      feature_code: form.feature_code,
      enabled: form.enabled === '' ? undefined : form.enabled === 'true',
      limit_value: form.limit_value ? Number(form.limit_value) : null,
      reason: form.reason || undefined,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overrides', tenantId] }); toast.success('Override created'); onClose() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: () => subscriptionsService.adminUpdateOverride(existing!.id, {
      enabled: form.enabled === '' ? undefined : form.enabled === 'true',
      limit_value: form.limit_value ? Number(form.limit_value) : null,
      reason: form.reason || undefined,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overrides', tenantId] }); toast.success('Override updated'); onClose() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const isEdit = !!existing
  const isPending = createMutation.isPending || updateMutation.isPending
  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">{isEdit ? 'Edit Override' : 'New Override'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Feature Code *</label>
            <input value={form.feature_code} onChange={e => setForm(p => ({ ...p, feature_code: e.target.value }))}
              disabled={isEdit} className={inputCls} placeholder="analytics" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Enable Override</label>
              <select value={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.value }))} className={inputCls}>
                <option value="">No change (inherit)</option>
                <option value="true">Force Enable</option>
                <option value="false">Force Disable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Limit Override</label>
              <input type="number" value={form.limit_value} onChange={e => setForm(p => ({ ...p, limit_value: e.target.value }))}
                placeholder="blank = inherit" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Reason</label>
            <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Expires At (optional)</label>
            <input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={!form.feature_code || isPending}
            onClick={() => isEdit ? updateMutation.mutate() : createMutation.mutate()}>
            {isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function OverridesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tenantInput, setTenantInput] = useState(searchParams.get('tenantId') ?? '')
  const [activeTenantId, setActiveTenantId] = useState(searchParams.get('tenantId') ?? '')
  const qc = useQueryClient()
  const [modal, setModal] = useState<TenantEntitlementOverride | null | 'new'>(null)

  const overridesQuery = useQuery({
    queryKey: ['overrides', activeTenantId],
    queryFn: () => subscriptionsService.adminListOverrides(activeTenantId),
    enabled: !!activeTenantId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionsService.adminDeleteOverride(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overrides', activeTenantId] }); toast.success('Override deleted') },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  function search() {
    const tid = tenantInput.trim()
    setActiveTenantId(tid)
    setSearchParams(tid ? { tenantId: tid } : {})
  }

  return (
    <>
      {modal !== null && activeTenantId && (
        <OverrideModal
          tenantId={activeTenantId}
          existing={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">Tenant Entitlement Overrides</h2>
        </div>

        {/* Tenant selector */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex gap-2">
          <input
            value={tenantInput}
            onChange={e => setTenantInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Paste tenant ID…"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
          />
          <Btn variant="secondary" size="sm" onClick={search}>Load</Btn>
          {activeTenantId && (
            <Btn size="sm" onClick={() => setModal('new')}>+ Override</Btn>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!activeTenantId ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <p className="text-zinc-500 text-sm">Enter a tenant ID to view and manage their entitlement overrides.</p>
              <p className="text-xs text-zinc-600">You can get the tenant ID from the Subscriptions page.</p>
            </div>
          ) : overridesQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : (overridesQuery.data ?? []).length === 0 ? (
            <Empty title="No overrides for this tenant" />
          ) : (
            <div className="max-w-3xl space-y-3">
              {(overridesQuery.data ?? []).map(ov => (
                <div key={ov.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-100 capitalize">
                          {ov.feature_code.replace(/_/g, ' ')}
                        </span>
                        {ov.enabled !== null && (
                          <Badge variant={ov.enabled ? 'success' : 'danger'} size="xs">
                            {ov.enabled ? 'Force Enabled' : 'Force Disabled'}
                          </Badge>
                        )}
                        {ov.limit_value !== null && (
                          <Badge variant="info" size="xs">Limit: {ov.limit_value}</Badge>
                        )}
                      </div>
                      {ov.reason && <p className="text-xs text-zinc-500 mt-1">{ov.reason}</p>}
                      <p className="text-xs text-zinc-600 mt-0.5">
                        Created {fmtDate(ov.created_at)}
                        {ov.expires_at && ` · Expires ${fmtDate(ov.expires_at)}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Btn variant="secondary" size="xs" onClick={() => setModal(ov)}>Edit</Btn>
                      <Btn variant="danger" size="xs"
                        onClick={() => confirm('Delete this override?') && deleteMutation.mutate(ov.id)}>
                        Delete
                      </Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
