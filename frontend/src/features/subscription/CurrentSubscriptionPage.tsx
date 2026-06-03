import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { cn } from '@/shared/utils'
import { useAuthStore } from '@/store/auth.store'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import type { Plan } from '@/shared/types'
import { ProofActionType } from '@/shared/types'
import { LatestProofCard, PendingProofBadge } from '@/features/reseller/ResellerReferralPage'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  EXPIRED:   'danger',
  SUSPENDED: 'warning',
  CANCELLED: 'default',
}

const FEATURE_LABELS: Record<string, string> = {
  users:         'Users / Staff',
  branches:      'Branches',
  products:      'Products',
  customers:     'Customers',
  devices:       'Devices',
  analytics:     'Analytics',
  procurement:   'Procurement',
  sync:          'Offline Sync',
  notifications: 'Notifications',
  sales:         'Sales',
  inventory:     'Inventory',
  pos:           'POS / Checkout',
}

function featureLabel(code: string) {
  return FEATURE_LABELS[code] ?? code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function UsageRow({
  featureCode, enabled, limitValue, used, isOverride,
}: {
  featureCode: string; enabled: boolean; limitValue: number | null; used: number | null; isOverride: boolean
}) {
  const isUnlimited = limitValue === null || limitValue === 0
  const pct = (!isUnlimited && used !== null && limitValue) ? Math.min((used / limitValue) * 100, 100) : 0
  let barColor = 'bg-green-500'
  if (pct >= 90) barColor = 'bg-red-500'
  else if (pct >= 75) barColor = 'bg-amber-500'

  return (
    <div className={cn('px-4 py-3.5', !enabled && 'opacity-40')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn('w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
            enabled ? 'bg-green-900 text-green-400' : 'bg-zinc-800 text-zinc-600')}>
            {enabled ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
            )}
          </span>
          <span className="text-sm text-zinc-200">{featureLabel(featureCode)}</span>
          {isOverride && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 flex-shrink-0">Override</span>
          )}
        </div>
        <span className="text-xs text-zinc-500 flex-shrink-0 tabular-nums">
          {!enabled ? 'Disabled' : isUnlimited ? (used !== null ? `${used} used · ∞` : '∞ Unlimited') : used !== null ? `${used} / ${limitValue}` : `Limit: ${limitValue}`}
        </span>
      </div>
      {enabled && !isUnlimited && limitValue !== null && used !== null && (
        <div className="mt-2 ml-6">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
          </div>
          {pct >= 90 && <p className="text-[10px] text-red-400 mt-1">Approaching limit</p>}
        </div>
      )}
    </div>
  )
}

// Reusable proof upload modal for renew / upgrade proof submission
function ProofSubmitModal({
  title, subtitle, onClose, actionType, targetPlanId,
}: {
  title: string; subtitle?: string; onClose: () => void
  actionType: ProofActionType; targetPlanId?: string
}) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MMK')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submitMutation = useMutation({
    mutationFn: (payload: Parameters<typeof subscriptionsService.submitPaymentProof>[0]) =>
      subscriptionsService.submitPaymentProof(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription', 'proofs'] })
      setDone(true)
    },
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
        proofUrl = await subscriptionsService.uploadProofFile(file)
        setUploadedUrl(proofUrl); setUploadProgress('done')
      } catch (err: unknown) {
        setUploadProgress('idle')
        toast.error(extractApiMsg(err) ?? 'File upload failed')
        return
      }
    }
    submitMutation.mutate({
      amount,
      currency,
      proof_file_url: proofUrl,
      action_type: actionType,
      ...(targetPlanId ? { target_plan_id: targetPlanId } : {}),
    })
  }

  const busy = uploadProgress === 'uploading' || submitMutation.isPending
  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-100">Proof Submitted</p>
                <p className="text-sm text-zinc-400 mt-1">Our team will review your payment and process your request. Track status under Billing &gt; Payment Proofs.</p>
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
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="Kyats" className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Receipt File * (JPG, PNG, PDF — max 10 MB)</label>
                <label className="block w-full cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="sr-only" />
                  <div className={cn('w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors',
                    file ? 'border-amber-500/60 bg-amber-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50')}>
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

