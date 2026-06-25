import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Btn, Spinner } from '@/components/ui'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { extractApiMsg } from '@/lib/utils'
import type { SubscriptionPaymentMethod } from '@/shared/types'

const METHOD_TYPES = [
  { value: 'KPAY',          label: 'KBZ Pay' },
  { value: 'WAVEPAY',       label: 'Wave Money' },
  { value: 'AYA_PAY',       label: 'AYA Pay' },
  { value: 'CB_PAY',        label: 'CB Pay' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'OTHER',         label: 'Other' },
]

const METHOD_COLORS: Record<string, string> = {
  KPAY: 'border-sky-700/50 bg-sky-900/20',
  WAVEPAY: 'border-orange-700/50 bg-orange-900/20',
  AYA_PAY: 'border-amber-700/50 bg-amber-900/20',
  CB_PAY: 'border-indigo-700/50 bg-indigo-900/20',
  BANK_TRANSFER: 'border-teal-700/50 bg-teal-900/20',
  OTHER: 'border-zinc-700 bg-zinc-800/50',
}

const METHOD_ICONS: Record<string, string> = {
  KPAY: '💙', WAVEPAY: '🧡', AYA_PAY: '🟡', CB_PAY: '🔵',
  BANK_TRANSFER: '🏦', OTHER: '💳',
}

function iconSrc(url: string | null | undefined) {
  if (!url) return null
  return url
}

function emptyMethod(): SubscriptionPaymentMethod {
  return { type: 'KPAY', label: 'KBZ Pay', account_number: '', account_name: '', icon_url: null }
}

