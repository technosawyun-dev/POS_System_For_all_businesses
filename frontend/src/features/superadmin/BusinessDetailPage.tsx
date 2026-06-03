import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { tenantService } from '@/services/tenant/tenant.service'
import { usersService } from '@/services/users/users.service'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import type { TenantEntitlementOverride } from '@/shared/types'

// Normalize legacy feature codes from DB (before migration) to canonical codes.
const LEGACY_CODE_MAP: Record<string, string> = {
  max_products:  'products',
  max_branches:  'branches',
  max_users:     'users',
  max_customers: 'customers',
}
function normalizeFeatureCode(code: string): string {
  return LEGACY_CODE_MAP[code] ?? code
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  SUSPENDED: 'warning',
  EXPIRED:   'danger',
  CANCELLED: 'default',
  INACTIVE:  'default',
}
const USER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE:   'success',
  INACTIVE: 'default',
  SUSPENDED:'warning',
}
const ROLE_LABELS: Record<string, string> = {
  BUSINESS_OWNER: 'Owner', MANAGER: 'Manager', CASHIER: 'Cashier',
  INVENTORY_STAFF: 'Inventory', RESELLER: 'Reseller',
}

type Tab = 'overview' | 'users' | 'branches' | 'subscription' | 'billing'

// Modals

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  )
}

function ExtendModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [days, setDays] = useState('30')
  const [reason, setReason] = useState('')
  const mutation = useMutation({
    mutationFn: () => subscriptionsService.adminExtend(tenantId, Number(days), reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] })
      toast.success(`Extended by ${days} days`)
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })
  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">Extend Subscription</h3>
          <CloseBtn onClick={onClose} />
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Days to extend *</label>
            <input type="number" min="1" max="3650" value={days} onChange={e => setDays(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={() => mutation.mutate()} disabled={!days || mutation.isPending}>
            {mutation.isPending ? 'Extending…' : 'Extend'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function ChangePlanModal({ tenantId, currentPlanId, onClose }: { tenantId: string; currentPlanId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')
  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
  })
  const mutation = useMutation({
    mutationFn: () => subscriptionsService.adminChangePlan(tenantId, selected, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] })
      qc.invalidateQueries({ queryKey: ['admin', 'entitlements', tenantId] })
      toast.success('Plan changed')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })
  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">Change Plan</h3>
          <CloseBtn onClick={onClose} />
        </div>
        <div className="p-5 space-y-2 max-h-64 overflow-y-auto">
          {(plans?.items ?? []).filter(p => p.id !== currentPlanId && p.is_active).map(plan => (
            <button key={plan.id} onClick={() => setSelected(plan.id)}
              className={cn('w-full text-left px-4 py-3 rounded-xl border transition-all',
                selected === plan.id ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800',
              )}>
              <p className="text-sm font-medium text-zinc-100">{plan.name}</p>
              <p className="text-xs text-zinc-500">{plan.currency} {Number(plan.price).toFixed(2)} / {plan.billing_cycle.toLowerCase()}</p>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-zinc-800">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" className={inputCls} />
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={!selected || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Changing…' : 'Change Plan'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function OverrideModal({
  tenantId,
  featureCode,
  planEnabled,
  planLimit,
  existing,
  onClose,
}: {
  tenantId: string
  featureCode: string
  planEnabled: boolean
  planLimit: number | null
  existing?: TenantEntitlementOverride
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    enabled: existing?.enabled === null ? '' : existing?.enabled === true ? 'true' : existing?.enabled === false ? 'false' : '',
    limit_value: existing?.limit_value != null ? String(existing.limit_value) : '',
    reason: existing?.reason ?? '',
    expires_at: existing?.expires_at ? existing.expires_at.split('T')[0] : '',
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'entitlements', tenantId] })
    qc.invalidateQueries({ queryKey: ['admin', 'overrides', tenantId] })
  }

  const createMutation = useMutation({
    mutationFn: () => subscriptionsService.adminCreateOverride(tenantId, {
      feature_code: featureCode,
      enabled: form.enabled === '' ? undefined : form.enabled === 'true',
      limit_value: form.limit_value !== '' ? Number(form.limit_value) : null,
      reason: form.reason || undefined,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
    }),
    onSuccess: () => { invalidate(); toast.success('Override saved'); onClose() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: () => subscriptionsService.adminUpdateOverride(existing!.id, {
      enabled: form.enabled === '' ? undefined : form.enabled === 'true',
      limit_value: form.limit_value !== '' ? Number(form.limit_value) : null,
      reason: form.reason || undefined,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
    }),
    onSuccess: () => { invalidate(); toast.success('Override updated'); onClose() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100 capitalize">
              {existing ? 'Edit' : 'Add'} Override
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{featureCode}</p>
          </div>
          <CloseBtn onClick={onClose} />
        </div>
        <div className="px-5 py-3 bg-zinc-800/50 border-b border-zinc-800 text-xs text-zinc-400 flex gap-4">
          <span>Plan default: <span className={planEnabled ? 'text-green-400' : 'text-zinc-600'}>{planEnabled ? 'Enabled' : 'Disabled'}</span></span>
          <span>Plan limit: <span className="text-zinc-200">{planLimit === null ? 'Unlimited' : planLimit}</span></span>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Enable override</label>
              <select value={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.value }))} className={inputCls}>
                <option value="">No change (keep plan)</option>
                <option value="true">Force Enable</option>
                <option value="false">Force Disable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Limit override</label>
              <input
                type="number" min="0" value={form.limit_value}
                onChange={e => setForm(p => ({ ...p, limit_value: e.target.value }))}
                placeholder="Leave blank = unlimited"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Reason</label>
            <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Expires at (optional)</label>
            <input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={isPending} onClick={() => existing ? updateMutation.mutate() : createMutation.mutate()}>
            {isPending ? 'Saving…' : existing ? 'Update' : 'Save Override'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// Subscription Tab

function SubscriptionTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'extend' | 'change-plan' | null>(null)
  const [overrideModal, setOverrideModal] = useState<{
    featureCode: string
    planEnabled: boolean
    planLimit: number | null
    existing?: TenantEntitlementOverride
  } | null>(null)

  const subQuery = useQuery({
    queryKey: ['admin', 'sub', tenantId],
    queryFn: () => subscriptionsService.adminGetTenantSubscription(tenantId),
  })

  const entitlementsQuery = useQuery({
    queryKey: ['admin', 'entitlements', tenantId],
    queryFn: () => subscriptionsService.adminGetEntitlements(tenantId),
    enabled: !!subQuery.data,
  })

  const overridesQuery = useQuery({
    queryKey: ['admin', 'overrides', tenantId],
    queryFn: () => subscriptionsService.adminListOverrides(tenantId),
    enabled: !!subQuery.data,
  })

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionsService.adminCancel(tenantId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] }); toast.success('Subscription deactivated') },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => subscriptionsService.adminReactivate(tenantId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] }); toast.success('Subscription activated') },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const suspendMutation = useMutation({
    mutationFn: () => subscriptionsService.adminSuspend(tenantId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] }); toast.success('Subscription suspended') },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const expireMutation = useMutation({
    mutationFn: () => subscriptionsService.adminExpire(tenantId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] }); toast.success('Subscription expired') },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const deleteOverrideMutation = useMutation({
    mutationFn: (overrideId: string) => subscriptionsService.adminDeleteOverride(overrideId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'entitlements', tenantId] })
      qc.invalidateQueries({ queryKey: ['admin', 'overrides', tenantId] })
      toast.success('Override removed')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  if (subQuery.isLoading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>

  if (subQuery.error || !subQuery.data) {
    return (
      <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
        <p className="text-sm text-red-400">No subscription found for this business.</p>
      </div>
    )
  }

  const sub = subQuery.data
  const overrides = overridesQuery.data ?? []

  // Build plan entitlement map for showing plan defaults
  const planEntMap = new Map(
    (sub.plan.entitlements ?? []).map(e => [e.feature_code, e])
  )

  // Map overrides by feature_code
  const overrideMap = new Map(overrides.map(o => [o.feature_code, o]))

  return (
    <div className="max-w-2xl space-y-4">
      {/* Modals */}
      {modal === 'extend' && <ExtendModal tenantId={tenantId} onClose={() => setModal(null)} />}
      {modal === 'change-plan' && (
        <ChangePlanModal tenantId={tenantId} currentPlanId={sub.plan_id} onClose={() => setModal(null)} />
      )}
      {overrideModal && (
        <OverrideModal
          tenantId={tenantId}
          featureCode={overrideModal.featureCode}
          planEnabled={overrideModal.planEnabled}
          planLimit={overrideModal.planLimit}
          existing={overrideModal.existing}
          onClose={() => setOverrideModal(null)}
        />
      )}

      {/* Subscription Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Subscription</h3>
          <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'} dot>{sub.status}</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: 'Plan', value: sub.plan.name },
            { label: 'Price', value: `${sub.plan.currency} ${Number(sub.plan.price).toFixed(2)}/${sub.plan.billing_cycle.toLowerCase()}` },
            { label: 'Started', value: fmtDate(sub.started_at) },
            { label: 'Expires', value: sub.expires_at ? fmtDate(sub.expires_at) : 'Never' },
            { label: 'Auto-Renew', value: sub.auto_renew ? 'Yes' : 'No' },
            ...(sub.trial_ends_at ? [{ label: 'Trial Ends', value: fmtDate(sub.trial_ends_at) }] : []),
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-zinc-500 mb-0.5">{item.label}</p>
              <p className="text-zinc-200">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap gap-2">
          <Btn size="sm" onClick={() => setModal('extend')}>Extend</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setModal('change-plan')}>Change Plan</Btn>
          {(sub.status === 'CANCELLED' || sub.status === 'EXPIRED') ? (
            <Btn
              variant="success" size="sm"
              disabled={reactivateMutation.isPending}
              onClick={() => confirm('Reactivate this subscription? Will set to ACTIVE and extend 30 days.') && reactivateMutation.mutate()}
            >
              {reactivateMutation.isPending ? 'Activating…' : 'Activate'}
            </Btn>
          ) : (
            <Btn
              variant="danger" size="sm"
              disabled={cancelMutation.isPending}
              onClick={() => confirm('Deactivate (cancel) this subscription?') && cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Btn>
          )}
          {sub.status !== 'SUSPENDED' && sub.status !== 'EXPIRED' && sub.status !== 'CANCELLED' && (
            <Btn
              variant="danger" size="sm"
              disabled={suspendMutation.isPending}
              onClick={() => confirm('Suspend this subscription?') && suspendMutation.mutate()}
            >
              {suspendMutation.isPending ? 'Suspending…' : 'Suspend'}
            </Btn>
          )}
          {sub.status !== 'EXPIRED' && sub.status !== 'CANCELLED' && (
            <Btn
              variant="danger" size="sm"
              disabled={expireMutation.isPending}
              onClick={() => confirm('Mark subscription as expired?') && expireMutation.mutate()}
            >
              {expireMutation.isPending ? 'Expiring…' : 'Expire'}
            </Btn>
          )}
        </div>
      </div>

      {/* Entitlements + Overrides */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-100">Entitlements</p>
            <p className="text-xs text-zinc-500 mt-0.5">Plan defaults · Overrides shown in amber</p>
          </div>
          {overrides.length > 0 && (
            <Badge variant="warning" size="xs">{overrides.length} override{overrides.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>

        {entitlementsQuery.isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={20} /></div>
        ) : (entitlementsQuery.data ?? []).length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">No entitlements configured for this plan.</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {(entitlementsQuery.data ?? []).map(e => {
              const hasOverride = e.source === 'override'
              const override = overrideMap.get(e.feature_code)
              const planDefault = planEntMap.get(e.feature_code)

              return (
                <div key={e.feature_code} className={cn(
                  'flex items-center justify-between px-4 py-3 gap-3',
                  hasOverride && 'bg-amber-950/20',
                )}>
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
                      e.enabled ? 'bg-green-900 text-green-400' : 'bg-zinc-800 text-zinc-600',
                    )}>
                      {e.enabled ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn('text-sm capitalize', e.enabled ? 'text-zinc-200' : 'text-zinc-500')}>
                          {normalizeFeatureCode(e.feature_code).replace(/_/g, ' ')}
                        </span>
                        {hasOverride && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/50 text-amber-400 font-medium">
                            Override
                          </span>
                        )}
                      </div>
                      {hasOverride && planDefault && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Plan: {planDefault.enabled ? 'enabled' : 'disabled'}
                          {planDefault.limit_value !== null ? ` · limit ${planDefault.limit_value}` : ' · unlimited'}
                        </p>
                      )}
                      {override?.expires_at && (
                        <p className="text-[11px] text-amber-500/70 mt-0.5">
                          Expires {fmtDate(override.expires_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-zinc-500">
                      {e.limit_value === null ? 'Unlimited' : `Limit: ${e.limit_value}`}
                    </span>
                    {hasOverride ? (
                      <>
                        <Btn
                          variant="secondary" size="xs"
                          onClick={() => setOverrideModal({
                            featureCode: e.feature_code,
                            planEnabled: planDefault?.enabled ?? e.enabled,
                            planLimit: planDefault?.limit_value ?? null,
                            existing: override,
                          })}
                        >
                          Edit
                        </Btn>
                        <button
                          disabled={deleteOverrideMutation.isPending}
                          onClick={() => override && confirm('Remove this override?') && deleteOverrideMutation.mutate(override.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
                          title="Remove override"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </>
                    ) : (
                      <Btn
                        variant="secondary" size="xs"
                        onClick={() => setOverrideModal({
                          featureCode: e.feature_code,
                          planEnabled: e.enabled,
                          planLimit: e.limit_value,
                        })}
                      >
                        + Override
                      </Btn>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Billing Tab
const PROOF_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger',
}
const HISTORY_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVATED: 'success', RENEWED: 'success', UPGRADED: 'success',
  TRIAL_STARTED: 'info', DOWNGRADED: 'warning', DOWNGRADE_REQUESTED: 'warning',
  UPGRADE_REQUESTED: 'info', RENEWAL_REQUESTED: 'info',
  CANCELLED: 'danger', EXPIRED: 'danger', SUSPENDED: 'danger',
}

async function openProofFile(url: string) {
  const token = localStorage.getItem('nexuspos_access_token') ?? ''
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  } catch (e) {
    toast.error('Could not open proof file. Check your connection.')
  }
}

type ReviewAction = { proofId: string; action: 'approve' | 'reject'; planName?: string }

function ReviewModal({ review, onClose, onConfirm, isPending }: {
  review: ReviewAction
  onClose: () => void
  onConfirm: (notes: string) => void
  isPending: boolean
}) {
  const [notes, setNotes] = useState('')
  const isApprove = review.action === 'approve'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">
            {isApprove ? 'Approve Payment Proof' : 'Reject Payment Proof'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          {isApprove ? (
            <p className="text-sm text-zinc-300">
              Approving will <span className="text-green-400 font-semibold">activate the subscription</span>
              {review.planName ? <> on the <span className="text-amber-400 font-semibold">{review.planName}</span> plan</> : ''}.
              The user will immediately gain access.
            </p>
          ) : (
            <p className="text-sm text-zinc-300">
              Rejecting will <span className="text-red-400 font-semibold">deny access</span> to the requested plan.
              The user will need to resubmit a new payment proof.
            </p>
          )}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={isApprove ? 'Notes for approval (optional)' : 'Reason for rejection (optional, shown to user)'}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Cancel</Btn>
          <Btn variant={isApprove ? 'success' : 'danger'} size="sm" onClick={() => onConfirm(notes)} disabled={isPending}>
            {isPending ? 'Processing…' : isApprove ? 'Approve & Activate' : 'Reject'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function BillingTab({ tenantId }: { tenantId: string }) {
  const [subtab, setSubtab] = useState<'proofs' | 'history'>('proofs')
  const [reviewModal, setReviewModal] = useState<ReviewAction | null>(null)
  const qc = useQueryClient()

  const proofsQuery = useQuery({
    queryKey: ['admin', 'billing-proofs', tenantId],
    queryFn: () => subscriptionsService.adminListProofs({ tenant_id: tenantId, page_size: 50 }),
  })

  const historyQuery = useQuery({
    queryKey: ['admin', 'billing-history', tenantId],
    queryFn: () => subscriptionsService.adminGetSubscriptionHistory(tenantId),
    enabled: subtab === 'history',
  })

  const approveMutation = useMutation({
    mutationFn: ({ proofId, notes }: { proofId: string; notes: string }) =>
      subscriptionsService.adminApproveProof(proofId, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'billing-proofs', tenantId] })
      qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] })
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] })
      setReviewModal(null)
      toast.success('Proof approved — subscription activated.')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ proofId, notes }: { proofId: string; notes: string }) =>
      subscriptionsService.adminRejectProof(proofId, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'billing-proofs', tenantId] })
      setReviewModal(null)
      toast.success('Proof rejected. User must resubmit.')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to reject'),
  })

  const isPending = approveMutation.isPending || rejectMutation.isPending

  const proofs = proofsQuery.data?.items ?? []
  const history = (historyQuery.data as any)?.items ?? (Array.isArray(historyQuery.data) ? historyQuery.data : [])

  return (
    <div className="space-y-4">
      {reviewModal && (
        <ReviewModal
          review={reviewModal}
          onClose={() => !isPending && setReviewModal(null)}
          isPending={isPending}
          onConfirm={(notes) => {
            if (reviewModal.action === 'approve') {
              approveMutation.mutate({ proofId: reviewModal.proofId, notes })
            } else {
              rejectMutation.mutate({ proofId: reviewModal.proofId, notes })
            }
          }}
        />
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-zinc-800 pb-2">
        {(['proofs', 'history'] as const).map(s => (
          <button key={s} onClick={() => setSubtab(s)}
            className={cn('px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              subtab === s ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200')}>
            {s === 'proofs' ? 'Payment Proofs' : 'Plan History'}
          </button>
        ))}
      </div>

      {/* Payment Proofs */}
      {subtab === 'proofs' && (
        <div className="space-y-3">
          {proofsQuery.isLoading ? (
            <div className="flex justify-center py-10"><Spinner size={24} /></div>
          ) : proofs.length === 0 ? (
            <Empty title="No payment proofs" subtitle="This tenant has not submitted any payment proofs yet." />
          ) : proofs.map((proof: any) => (
            <div key={proof.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={PROOF_VARIANT[proof.status] ?? 'default'} size="xs">{proof.status}</Badge>
                    <Badge variant={proof.action_type === 'UPGRADE' ? 'warning' : proof.action_type === 'RENEWAL' ? 'info' : 'default'} size="xs">
                      {proof.action_type === 'INITIAL_ACTIVATION' ? 'New Activation'
                        : proof.action_type === 'RENEWAL' ? 'Renewal' : 'Plan Upgrade'}
                    </Badge>
                  </div>
                  {proof.target_plan_name && (
                    <p className="text-sm font-semibold text-green-400">→ Plan: {proof.target_plan_name}</p>
                  )}
                  <p className="text-sm text-zinc-300 font-medium">
                    {proof.currency} {Number(proof.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    <span className="text-zinc-500 font-normal"> · {fmtDate(proof.created_at)}</span>
                  </p>
                  {proof.reference_number && (
                    <p className="text-xs text-amber-300/80">Ref: {proof.reference_number}</p>
                  )}
                  {proof.review_notes && (
                    <p className="text-xs text-zinc-500 italic">Note: {proof.review_notes}</p>
                  )}
                  {proof.reviewed_at && (
                    <p className="text-xs text-zinc-600">Reviewed {fmtDate(proof.reviewed_at)}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {proof.proof_file_url && (
                    <button
                      onClick={() => openProofFile(proof.proof_file_url)}
                      className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors border border-amber-500/30 hover:border-amber-400/60 rounded-lg px-2.5 py-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      View proof
                    </button>
                  )}
                  {proof.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReviewModal({ proofId: proof.id, action: 'approve', planName: proof.target_plan_name })}
                        className="text-xs text-green-400 hover:text-green-300 font-semibold transition-colors border border-green-500/30 hover:border-green-400/60 rounded-lg px-2.5 py-1.5"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setReviewModal({ proofId: proof.id, action: 'reject' })}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors border border-red-500/30 hover:border-red-400/60 rounded-lg px-2.5 py-1.5"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan History */}
      {subtab === 'history' && (
        <div className="space-y-2">
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-10"><Spinner size={24} /></div>
          ) : history.length === 0 ? (
            <Empty title="No history" subtitle="No subscription changes recorded yet." />
          ) : history.map((h: any) => (
            <div key={h.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={HISTORY_VARIANT[h.change_type] ?? 'default'} size="xs">
                      {(h.change_type ?? '').replace(/_/g, ' ')}
                    </Badge>
                    {h.new_plan_name && (
                      <span className="text-xs text-zinc-300 font-medium">→ {h.new_plan_name}</span>
                    )}
                  </div>
                  {h.note && <p className="text-xs text-zinc-500 italic">{h.note}</p>}
                </div>
                <span className="text-xs text-zinc-600 flex-shrink-0">{fmtDate(h.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Main Page

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const tab = (searchParams.get('tab') as Tab | null) ?? 'overview'
  function setTab(t: Tab) {
    setSearchParams(prev => { prev.set('tab', t); return prev }, { replace: true })
  }

  const tenantQuery = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantService.getTenant(id!),
    enabled: !!id,
  })

  const usersQuery = useQuery({
    queryKey: ['admin', 'tenant-users', id],
    queryFn: () => usersService.list({ tenant_id: id, page: 1, page_size: 50 }),
    enabled: !!id && tab === 'users',
  })

  const branchesQuery = useQuery({
    queryKey: ['tenant', id, 'branches'],
    queryFn: () => tenantService.getBranches(id!, { page: 1, page_size: 50 }),
    enabled: !!id && tab === 'branches',
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => tenantService.updateTenantStatus(id!, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'businesses'] })
      toast.success('Status updated')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const tenant = tenantQuery.data
  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',     label: 'Overview'     },
    { key: 'users',        label: 'Users'        },
    { key: 'branches',     label: 'Branches'     },
    { key: 'subscription', label: 'Subscription' },
    { key: 'billing',      label: 'Billing'      },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
        <button
          onClick={() => navigate('/super-admin/businesses')}
          className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          {tenantQuery.isLoading ? (
            <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-100">{tenant?.name}</h2>
              {tenant && <Badge variant={STATUS_VARIANT[tenant.status] ?? 'default'} size="xs">{tenant.status}</Badge>}
            </div>
          )}
          <p className="text-xs text-zinc-500 mt-0.5 font-mono">{tenant?.slug}</p>
        </div>
        {tenant && (
          <div className="flex gap-2 flex-shrink-0">
            {tenant.status !== 'SUSPENDED' ? (
              <Btn variant="secondary" size="sm" disabled={statusMutation.isPending}
                onClick={() => confirm(`Suspend ${tenant.name}?`) && statusMutation.mutate('SUSPENDED')}>
                Suspend
              </Btn>
            ) : (
              <Btn variant="secondary" size="sm" disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('ACTIVE')}>
                Activate
              </Btn>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center px-4 py-2 border-b border-zinc-800 gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              tab === t.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Overview */}
        {tab === 'overview' && (
          <div className="max-w-2xl">
            {tenantQuery.isLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : tenant ? (
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Business Profile</h3>
                  <dl className="space-y-3">
                    {[
                      { label: 'Name', value: tenant.name },
                      { label: 'Slug', value: <span className="font-mono">{tenant.slug}</span> },
                      { label: 'Email', value: tenant.email ?? '—' },
                      { label: 'Phone', value: tenant.phone ?? '—' },
                      { label: 'Address', value: tenant.address ?? '—' },
                      { label: 'City', value: tenant.city ?? '—' },
                      { label: 'Country', value: tenant.country ?? '—' },
                      { label: 'Timezone', value: tenant.timezone },
                      { label: 'Currency', value: tenant.currency },
                      { label: 'Locale', value: tenant.locale },
                      { label: 'Created', value: fmtDate(tenant.created_at) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-4">
                        <dt className="text-xs text-zinc-500 w-24 flex-shrink-0 pt-0.5">{label}</dt>
                        <dd className="text-sm text-zinc-200">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="max-w-3xl">
            {usersQuery.isLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : (usersQuery.data?.items ?? []).length === 0 ? (
              <Empty title="No users found" />
            ) : (
              <div className="space-y-2">
                {(usersQuery.data?.items ?? []).map(user => (
                  <div
                    key={user.id}
                    onClick={() => navigate(`/super-admin/users/${user.id}`)}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{user.full_name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="default" size="xs">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                      <Badge variant={USER_STATUS_VARIANT[user.status] ?? 'default'} size="xs">{user.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Branches */}
        {tab === 'branches' && (
          <div className="max-w-3xl">
            {branchesQuery.isLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : (branchesQuery.data?.items ?? []).length === 0 ? (
              <Empty title="No branches found" />
            ) : (
              <div className="space-y-2">
                {(branchesQuery.data?.items ?? []).map(branch => (
                  <div key={branch.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100">{branch.name}</p>
                      {branch.address && <p className="text-xs text-zinc-500 mt-0.5">{branch.address}</p>}
                    </div>
                    <Badge variant={branch.status === 'ACTIVE' ? 'success' : branch.status === 'CLOSED' ? 'danger' : 'default'} size="xs">
                      {branch.status === 'ACTIVE' ? 'Active' : branch.status === 'CLOSED' ? 'Closed' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subscription */}
        {tab === 'subscription' && id && <SubscriptionTab tenantId={id} />}

        {/* Billing */}
        {tab === 'billing' && id && <BillingTab tenantId={id} />}
      </div>
    </div>
  )
}