// Standard plan picker for ACTIVE paid-plan users upgrading
function PlanPickerModal({
  mode, currentPlan, onClose, onConfirm,
}: {
  mode: 'upgrade' | 'downgrade'; currentPlan: Plan; onClose: () => void; onConfirm: (planId: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
  })
  const [selected, setSelected] = useState<string>('')

  const currentPrice = Number(currentPlan.price)
  const plans = (data?.items ?? []).filter(p =>
    p.is_active &&
    p.id !== currentPlan.id &&
    !p.is_referral_plan &&
    (mode === 'upgrade' ? Number(p.price) > currentPrice : Number(p.price) < currentPrice),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
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
              <button key={plan.id} onClick={() => setSelected(plan.id)}
                className={cn('w-full text-left px-4 py-3 rounded-xl border transition-all',
                  selected === plan.id ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800')}>
                <p className="text-sm font-medium text-zinc-100">{plan.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency} / {plan.billing_cycle.toLowerCase()}</p>
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

// 2-step modal for Trial/Referral users: pick plan → upload payment proof
function RequestUpgradeModal({ currentPlan, onClose }: { currentPlan: Plan; onClose: () => void }) {
  const qc = useQueryClient()
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

  // Only show real paid plans (not free trial / referral)
  const plans = (plansData?.items ?? []).filter(p =>
    p.is_active && !p.is_referral_plan && p.trial_days === 0 && Number(p.price) > 0 && p.id !== currentPlan.id
  ).sort((a, b) => Number(a.price) - Number(b.price))

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => subscriptionsService.submitPaymentProof(payload as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription', 'proofs'] })
      setStep('done')
    },
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
        proofUrl = await subscriptionsService.uploadProofFile(file)
        setUploadedUrl(proofUrl); setUploadProgress('done')
      } catch (err: unknown) {
        setUploadProgress('idle')
        toast.error(extractApiMsg(err) ?? 'File upload failed')
        return
      }
    }
    submitMutation.mutate({
      amount,
      currency,
      reference_number: `Upgrade to: ${selectedPlan.name}`,
      proof_file_url: proofUrl,
      target_plan_id: selectedPlan.id,
    })
  }

  const busy = uploadProgress === 'uploading' || submitMutation.isPending
  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              {step === 'plan' ? 'Choose a Plan' : step === 'proof' ? 'Submit Payment Proof' : 'Request Submitted'}
            </h3>
            {step !== 'done' && (
              <p className="text-xs text-zinc-500 mt-0.5">Step {step === 'plan' ? '1' : '2'} of 2</p>
            )}
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
                <p className="text-zinc-500 text-sm text-center py-6">No paid plans available at the moment</p>
              ) : (
                plans.map(plan => (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                    className={cn('w-full text-left px-4 py-3 rounded-xl border transition-all',
                      selectedPlan?.id === plan.id ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800')}>
                    <p className="text-sm font-medium text-zinc-100">{plan.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency} / {plan.billing_cycle.toLowerCase()}</p>
                    {plan.description && <p className="text-xs text-zinc-600 mt-0.5">{plan.description}</p>}
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
                  <p className="text-sm font-semibold text-amber-400">{selectedPlan?.name}</p>
                </div>
                <p className="text-sm text-zinc-300">
                  {Number(selectedPlan?.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedPlan?.currency === 'MMK' ? 'Kyats' : selectedPlan?.currency} / {selectedPlan?.billing_cycle.toLowerCase()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Amount Paid *</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="Kyats" className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Receipt File * (JPG, PNG, PDF — max 10 MB)</label>
                <label className="block w-full cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="sr-only" />
                  <div className={`w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors ${
                    file ? 'border-amber-500/60 bg-amber-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
                  }`}>
                    {file ? (
                      <div>
                        <p className="text-sm text-zinc-200 font-medium truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {(file.size / 1024).toFixed(0)} KB ·{' '}
                          {uploadProgress === 'done' ? <span className="text-green-400">Uploaded</span> : <span className="text-zinc-400">Click to change</span>}
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-100">Request Submitted</p>
                <p className="text-sm text-zinc-400 mt-1">
                  Your upgrade request to <span className="text-amber-400 font-medium">{selectedPlan?.name}</span> has been submitted.
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Our team will review your payment proof and activate your new plan. You can track the status in the Billing tab.
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

export default function CurrentSubscriptionPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const [modal, setModal] = useState<'upgrade' | 'downgrade' | 'request-upgrade' | 'renew-proof' | null>(null)
  const [upgradePlanId, setUpgradePlanId] = useState<string | null>(null)
  const isOwner = user?.role === 'BUSINESS_OWNER'

  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.getMySubscription,
  })

  const { data: effectiveEntitlements } = useQuery({
    queryKey: ['subscription', 'entitlements'],
    queryFn: subscriptionsService.getMyEntitlements,
    enabled: !!sub,
  })

  const { data: trialStatus } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: subscriptionsService.getTrialStatus,
    enabled: !!sub,
    staleTime: 60_000,
  })

  // Fetch plans to know if upgrade/downgrade options actually exist
  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
    enabled: !!sub && sub.status === 'ACTIVE',
    staleTime: 5 * 60 * 1000,
  })

  const { data: latestProofData } = useQuery({
    queryKey: ['subscription', 'proofs', 'latest'],
    queryFn: () => subscriptionsService.listPaymentProofs({ page: 1, page_size: 1 }),
    enabled: !!sub,
    staleTime: 0,
  })
  const latestProof = latestProofData?.items[0] ?? null

  const downgradeMutation = useMutation({
    mutationFn: (planId: string) => subscriptionsService.downgrade(planId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
      toast.success(data.message ?? 'Downgrade scheduled for end of billing period.')
      setModal(null)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to schedule downgrade'),
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>

  if (error || !sub) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="text-zinc-400 text-sm">No active subscription found.</p>
        <p className="text-zinc-600 text-xs text-center max-w-xs">Contact your administrator to activate a subscription for this account.</p>
      </div>
    )
  }

  const isTrial = sub.status === 'TRIAL'
  const isActive = sub.status === 'ACTIVE'
  const isExpired = sub.status === 'EXPIRED'
  const isReferralPlan = sub.plan.is_referral_plan
  const isReferralOrTrial = isTrial || isReferralPlan
  const plan = sub.plan

  // Determine which actions are available based on plans that actually exist
  const currentPrice = Number(plan.price)
  const activePaidPlans = (plansData?.items ?? []).filter(p => p.is_active && !p.is_referral_plan && Number(p.price) > 0)
  const hasHigherPlan = activePaidPlans.some(p => Number(p.price) > currentPrice)
  const hasLowerPlan = activePaidPlans.some(p => Number(p.price) < currentPrice)

  const usageMap: Record<string, number> = {}
  if (trialStatus?.usage) {
    const u = trialStatus.usage
    if (u.products?.used !== undefined) { usageMap['products'] = u.products.used }
    if (u.staff?.used !== undefined) { usageMap['users'] = u.staff.used }
    if (u.branches?.used !== undefined) { usageMap['branches'] = u.branches.used }
    if (u.customers?.used !== undefined) { usageMap['customers'] = u.customers.used }
  }

  const entitlementItems = effectiveEntitlements ?? plan.entitlements.map(e => ({
    feature_code: e.feature_code, enabled: e.enabled, limit_value: e.limit_value, source: 'plan',
  }))

  // Look up pending downgrade plan name from plansData if available
  const pendingDowngradePlan = sub.pending_downgrade_plan_id
    ? (plansData?.items ?? []).find(p => p.id === sub.pending_downgrade_plan_id)
    : null

  const pendingProofType = latestProof?.status === 'PENDING' ? latestProof.action_type : null
  const downgradeProofApproved =
    !!sub.pending_downgrade_plan_id &&
    latestProof?.action_type === ProofActionType.DOWNGRADE &&
    latestProof?.status === 'APPROVED'

  return (
    <>
      {modal === 'request-upgrade' && (
        <RequestUpgradeModal currentPlan={plan} onClose={() => setModal(null)} />
      )}
      {modal === 'upgrade' && !isReferralOrTrial && (
        <PlanPickerModal
          mode="upgrade"
          currentPlan={plan}
          onClose={() => setModal(null)}
          onConfirm={planId => {
            setUpgradePlanId(planId)
            setModal(null)
          }}
        />
      )}
      {modal === 'downgrade' && !isReferralOrTrial && (
        <PlanPickerModal
          mode="downgrade"
          currentPlan={plan}
          onClose={() => setModal(null)}
          onConfirm={planId => downgradeMutation.mutate(planId)}
        />
      )}
      {modal === 'renew-proof' && (
        sub?.pending_downgrade_plan_id ? (
          <ProofSubmitModal
            title={`Pay for ${pendingDowngradePlan?.name ?? 'Downgrade Plan'}`}
            subtitle={`Submit payment for your new plan. It activates when your current plan expires${sub.expires_at ? ` (${fmtDate(sub.expires_at)})` : ''}.`}
            actionType={ProofActionType.DOWNGRADE}
            targetPlanId={sub.pending_downgrade_plan_id}
            onClose={() => setModal(null)}
          />
        ) : (
          <ProofSubmitModal
            title="Submit Renewal Payment Proof"
            subtitle="Upload your payment receipt to complete the renewal process."
            actionType={ProofActionType.RENEWAL}
            onClose={() => setModal(null)}
          />
        )
      )}
      {upgradePlanId && (
        <ProofSubmitModal
          title="Submit Upgrade Payment Proof"
          subtitle="Upload your payment receipt to complete the upgrade process."
          actionType={ProofActionType.UPGRADE}
          targetPlanId={upgradePlanId}
          onClose={() => setUpgradePlanId(null)}
        />
      )}

      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-4">
          {/* Pending downgrade info banner */}
          {sub.pending_downgrade_plan_id && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm text-amber-300">
                Downgrade to{' '}
                <span className="font-semibold">{pendingDowngradePlan?.name ?? 'a lower plan'}</span>{' '}
                scheduled for end of billing period.
                {sub.pending_downgrade_requested_at && (
                  <span className="text-amber-400/70 text-xs ml-1">(requested {fmtDate(sub.pending_downgrade_requested_at)})</span>
                )}
              </p>
            </div>
          )}

          {/* Status card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Current Plan</p>
                <h2 className="text-2xl font-bold text-zinc-100">{plan.name}</h2>
                <p className="text-sm text-zinc-400 mt-1">{plan.description ?? plan.code}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'} size="md" dot>{sub.status}</Badge>
                {isReferralPlan && (
                  <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded px-1.5 py-0.5">Referral Trial</span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">Price</p>
                <p className="text-zinc-100 font-medium">
                  {Number(plan.price) === 0 ? 'Free' : `${Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${plan.currency === 'MMK' ? 'Kyats' : plan.currency}`}
                  {Number(plan.price) > 0 && <span className="text-zinc-500 text-xs ml-1">/ {plan.billing_cycle.toLowerCase()}</span>}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">Started</p>
                <p className="text-zinc-100">{fmtDate(sub.started_at)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">Expires</p>
                <p className="text-zinc-100">{sub.expires_at ? fmtDate(sub.expires_at) : 'Never'}</p>
              </div>
              {isTrial && sub.trial_ends_at && (
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Trial Ends</p>
                  <p className="text-amber-400">{fmtDate(sub.trial_ends_at)}</p>
                </div>
              )}
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">Auto-Renew</p>
                <p className={sub.auto_renew ? 'text-green-400' : 'text-zinc-500'}>{sub.auto_renew ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
          </div>

          {/* Usage & Limits */}
          {entitlementItems.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <p className="text-sm font-semibold text-zinc-100">Usage &amp; Limits</p>
                <p className="text-xs text-zinc-500 mt-0.5">Current usage against your plan limits</p>
              </div>
              <div className="divide-y divide-zinc-800">
                {entitlementItems.map(e => (
                  <UsageRow
                    key={e.feature_code}
                    featureCode={e.feature_code}
                    enabled={e.enabled}
                    limitValue={e.limit_value}
                    used={usageMap[e.feature_code] ?? null}
                    isOverride={(e as { source?: string }).source === 'override'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Latest payment proof */}
          {latestProof && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <LatestProofCard proof={latestProof} />
            </div>
          )}

          {/* Actions */}
          {isOwner && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-zinc-100 mb-1">Actions</h3>
              {isReferralOrTrial && (
                <p className="text-xs text-zinc-500 mb-3">
                  To upgrade to a paid plan, submit a payment proof. Our team will review and activate your plan.
                </p>
              )}
              {isExpired && Number(plan.price) > 0 && (
                <p className="text-xs text-zinc-500 mb-3">
                  Your <span className="text-zinc-300">{plan.name}</span> subscription has expired. Submit your payment proof to reactivate it, or request an upgrade to a different plan.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {/* Trial/Referral users: request upgrade with proof */}
                {isReferralOrTrial && (
                  pendingProofType === ProofActionType.UPGRADE ? (
                    <PendingProofBadge />
                  ) : (
                    <Btn size="sm" onClick={() => setModal('request-upgrade')}>
                      Request Upgrade
                    </Btn>
                  )
                )}

                {/* Expired paid-plan users: pay to reactivate current plan, or request upgrade */}
                {isExpired && Number(plan.price) > 0 && (
                  pendingProofType ? (
                    <PendingProofBadge />
                  ) : (
                    <>
                      <Btn size="sm" onClick={() => setModal('renew-proof')}>
                        Pay to Reactivate
                      </Btn>
                      <Btn variant="secondary" size="sm" onClick={() => setModal('request-upgrade')}>
                        Switch Plan
                      </Btn>
                    </>
                  )
                )}

                {/* Paid ACTIVE users: standard upgrade/downgrade (only show when plans exist) */}
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
                        <Btn variant="secondary" size="sm" onClick={() => setModal('renew-proof')}>
                          Pay for {pendingDowngradePlan?.name ?? 'Downgrade Plan'}
                        </Btn>
                      )
                    ) : (
                      pendingProofType === ProofActionType.RENEWAL ? (
                        <PendingProofBadge />
                      ) : (
                        <Btn variant="secondary" size="sm" onClick={() => setModal('renew-proof')}>
                          Renew Now
                        </Btn>
                      )
                    )}
                  </>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
