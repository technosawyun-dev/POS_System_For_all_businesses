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
import { tokenStorage } from '@/app/lib/axios'

//  Helpers 

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
    >
      {copied ? 'Copied!' : 'Copy'}
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
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Proof Under Review
    </span>
  )
}

//  Authenticated file opener 

async function openProofFile(url: string) {
  try {
    // Use raw axios (no /api/v1 base URL) but inject the Bearer token manually
    const token = tokenStorage.getAccess()
    const res = await axios.get<Blob>(url, {
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
    toast.error('Could not load proof file')
  }
}

//  Latest Proof Card (shared between user page and reseller modal) 

export function LatestProofCard({ proof }: { proof: PaymentProof }) {
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
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Last Uploaded Proof</p>
        <ProofStatusBadge status={proof.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-zinc-500">Amount</span>
          <p className="text-zinc-200 font-medium">{Number(proof.amount).toLocaleString()} {proof.currency}</p>
        </div>
        <div>
          <span className="text-zinc-500">Submitted</span>
          <p className="text-zinc-200">{fmtDate(proof.created_at)}</p>
        </div>
        {proof.action_type && (
          <div>
            <span className="text-zinc-500">Action</span>
            <p className="text-zinc-200 capitalize">{proof.action_type.toLowerCase().replace('_', ' ')}</p>
          </div>
        )}
        {proof.target_plan_name && (
          <div>
            <span className="text-zinc-500">Target Plan</span>
            <p className="text-zinc-200">{proof.target_plan_name}</p>
          </div>
        )}
        {proof.review_notes && (
          <div className="col-span-2">
            <span className="text-zinc-500">Review Note</span>
            <p className={cn('font-medium', proof.status === 'REJECTED' ? 'text-red-400' : 'text-zinc-200')}>{proof.review_notes}</p>
          </div>
        )}
      </div>
      <button
        onClick={handleOpen}
        disabled={opening}
        className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 disabled:opacity-50 transition-colors"
      >
        {opening ? 'Opening…' : isImage ? 'View Image' : 'View File'}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
    </div>
  )
}

//  Plan Picker Modal 

function PlanPickerModal({
  mode, currentPlan, onClose, onConfirm,
}: {
  mode: 'upgrade' | 'downgrade'; currentPlan: Plan; onClose: () => void; onConfirm: (plan: Plan) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
  })
  const [selected, setSelected] = useState<Plan | null>(null)
  const currentPrice = Number(currentPlan.price)
  const plans = (data?.items ?? []).filter(p =>
    p.is_active && p.id !== currentPlan.id && !p.is_referral_plan &&
    (mode === 'upgrade' ? Number(p.price) > currentPrice : Number(p.price) < currentPrice),
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100 capitalize">{mode} Plan</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : plans.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">No {mode} plans available</p>
          ) : (
            plans.map(plan => (
              <button key={plan.id} onClick={() => setSelected(plan)}
                className={cn('w-full text-left px-4 py-3 rounded-xl border transition-all',
                  selected?.id === plan.id ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800')}>
                <p className="text-sm font-medium text-zinc-100">{plan.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency} / {plan.billing_cycle.toLowerCase()}
                </p>
              </button>
            ))
          )}
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={!selected} onClick={() => selected && onConfirm(selected)}>
            Confirm {mode}
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
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to submit proof'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileError(null); setUploadedUrl(null); setUploadProgress('idle')
    if (!f) { setFile(null); return }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
      setFileError('Only JPG, PNG, or PDF files are accepted'); setFile(null); return
    }
    if (f.size > 10 * 1024 * 1024) { setFileError('File must be under 10 MB'); setFile(null); return }
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
        toast.error(extractApiMsg(err) ?? 'File upload failed')
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
            <h3 className="text-base font-semibold text-zinc-100">{done ? 'Request Submitted' : title}</h3>
            {!done && subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
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
                <p className="text-base font-semibold text-zinc-100">Proof Submitted</p>
                <p className="text-sm text-zinc-400 mt-1">Our team will review the payment and process the request.</p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-center">
              <Btn size="sm" onClick={onClose}>Done</Btn>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Amount Paid *</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="MMK" className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Receipt File * (JPG, PNG, PDF — max 10 MB)</label>
                <label className="block w-full cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="sr-only" />
                  <div className={cn('w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors',
                    file ? 'border-orange-500/60 bg-orange-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50')}>
                    {file ? (
                      <div>
                        <p className="text-sm text-zinc-200 font-medium truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB · {uploadProgress === 'done' ? <span className="text-green-400">Uploaded</span> : <span className="text-zinc-400">Click to change</span>}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">Click to select a receipt file</p>
                    )}
                  </div>
                </label>
                {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
              <Btn variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Btn>
              <Btn size="sm" disabled={!amount || !file || busy} onClick={handleSubmit}>
                {uploadProgress === 'uploading' ? 'Uploading…' : submitMutation.isPending ? 'Submitting…' : 'Submit Proof'}
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
    p.is_active && !p.is_referral_plan && p.trial_days === 0 && Number(p.price) > 0 && p.id !== currentPlan.id
  ).sort((a, b) => Number(a.price) - Number(b.price))

  const submitMutation = useMutation({
    mutationFn: (payload: Parameters<typeof resellerFinanceService.submitBusinessProof>[1]) =>
      resellerFinanceService.submitBusinessProof(tenantId, payload),
    onSuccess: () => { setStep('done'); onSuccess() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to submit'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileError(null); setUploadedUrl(null); setUploadProgress('idle')
    if (!f) { setFile(null); return }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
      setFileError('Only JPG, PNG, or PDF files are accepted'); setFile(null); return
    }
    if (f.size > 10 * 1024 * 1024) { setFileError('File must be under 10 MB'); setFile(null); return }
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
        toast.error(extractApiMsg(err) ?? 'File upload failed')
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
              {step === 'plan' ? 'Choose a Plan' : step === 'proof' ? 'Submit Payment Proof' : 'Request Submitted'}
            </h3>
            {step !== 'done' && <p className="text-xs text-zinc-500 mt-0.5">Step {step === 'plan' ? '1' : '2'} of 2</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {step === 'plan' && (
          <>
            <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
              {plansLoading ? (
                <div className="flex justify-center py-8"><Spinner size={24} /></div>
              ) : plans.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">No paid plans available</p>
              ) : (
                plans.map(plan => (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                    className={cn('w-full text-left px-4 py-3 rounded-xl border transition-all',
                      selectedPlan?.id === plan.id ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800')}>
                    <p className="text-sm font-medium text-zinc-100">{plan.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency} / {plan.billing_cycle.toLowerCase()}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
              <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" disabled={!selectedPlan} onClick={() => setStep('proof')}>Next →</Btn>
            </div>
          </>
        )}

        {step === 'proof' && (
          <>
            <div className="p-5 space-y-4">
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Upgrading to</p>
                  <p className="text-sm font-semibold text-orange-400">{selectedPlan?.name}</p>
                </div>
                <p className="text-sm text-zinc-300">
                  {Number(selectedPlan?.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedPlan?.currency === 'MMK' ? 'Kyats' : selectedPlan?.currency} / {selectedPlan?.billing_cycle.toLowerCase()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Amount Paid *</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="MMK" className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Receipt File * (JPG, PNG, PDF — max 10 MB)</label>
                <label className="block w-full cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="sr-only" />
                  <div className={cn('w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors',
                    file ? 'border-orange-500/60 bg-orange-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50')}>
                    {file ? (
                      <div>
                        <p className="text-sm text-zinc-200 font-medium truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {(file.size / 1024).toFixed(0)} KB · {uploadProgress === 'done' ? <span className="text-green-400">Uploaded</span> : <span className="text-zinc-400">Click to change</span>}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">Click to select a receipt file</p>
                    )}
                  </div>
                </label>
                {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
              <Btn variant="secondary" size="sm" onClick={() => setStep('plan')} disabled={busy}>← Back</Btn>
              <Btn size="sm" disabled={!amount || !file || busy} onClick={handleSubmitProof}>
                {uploadProgress === 'uploading' ? 'Uploading…' : submitMutation.isPending ? 'Submitting…' : 'Submit Request'}
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
                <p className="text-base font-semibold text-zinc-100">Request Submitted</p>
                <p className="text-sm text-zinc-400 mt-1">
                  Upgrade request to <span className="text-orange-400 font-medium">{selectedPlan?.name}</span> submitted for review.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-center">
              <Btn size="sm" onClick={onClose}>Done</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Manage Business Modal 

function ManageBusinessModal({ referral, onClose }: { referral: TenantReferralResponse; onClose: () => void }) {
  const qc = useQueryClient()
  type ModalMode = 'upgrade' | 'downgrade' | 'request-upgrade' | 'renew' | 'upgrade-proof' | null
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
      toast.success(data.message ?? 'Downgrade scheduled for end of billing period.')
      setModal(null)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to schedule downgrade'),
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
  const activePaidPlans = (plansData?.items ?? []).filter(p => p.is_active && !p.is_referral_plan && Number(p.price) > 0)
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
            ? `Pay for ${pendingDowngradePlan?.name ?? 'Downgrade Plan'}`
            : 'Submit Renewal Payment Proof'}
          subtitle={sub.pending_downgrade_plan_id
            ? `Payment for new plan. Activates when current plan expires${sub.expires_at ? ` (${fmtDate(sub.expires_at)})` : ''}.`
            : 'Upload the payment receipt to complete renewal.'}
          tenantId={referral.tenant_id}
          actionType={sub.pending_downgrade_plan_id ? ProofActionType.DOWNGRADE : ProofActionType.RENEWAL}
          targetPlanId={sub.pending_downgrade_plan_id ?? undefined}
          onClose={() => setModal(null)}
          onSuccess={invalidateAfterProof}
        />
      )}
      {upgradePlanId && (
        <ResellerProofSubmitModal
          title="Submit Upgrade Payment Proof"
          subtitle="Upload the payment receipt to complete the upgrade."
          tenantId={referral.tenant_id}
          actionType={ProofActionType.UPGRADE}
          targetPlanId={upgradePlanId}
          onClose={() => setUpgradePlanId(null)}
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
                {referral.tenant_name ?? `Business ${referral.tenant_id.slice(0, 8)}…`}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">Manage subscription</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {subLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : subError || !sub ? (
              <div className="text-center py-10 text-zinc-500 text-sm">
                Could not load subscription details.
              </div>
            ) : (
              <>
                {/* Pending downgrade banner */}
                {sub.pending_downgrade_plan_id && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-sm text-amber-300">
                      Downgrade to <span className="font-semibold">{pendingDowngradePlan?.name ?? 'a lower plan'}</span> scheduled for end of billing period.
                    </p>
                  </div>
                )}

                {/* Subscription card */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Current Plan</p>
                      <h4 className="text-lg font-bold text-zinc-100">{plan?.name}</h4>
                      {isReferralPlan && (
                        <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded px-1.5 py-0.5">Referral Trial</span>
                      )}
                    </div>
                    <Badge variant={SUB_STATUS_VARIANT[sub.status] ?? 'default'} size="md" dot>{sub.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-zinc-500 mb-0.5">Price</p>
                      <p className="text-zinc-200 font-medium">
                        {Number(plan?.price ?? 0) === 0 ? 'Free' : `${Number(plan?.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${plan?.currency === 'MMK' ? 'Kyats' : plan?.currency}`}
                        {Number(plan?.price ?? 0) > 0 && <span className="text-zinc-500 ml-1">/ {plan?.billing_cycle.toLowerCase()}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Started</p>
                      <p className="text-zinc-200">{fmtDate(sub.started_at)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Expires</p>
                      <p className={cn('font-medium', isExpired ? 'text-red-400' : 'text-zinc-200')}>
                        {sub.expires_at ? fmtDate(sub.expires_at) : 'Never'}
                      </p>
                    </div>
                    {isTrial && sub.trial_ends_at && (
                      <div>
                        <p className="text-zinc-500 mb-0.5">Trial Ends</p>
                        <p className="text-amber-400">{fmtDate(sub.trial_ends_at)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Actions</p>
                  {isReferralOrTrial && (
                    <p className="text-xs text-zinc-500 mb-3">Submit a payment proof to upgrade this business to a paid plan.</p>
                  )}
                  {isExpired && Number(plan?.price ?? 0) > 0 && (
                    <p className="text-xs text-zinc-500 mb-3">
                      This business's <span className="text-zinc-300">{plan?.name}</span> subscription has expired.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {isReferralOrTrial && (
                      pendingProofType === ProofActionType.UPGRADE ? (
                        <PendingProofBadge />
                      ) : (
                        <Btn size="sm" onClick={() => setModal('request-upgrade')}>
                          Request Upgrade
                        </Btn>
                      )
                    )}
                    {isExpired && Number(plan?.price ?? 0) > 0 && (
                      pendingProofType ? (
                        <PendingProofBadge />
                      ) : (
                        <>
                          <Btn size="sm" onClick={() => setModal('renew')}>
                            Pay to Reactivate
                          </Btn>
                          <Btn variant="secondary" size="sm" onClick={() => setModal('request-upgrade')}>
                            Switch Plan
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
                              Upgrade Plan
                            </Btn>
                          )
                        )}
                        {hasLowerPlan && !sub.pending_downgrade_plan_id && (
                          <Btn variant="secondary" size="sm" onClick={() => setModal('downgrade')} disabled={downgradeMutation.isPending}>
                            Downgrade Plan
                          </Btn>
                        )}
                        {sub.pending_downgrade_plan_id ? (
                          pendingProofType === ProofActionType.DOWNGRADE ? (
                            <PendingProofBadge />
                          ) : downgradeProofApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500/10 border border-green-500/30 text-green-400">
                              Downgrade to {pendingDowngradePlan?.name ?? 'lower plan'} scheduled{sub.expires_at ? ` for ${fmtDate(sub.expires_at)}` : ''}
                            </span>
                          ) : (
                            <Btn variant="secondary" size="sm" onClick={() => setModal('renew')}>
                              Pay for {pendingDowngradePlan?.name ?? 'Downgrade Plan'}
                            </Btn>
                          )
                        ) : (
                          pendingProofType === ProofActionType.RENEWAL ? (
                            <PendingProofBadge />
                          ) : (
                            <Btn variant="secondary" size="sm" onClick={() => setModal('renew')}>
                              Renew Now
                            </Btn>
                          )
                        )}
                      </>
                    )}
                    {!isReferralOrTrial && !isExpired && !isActive && (
                      <p className="text-xs text-zinc-600">No actions available for the current subscription status.</p>
                    )}
                  </div>
                </div>

                {/* Latest proof */}
                {proofLoading ? (
                  <div className="flex justify-center py-4"><Spinner size={18} /></div>
                ) : latestProof ? (
                  <LatestProofCard proof={latestProof} />
                ) : (
                  <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-zinc-600">No payment proof uploaded yet.</p>
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
      toast.success(`Promo code updated to ${created.code}`)
      setEditing(false); setNewCode('')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update code'),
  })

  const createFirstMutation = useMutation({
    mutationFn: () => resellerFinanceService.createCode(undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller', 'referral-codes'] })
      toast.success('Promo code created')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to create code'),
  })

  if (!activeCode) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
        <div className="text-4xl">🔗</div>
        <div>
          <p className="text-zinc-300 font-semibold">No promo code yet</p>
          <p className="text-zinc-500 text-sm mt-1">Generate a promo code to start referring businesses.</p>
        </div>
        <Btn size="sm" onClick={() => createFirstMutation.mutate()} loading={createFirstMutation.isPending}>
          Generate Promo Code
        </Btn>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Your Promo Code</h2>
        <Badge variant={activeCode.is_active ? 'success' : 'warning'} size="xs">
          {activeCode.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">New code (letters & digits only)</label>
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. MYNEWCODE"
              maxLength={20}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-zinc-100 tracking-widest focus:outline-none focus:border-orange-500 uppercase"
            />
            <p className="text-[11px] text-zinc-600 mt-1">Min 4 characters. This will deactivate your current code.</p>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" disabled={newCode.length < 4 || createMutation.isPending} onClick={() => createMutation.mutate(newCode)}>
              {createMutation.isPending ? 'Saving…' : 'Save Code'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setNewCode('') }}>Cancel</Btn>
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
              {showLink ? 'Hide link' : 'Get link'}
            </button>
            <button
              onClick={() => { setEditing(true); setNewCode(activeCode.code) }}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
            >
              Edit
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
        Share this code or link with businesses. Anyone who registers with it will be counted as your referral.
      </p>
    </div>
  )
}

//  Main Page 

export default function ResellerReferralPage() {
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
        <h1 className="text-2xl font-bold text-zinc-100">Referrals</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your promo code and track referred businesses.</p>
      </div>

      {/* Promo code card */}
      {codesLoading ? (
        <div className="flex justify-center py-8"><Spinner size={24} /></div>
      ) : (
        <PrimaryCodeCard codes={codes} />
      )}

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Performance</h2>
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
              { label: 'Total Referrals', value: stats?.total_referrals ?? 0 },
              { label: 'Converted', value: stats?.converted_referrals ?? 0, sub: 'Paying customers' },
              { label: 'In Trial', value: stats?.trial_referrals ?? 0 },
              { label: 'Conversion Rate', value: `${stats?.conversion_rate ?? 0}%` },
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
          Referred Businesses {referrals?.total ? `(${referrals.total})` : ''}
        </h2>
        {referralsLoading ? (
          <div className="flex justify-center py-6"><Spinner size={20} /></div>
        ) : !referrals?.items.length ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-600 text-sm">
            No businesses referred yet. Share your promo code to get started.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Business</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">Code Used</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden md:table-cell">Referred</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">Expires</th>
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {referrals.items.map(r => (
                  <tr key={r.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-zinc-200 text-sm font-medium">
                        {r.tenant_name ?? `Business ${r.tenant_id.slice(0, 8)}…`}
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
                          {r.locked_at ? 'Converted' : 'Trial'}
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
                        Manage
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
