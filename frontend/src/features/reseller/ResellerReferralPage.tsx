import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg, fmtDate } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { cn } from '@/shared/utils'
import { resellerFinanceService, type ReferralCodeResponse, type TenantReferralResponse } from '@/services/reseller_finance/reseller_finance.service'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import type { Plan, PaymentProof } from '@/shared/types'
import { ProofActionType } from '@/shared/types'
import axios from 'axios'
import { tokenStorage, BASE_URL } from '@/app/lib/axios'
import { useLocaleStore } from '@/i18n/localeStore'

// The API can live on a different origin than this app (e.g. a Vercel-hosted
// frontend + separate API domain), so a bare "/uploads/..." path from the
// backend resolves against the wrong host unless prefixed with the API's origin.
const API_ORIGIN = new URL(BASE_URL, window.location.origin).origin

//  Helpers

function CopyButton({ text }: { text: string }) {
  const t = useLocaleStore(s => s.t)
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
    >
      {copied ? t('reseller.copied') : t('common.copy')}
    </button>
  )
}

const SUB_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  EXPIRED:   'danger',
  SUSPENDED: 'warning',
  CANCELLED: 'default',
}

function ProofStatusBadge({ status }: { status: string }) {
  const variant = status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'danger' : 'warning'
  return <Badge variant={variant} size="xs">{status}</Badge>
}

export function PendingProofBadge() {
  const t = useLocaleStore(s => s.t)
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {t('reseller.proof_under_review')}
    </span>
  )
}

//  Authenticated file opener 

