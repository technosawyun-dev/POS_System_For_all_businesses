import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import type { PaymentProof } from '@/shared/types'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  EXPIRED:   'danger',
  SUSPENDED: 'warning',
  CANCELLED: 'default',
}

const PROOF_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success',
  PENDING:  'warning',
  REJECTED: 'danger',
}

function ReviewModal({ proofId, action, onClose }: { proofId: string; action: 'approve' | 'reject'; onClose: () => void }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      action === 'approve'
        ? subscriptionsService.adminApproveProof(proofId, notes || undefined)
        : subscriptionsService.adminRejectProof(proofId, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'proofs'] })
      toast.success(`Proof ${action}d`)
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100 capitalize">{action} Payment Proof</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">
          <label className="block text-xs text-zinc-400 mb-1">Review Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn
            variant={action === 'approve' ? 'success' : 'danger'}
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Processing…' : `Confirm ${action}`}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function ProofsTab() {
  const [proofsPage, setProofsPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewModal, setReviewModal] = useState<{ proofId: string; action: 'approve' | 'reject' } | null>(null)

  const proofsQuery = useQuery({
    queryKey: ['admin', 'proofs', proofsPage, statusFilter],
    queryFn: () => subscriptionsService.adminListProofs({
      page: proofsPage,
      page_size: 20,
      status: statusFilter || undefined,
    }),
    staleTime: 30_000,
  })

  const proofs = proofsQuery.data?.items ?? []

  return (
    <>
      {reviewModal && (
        <ReviewModal
          proofId={reviewModal.proofId}
          action={reviewModal.action}
          onClose={() => setReviewModal(null)}
        />
      )}

      <div className="max-w-4xl space-y-4">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setProofsPage(1) }}
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            <option value="">All statuses</option>
            {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {proofsQuery.isFetching && <Spinner size={16} />}
        </div>

        {proofsQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : proofs.length === 0 ? (
          <Empty title="No payment proofs" subtitle="No tenants have submitted payment proofs yet." />
        ) : (
          <div className="space-y-2">
            {proofs.map((proof: PaymentProof) => (
              <div key={proof.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-100 font-mono">
                        {proof.tenant_id.slice(0, 8)}…
                      </p>
                      <Badge variant={PROOF_VARIANT[proof.status] ?? 'default'} size="xs">
                        {proof.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      MMK {Number(proof.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      {proof.reference_number && ` · Ref: ${proof.reference_number}`}
                      {' · '}{fmtDate(proof.created_at)}
                    </p>
                    {proof.review_notes && (
                      <p className="text-xs text-zinc-600 mt-0.5 italic">Note: {proof.review_notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {proof.proof_file_url && (
                      <a
                        href={proof.proof_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        View proof
                      </a>
                    )}
                    {proof.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => setReviewModal({ proofId: proof.id, action: 'approve' })}
                          className="text-xs text-green-400 hover:text-green-300 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setReviewModal({ proofId: proof.id, action: 'reject' })}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(proofsQuery.data?.total_pages ?? 0) > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Btn variant="secondary" size="xs" disabled={proofsPage === 1} onClick={() => setProofsPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-500 self-center">{proofsPage} / {proofsQuery.data?.total_pages}</span>
                <Btn variant="secondary" size="xs" disabled={!proofsQuery.data?.has_next} onClick={() => setProofsPage(p => p + 1)}>Next</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function AdminSubscriptionsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'subscriptions' | 'proofs'>('subscriptions')
  const [page, setPage] = useState(1)
  const [reviewModal, setReviewModal] = useState<{ proofId: string; action: 'approve' | 'reject' } | null>(null)

  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: subscriptionsService.adminGetOverview,
  })

  const subsQuery = useQuery({
    queryKey: ['admin', 'subscriptions', page],
    queryFn: () => subscriptionsService.adminListSubscriptions({ page, page_size: 15 }),
    enabled: tab === 'subscriptions',
  })

  const ov = overviewQuery.data

  return (
    <>
      {reviewModal && (
        <ReviewModal
          proofId={reviewModal.proofId}
          action={reviewModal.action}
          onClose={() => setReviewModal(null)}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden">
        {/* Overview stats */}
        {ov && (
          <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-zinc-800 border-b border-zinc-800">
            {[
              { label: 'Total Tenants', value: ov.total_tenants },
              { label: 'Active', value: ov.active_subscriptions },
              { label: 'Trial', value: ov.trial_subscriptions },
              { label: 'Expired', value: ov.expired_subscriptions },
              { label: 'Suspended', value: ov.suspended_subscriptions },
              { label: 'Monthly Revenue', value: `MMK ${Number(ov.monthly_revenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
            ].map(stat => (
              <div key={stat.label} className="bg-zinc-950 px-3 py-3 text-center">
                <p className="text-xs text-zinc-500">{stat.label}</p>
                <p className="text-base font-bold text-zinc-100 mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex-shrink-0 flex items-center px-4 py-2 border-b border-zinc-800 gap-1">
          {(['subscriptions', 'proofs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
                tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
              )}
            >
              {t === 'subscriptions' ? 'All Subscriptions' : 'Payment Proofs'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'subscriptions' && (
            <div className="max-w-4xl">
              {subsQuery.isLoading ? (
                <div className="flex justify-center py-12"><Spinner size={28} /></div>
              ) : !subsQuery.data?.items.length ? (
                <Empty title="No subscriptions found" />
              ) : (
                <div className="space-y-2">
                  {subsQuery.data.items.map(sub => (
                    <div
                      key={sub.id}
                      onClick={() => navigate(`/super-admin/subscriptions/${sub.tenant_id}`)}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3.5 cursor-pointer transition-colors flex items-center gap-3 flex-wrap"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">
                          Tenant: <span className="font-mono text-xs text-zinc-400">{sub.tenant_id.slice(0, 8)}…</span>
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">{sub.plan.name} · expires {fmtDate(sub.expires_at)}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'} dot>{sub.status}</Badge>
                    </div>
                  ))}
                  {(subsQuery.data.total_pages ?? 0) > 1 && (
                    <div className="flex justify-center gap-2 pt-2">
                      <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                      <span className="text-xs text-zinc-500 self-center">{page} / {subsQuery.data.total_pages}</span>
                      <Btn variant="secondary" size="xs" disabled={!subsQuery.data.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'proofs' && <ProofsTab />}
        </div>
      </div>
    </>
  )
}
