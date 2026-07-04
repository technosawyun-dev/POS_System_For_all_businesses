import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { Badge, Btn, Spinner } from '@/components/ui'
import { cn } from '@/shared/utils'
import { extractApiMsg } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { BASE_URL } from '@/app/lib/axios'
import type { ContactLinks, Plan, SubscriptionPaymentMethod } from '@/shared/types'
import { ProofActionType } from '@/shared/types'

// The API can live on a different origin than this app (e.g. a Vercel-hosted
// frontend + separate API domain), so a bare "/uploads/..." path from the
// backend resolves against the wrong host unless prefixed with the API's origin.
const API_ORIGIN = new URL(BASE_URL, window.location.origin).origin

function iconSrc(url: string | null | undefined) {
  if (!url) return null
  if (/^https?:\/\//.test(url)) return url
  return `${API_ORIGIN}${url}`
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

const SOCIAL_PLATFORMS = [
  {
    key: 'viber' as const,
    label: 'Viber',
    color: 'hover:bg-violet-500/20 hover:border-violet-500/50 hover:text-violet-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.4 0C5.5 0 .8 4.5.8 10.1c0 3 1.4 5.7 3.6 7.5v3.7l3.4-1.9c1 .3 2.1.4 3.2.4 5.9 0 10.6-4.5 10.6-10.1S17.3 0 11.4 0zm1 13.6l-2.5-2.7-4.9 2.7 5.4-5.8 2.6 2.7 4.8-2.7-5.4 5.8z"/>
      </svg>
    ),
  },
  {
    key: 'telegram' as const,
    label: 'Telegram',
    color: 'hover:bg-sky-500/20 hover:border-sky-500/50 hover:text-sky-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
  {
    key: 'facebook' as const,
    label: 'Facebook',
    color: 'hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-blue-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    key: 'tiktok' as const,
    label: 'TikTok',
    color: 'hover:bg-pink-500/20 hover:border-pink-500/50 hover:text-pink-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.02-.05z"/>
      </svg>
    ),
  },
]

const PAYMENT_METHOD_ICONS: Record<string, string> = {
  KPAY: '💙', WAVEPAY: '🧡', AYA_PAY: '🟡', CB_PAY: '🔵',
  BANK_TRANSFER: '🏦', OTHER: '💳',
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  KPAY: 'border-sky-700/50 bg-sky-900/20',
  WAVEPAY: 'border-orange-700/50 bg-orange-900/20',
  AYA_PAY: 'border-amber-700/50 bg-amber-900/20',
  CB_PAY: 'border-indigo-700/50 bg-indigo-900/20',
  BANK_TRANSFER: 'border-teal-700/50 bg-teal-900/20',
  OTHER: 'border-zinc-700 bg-zinc-800/50',
}

function PaymentMethodLogo({ method }: { method: SubscriptionPaymentMethod }) {
  const src = iconSrc(method.icon_url)
  if (src) {
    return (
      <img
        src={src}
        alt={method.label}
        className="w-7 h-7 rounded-lg object-contain bg-white/5 flex-shrink-0"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span className="text-base leading-none flex-shrink-0">{PAYMENT_METHOD_ICONS[method.type] ?? '💳'}</span>
}

function HowToPaySection({ methods }: { methods: SubscriptionPaymentMethod[] | undefined }) {
  if (!methods || methods.length === 0) return null
  return (
    <div className="p-5 border-b border-zinc-800 space-y-3">
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">How to Pay</p>
      </div>
      <p className="text-[11px] text-zinc-500">Transfer the payment to one of the accounts below, then upload your receipt.</p>
      <div className="space-y-2">
        {methods.map((m, i) => (
          <div key={i} className={cn('rounded-xl border px-4 py-3 space-y-1', PAYMENT_METHOD_COLORS[m.type] ?? 'border-zinc-700 bg-zinc-800/50')}>
            <div className="flex items-center gap-2.5">
              <PaymentMethodLogo method={m} />
              <span className="text-sm font-semibold text-zinc-100">{m.label}</span>
            </div>
            <div className="pl-10 space-y-0.5">
              <p className="text-sm font-mono text-amber-300 font-bold tracking-wide">{m.account_number}</p>
              {m.account_name && <p className="text-xs text-zinc-400">{m.account_name}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContactFooter({ links }: { links: ContactLinks | null }) {
  const active = SOCIAL_PLATFORMS.filter(p => links?.[p.key])
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-zinc-500 text-center">Get in touch to discuss your requirements</p>
      {active.length > 0 ? (
        <div className="flex flex-wrap gap-2 justify-center">
          {active.map(p => (
            <a
              key={p.key}
              href={links![p.key]!}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs font-medium transition-colors ${p.color}`}
            >
              {p.icon}
              {p.label}
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600 text-center">Contact your administrator for details.</p>
      )}
    </div>
  )
}

// Proof submission modal — plan is pre-selected, shows payment info then upload form
function UpgradeProofModal({ plan, paymentMethods, onClose }: { plan: Plan; paymentMethods: SubscriptionPaymentMethod[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('MMK')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      subscriptionsService.submitPaymentProof(payload as unknown as Parameters<typeof subscriptionsService.submitPaymentProof>[0]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription', 'proofs'] })
      setDone(true)
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
      reference_number: `Activate: ${plan.name}`,
      proof_file_url: proofUrl,
      target_plan_id: plan.id,
      action_type: ProofActionType.UPGRADE,
    })
  }

  const busy = uploadProgress === 'uploading' || submitMutation.isPending
  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              {done ? 'Request Submitted' : 'Submit Payment Proof'}
            </h3>
            {!done && (
              <p className="text-xs text-zinc-500 mt-0.5">
                For: <span className="text-amber-400 font-medium">{plan.name}</span>
                {' — '}{Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency} / {plan.billing_cycle.toLowerCase()}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {done ? (
          <>
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-900/50 flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-100">Request Submitted</p>
                <p className="text-sm text-zinc-400 mt-1">
                  Your request to activate <span className="text-amber-400 font-medium">{plan.name}</span> has been submitted.
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Our team will review your payment proof and activate your plan. Track status under Billing History.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-center">
              <Btn size="sm" onClick={onClose}>Done</Btn>
            </div>
          </>
        ) : (
          <>
            <HowToPaySection methods={paymentMethods} />
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Amount Paid *</label>
                  <input
                    type="number" step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" className={inp}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                  <input
                    type="text" value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    placeholder="Kyats" className={inp}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Receipt File * (JPG, PNG, PDF — max 10 MB)</label>
                <label className="block w-full cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="sr-only" />
                  <div className={cn(
                    'w-full border-2 border-dashed rounded-xl px-4 py-5 text-center transition-colors',
                    file ? 'border-amber-500/60 bg-amber-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50',
                  )}>
                    {file ? (
                      <div>
                        <p className="text-sm text-zinc-200 font-medium truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {(file.size / 1024).toFixed(0)} KB ·{' '}
                          {uploadProgress === 'done'
                            ? <span className="text-green-400">Uploaded</span>
                            : <span className="text-zinc-400">Click to change</span>}
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
              <Btn variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Btn>
              <Btn size="sm" disabled={!amount || !file || busy} onClick={handleSubmit}>
                {uploadProgress === 'uploading' ? 'Uploading…' : submitMutation.isPending ? 'Submitting…' : 'Submit Request'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Inline confirm dialog for downgrade (shows "scheduled at end of period" messaging)
function ConfirmDowngradeModal({
  plan, onClose, onConfirm, isPending,
}: {
  plan: Plan
  onClose: () => void; onConfirm: () => void; isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">Confirm Downgrade</h3>
          <p className="text-sm text-zinc-400 mt-2">
            Your plan will switch to{' '}
            <span className="text-zinc-200 font-medium">{plan.name}</span>
            {' '}({Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency} / {plan.billing_cycle.toLowerCase()}) at the end of your current billing period.
          </p>
          <p className="text-xs text-amber-400 mt-2">
            You will keep your current plan features until the billing period ends. Some features or limits may be reduced after the downgrade takes effect.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Cancel</Btn>
          <Btn size="sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Scheduling…' : 'Confirm Downgrade'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// Proof upload modal for upgrade — plan is pre-selected
function UpgradeProofSubmitModal({ plan, paymentMethods, onClose }: { plan: Plan; paymentMethods: SubscriptionPaymentMethod[]; onClose: () => void }) {
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
      reference_number: `Upgrade to: ${plan.name}`,
      proof_file_url: proofUrl,
      action_type: ProofActionType.UPGRADE,
      target_plan_id: plan.id,
    })
  }

  const busy = uploadProgress === 'uploading' || submitMutation.isPending
  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">{done ? 'Request Submitted' : 'Submit Upgrade Payment Proof'}</h3>
            {!done && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Upgrading to <span className="text-amber-400 font-medium">{plan.name}</span>
                {' — '}{Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency} / {plan.billing_cycle.toLowerCase()}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
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
                <p className="text-base font-semibold text-zinc-100">Request Submitted</p>
                <p className="text-sm text-zinc-400 mt-1">
                  Your upgrade request to <span className="text-amber-400 font-medium">{plan.name}</span> has been submitted.
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Our team will review your payment proof and activate your new plan. Track status under Billing &gt; Payment Proofs.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-center">
              <Btn size="sm" onClick={onClose}>Done</Btn>
            </div>
          </>
        ) : (
          <>
            <HowToPaySection methods={paymentMethods} />
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

export default function PlansPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const isOwner = user?.role === 'BUSINESS_OWNER'

  const [proofPlan, setProofPlan] = useState<Plan | null>(null)
  const [confirmDowngrade, setConfirmDowngrade] = useState<Plan | null>(null)
  const [upgradeProofPlan, setUpgradeProofPlan] = useState<Plan | null>(null)
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())

  function toggleExpand(planId: string) {
    setExpandedPlans(prev => {
      const next = new Set(prev)
      next.has(planId) ? next.delete(planId) : next.add(planId)
      return next
    })
  }

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.getMySubscription,
  })

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
    staleTime: 60_000,
  })

  const { data: platformPaymentMethods = [] } = useQuery({
    queryKey: ['platform', 'payment-methods'],
    queryFn: subscriptionsService.getPlatformPaymentMethods,
    staleTime: 300_000,
  })

  const downgradeMutation = useMutation({
    mutationFn: (planId: string) => subscriptionsService.downgrade(planId),
    onSuccess: (data, planId) => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
      const targetPlan = (plansData?.items ?? []).find(p => p.id === planId)
      toast.success(data.message ?? `Downgrade to ${targetPlan?.name ?? 'lower plan'} scheduled for end of billing period.`)
      setConfirmDowngrade(null)
    },
    onError: err => {
      toast.error(extractApiMsg(err) ?? 'Failed to schedule downgrade')
      setConfirmDowngrade(null)
    },
  })

  const cancelDowngradeMutation = useMutation({
    mutationFn: () => subscriptionsService.cancelPendingDowngrade(),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success(data.message ?? 'Pending downgrade cancelled')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to cancel downgrade'),
  })

  if (subLoading || plansLoading) {
    return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  }

  // All active, non-referral plans — sorted by sort_order then price; custom plans always last
  const plans = (plansData?.items ?? [])
    .filter(p => p.is_active && !p.is_referral_plan)
    .sort((a, b) => {
      if (a.is_custom !== b.is_custom) return a.is_custom ? 1 : -1
      return a.sort_order - b.sort_order || Number(a.price) - Number(b.price)
    })

  const currentPlan = sub?.plan
  const currentPlanId = currentPlan?.id
  const currentPrice = currentPlan ? Number(currentPlan.price) : 0
  const subStatus = sub?.status ?? ''

  // ACTIVE + paid + not referral = can upgrade/downgrade directly
  const isActiveAndPaid = (
    subStatus === 'ACTIVE' &&
    !!currentPlan &&
    Number(currentPlan.price) > 0 &&
    !currentPlan.is_referral_plan
  )
  // Everyone else needs the payment proof flow
  const needsProofFlow = !isActiveAndPaid

  const ctaLabel = (subStatus === 'CANCELLED' || subStatus === 'EXPIRED') ? 'Resubscribe →' : 'Select Plan →'

  return (
    <>
      {proofPlan && (
        <UpgradeProofModal plan={proofPlan} paymentMethods={platformPaymentMethods} onClose={() => setProofPlan(null)} />
      )}
      {upgradeProofPlan && (
        <UpgradeProofSubmitModal plan={upgradeProofPlan} paymentMethods={platformPaymentMethods} onClose={() => setUpgradeProofPlan(null)} />
      )}
      {confirmDowngrade && (
        <ConfirmDowngradeModal
          plan={confirmDowngrade}
          isPending={downgradeMutation.isPending}
          onClose={() => setConfirmDowngrade(null)}
          onConfirm={() => downgradeMutation.mutate(confirmDowngrade.id)}
        />
      )}

      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl">
          {/* Current plan banner */}
          {sub && currentPlan && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
              <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <p className="text-sm text-zinc-300 flex-1 min-w-0">
                Currently on{' '}
                <span className="font-semibold text-amber-400">{currentPlan.name}</span>
                <span className="text-zinc-600 mx-1.5">·</span>
                <span className="text-zinc-500 capitalize">{subStatus.toLowerCase()}</span>
              </p>
              {needsProofFlow && isOwner && Number(currentPrice) === 0 && (
                <p className="text-xs text-zinc-500">
                  Select a paid plan below to upgrade — submit a payment proof and our team will activate it.
                </p>
              )}
            </div>
          )}

          {/* Pending downgrade banner */}
          {sub?.pending_downgrade_plan_id && (() => {
            const pendingPlan = plans.find(p => p.id === sub.pending_downgrade_plan_id)
            return (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-6 flex items-start gap-3 flex-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm text-amber-300 flex-1 min-w-[200px]">
                  Downgrade to{' '}
                  <span className="font-semibold">{pendingPlan?.name ?? 'a lower plan'}</span>{' '}
                  is scheduled for end of your current billing period.
                </p>
                {isOwner && (
                  <Btn
                    variant="secondary" size="sm"
                    disabled={cancelDowngradeMutation.isPending}
                    onClick={() => cancelDowngradeMutation.mutate()}
                  >
                    {cancelDowngradeMutation.isPending ? 'Cancelling…' : 'Cancel Downgrade'}
                  </Btn>
                )}
              </div>
            )
          })()}

          {plans.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-500 text-sm">No plans available at the moment.</p>
              <p className="text-zinc-600 text-xs mt-1">Contact your administrator for more information.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(plan => {
                const isCurrent = plan.id === currentPlanId
                const planPrice = Number(plan.price)
                const isFree = planPrice === 0

                // What CTA to render
                let action: 'current' | 'proof' | 'upgrade' | 'downgrade' | 'contact' | null = null

                if (plan.is_custom) {
                  action = 'contact'
                } else if (isCurrent && subStatus === 'ACTIVE') {
                  action = 'current'
                } else if (isOwner) {
                  if (isFree) {
                    // Can't self-service downgrade to free — cancel achieves this automatically
                    action = null
                  } else if (needsProofFlow) {
                    action = 'proof'
                  } else {
                    // Direct API — active paid user
                    action = planPrice > currentPrice ? 'upgrade' : 'downgrade'
                  }
                }

                const isExpanded = expandedPlans.has(plan.id)
                const enabledFeatures = plan.entitlements.filter(e => e.enabled)
                const disabledFeatures = plan.entitlements.filter(e => !e.enabled)
                const visibleFeatures = isExpanded ? enabledFeatures : enabledFeatures.slice(0, 6)
                const hiddenEnabledCount = Math.max(0, enabledFeatures.length - 6)
                const hasMore = hiddenEnabledCount > 0 || disabledFeatures.length > 0
                const moreCount = hiddenEnabledCount + disabledFeatures.length

                const isPendingDowngradeTo = sub?.pending_downgrade_plan_id === plan.id

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'bg-zinc-900 border rounded-2xl flex flex-col transition-colors',
                      isCurrent
                        ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                        : isPendingDowngradeTo
                        ? 'border-amber-500/30 ring-1 ring-amber-500/10'
                        : 'border-zinc-800 hover:border-zinc-700',
                    )}
                  >
                    {/* Current / pending-downgrade badge */}
                    {(isCurrent || isPendingDowngradeTo) && (
                      <div className="px-4 pt-3 flex gap-2 flex-wrap">
                        {isCurrent && (
                          <span className="inline-block text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                            Current Plan
                          </span>
                        )}
                        {isPendingDowngradeTo && (
                          <span className="inline-block text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                            Pending Downgrade
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-5 flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-base font-bold text-zinc-100 leading-tight">{plan.name}</h3>
                        {isFree && <Badge variant="default" size="sm">Free</Badge>}
                      </div>

                      {plan.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 mb-3 leading-relaxed">{plan.description}</p>
                      )}

                      <div className="mb-5 mt-3">
                        {plan.is_custom ? (
                          <p className="text-xl font-bold text-violet-400">Contact for Pricing</p>
                        ) : isFree ? (
                          <p className="text-2xl font-bold text-zinc-100">Free</p>
                        ) : (
                          <p className="text-2xl font-bold text-zinc-100">
                            {Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {plan.currency === 'MMK' ? 'Kyats' : plan.currency}
                            <span className="text-sm font-normal text-zinc-500 ml-1.5">
                              / {plan.billing_cycle.toLowerCase()}
                            </span>
                          </p>
                        )}
                      </div>

                      {(visibleFeatures.length > 0 || (isExpanded && disabledFeatures.length > 0)) && (
                        <ul className="space-y-1.5">
                          {/* Enabled features */}
                          {visibleFeatures.map(ent => (
                            <li key={ent.feature_code} className="flex items-center gap-2 text-xs text-zinc-400">
                              <span className="w-3.5 h-3.5 rounded-full bg-green-900/60 text-green-400 flex items-center justify-center flex-shrink-0">
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                              <span>{featureLabel(ent.feature_code)}</span>
                              {ent.limit_value !== null && ent.limit_value > 0 ? (
                                <span className="text-zinc-600 ml-auto tabular-nums">up to {ent.limit_value}</span>
                              ) : ent.limit_value === null || ent.limit_value === 0 ? (
                                <span className="text-zinc-700 ml-auto">∞</span>
                              ) : null}
                            </li>
                          ))}

                          {/* Disabled features — only shown when expanded */}
                          {isExpanded && disabledFeatures.map(ent => (
                            <li key={ent.feature_code} className="flex items-center gap-2 text-xs text-zinc-600">
                              <span className="w-3.5 h-3.5 rounded-full bg-zinc-800 text-zinc-600 flex items-center justify-center flex-shrink-0">
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                              </span>
                              <span className="line-through">{featureLabel(ent.feature_code)}</span>
                            </li>
                          ))}

                          {/* Show more / Show less toggle */}
                          {hasMore && (
                            <li>
                              <button
                                onClick={() => toggleExpand(plan.id)}
                                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors pt-0.5 pl-5"
                              >
                                <svg
                                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth="2.5"
                                  className={cn('transition-transform', isExpanded && 'rotate-180')}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                                {isExpanded ? 'Show less' : `Show more (${moreCount})`}
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>

                    {/* Action footer */}
                    <div className="px-5 pb-5">
                      {action === 'contact' ? (
                        <ContactFooter links={plan.contact_links} />
                      ) : isOwner && action === 'current' ? (
                        <div className="w-full text-center py-2 text-xs font-medium text-zinc-500 border border-zinc-800 rounded-xl">
                          ✓ Active Plan
                        </div>
                      ) : isOwner && action === 'proof' ? (
                        <Btn size="sm" fullWidth onClick={() => setProofPlan(plan)}>
                          {ctaLabel}
                        </Btn>
                      ) : isOwner && action === 'upgrade' ? (
                        <Btn size="sm" fullWidth onClick={() => setUpgradeProofPlan(plan)}>
                          Upgrade →
                        </Btn>
                      ) : isOwner && action === 'downgrade' ? (
                        isPendingDowngradeTo ? (
                          <div className="w-full text-center py-2 text-xs font-medium text-amber-400/70 border border-amber-500/20 rounded-xl">
                            Downgrade Scheduled
                          </div>
                        ) : (
                          <Btn
                            variant="secondary" size="sm" fullWidth
                            disabled={downgradeMutation.isPending || !!sub?.pending_downgrade_plan_id}
                            onClick={() => setConfirmDowngrade(plan)}
                          >
                            Downgrade
                          </Btn>
                        )
                      ) : isOwner && isFree && !isCurrent ? (
                        <p className="text-xs text-zinc-600 text-center py-2">
                          Cancel your plan to revert to Free
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Help note for proof flow users with a paid plan target */}
          {isOwner && needsProofFlow && plans.some(p => Number(p.price) > 0) && (
            <p className="text-xs text-zinc-600 text-center mt-6">
              Payments are manually reviewed. Submit a payment proof and our team will activate your plan within 1–2 business days.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