function MethodIcon({ method }: { method: SubscriptionPaymentMethod }) {
  const src = iconSrc(method.icon_url)
  if (src) {
    return (
      <img
        src={src}
        alt={method.label}
        className="w-7 h-7 rounded-lg object-contain bg-white/5 border border-white/10"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span className="text-xl leading-none w-7 text-center">{METHOD_ICONS[method.type] ?? '💳'}</span>
}

function IconUploadButton({
  method,
  idx,
  onUploaded,
}: {
  method: SubscriptionPaymentMethod
  idx: number
  onUploaded: (idx: number, url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const src = iconSrc(method.icon_url)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await subscriptionsService.adminUploadPaymentMethodIcon(file)
      onUploaded(idx, url)
      toast.success('Icon uploaded')
    } catch (err) {
      toast.error(extractApiMsg(err) ?? 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-14 h-14 rounded-xl border border-zinc-700 bg-zinc-800 flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500/50 transition-colors relative group"
        onClick={() => !uploading && inputRef.current?.click()}
        title="Click to upload logo"
      >
        {uploading ? (
          <Spinner size={18} />
        ) : src ? (
          <>
            <img
              src={src}
              alt="icon"
              className="w-full h-full object-contain p-1"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-zinc-600 group-hover:text-zinc-400 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
        )}
      </div>
      <span className="text-[9px] text-zinc-600 text-center leading-tight">Logo</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

export default function PlatformPaymentMethodsPage() {
  const qc = useQueryClient()
  const [methods, setMethods] = useState<SubscriptionPaymentMethod[]>([])
  const [dirty, setDirty] = useState(false)

  const { data: savedMethods, isLoading } = useQuery({
    queryKey: ['platform', 'payment-methods'],
    queryFn: subscriptionsService.getPlatformPaymentMethods,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (savedMethods) {
      setMethods(savedMethods)
      setDirty(false)
    }
  }, [savedMethods])

  const saveMutation = useMutation({
    mutationFn: (m: SubscriptionPaymentMethod[]) => subscriptionsService.adminSetPlatformPaymentMethods(m),
    onSuccess: saved => {
      qc.invalidateQueries({ queryKey: ['platform', 'payment-methods'] })
      setMethods(saved)
      setDirty(false)
      toast.success('Payment methods saved')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to save'),
  })

  function addMethod() {
    setMethods(prev => [...prev, emptyMethod()])
    setDirty(true)
  }

  function removeMethod(idx: number) {
    setMethods(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function updateMethod(idx: number, patch: Partial<SubscriptionPaymentMethod>) {
    setMethods(prev => prev.map((m, i) => {
      if (i !== idx) return m
      const updated = { ...m, ...patch }
      if (patch.type) {
        const found = METHOD_TYPES.find(t => t.value === patch.type)
        if (found && m.type !== patch.type) updated.label = found.label
      }
      return updated
    }))
    setDirty(true)
  }

  function handleIconUploaded(idx: number, url: string) {
    setMethods(prev => prev.map((m, i) => i === idx ? { ...m, icon_url: url } : m))
    setDirty(true)
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    setMethods(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
    setDirty(true)
  }

  function moveDown(idx: number) {
    setMethods(prev => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
    setDirty(true)
  }

  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors'

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Subscription Payment Methods</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Accounts subscribers use to pay for plans — shown in the payment modal for all plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
          <Btn
            size="sm"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(methods)}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Btn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-xl space-y-4">

          {/* Live preview */}
          {methods.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Preview — what subscribers see</p>
              <div className="space-y-2">
                {methods.map((m, i) => (
                  <div key={i} className={`rounded-xl border px-4 py-3 space-y-1 ${METHOD_COLORS[m.type] ?? 'border-zinc-700 bg-zinc-800/50'}`}>
                    <div className="flex items-center gap-2.5">
                      <MethodIcon method={m} />
                      <span className="text-sm font-semibold text-zinc-100">{m.label || '—'}</span>
                    </div>
                    <div className="pl-10 space-y-0.5">
                      <p className="text-sm font-mono text-amber-300 font-bold tracking-wide">
                        {m.account_number || <span className="text-zinc-600 italic text-xs font-normal">account number</span>}
                      </p>
                      {m.account_name && <p className="text-xs text-zinc-400">{m.account_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
              <p className="text-sm font-semibold text-zinc-100">Payment Accounts</p>
              <button
                type="button"
                onClick={addMethod}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add Account
              </button>
            </div>

            {methods.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-3">💳</div>
                <p className="text-sm text-zinc-500">No payment accounts configured</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Click "Add Account" to add KBZ Pay, Wave Money, bank accounts, etc.
                </p>
                <p className="text-xs text-zinc-700 mt-3">
                  These will be shown to subscribers when they select any plan.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {methods.map((m, idx) => (
                  <div key={idx} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Logo upload */}
                      <IconUploadButton method={m} idx={idx} onUploaded={handleIconUploaded} />

                      <div className="flex-1 space-y-3 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Order controls */}
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => moveUp(idx)}
                              disabled={idx === 0}
                              className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDown(idx)}
                              disabled={idx === methods.length - 1}
                              className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                          </div>

                          {/* Type selector */}
                          <div className="flex-1">
                            <label className="block text-[10px] text-zinc-500 mb-1">Type</label>
                            <select
                              value={m.type}
                              onChange={e => updateMethod(idx, { type: e.target.value })}
                              className={inp}
                            >
                              {METHOD_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => removeMethod(idx)}
                            className="flex-shrink-0 mt-4 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-950/50 transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-1">Account Number / Phone *</label>
                            <input
                              value={m.account_number}
                              onChange={e => updateMethod(idx, { account_number: e.target.value })}
                              placeholder="09-XXX-XXX-XXXX"
                              className={inp}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-1">Account Name</label>
                            <input
                              value={m.account_name}
                              onChange={e => updateMethod(idx, { account_name: e.target.value })}
                              placeholder="Business Name"
                              className={inp}
                            />
                          </div>
                        </div>

                        {m.type === 'OTHER' && (
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-1">Custom Label</label>
                            <input
                              value={m.label}
                              onChange={e => updateMethod(idx, { label: e.target.value })}
                              placeholder="e.g. City Bank, MPU Card…"
                              className={inp}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 px-4 py-3 bg-blue-950/30 border border-blue-800/30 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs text-blue-300/80 leading-relaxed">
              These payment methods apply to <strong className="text-blue-200">all subscription plans</strong>.
              Upload a logo by clicking the icon box on the left of each row (JPEG/PNG, max 2 MB).
              Subscribers will see these accounts before uploading their proof of payment.
            </p>
          </div>

          {dirty && (
            <div className="flex justify-end pb-4">
              <Btn
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(methods)}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Btn>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
