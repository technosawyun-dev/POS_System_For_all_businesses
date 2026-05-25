import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, fmtDateTime, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { useAuthStore } from '@/store/auth.store'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { apiClient } from '@/app/lib/axios'
import type { PaymentProofCreateRequest } from '@/shared/types'

async function openProofFile(url: string) {
  try {
    const res = await apiClient.get(url, { responseType: 'blob', baseURL: '/' })
    const blobUrl = URL.createObjectURL(res.data)
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  } catch {
    toast.error('Could not load proof file')
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

function SubmitProofModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
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
      setFileError('Only JPG, PNG, or PDF files are accepted')
      setFile(null)
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`File must be under ${MAX_MB} MB`)
      setFile(null)
      return
    }
    setFile(f)
  }

  const submitMutation = useMutation({
    mutationFn: subscriptionsService.submitPaymentProof,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription', 'proofs'] })
      toast.success('Payment proof submitted')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to submit'),
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
        toast.error(extractApiMsg(err) ?? 'File upload failed')
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
          <h3 className="text-base font-semibold text-zinc-100">Submit Payment Proof</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Amount *</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Currency</label>
              <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Reference Number</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="TXN-12345"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Receipt File * (JPG, PNG, PDF — max {MAX_MB} MB)</label>
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
                        <span className="text-green-400">Uploaded</span>
                      ) : (
                        <span className="text-zinc-400">Click to change</span>
                      )}
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
          <Btn
            size="sm"
            disabled={!amount || !file || busy}
            onClick={handleSubmit}
          >
            {uploadProgress === 'uploading' ? 'Uploading…' : submitMutation.isPending ? 'Submitting…' : 'Submit'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function BillingHistoryPage() {
  const user = useAuthStore(s => s.user)
  const isOwner = user?.role === 'BUSINESS_OWNER'
  const [tab, setTab] = useState<'history' | 'proofs'>('proofs')
  const [showModal, setShowModal] = useState(false)
  const [proofsPage, setProofsPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)

  const proofsQuery = useQuery({
    queryKey: ['subscription', 'proofs', proofsPage],
    queryFn: () => subscriptionsService.listPaymentProofs({ page: proofsPage, page_size: 10 }),
  })

  const historyQuery = useQuery({
    queryKey: ['subscription', 'history', historyPage],
    queryFn: () => subscriptionsService.getHistory({ page: historyPage, page_size: 10 }),
  })

  return (
    <>
      {showModal && <SubmitProofModal onClose={() => setShowModal(false)} />}

      <div className="h-full flex flex-col overflow-hidden">
        {/* Sub-tab bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex gap-1">
            {(['proofs', 'history'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
                  tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
                )}
              >
                {t === 'proofs' ? 'Payment Proofs' : 'Change History'}
              </button>
            ))}
          </div>
          {isOwner && tab === 'proofs' && (
            <Btn size="sm" onClick={() => setShowModal(true)}>Submit Proof</Btn>
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
                  <Empty title="No payment proofs yet" />
                ) : (
                  <div className="space-y-3">
                    {proofsQuery.data.items.map(proof => (
                      <div key={proof.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">
                              {proof.currency} {Number(proof.amount).toFixed(2)}
                            </p>
                            {proof.reference_number && (
                              <p className="text-xs text-zinc-500 mt-0.5">Ref: {proof.reference_number}</p>
                            )}
                            <p className="text-xs text-zinc-600 mt-0.5">{fmtDate(proof.created_at)}</p>
                          </div>
                          <Badge variant={PROOF_VARIANT[proof.status] ?? 'default'} dot>
                            {proof.status}
                          </Badge>
                        </div>
                        {proof.reviewed_at && (
                          <p className="text-xs text-zinc-600 mt-2">
                            Reviewed {fmtDate(proof.reviewed_at)}
                            {proof.review_notes && ` — ${proof.review_notes}`}
                          </p>
                        )}
                        <button
                          onClick={() => openProofFile(proof.proof_file_url)}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-amber-400 hover:text-amber-300"
                        >
                          View proof
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </button>
                      </div>
                    ))}
                    {proofsQuery.data.total_pages > 1 && (
                      <div className="flex justify-center gap-2 pt-2">
                        <Btn variant="secondary" size="xs" disabled={proofsPage === 1} onClick={() => setProofsPage(p => p - 1)}>Prev</Btn>
                        <span className="text-xs text-zinc-500 self-center">{proofsPage} / {proofsQuery.data.total_pages}</span>
                        <Btn variant="secondary" size="xs" disabled={!proofsQuery.data.has_next} onClick={() => setProofsPage(p => p + 1)}>Next</Btn>
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
                  <Empty title="No subscription history" />
                ) : (
                  <div className="space-y-2">
                    {historyQuery.data.items.map(h => (
                      <div key={h.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                        <Badge variant={CHANGE_VARIANT[h.change_type] ?? 'default'} size="xs">
                          {h.change_type.replace(/_/g, ' ')}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          {h.note && <p className="text-xs text-zinc-400 truncate">{h.note}</p>}
                        </div>
                        <span className="text-xs text-zinc-600 flex-shrink-0">{fmtDateTime(h.created_at)}</span>
                      </div>
                    ))}
                    {historyQuery.data.total_pages > 1 && (
                      <div className="flex justify-center gap-2 pt-2">
                        <Btn variant="secondary" size="xs" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>Prev</Btn>
                        <span className="text-xs text-zinc-500 self-center">{historyPage} / {historyQuery.data.total_pages}</span>
                        <Btn variant="secondary" size="xs" disabled={!historyQuery.data.has_next} onClick={() => setHistoryPage(p => p + 1)}>Next</Btn>
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
