import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, fmtDateTime, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { useAuthStore } from '@/store/auth.store'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { apiClient, BASE_URL } from '@/app/lib/axios'
import type { PaymentProofCreateRequest } from '@/shared/types'
import { useLocaleStore } from '@/i18n/localeStore'

// The API can live on a different origin than this app (e.g. a Vercel-hosted
// frontend + separate API domain), so a bare "/uploads/..." path from the
// backend resolves against the wrong host unless prefixed with the API's origin.
const API_ORIGIN = new URL(BASE_URL, window.location.origin).origin

async function openProofFile(url: string, t: (k: string) => string) {
  const token = localStorage.getItem('sawyunpos_access_token') ?? ''
  try {
    const absoluteUrl = /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`
    const res = await fetch(absoluteUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  } catch {
    toast.error(t('subscription.could_not_load_proof_file'))
  }
}

const PROOF_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success',
  PENDING:  'warning',
  REJECTED: 'danger',
}

const CHANGE_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ACTIVATED:     'success',
  RENEWED:       'success',
  UPGRADED:      'info',
  DOWNGRADED:    'warning',
  TRIAL_STARTED: 'info',
  EXPIRED:       'danger',
  SUSPENDED:     'warning',
  CANCELLED:     'danger',
  EXTENDED:      'success',
  PLAN_CHANGED:  'info',
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,application/pdf'
const MAX_MB = 10

function proofStatusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    APPROVED: t('subscription.status_approved'),
    PENDING: t('status.pending'),
    REJECTED: t('subscription.status_rejected'),
  }
  return map[status] ?? status
}

function changeTypeLabel(type: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    ACTIVATED: t('subscription.change_type_activated'),
    RENEWED: t('subscription.change_type_renewed'),
    UPGRADED: t('subscription.change_type_upgraded'),
    DOWNGRADED: t('subscription.change_type_downgraded'),
    TRIAL_STARTED: t('subscription.change_type_trial_started'),
    EXPIRED: t('subscription.change_type_expired'),
    SUSPENDED: t('subscription.change_type_suspended'),
    CANCELLED: t('subscription.change_type_cancelled'),
    EXTENDED: t('subscription.change_type_extended'),
    PLAN_CHANGED: t('subscription.change_type_plan_changed'),
  }
  return map[type] ?? type.replace(/_/g, ' ')
}

function SubmitProofModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const t = useLocaleStore(s => s.t)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MMK')
  const [reference, setReference] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileError(null)
    setUploadedUrl(null)
    setUploadProgress('idle')
    if (!f) { setFile(null); return }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
      setFileError(t('subscription.file_type_error'))
      setFile(null)
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`${t('subscription.file_size_error_prefix')} ${MAX_MB} MB`)
      setFile(null)
      return
    }
    setFile(f)
  }

  const submitMutation = useMutation({
    mutationFn: subscriptionsService.submitPaymentProof,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription', 'proofs'] })
      toast.success(t('subscription.payment_proof_submitted'))
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? t('subscription.failed_to_submit')),
  })

  async function handleSubmit() {
    if (!amount || !file) return
    let proofUrl = uploadedUrl

    if (!proofUrl) {
      setUploadProgress('uploading')
      try {
        proofUrl = await subscriptionsService.uploadProofFile(file)
        setUploadedUrl(proofUrl)
        setUploadProgress('done')
      } catch (err: any) {
        setUploadProgress('idle')
        toast.error(extractApiMsg(err) ?? t('subscription.file_upload_failed'))
        return
      }
    }

    submitMutation.mutate({
      amount,
      currency,
      reference_number: reference || undefined,
      proof_file_url: proofUrl,
    } as any)
  }

  const busy = uploadProgress === 'uploading' || submitMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">{t('subscription.submit_payment_proof')}</h3>
          <button onClick={onClose} aria-label={t('common.close')} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('subscription.amount_required')}</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.currency')}</label>
              <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder={t('currency.mmk')}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t('subscription.reference_number')}</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="TXN-12345"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t('subscription.receipt_file_required')} (JPG, PNG, PDF — {t('subscription.max_size_prefix')} {MAX_MB} MB)</label>
            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileChange}
                className="sr-only"
              />
              <div className={`w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors ${
                file
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
              }`}>
                {file ? (
                  <div>
                    <p className="text-sm text-zinc-200 font-medium truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {(file.size / 1024).toFixed(0)} KB ·{' '}
                      {uploadProgress === 'done' ? (
                        <span className="text-green-400">{t('subscription.uploaded')}</span>
                      ) : (
                        <span className="text-zinc-400">{t('subscription.click_to_change')}</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">{t('subscription.click_to_select_receipt')}</p>
                )}
              </div>
            </label>
            {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={busy}>{t('common.cancel')}</Btn>
          <Btn
            size="sm"
            disabled={!amount || !file || busy}
            onClick={handleSubmit}
          >
            {uploadProgress === 'uploading' ? t('subscription.uploading') : submitMutation.isPending ? t('subscription.submitting') : t('subscription.submit')}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function BillingHistoryPage() {
  const user = useAuthStore(s => s.user)
  const t = useLocaleStore(s => s.t)
  const isOwner = user?.role === 'BUSINESS_OWNER'
  const [tab, setTab] = useState<'history' | 'proofs'>('proofs')
  const [showModal, setShowModal] = useState(false)
  const [proofsPage, setProofsPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)

  const proofsQuery = useQuery({
    queryKey: ['subscription', 'proofs', proofsPage],
    queryFn: () => subscriptionsService.listPaymentProofs({ page: proofsPage, page_size: 10 }),
  })

  // Decoupled from proofsPage so the button's visibility reflects the true latest
  // proof, not just item 0 of whichever page the owner happens to be browsing.
  const latestProofQuery = useQuery({
    queryKey: ['subscription', 'proofs', 'latest'],
    queryFn: () => subscriptionsService.listPaymentProofs({ page: 1, page_size: 1 }),
  })

  const historyQuery = useQuery({
    queryKey: ['subscription', 'history', historyPage],
    queryFn: () => subscriptionsService.getHistory({ page: historyPage, page_size: 10 }),
  })

  // This button is only for the plain "activate/renew whatever plan I'm already on"
  // flow — upgrade/downgrade/renewal proofs are submitted from their own dedicated
  // modals on the Current Plan page, which know which target plan to reactivate on
  // approval. A rejected proof that WAS for a specific plan (target_plan_id set) must
  // be resubmitted from there instead — submitting a fresh generic proof here would
  // silently just renew the current plan rather than applying that plan change, which
  // is exactly the confusing no-op this is guarding against. Proofs are newest-first.
  const latestProof = latestProofQuery.data?.items[0]
  const canSubmitProof = !latestProof || (latestProof.status === 'REJECTED' && !latestProof.target_plan_id)
  const needsResubmitOnPlanPage = latestProof?.status === 'REJECTED' && !!latestProof.target_plan_id

  return (
    <>
      {showModal && <SubmitProofModal onClose={() => setShowModal(false)} />}

      <div className="h-full flex flex-col overflow-hidden">
        {/* Sub-tab bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex gap-1">
            {(['proofs', 'history'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
                  tab === tabKey ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
                )}
              >
                {tabKey === 'proofs' ? t('subscription.payment_proofs') : t('subscription.change_history')}
              </button>
            ))}
          </div>
          {isOwner && tab === 'proofs' && !latestProofQuery.isLoading && canSubmitProof && (
            <Btn size="sm" onClick={() => setShowModal(true)}>{t('subscription.submit_proof')}</Btn>
          )}
          {isOwner && tab === 'proofs' && needsResubmitOnPlanPage && (
            <Link to="/app/subscription/current" className="text-xs text-amber-400 hover:text-amber-300 font-medium">
              {t('subscription.resubmit_from_current_plan')}
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl">
            {/* Payment Proofs tab */}
            {tab === 'proofs' && (
              <>
                {proofsQuery.isLoading ? (
                  <div className="flex justify-center py-12"><Spinner size={28} /></div>
                ) : !proofsQuery.data?.items.length ? (
                  <Empty title={t('subscription.no_payment_proofs_yet')} />
                ) : (
                  <div className="space-y-3">
                    {proofsQuery.data.items.map(proof => (
                      <div key={proof.id} className={`bg-zinc-900 border rounded-2xl p-4 ${
                        proof.status === 'REJECTED' ? 'border-red-900/50' :
                        proof.status === 'APPROVED' ? 'border-green-900/50' : 'border-zinc-800'
                      }`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-zinc-100">
                              {Number(proof.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {proof.currency === 'MMK' ? t('currency.mmk') : proof.currency}
                            </p>
                            {proof.target_plan_name && (
                              <p className="text-xs text-green-400 font-medium">→ {proof.target_plan_name}</p>
                            )}
                            {proof.reference_number && (
                              <p className="text-sm text-zinc-400">{t('subscription.ref_prefix')} {proof.reference_number}</p>
                            )}
                            <p className="text-sm text-zinc-500">{fmtDate(proof.created_at)}</p>
                          </div>
                          <Badge variant={PROOF_VARIANT[proof.status] ?? 'default'} dot>
                            {proofStatusLabel(proof.status, t)}
                          </Badge>
                        </div>

                        {/* Review result — shown prominently when reviewed */}
                        {proof.reviewed_at && (
                          <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                            proof.status === 'APPROVED'
                              ? 'bg-green-900/20 border border-green-800/40 text-green-300'
                              : 'bg-red-900/20 border border-red-800/40 text-red-300'
                          }`}>
                            <p className="font-medium">
                              {proof.status === 'APPROVED' ? `✓ ${t('subscription.status_approved')}` : `✗ ${t('subscription.status_rejected')}`} · {fmtDate(proof.reviewed_at)}
                            </p>
                            {proof.review_notes ? (
                              <p className="mt-0.5 text-xs opacity-90">{proof.review_notes}</p>
                            ) : (
                              <p className="mt-0.5 text-xs opacity-60 italic">{t('subscription.no_notes_provided')}</p>
                            )}
                          </div>
                        )}

                        {proof.proof_file_url && (
                          <button
                            onClick={() => openProofFile(proof.proof_file_url, t)}
                            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-amber-400 hover:text-amber-300"
                          >
                            {t('subscription.view_proof')}
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {proofsQuery.data.total_pages > 1 && (
                      <div className="flex justify-center gap-2 pt-2">
                        <Btn variant="secondary" size="xs" disabled={proofsPage === 1} onClick={() => setProofsPage(p => p - 1)}>{t('common.prev')}</Btn>
                        <span className="text-xs text-zinc-500 self-center">{proofsPage} / {proofsQuery.data.total_pages}</span>
                        <Btn variant="secondary" size="xs" disabled={!proofsQuery.data.has_next} onClick={() => setProofsPage(p => p + 1)}>{t('common.next')}</Btn>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* History tab */}
            {tab === 'history' && (
              <>
                {historyQuery.isLoading ? (
                  <div className="flex justify-center py-12"><Spinner size={28} /></div>
                ) : !historyQuery.data?.items.length ? (
                  <Empty title={t('subscription.no_subscription_history')} />
                ) : (
                  <div className="space-y-2">
                    {historyQuery.data.items.map(h => (
                      <div key={h.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                        <Badge variant={CHANGE_VARIANT[h.change_type] ?? 'default'} size="xs">
                          {changeTypeLabel(h.change_type, t)}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          {h.note && <p className="text-xs text-zinc-400 truncate">{h.note}</p>}
                        </div>
                        <span className="text-xs text-zinc-600 flex-shrink-0">{fmtDateTime(h.created_at)}</span>
                      </div>
                    ))}
                    {historyQuery.data.total_pages > 1 && (
                      <div className="flex justify-center gap-2 pt-2">
                        <Btn variant="secondary" size="xs" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>{t('common.prev')}</Btn>
                        <span className="text-xs text-zinc-500 self-center">{historyPage} / {historyQuery.data.total_pages}</span>
                        <Btn variant="secondary" size="xs" disabled={!historyQuery.data.has_next} onClick={() => setHistoryPage(p => p + 1)}>{t('common.next')}</Btn>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