async function openProofFile(url: string) {
  try {
    // Use raw axios (no /api/v1 base URL) but inject the Bearer token manually
    const token = tokenStorage.getAccess()
    const absoluteUrl = /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`
    const res = await axios.get<Blob>(absoluteUrl, {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const blobUrl = URL.createObjectURL(res.data)
    const tab = window.open(blobUrl, '_blank')
    if (!tab) {
      const a = document.createElement('a')
      a.href = blobUrl; a.target = '_blank'; a.click()
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  } catch {
    toast.error(useLocaleStore.getState().t('reseller.could_not_load_proof'))
  }
}

//  Latest Proof Card (shared between user page and reseller modal) 

export function LatestProofCard({ proof }: { proof: PaymentProof }) {
  const t = useLocaleStore(s => s.t)
  const [opening, setOpening] = useState(false)
  const isImage = proof.proof_file_url.match(/\.(jpg|jpeg|png)(\?|$)/i)

  async function handleOpen() {
    setOpening(true)
    await openProofFile(proof.proof_file_url)
    setOpening(false)
  }

  return (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('reseller.last_uploaded_proof')}</p>
        <ProofStatusBadge status={proof.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-zinc-500">{t('reseller.amount_label')}</span>
          <p className="text-zinc-200 font-medium">{Number(proof.amount).toLocaleString()} {proof.currency}</p>
        </div>
        <div>
          <span className="text-zinc-500">{t('reseller.submitted_label')}</span>
          <p className="text-zinc-200">{fmtDate(proof.created_at)}</p>
        </div>
        {proof.action_type && (
          <div>
            <span className="text-zinc-500">{t('reseller.action_label')}</span>
            <p className="text-zinc-200 capitalize">{proof.action_type.toLowerCase().replace('_', ' ')}</p>
          </div>
        )}
        {proof.target_plan_name && (
          <div>
            <span className="text-zinc-500">{t('reseller.target_plan_label')}</span>
            <p className="text-zinc-200">{proof.target_plan_name}</p>
          </div>
        )}
        {proof.review_notes && (
          <div className="col-span-2">
            <span className="text-zinc-500">{t('reseller.review_note_label')}</span>
            <p className={cn('font-medium', proof.status === 'REJECTED' ? 'text-red-400' : 'text-zinc-200')}>{proof.review_notes}</p>
          </div>
        )}
      </div>
      <button
        onClick={handleOpen}
        disabled={opening}
        className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 disabled:opacity-50 transition-colors"
      >
        {opening ? t('reseller.opening') : isImage ? t('reseller.view_image') : t('reseller.view_file')}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
    </div>
  )
}

//  Upcoming Plan Card (shared between user page and reseller modal)

export function UpcomingPlanCard({
  plan, effectiveDate, paid, pendingReview,
}: {
  plan: Plan | null | undefined
  effectiveDate: string | null
  paid: boolean
  pendingReview: boolean
}) {
  const t = useLocaleStore(s => s.t)
  if (!plan) return null
  const price = Number(plan.price)
  // Free plans auto-activate on the effective date regardless of any payment
  // proof (see process_expired_subscriptions), so they're never "unpaid".
  const autoActivates = paid || price === 0

  return (
    <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-amber-400 uppercase tracking-wider mb-1">{t('reseller.upcoming_plan')}</p>
          <h3 className="text-lg font-bold text-zinc-100">{plan.name}</h3>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border flex-shrink-0',
          pendingReview ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : autoActivates ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400',
        )}>
          {pendingReview ? t('reseller.proof_under_review') : paid ? t('reseller.paid_check') : autoActivates ? t('reseller.free_no_payment') : t('reseller.payment_needed')}
        </span>
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-zinc-500 text-xs mb-0.5">{t('reseller.price_label')}</p>
          <p className="text-zinc-100 font-medium">
            {price === 0 ? t('reseller.free') : `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${plan.currency === 'MMK' ? t('currency.mmk') : plan.currency}`}
            {price > 0 && <span className="text-zinc-500 text-xs ml-1">/ {plan.billing_cycle.toLowerCase()}</span>}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs mb-0.5">{t('reseller.takes_effect_label')}</p>
          <p className="text-zinc-100">{effectiveDate ? fmtDate(effectiveDate) : '—'}</p>
        </div>
      </div>
      <p className="text-xs text-zinc-500 mt-3">
        {pendingReview
          ? t('reseller.pending_review_desc')
          : autoActivates
          ? `${t('reseller.auto_switch_pre')} ${plan.name} ${t('reseller.auto_switch_mid')} ${effectiveDate ? fmtDate(effectiveDate) : t('reseller.renewal_date_fallback')}${t('reseller.auto_switch_post')}${price > 0 ? t('reseller.auto_switch_renewal_note') : ''}`
          : `${t('reseller.payment_needed_pre')} ${effectiveDate ? fmtDate(effectiveDate) : t('reseller.renewal_date_fallback')} ${t('reseller.payment_needed_post')}`}
      </p>
    </div>
  )
}

//  Plan Picker Modal

function PlanPickerModal({
  mode, currentPlan, onClose, onConfirm,
}: {
  mode: 'upgrade' | 'downgrade'; currentPlan: Plan; onClose: () => void; onConfirm: (plan: Plan) => void
}) {
  const t = useLocaleStore(s => s.t)
  const modeWord = mode === 'upgrade' ? t('reseller.upgrade_word') : t('reseller.downgrade_word')
  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
  })
  const [selected, setSelected] = useState<Plan | null>(null)
  const currentPrice = Number(currentPlan.price)
  const plans = (data?.items ?? []).filter(p =>
    p.is_active && !p.is_custom && p.id !== currentPlan.id && !p.is_referral_plan &&
    (mode === 'upgrade' ? Number(p.price) > currentPrice : Number(p.price) < currentPrice),
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100 capitalize">{modeWord} {t('reseller.plan_word')}</h3>
          <button onClick={onClose} aria-label={t('common.close')} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : plans.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">{t('reseller.no_x_plans_available_pre')} {modeWord} {t('reseller.no_x_plans_available_post')}</p>
          ) : (
            plans.map(plan => (
              <button key={plan.id} onClick={() => setSelected(plan)}
                className={cn('w-full text-left px-4 py-3 rounded-xl border transition-all',
                  selected?.id === plan.id ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800')}>
                <p className="text-sm font-medium text-zinc-100">{plan.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {plan.currency === 'MMK' ? t('currency.mmk') : plan.currency} / {plan.billing_cycle.toLowerCase()}
                </p>
              </button>
            ))
          )}
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn size="sm" disabled={!selected} onClick={() => selected && onConfirm(selected)}>
            {t('common.confirm')} {modeWord}
          </Btn>
        </div>
      </div>
    </div>
  )
}

//  Proof Submit Modal (for reseller submitting on behalf of a business) 

function ResellerProofSubmitModal({
  title, subtitle, tenantId, actionType, targetPlanId, onClose, onSuccess,
}: {
  title: string; subtitle?: string; tenantId: string
  actionType: ProofActionType; targetPlanId?: string
  onClose: () => void; onSuccess: () => void
}) {
  const t = useLocaleStore(s => s.t)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MMK')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submitMutation = useMutation({
    mutationFn: (payload: Parameters<typeof resellerFinanceService.submitBusinessProof>[1]) =>
      resellerFinanceService.submitBusinessProof(tenantId, payload),
    onSuccess: () => { setDone(true); onSuccess() },
    onError: err => toast.error(extractApiMsg(err) ?? t('reseller.failed_submit_proof')),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileError(null); setUploadedUrl(null); setUploadProgress('idle')
    if (!f) { setFile(null); return }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
      setFileError(t('reseller.file_type_error')); setFile(null); return
    }
    if (f.size > 10 * 1024 * 1024) { setFileError(t('reseller.file_size_error')); setFile(null); return }
    setFile(f)
  }

  async function handleSubmit() {
    if (!amount || !file) return
    let proofUrl = uploadedUrl
    if (!proofUrl) {
      setUploadProgress('uploading')
      try {
        proofUrl = await resellerFinanceService.uploadBusinessProof(tenantId, file)
        setUploadedUrl(proofUrl); setUploadProgress('done')
      } catch (err: unknown) {
        setUploadProgress('idle')
        toast.error(extractApiMsg(err) ?? t('reseller.file_upload_failed'))
        return
      }
    }
    submitMutation.mutate({
      amount, currency,
      proof_file_url: proofUrl,
      action_type: actionType,
      ...(targetPlanId ? { target_plan_id: targetPlanId } : {}),
    })
  }

  const busy = uploadProgress === 'uploading' || submitMutation.isPending
  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">{done ? t('reseller.request_submitted') : title}</h3>
            {!done && subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        {done ? (
          <>
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-900/50 flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-100">{t('reseller.proof_submitted')}</p>
                <p className="text-sm text-zinc-400 mt-1">{t('reseller.team_will_review')}</p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-center">
              <Btn size="sm" onClick={onClose}>{t('reseller.done_btn')}</Btn>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('reseller.amount_paid_label')}</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('reseller.currency_label')}</label>
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="MMK" className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('reseller.receipt_file_label')}</label>
                <label className="block w-full cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="sr-only" />
                  <div className={cn('w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors',
                    file ? 'border-orange-500/60 bg-orange-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50')}>
                    {file ? (
                      <div>
                        <p className="text-sm text-zinc-200 font-medium truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB · {uploadProgress === 'done' ? <span className="text-green-400">{t('reseller.uploaded_label')}</span> : <span className="text-zinc-400">{t('reseller.click_to_change')}</span>}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">{t('reseller.click_select_receipt')}</p>
                    )}
                  </div>
                </label>
                {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
              <Btn variant="secondary" size="sm" onClick={onClose} disabled={busy}>{t('common.cancel')}</Btn>
              <Btn size="sm" disabled={!amount || !file || busy} onClick={handleSubmit}>
                {uploadProgress === 'uploading' ? t('reseller.uploading') : submitMutation.isPending ? t('reseller.submitting') : t('reseller.submit_proof')}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// 2-step Request Upgrade Modal (Trial/Referral plan businesses) 

function ResellerRequestUpgradeModal({ tenantId, currentPlan, onClose, onSuccess }: {
  tenantId: string; currentPlan: Plan; onClose: () => void; onSuccess: () => void
}) {
  const t = useLocaleStore(s => s.t)
  const [step, setStep] = useState<'plan' | 'proof' | 'done'>('plan')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MMK')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
  })

  const plans = (plansData?.items ?? []).filter(p =>
    p.is_active && !p.is_custom && !p.is_referral_plan && p.trial_days === 0 && Number(p.price) > 0 && p.id !== currentPlan.id
  ).sort((a, b) => Number(a.price) - Number(b.price))

  const submitMutation = useMutation({
    mutationFn: (payload: Parameters<typeof resellerFinanceService.submitBusinessProof>[1]) =>
      resellerFinanceService.submitBusinessProof(tenantId, payload),
    onSuccess: () => { setStep('done'); onSuccess() },
    onError: err => toast.error(extractApiMsg(err) ?? t('reseller.failed_submit')),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileError(null); setUploadedUrl(null); setUploadProgress('idle')
    if (!f) { setFile(null); return }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
      setFileError(t('reseller.file_type_error')); setFile(null); return
    }
    if (f.size > 10 * 1024 * 1024) { setFileError(t('reseller.file_size_error')); setFile(null); return }
    setFile(f)
  }

  async function handleSubmitProof() {
    if (!amount || !file || !selectedPlan) return
    let proofUrl = uploadedUrl
    if (!proofUrl) {
      setUploadProgress('uploading')
      try {
        proofUrl = await resellerFinanceService.uploadBusinessProof(tenantId, file)
        setUploadedUrl(proofUrl); setUploadProgress('done')
      } catch (err: unknown) {
        setUploadProgress('idle')
        toast.error(extractApiMsg(err) ?? t('reseller.file_upload_failed'))
        return
      }
    }
    submitMutation.mutate({
      amount, currency,
      reference_number: `Upgrade to: ${selectedPlan.name}`,
      proof_file_url: proofUrl,
      action_type: ProofActionType.UPGRADE,
      target_plan_id: selectedPlan.id,
    })
  }

  const busy = uploadProgress === 'uploading' || submitMutation.isPending
  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              {step === 'plan' ? t('reseller.choose_plan_title') : step === 'proof' ? t('reseller.submit_payment_proof_title') : t('reseller.request_submitted')}
            </h3>
            {step !== 'done' && <p className="text-xs text-zinc-500 mt-0.5">{t('reseller.step_label')} {step === 'plan' ? '1' : '2'} {t('reseller.of_2')}</p>}
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {step === 'plan' && (
          <>
            <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
              {plansLoading ? (
                <div className="flex justify-center py-8"><Spinner size={24} /></div>
              ) : plans.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">{t('reseller.no_paid_plans')}</p>
              ) : (
                plans.map(plan => (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                    className={cn('w-full text-left px-4 py-3 rounded-xl border transition-all',
                      selectedPlan?.id === plan.id ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800')}>
                    <p className="text-sm font-medium text-zinc-100">{plan.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {plan.currency === 'MMK' ? t('currency.mmk') : plan.currency} / {plan.billing_cycle.toLowerCase()}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
              <Btn variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Btn>
              <Btn size="sm" disabled={!selectedPlan} onClick={() => setStep('proof')}>{t('reseller.next_arrow')}</Btn>
            </div>
          </>
        )}

        {step === 'proof' && (
          <>
            <div className="p-5 space-y-4">
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">{t('reseller.upgrading_to')}</p>
                  <p className="text-sm font-semibold text-orange-400">{selectedPlan?.name}</p>
                </div>
                <p className="text-sm text-zinc-300">
                  {Number(selectedPlan?.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedPlan?.currency === 'MMK' ? t('currency.mmk') : selectedPlan?.currency} / {selectedPlan?.billing_cycle.toLowerCase()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('reseller.amount_paid_label')}</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('reseller.currency_label')}</label>
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="MMK" className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('reseller.receipt_file_label')}</label>
                <label className="block w-full cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="sr-only" />
                  <div className={cn('w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors',
                    file ? 'border-orange-500/60 bg-orange-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50')}>
                    {file ? (
                      <div>
                        <p className="text-sm text-zinc-200 font-medium truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {(file.size / 1024).toFixed(0)} KB · {uploadProgress === 'done' ? <span className="text-green-400">{t('reseller.uploaded_label')}</span> : <span className="text-zinc-400">{t('reseller.click_to_change')}</span>}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">{t('reseller.click_select_receipt')}</p>
                    )}
                  </div>
                </label>
                {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
              <Btn variant="secondary" size="sm" onClick={() => setStep('plan')} disabled={busy}>{t('reseller.back_arrow')}</Btn>
              <Btn size="sm" disabled={!amount || !file || busy} onClick={handleSubmitProof}>
                {uploadProgress === 'uploading' ? t('reseller.uploading') : submitMutation.isPending ? t('reseller.submitting') : t('reseller.submit_request')}
              </Btn>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-900/50 flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-100">{t('reseller.request_submitted')}</p>
                <p className="text-sm text-zinc-400 mt-1">
                  {t('reseller.upgrade_request_pre')} <span className="text-orange-400 font-medium">{selectedPlan?.name}</span> {t('reseller.upgrade_request_post')}
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-center">
              <Btn size="sm" onClick={onClose}>{t('reseller.done_btn')}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Manage Business Modal

const RESUBMIT_LABEL_KEY: Record<ProofActionType, string> = {
  [ProofActionType.UPGRADE]:            'reseller.upgrade_payment_label',
  [ProofActionType.DOWNGRADE]:          'reseller.downgrade_payment_label',
  [ProofActionType.RENEWAL]:            'reseller.renewal_payment_label',
  [ProofActionType.INITIAL_ACTIVATION]: 'reseller.payment_label',
}

function ManageBusinessModal({ referral, onClose }: { referral: TenantReferralResponse; onClose: () => void }) {
  const t = useLocaleStore(s => s.t)
  const qc = useQueryClient()
  type ModalMode = 'upgrade' | 'downgrade' | 'request-upgrade' | 'renew' | 'upgrade-proof' | 'resubmit-proof' | null
  const [modal, setModal] = useState<ModalMode>(null)
  const [upgradePlanId, setUpgradePlanId] = useState<string | null>(null)

  const { data: sub, isLoading: subLoading, error: subError } = useQuery({
    queryKey: ['reseller', 'business-sub', referral.tenant_id],
    queryFn: () => resellerFinanceService.getBusinessSubscription(referral.tenant_id),
    staleTime: 0,
  })

  const { data: latestProof, isLoading: proofLoading } = useQuery({
    queryKey: ['reseller', 'business-latest-proof', referral.tenant_id],
    queryFn: () => resellerFinanceService.getBusinessLatestProof(referral.tenant_id),
    staleTime: 0,
  })

  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
    enabled: !!sub && sub.status === 'ACTIVE',
    staleTime: 5 * 60 * 1000,
  })

  const downgradeMutation = useMutation({
    mutationFn: (planId: string) => resellerFinanceService.downgradeBusinessSubscription(referral.tenant_id, planId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reseller', 'business-sub', referral.tenant_id] })
      qc.invalidateQueries({ queryKey: ['reseller', 'referrals'] })
      toast.success(data.message ?? t('reseller.downgrade_scheduled'))
      setModal(null)
    },
    onError: err => toast.error(extractApiMsg(err) ?? t('reseller.failed_schedule_downgrade')),
  })

  function invalidateAfterProof() {
    qc.invalidateQueries({ queryKey: ['reseller', 'business-sub', referral.tenant_id] })
    qc.invalidateQueries({ queryKey: ['reseller', 'business-latest-proof', referral.tenant_id] })
    qc.invalidateQueries({ queryKey: ['reseller', 'referrals'] })
  }

  const isTrial = sub?.status === 'TRIAL'
  const isActive = sub?.status === 'ACTIVE'
  const isExpired = sub?.status === 'EXPIRED'
  const isReferralPlan = sub?.plan.is_referral_plan ?? false
  const isReferralOrTrial = isTrial || isReferralPlan
  const plan = sub?.plan

  const currentPrice = Number(plan?.price ?? 0)
  const activePaidPlans = (plansData?.items ?? []).filter(p => p.is_active && !p.is_custom && !p.is_referral_plan && Number(p.price) > 0)
  const hasHigherPlan = activePaidPlans.some(p => Number(p.price) > currentPrice)
  const hasLowerPlan = activePaidPlans.some(p => Number(p.price) < currentPrice)

  const pendingDowngradePlan = sub?.pending_downgrade_plan_id
    ? (plansData?.items ?? []).find(p => p.id === sub.pending_downgrade_plan_id)
    : null

  const pendingProofType = latestProof?.status === 'PENDING' ? latestProof.action_type : null
  const downgradeProofApproved =
    !!sub?.pending_downgrade_plan_id &&
    latestProof?.action_type === ProofActionType.DOWNGRADE &&
    latestProof?.status === 'APPROVED'

  return (
    <>
      {/* Sub-modals */}
      {modal === 'request-upgrade' && plan && (
        <ResellerRequestUpgradeModal
          tenantId={referral.tenant_id}
          currentPlan={plan}
          onClose={() => setModal(null)}
          onSuccess={invalidateAfterProof}
        />
      )}
      {modal === 'upgrade' && plan && (
        <PlanPickerModal
          mode="upgrade"
          currentPlan={plan}
          onClose={() => setModal(null)}
          onConfirm={p => { setUpgradePlanId(p.id); setModal(null) }}
        />
      )}
      {modal === 'downgrade' && plan && (
        <PlanPickerModal
          mode="downgrade"
          currentPlan={plan}
          onClose={() => setModal(null)}
          onConfirm={p => downgradeMutation.mutate(p.id)}
        />
      )}
      {modal === 'renew' && sub && (
        <ResellerProofSubmitModal
          title={sub.pending_downgrade_plan_id
            ? `${t('reseller.pay_for_prefix')} ${pendingDowngradePlan?.name ?? t('reseller.downgrade_plan_fallback')}`
            : t('reseller.submit_renewal_proof_title')}
          subtitle={sub.pending_downgrade_plan_id
            ? `${t('reseller.payment_new_plan_pre')}${sub.expires_at ? ` (${fmtDate(sub.expires_at)})` : ''}.`
            : t('reseller.upload_receipt_renewal')}
          tenantId={referral.tenant_id}
          actionType={sub.pending_downgrade_plan_id ? ProofActionType.DOWNGRADE : ProofActionType.RENEWAL}
          targetPlanId={sub.pending_downgrade_plan_id ?? undefined}
          onClose={() => setModal(null)}
          onSuccess={invalidateAfterProof}
        />
      )}
      {upgradePlanId && (
        <ResellerProofSubmitModal
          title={t('reseller.submit_upgrade_proof_title')}
          subtitle={t('reseller.upload_receipt_upgrade')}
          tenantId={referral.tenant_id}
          actionType={ProofActionType.UPGRADE}
          targetPlanId={upgradePlanId}
          onClose={() => setUpgradePlanId(null)}
          onSuccess={invalidateAfterProof}
        />
      )}
      {modal === 'resubmit-proof' && latestProof?.status === 'REJECTED' && (
        <ResellerProofSubmitModal
          title={`${t('reseller.resubmit_prefix')} ${t(RESUBMIT_LABEL_KEY[latestProof.action_type ?? ProofActionType.INITIAL_ACTIVATION])} ${t('reseller.proof_suffix')}`}
          subtitle={
            latestProof.target_plan_name
              ? `${t('reseller.previous_proof_for_prefix')} ${latestProof.target_plan_name} ${t('reseller.was_rejected')}${latestProof.review_notes ? `: "${latestProof.review_notes}"` : ''}. ${t('reseller.upload_new_receipt_retry')}`
              : `${t('reseller.previous_proof_prefix_generic')} ${t('reseller.was_rejected')}${latestProof.review_notes ? `: "${latestProof.review_notes}"` : ''}. ${t('reseller.upload_new_receipt_retry')}`
          }
          tenantId={referral.tenant_id}
          actionType={latestProof.action_type ?? ProofActionType.INITIAL_ACTIVATION}
          targetPlanId={latestProof.target_plan_id ?? undefined}
          onClose={() => setModal(null)}
          onSuccess={invalidateAfterProof}
        />
      )}

      {/* Main modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                {referral.tenant_name ?? `${t('reseller.business_word')} ${referral.tenant_id.slice(0, 8)}…`}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">{t('reseller.manage_subscription')}</p>
            </div>
            <button onClick={onClose} aria-label={t('common.close')} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {subLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : subError || !sub ? (
              <div className="text-center py-10 text-zinc-500 text-sm">
                {t('reseller.could_not_load_subscription')}
              </div>
            ) : (
              <>
                {/* Subscription card */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">{t('reseller.current_plan_label')}</p>
                      <h4 className="text-lg font-bold text-zinc-100">{plan?.name}</h4>
                      {isReferralPlan && (
                        <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded px-1.5 py-0.5">{t('reseller.referral_trial_badge')}</span>
                      )}
                    </div>
                    <Badge variant={SUB_STATUS_VARIANT[sub.status] ?? 'default'} size="md" dot>{sub.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-zinc-500 mb-0.5">{t('reseller.price_label')}</p>
                      <p className="text-zinc-200 font-medium">
                        {Number(plan?.price ?? 0) === 0 ? t('reseller.free') : `${Number(plan?.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${plan?.currency === 'MMK' ? t('currency.mmk') : plan?.currency}`}
                        {Number(plan?.price ?? 0) > 0 && <span className="text-zinc-500 ml-1">/ {plan?.billing_cycle.toLowerCase()}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">{t('reseller.started_label')}</p>
                      <p className="text-zinc-200">{fmtDate(sub.started_at)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">{t('reseller.expires_label')}</p>
                      <p className={cn('font-medium', isExpired ? 'text-red-400' : 'text-zinc-200')}>
                        {sub.expires_at ? fmtDate(sub.expires_at) : t('reseller.never_label')}
                      </p>
                    </div>
                    {isTrial && sub.trial_ends_at && (
                      <div>
                        <p className="text-zinc-500 mb-0.5">{t('reseller.trial_ends_label')}</p>
                        <p className="text-amber-400">{fmtDate(sub.trial_ends_at)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {sub.pending_downgrade_plan_id && (
                  <UpcomingPlanCard
                    plan={pendingDowngradePlan}
                    effectiveDate={sub.expires_at}
                    paid={downgradeProofApproved}
                    pendingReview={pendingProofType === ProofActionType.DOWNGRADE}
                  />
                )}

                {/* Actions */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{t('reseller.actions_label')}</p>
                  {isReferralOrTrial && (
                    <p className="text-xs text-zinc-500 mb-3">{t('reseller.submit_proof_upgrade_hint')}</p>
                  )}
                  {isExpired && Number(plan?.price ?? 0) > 0 && (
                    <p className="text-xs text-zinc-500 mb-3">
                      {t('reseller.business_plan_expired_pre')} <span className="text-zinc-300">{plan?.name}</span> {t('reseller.business_plan_expired_post')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {isReferralOrTrial && (
                      pendingProofType === ProofActionType.UPGRADE ? (
                        <PendingProofBadge />
                      ) : (
                        <Btn size="sm" onClick={() => setModal('request-upgrade')}>
                          {t('reseller.request_upgrade_btn')}
                        </Btn>
                      )
                    )}
                    {isExpired && Number(plan?.price ?? 0) > 0 && (
                      pendingProofType ? (
                        <PendingProofBadge />
                      ) : (
                        <>
                          <Btn size="sm" onClick={() => setModal('renew')}>
                            {t('reseller.pay_to_reactivate')}
                          </Btn>
                          <Btn variant="secondary" size="sm" onClick={() => setModal('request-upgrade')}>
                            {t('reseller.switch_plan')}
                          </Btn>
                        </>
                      )
                    )}
                    {isActive && !isReferralPlan && (
                      <>
                        {hasHigherPlan && (
                          pendingProofType === ProofActionType.UPGRADE ? (
                            <PendingProofBadge />
                          ) : (
                            <Btn size="sm" onClick={() => setModal('upgrade')}>
                              {t('reseller.upgrade_plan_btn')}
                            </Btn>
                          )
                        )}
                        {/* Hidden while an upgrade proof is pending review —
                            see CurrentSubscriptionPage for why. */}
                        {hasLowerPlan && !sub.pending_downgrade_plan_id && pendingProofType !== ProofActionType.UPGRADE && (
                          <Btn variant="secondary" size="sm" onClick={() => setModal('downgrade')} disabled={downgradeMutation.isPending}>
                            {t('reseller.downgrade_plan_btn')}
                          </Btn>
                        )}
                        {sub.pending_downgrade_plan_id ? (
                          pendingProofType === ProofActionType.DOWNGRADE ? (
                            <PendingProofBadge />
                          ) : downgradeProofApproved || Number(pendingDowngradePlan?.price ?? -1) === 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500/10 border border-green-500/30 text-green-400">
                              {t('reseller.downgrade_to_prefix')} {pendingDowngradePlan?.name ?? t('reseller.lower_plan_fallback')} {t('reseller.scheduled_suffix')}{sub.expires_at ? ` ${t('reseller.for_date_prefix')} ${fmtDate(sub.expires_at)}` : ''}
                            </span>
                          ) : (
                            <Btn variant="secondary" size="sm" onClick={() => setModal('renew')}>
                              {t('reseller.pay_for_prefix')} {pendingDowngradePlan?.name ?? t('reseller.downgrade_plan_fallback')}
                            </Btn>
                          )
                        ) : (
                          pendingProofType === ProofActionType.RENEWAL ? (
                            <PendingProofBadge />
                          ) : (
                            <Btn variant="secondary" size="sm" onClick={() => setModal('renew')}>
                              {t('reseller.renew_now')}
                            </Btn>
                          )
                        )}
                      </>
                    )}
                    {!isReferralOrTrial && !isExpired && !isActive && (
                      <p className="text-xs text-zinc-600">{t('reseller.no_actions_available')}</p>
                    )}
                  </div>
                </div>

                {/* Latest proof */}
                {proofLoading ? (
                  <div className="flex justify-center py-4"><Spinner size={18} /></div>
                ) : latestProof ? (
                  <div>
                    <LatestProofCard proof={latestProof} />
                    {latestProof.status === 'REJECTED' && (
                      <Btn size="sm" className="mt-3" onClick={() => setModal('resubmit-proof')}>
                        {t('reseller.resubmit_proof_btn')}
                      </Btn>
                    )}
                  </div>
                ) : (
                  <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-zinc-600">{t('reseller.no_proof_uploaded')}</p>
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

//  Primary Promo Code Card 

function PrimaryCodeCard({ codes }: { codes: ReferralCodeResponse[] }) {
  const t = useLocaleStore(s => s.t)
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [showLink, setShowLink] = useState(false)

  const activeCode = codes.find(c => c.is_active) ?? codes[0] ?? null

  const { data: linkData } = useQuery({
    queryKey: ['reseller', 'referral-link', activeCode?.id],
    queryFn: () => resellerFinanceService.getReferralLink(activeCode!.id),
    enabled: showLink && !!activeCode,
  })

  const createMutation = useMutation({
    mutationFn: (code: string) => resellerFinanceService.createCode(code || undefined),
    onSuccess: async (created) => {
      if (activeCode) await resellerFinanceService.deactivateCode(activeCode.id)
      qc.invalidateQueries({ queryKey: ['reseller', 'referral-codes'] })
      toast.success(`${t('reseller.promo_updated_prefix')} ${created.code}`)
      setEditing(false); setNewCode('')
    },
    onError: err => toast.error(extractApiMsg(err) ?? t('reseller.failed_update_code')),
  })

  const createFirstMutation = useMutation({
    mutationFn: () => resellerFinanceService.createCode(undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller', 'referral-codes'] })
      toast.success(t('reseller.promo_code_created'))
    },
    onError: err => toast.error(extractApiMsg(err) ?? t('reseller.failed_create_code')),
  })

  if (!activeCode) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
        <div className="text-4xl">🔗</div>
        <div>
          <p className="text-zinc-300 font-semibold">{t('reseller.no_promo_code')}</p>
          <p className="text-zinc-500 text-sm mt-1">{t('reseller.generate_promo_hint')}</p>
        </div>
        <Btn size="sm" onClick={() => createFirstMutation.mutate()} loading={createFirstMutation.isPending}>
          {t('reseller.generate_promo_code_btn')}
        </Btn>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('reseller.your_promo_code')}</h2>
        <Badge variant={activeCode.is_active ? 'success' : 'warning'} size="xs">
          {activeCode.is_active ? t('status.active') : t('status.inactive')}
        </Badge>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">{t('reseller.new_code_label')}</label>
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder={t('reseller.new_code_placeholder')}
              maxLength={20}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-zinc-100 tracking-widest focus:outline-none focus:border-orange-500 uppercase"
            />
            <p className="text-[11px] text-zinc-600 mt-1">{t('reseller.new_code_hint')}</p>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" disabled={newCode.length < 4 || createMutation.isPending} onClick={() => createMutation.mutate(newCode)}>
              {createMutation.isPending ? t('common.saving') : t('reseller.save_code')}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setNewCode('') }}>{t('common.cancel')}</Btn>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono text-4xl font-black text-orange-400 tracking-widest">{activeCode.code}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <CopyButton text={activeCode.code} />
            <button
              onClick={() => setShowLink(v => !v)}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
            >
              {showLink ? t('reseller.hide_link') : t('reseller.get_link')}
            </button>
            <button
              onClick={() => { setEditing(true); setNewCode(activeCode.code) }}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
            >
              {t('common.edit')}
            </button>
          </div>
        </div>
      )}

      {showLink && linkData && (
        <div className="bg-zinc-800 rounded-xl px-3 py-2.5 flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-mono truncate flex-1">{linkData.referral_url}</span>
          <CopyButton text={linkData.referral_url} />
        </div>
      )}

      <p className="text-[11px] text-zinc-600">
        {t('reseller.share_code_hint')}
      </p>
    </div>
  )
}

//  Main Page 

export default function ResellerReferralPage() {
  const t = useLocaleStore(s => s.t)
  const [managingReferral, setManagingReferral] = useState<TenantReferralResponse | null>(null)

  const { data: codesData, isLoading: codesLoading } = useQuery({
    queryKey: ['reseller', 'referral-codes'],
    queryFn: () => resellerFinanceService.listMyCodes({ page_size: 100 }),
    staleTime: 60_000,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['reseller', 'referral-stats'],
    queryFn: resellerFinanceService.getReferralStats,
    staleTime: 60_000,
  })

  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ['reseller', 'referrals', 1],
    queryFn: () => resellerFinanceService.listMyReferrals({ page: 1, page_size: 50 }),
    staleTime: 60_000,
  })

  const codes = codesData?.items ?? []

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {managingReferral && (
        <ManageBusinessModal referral={managingReferral} onClose={() => setManagingReferral(null)} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{t('reseller.referrals')}</h1>
        <p className="text-zinc-500 text-sm mt-1">{t('reseller.referral_page_subtitle')}</p>
      </div>

      {/* Promo code card */}
      {codesLoading ? (
        <div className="flex justify-center py-8"><Spinner size={24} /></div>
      ) : (
        <PrimaryCodeCard codes={codes} />
      )}

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t('reseller.performance_heading')}</h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse">
                <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
                <div className="h-7 w-16 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('reseller.total_referrals'), value: stats?.total_referrals ?? 0 },
              { label: t('reseller.converted'), value: stats?.converted_referrals ?? 0, sub: t('reseller.paying_customers') },
              { label: t('reseller.in_trial'), value: stats?.trial_referrals ?? 0 },
              { label: t('reseller.conversion_rate'), value: `${stats?.conversion_rate ?? 0}%` },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-zinc-100 tabular-nums">{s.value}</p>
                {s.sub && <p className="text-xs text-zinc-600 mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referred businesses */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          {t('reseller.referred_businesses_heading')} {referrals?.total ? `(${referrals.total})` : ''}
        </h2>
        {referralsLoading ? (
          <div className="flex justify-center py-6"><Spinner size={20} /></div>
        ) : !referrals?.items.length ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-600 text-sm">
            {t('reseller.no_businesses_referred')}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">{t('reseller.business_column')}</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">{t('reseller.code_used_column')}</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden md:table-cell">{t('reseller.referred_column')}</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">{t('settings.status')}</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">{t('reseller.expires_label')}</th>
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium text-right">{t('reseller.action_label')}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.items.map(r => (
                  <tr key={r.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-zinc-200 text-sm font-medium">
                        {r.tenant_name ?? `${t('reseller.business_word')} ${r.tenant_id.slice(0, 8)}…`}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-mono text-amber-400 text-xs tracking-wider bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
                        {r.referral_code_snapshot}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">
                      {new Date(r.referred_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {r.subscription_status ? (
                        <Badge variant={SUB_STATUS_VARIANT[r.subscription_status] ?? 'default'} size="xs">
                          {r.subscription_status}
                        </Badge>
                      ) : (
                        <Badge variant={r.locked_at ? 'success' : 'warning'} size="xs">
                          {r.locked_at ? t('reseller.converted') : t('reseller.trial_label')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell">
                      {r.subscription_expires_at ? (
                        <span className={cn(
                          'font-medium',
                          r.subscription_status === 'EXPIRED' ? 'text-red-400' :
                          r.subscription_status === 'ACTIVE' ? 'text-zinc-200' : 'text-zinc-500',
                        )}>
                          {fmtDate(r.subscription_expires_at)}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setManagingReferral(r)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 border border-orange-500/25 hover:border-orange-500/40 transition-all"
                      >
                        {t('reseller.manage_btn')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
