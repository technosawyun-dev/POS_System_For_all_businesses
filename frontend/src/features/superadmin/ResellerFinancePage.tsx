import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Badge, Btn } from '@/components/ui'
import {
  resellerFinanceAdminService,
  type PayoutRequestResponse,
  type ResellerWalletSummary,
} from '@/services/reseller_finance/reseller_finance.service'


// Helpers

function fmt(v: string | number) {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const PAYOUT_VARIANT: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  PAID: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
}


// Overview cards

function OverviewCards() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reseller-finance', 'overview'],
    queryFn: resellerFinanceAdminService.getOverview,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse h-24" />
        ))}
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {[
        { label: 'Total Resellers', value: data.total_resellers, color: '' },
        { label: 'Wallets Value', value: fmt(data.total_wallets_value), color: 'text-green-400' },
        { label: 'Commission Earned', value: fmt(data.total_commission_earned), color: 'text-amber-400' },
        { label: 'All-Time Paid Out', value: fmt(data.total_commission_paid_out), color: '' },
        { label: 'Pending Payouts', value: data.total_pending_payouts, color: data.total_pending_payouts > 0 ? 'text-orange-400' : '' },
      ].map(c => (
        <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 mb-1">{c.label}</p>
          <p className={`text-2xl font-bold tabular-nums ${c.color || 'text-zinc-100'}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}


// Wallet settings modal

function WalletSettingsModal({ resellerId, current, onClose }: { resellerId: string; current: ResellerWalletSummary; onClose: () => void }) {
  const qc = useQueryClient()
  const [rate, setRate] = useState(current.commission_rate_pct)
  const [min, setMin] = useState(current.min_payout_amount)

  const mutation = useMutation({
    mutationFn: () => resellerFinanceAdminService.updateWalletSettings(resellerId, {
      commission_rate_pct: rate,
      min_payout_amount: min,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reseller-finance'] })
      toast.success('Settings updated')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Wallet Settings</h2>
        <p className="text-xs text-zinc-500 font-mono">{resellerId}</p>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Commission Rate (%)</label>
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} step="0.01"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Min Payout Amount (MMK)</label>
          <input type="number" value={min} onChange={e => setMin(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn
            size="sm"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!rate || !min || Number(rate) < 0 || Number(rate) > 100 || Number(min) <= 0}
          >
            Save
          </Btn>
        </div>
      </div>
    </div>
  )
}


// Adjustment modal

function AdjustmentModal({ resellerId, onClose }: { resellerId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [type, setType] = useState('MANUAL_ADJUSTMENT')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => resellerFinanceAdminService.manualAdjustment(resellerId, { transaction_type: type, amount, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reseller-finance'] })
      toast.success('Adjustment applied')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Manual Adjustment</h2>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Type</label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500">
            <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
            <option value="BONUS">Bonus</option>
            <option value="PENALTY">Penalty</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Amount (use PENALTY type to deduct)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Notes (required)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 resize-none" />
        </div>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!amount || !notes}>Apply</Btn>
        </div>
      </div>
    </div>
  )
}


// Payout review modal

function ReviewPayoutModal({ payout, onClose }: { payout: PayoutRequestResponse; onClose: () => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'reseller-finance', 'payouts'] })
    qc.invalidateQueries({ queryKey: ['admin', 'reseller-finance', 'overview'] })
  }

  const approve = useMutation({
    mutationFn: () => resellerFinanceAdminService.approvePayout(payout.id),
    onSuccess: () => { invalidate(); toast.success('Payout approved'); onClose() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const reject = useMutation({
    mutationFn: () => resellerFinanceAdminService.rejectPayout(payout.id, note || undefined),
    onSuccess: () => { invalidate(); toast.success('Payout rejected'); onClose() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const markPaid = useMutation({
    mutationFn: () => resellerFinanceAdminService.markPayoutPaid(payout.id, note || undefined),
    onSuccess: () => { invalidate(); toast.success('Marked as paid'); onClose() },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const isPending = approve.isPending || reject.isPending || markPaid.isPending

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Review Payout</h2>
        <div className="bg-zinc-900 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Amount</span>
            <span className="text-zinc-100 font-bold font-mono">{fmt(payout.amount)} {payout.currency_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Status</span>
            <Badge variant={PAYOUT_VARIANT[payout.status] ?? 'default'} size="xs">{payout.status}</Badge>
          </div>
          {payout.reason && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500 shrink-0">Reason</span>
              <span className="text-zinc-400 text-xs text-right">{payout.reason}</span>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Notes (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 resize-none" />
        </div>
        <div className="flex gap-2 justify-end flex-wrap">
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          {(payout.status === 'PENDING' || payout.status === 'UNDER_REVIEW') && (
            <>
              <Btn size="sm" variant="danger" onClick={() => reject.mutate()} loading={isPending}>Reject</Btn>
              <Btn size="sm" onClick={() => approve.mutate()} loading={isPending}>Approve</Btn>
            </>
          )}
          {payout.status === 'APPROVED' && (
            <Btn size="sm" onClick={() => markPaid.mutate()} loading={isPending}>Mark Paid</Btn>
          )}
        </div>
      </div>
    </div>
  )
}


// Wallets tab

function WalletsTab() {
  const [settingsFor, setSettingsFor] = useState<ResellerWalletSummary | null>(null)
  const [adjustFor, setAdjustFor] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reseller-finance', 'wallets'],
    queryFn: () => resellerFinanceAdminService.listWallets(),
    staleTime: 30_000,
  })

  if (isLoading) return <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center animate-pulse h-32" />

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Reseller</th>
              <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Referrals</th>
              <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Available</th>
              <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Locked</th>
              <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Paid Out</th>
              <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Rate</th>
              <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Min Payout</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map(w => (
              <tr key={w.reseller_id} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-4 py-3">
                  <p className="text-zinc-200 text-sm font-medium">{w.reseller_name}</p>
                  <p className="text-zinc-500 text-xs">{w.reseller_email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-right text-zinc-300">{w.total_referrals}</td>
                <td className="px-4 py-3 font-mono text-right text-green-400">{fmt(w.available_balance)}</td>
                <td className="px-4 py-3 font-mono text-right text-amber-400">{fmt(w.locked_balance)}</td>
                <td className="px-4 py-3 font-mono text-right text-zinc-400">{fmt(w.total_paid_out)}</td>
                <td className="px-4 py-3 font-mono text-right text-orange-400">{Number(w.commission_rate_pct).toFixed(2)}%</td>
                <td className="px-4 py-3 font-mono text-right text-zinc-400">MMK {Number(w.min_payout_amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSettingsFor(w)} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Settings</button>
                    <button onClick={() => setAdjustFor(w.reseller_id)} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">Adjust</button>
                  </div>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-600 text-sm">No wallets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {settingsFor && <WalletSettingsModal resellerId={settingsFor.reseller_id} current={settingsFor} onClose={() => setSettingsFor(null)} />}
      {adjustFor && <AdjustmentModal resellerId={adjustFor} onClose={() => setAdjustFor(null)} />}
    </>
  )
}


// Payouts tab

function PayoutsTab() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewing, setReviewing] = useState<PayoutRequestResponse | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reseller-finance', 'payouts', page, statusFilter],
    queryFn: () => resellerFinanceAdminService.listAllPayouts({ page, page_size: 20, status: statusFilter || undefined }),
    staleTime: 30_000,
  })

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500">
          <option value="">All statuses</option>
          {['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="ml-auto">
          <Btn size="sm" onClick={() => setShowCreate(true)}>+ Create Payout</Btn>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 animate-pulse h-32" />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Reseller</th>
                <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.items.map(p => (
                <tr key={p.id} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-4 py-3">
                    {p.reseller_name ? (
                      <>
                        <p className="text-zinc-200 text-sm font-medium">{p.reseller_name}</p>
                        {p.reseller_email && <p className="text-zinc-500 text-xs">{p.reseller_email}</p>}
                      </>
                    ) : (
                      <span className="font-mono text-zinc-400 text-xs">{p.reseller_id.slice(0, 12)}…</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-right font-bold text-zinc-100">{fmt(p.amount)} <span className="text-zinc-600 font-normal text-xs">{p.currency_code}</span></td>
                  <td className="px-4 py-3">
                    <Badge variant={PAYOUT_VARIANT[p.status] ?? 'default'} size="xs">{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(p.status) && (
                      <button onClick={() => setReviewing(p)} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">Review</button>
                    )}
                  </td>
                </tr>
              ))}
              {!data?.items.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-600 text-sm">No payouts found.</td></tr>
              )}
            </tbody>
          </table>
          {(data?.total ?? 0) > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
              <Btn variant="ghost" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Btn>
              <span className="text-xs text-zinc-600">{page}</span>
              <Btn variant="ghost" size="xs" disabled={page * 20 >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next →</Btn>
            </div>
          )}
        </div>
      )}

      {reviewing && <ReviewPayoutModal payout={reviewing} onClose={() => setReviewing(null)} />}
      {showCreate && <AdminCreatePayoutModal onClose={() => setShowCreate(false)} />}
    </>
  )
}

function AdminCreatePayoutModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ reseller_id: '', amount: '', reason: '' })

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['admin', 'reseller-finance', 'wallets'],
    queryFn: () => resellerFinanceAdminService.listWallets(),
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: () => resellerFinanceAdminService.createPayout({ reseller_id: form.reseller_id, amount: form.amount, reason: form.reason || 'Admin-initiated payout' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reseller-finance', 'payouts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'reseller-finance', 'overview'] })
      toast.success('Payout created')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Create Payout (Admin)</h2>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Reseller</label>
          <select
            value={form.reseller_id}
            onChange={e => setForm(p => ({ ...p, reseller_id: e.target.value }))}
            disabled={walletsLoading}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 disabled:opacity-50"
          >
            <option value="">{walletsLoading ? 'Loading resellers…' : 'Select reseller'}</option>
            {(wallets ?? []).map(w => (
              <option key={w.reseller_id} value={w.reseller_id}>
                {w.reseller_name} — {w.reseller_email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Amount</label>
          <input
            type="number"
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            placeholder="0.00"
            step="0.01"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Reason (optional)</label>
          <input
            type="text"
            value={form.reason}
            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="e.g. Monthly commission payout"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn
            size="sm"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!form.reseller_id || !form.amount || walletsLoading}
          >
            Create
          </Btn>
        </div>
      </div>
    </div>
  )
}


// Main page

type Tab = 'wallets' | 'payouts'

export default function ResellerFinancePage() {
  const [tab, setTab] = useState<Tab>('wallets')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'payouts', label: 'Payout Requests' },
    { id: 'wallets', label: 'Wallets' },
  ]

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Reseller Finance</h1>
        <p className="text-zinc-500 text-sm mt-1">Commission wallets and payout management.</p>
      </div>

      <OverviewCards />

      {/* Tabs */}
      <div className="border-b border-zinc-800 flex gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'wallets' && <WalletsTab />}
      {tab === 'payouts' && <PayoutsTab />}
    </div>
  )
}
