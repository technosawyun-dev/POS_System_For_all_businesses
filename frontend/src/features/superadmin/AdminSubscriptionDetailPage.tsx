import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { cn } from '@/shared/utils'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success', TRIAL: 'info', EXPIRED: 'danger', SUSPENDED: 'warning', CANCELLED: 'default',
}

const PROOF_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger',
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">Extend Subscription</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Days to extend *</label>
            <input type="number" min="1" max="3650" value={days} onChange={e => setDays(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
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
      toast.success('Plan changed')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">Change Plan</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
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
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
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

function ReviewProofModal({ proofId, action, onClose }: { proofId: string; action: 'approve' | 'reject'; onClose: () => void }) {
  const qc = useQueryClient()
  const { tenantId } = useParams<{ tenantId: string }>()
  const [notes, setNotes] = useState('')
  const mutation = useMutation({
    mutationFn: () =>
      action === 'approve'
        ? subscriptionsService.adminApproveProof(proofId, notes || undefined)
        : subscriptionsService.adminRejectProof(proofId, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] })
      qc.invalidateQueries({ queryKey: ['admin', 'proofs', 'tenant', tenantId] })
      if (action === 'approve') {
        toast.success('Proof approved. Use "Change Plan" above to activate the tenant\'s new plan.', { duration: 7000 })
      } else {
        toast.success('Proof rejected')
      }
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100 capitalize">{action} Proof</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Review notes (optional)" rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none" />
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant={action === 'approve' ? 'success' : 'danger'} size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Processing…' : `Confirm ${action}`}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function AdminSubscriptionDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [modal, setModal] = useState<'extend' | 'change-plan' | null>(null)
  const [reviewModal, setReviewModal] = useState<{ proofId: string; action: 'approve' | 'reject' } | null>(null)
  const [tab, setTab] = useState<'overview' | 'entitlements' | 'proofs'>('overview')

  const subQuery = useQuery({
    queryKey: ['admin', 'sub', tenantId],
    queryFn: () => subscriptionsService.adminGetTenantSubscription(tenantId!),
    enabled: !!tenantId,
  })

  const entitlementsQuery = useQuery({
    queryKey: ['admin', 'entitlements', tenantId],
    queryFn: () => subscriptionsService.adminGetEntitlements(tenantId!),
    enabled: !!tenantId && tab === 'entitlements',
  })

  const proofsQuery = useQuery({
    queryKey: ['admin', 'proofs', 'tenant', tenantId],
    queryFn: () => subscriptionsService.adminListProofs({ page_size: 20, tenant_id: tenantId }),
    enabled: !!tenantId && tab === 'proofs',
  })

  const suspendMutation = useMutation({
    mutationFn: () => subscriptionsService.adminSuspend(tenantId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] }); toast.success('Subscription suspended') },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const expireMutation = useMutation({
    mutationFn: () => subscriptionsService.adminExpire(tenantId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'sub', tenantId] }); toast.success('Subscription expired') },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const sub = subQuery.data

  if (subQuery.isLoading) return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  if (!sub) return <div className="flex items-center justify-center h-full"><p className="text-zinc-500 text-sm">Subscription not found.</p></div>

  return (
    <>
      {modal === 'extend' && tenantId && <ExtendModal tenantId={tenantId} onClose={() => setModal(null)} />}
      {modal === 'change-plan' && tenantId && <ChangePlanModal tenantId={tenantId} currentPlanId={sub.plan_id} onClose={() => setModal(null)} />}
      {reviewModal && <ReviewProofModal proofId={reviewModal.proofId} action={reviewModal.action} onClose={() => setReviewModal(null)} />}

      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
          <button onClick={() => navigate('/super-admin/subscriptions')} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              Tenant: <span className="font-mono text-zinc-400">{tenantId?.slice(0, 8)}…</span>
            </h2>
            <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'} size="xs" dot>{sub.status}</Badge>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Btn variant="secondary" size="sm" onClick={() => setModal('extend')}>Extend</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setModal('change-plan')}>Change Plan</Btn>
            {sub.status === 'ACTIVE' && (
              <Btn variant="danger" size="sm" onClick={() => confirm('Suspend this subscription?') && suspendMutation.mutate()} disabled={suspendMutation.isPending}>
                Suspend
              </Btn>
            )}
            {sub.status !== 'EXPIRED' && sub.status !== 'CANCELLED' && (
              <Btn variant="danger" size="sm" onClick={() => confirm('Expire this subscription?') && expireMutation.mutate()} disabled={expireMutation.isPending}>
                Expire
              </Btn>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex-shrink-0 flex gap-1 px-4 py-2 border-b border-zinc-800">
          {(['overview', 'entitlements', 'proofs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 text-sm rounded-lg font-medium transition-colors capitalize',
                tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
              )}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl">
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-zinc-100 mb-3">{sub.plan.name}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    {[
                      { label: 'Status', value: <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'} dot>{sub.status}</Badge> },
                      { label: 'Started', value: fmtDate(sub.started_at) },
                      { label: 'Expires', value: fmtDate(sub.expires_at) },
                      { label: 'Auto-Renew', value: sub.auto_renew ? 'Yes' : 'No' },
                      { label: 'Price', value: `${sub.plan.currency} ${Number(sub.plan.price).toFixed(2)}/${sub.plan.billing_cycle.toLowerCase()}` },
                      ...(sub.trial_ends_at ? [{ label: 'Trial Ends', value: fmtDate(sub.trial_ends_at) }] : []),
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-xs text-zinc-500 mb-0.5">{item.label}</p>
                        <div className="text-zinc-200 text-sm">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'entitlements' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-100">Effective Entitlements</p>
                  <Btn variant="secondary" size="xs" onClick={() => navigate(`/super-admin/overrides?tenantId=${tenantId}`)}>
                    Manage Overrides
                  </Btn>
                </div>
                {entitlementsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Spinner size={20} /></div>
                ) : (entitlementsQuery.data ?? []).length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-8">No entitlements.</p>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {(entitlementsQuery.data ?? []).map(e => (
                      <div key={e.feature_code} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('w-4 h-4 rounded-full flex items-center justify-center',
                            e.enabled ? 'bg-green-900 text-green-400' : 'bg-zinc-800 text-zinc-600')}>
                            {e.enabled ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            )}
                          </span>
                          <span className={cn('text-sm capitalize', e.enabled ? 'text-zinc-200' : 'text-zinc-600')}>
                            {e.feature_code.replace(/_/g, ' ')}
                          </span>
                          <Badge variant={e.source === 'override' ? 'warning' : e.source === 'plan' ? 'info' : 'default'} size="xs">
                            {e.source}
                          </Badge>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {e.limit_value === null ? 'Unlimited' : `Limit: ${e.limit_value}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'proofs' && (
              <div className="space-y-3">
                {proofsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Spinner size={24} /></div>
                ) : !proofsQuery.data?.items.length ? (
                  <p className="text-zinc-500 text-sm text-center py-8">No payment proofs for this tenant.</p>
                ) : (
                  proofsQuery.data.items.map(proof => (
                    <div key={proof.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-zinc-100">
                              {proof.currency} {Number(proof.amount).toLocaleString()}
                            </p>
                            <Badge variant={PROOF_VARIANT[proof.status] ?? 'default'} size="xs">{proof.status}</Badge>
                          </div>
                          {proof.reference_number && (
                            <p className="text-xs text-amber-300/80 mt-0.5">{proof.reference_number}</p>
                          )}
                          <p className="text-xs text-zinc-600 mt-0.5">{proof.created_at ? new Date(proof.created_at).toLocaleDateString() : ''}</p>
                          {proof.review_notes && (
                            <p className="text-xs text-zinc-500 mt-1 italic">Note: {proof.review_notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {proof.proof_file_url && (
                            <a href={proof.proof_file_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                              View proof
                            </a>
                          )}
                          {proof.status === 'PENDING' && (
                            <>
                              <button onClick={() => setReviewModal({ proofId: proof.id, action: 'approve' })}
                                className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors">
                                Approve
                              </button>
                              <button onClick={() => setReviewModal({ proofId: proof.id, action: 'reject' })}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors">
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
