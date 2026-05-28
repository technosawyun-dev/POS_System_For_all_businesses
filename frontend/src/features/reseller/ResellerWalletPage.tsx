import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Badge, Btn } from '@/components/ui'
import {
  resellerFinanceService,
  type PayoutRequestResponse,
} from '@/services/reseller_finance/reseller_finance.service'

const PAYOUT_STATUS_VARIANT: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  PAID: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
}

const TX_TYPE_LABEL: Record<string, string> = {
  COMMISSION_EARNED: 'Commission',
  COMMISSION_REVERSAL: 'Commission Reversal',
  PAYOUT_LOCKED: 'Payout Reserved',
  PAYOUT_REJECTED: 'Payout Released',
  PAYOUT_COMPLETED: 'Payout Paid',
  MANUAL_ADJUSTMENT: 'Adjustment',
  BONUS: 'Bonus',
  PENALTY: 'Penalty',
}

function fmt(amount: string): string {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function RequestPayoutModal({ wallet, onClose }: { wallet: { available_balance: string; min_payout_amount: string; currency_code: string }; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => resellerFinanceService.requestPayout({ amount, reason: reason || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller', 'wallet'] })
      qc.invalidateQueries({ queryKey: ['reseller', 'payouts'] })
      toast.success('Payout requested successfully')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to request payout'),
  })

  const available = Number(wallet.available_balance)
  const min = Number(wallet.min_payout_amount)
  const requested = Number(amount)
  const isValid = requested > 0 && requested <= available && requested >= min

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Request Payout</h2>
        <div className="bg-zinc-900 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Available</span>
            <span className="text-zinc-200 font-mono">{fmt(wallet.available_balance)} {wallet.currency_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Minimum</span>
            <span className="text-zinc-400 font-mono">{fmt(wallet.min_payout_amount)} {wallet.currency_code}</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Min ${fmt(wallet.min_payout_amount)}`}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 resize-none"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!isValid}>
            Request
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function ResellerWalletPage() {
  const [showRequest, setShowRequest] = useState(false)
  const [txPage, setTxPage] = useState(1)
  const [payoutPage, setPayoutPage] = useState(1)

  const qc = useQueryClient()

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['reseller', 'wallet'],
    queryFn: resellerFinanceService.getMyWallet,
    staleTime: 30_000,
  })

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ['reseller', 'wallet-transactions', txPage],
    queryFn: () => resellerFinanceService.listMyTransactions({ page: txPage, page_size: 20 }),
    staleTime: 30_000,
  })

  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ['reseller', 'payouts', payoutPage],
    queryFn: () => resellerFinanceService.listMyPayouts({ page: payoutPage, page_size: 10 }),
    staleTime: 30_000,
  })

  const cancelPayout = useMutation({
    mutationFn: (id: string) => resellerFinanceService.cancelPayout(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller', 'payouts'] })
      qc.invalidateQueries({ queryKey: ['reseller', 'wallet'] })
      toast.success('Payout cancelled')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to cancel'),
  })

  const available = wallet ? Number(wallet.available_balance) : 0
  const canRequest = wallet && available >= Number(wallet.min_payout_amount)

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Wallet & Payouts</h1>
          <p className="text-zinc-500 text-sm mt-1">Commission earnings and payout management.</p>
        </div>
        <Btn size="sm" disabled={!canRequest} onClick={() => setShowRequest(true)}>
          Request Payout
        </Btn>
      </div>

      {/* Wallet cards */}
      {walletLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : wallet ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Available</p>
            <p className="text-2xl font-bold text-green-400 tabular-nums">{fmt(wallet.available_balance)}</p>
            <p className="text-xs text-zinc-600 mt-1">{wallet.currency_code}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Locked</p>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{fmt(wallet.locked_balance)}</p>
            <p className="text-xs text-zinc-600 mt-1">Pending payout</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Total Paid Out</p>
            <p className="text-2xl font-bold text-zinc-100 tabular-nums">{fmt(wallet.total_paid_out)}</p>
            <p className="text-xs text-zinc-600 mt-1">All time</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-500 mb-1">Commission Rate</p>
            <p className="text-2xl font-bold text-orange-400 tabular-nums">{Number(wallet.commission_rate_pct).toFixed(2)}%</p>
            <p className="text-xs text-zinc-600 mt-1">Per paid subscription</p>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No wallet yet. Wallet is created once you refer a paying tenant.</p>
        </div>
      )}

      {/* Payout requests */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Payout Requests</h2>
        {payoutsLoading ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-pulse h-24" />
        ) : !payouts || payouts.items.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <p className="text-zinc-600 text-sm">No payout requests yet.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Reason</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {payouts.items.map((p: PayoutRequestResponse) => (
                  <tr key={p.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3 font-mono font-bold text-zinc-100">{fmt(p.amount)} <span className="text-zinc-600 font-normal text-xs">{p.currency_code}</span></td>
                    <td className="px-4 py-3">
                      <Badge variant={PAYOUT_STATUS_VARIANT[p.status] ?? 'default'} size="xs">{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[180px] truncate">{p.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {p.status === 'PENDING' && (
                        <button
                          onClick={() => cancelPayout.mutate(p.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(payouts.total ?? 0) > 10 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
                <Btn variant="ghost" size="xs" disabled={payoutPage === 1} onClick={() => setPayoutPage(p => p - 1)}>← Prev</Btn>
                <span className="text-xs text-zinc-600">{payoutPage}</span>
                <Btn variant="ghost" size="xs" disabled={payoutPage * 10 >= (payouts.total ?? 0)} onClick={() => setPayoutPage(p => p + 1)}>Next →</Btn>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction ledger */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Transaction Ledger</h2>
        {txLoading ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-pulse h-32" />
        ) : !transactions || transactions.items.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <p className="text-zinc-600 text-sm">No transactions yet.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Type</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Note</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.items.map(tx => {
                  const isCredit = Number(tx.amount) >= 0
                  return (
                    <tr key={tx.id} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-4 py-3 text-zinc-300 text-xs">{TX_TYPE_LABEL[tx.transaction_type] ?? tx.transaction_type}</td>
                      <td className={`px-4 py-3 font-mono text-right font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                        {isCredit ? '+' : ''}{fmt(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs max-w-[200px] truncate">{tx.note ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(transactions.total ?? 0) > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
                <Btn variant="ghost" size="xs" disabled={txPage === 1} onClick={() => setTxPage(p => p - 1)}>← Prev</Btn>
                <span className="text-xs text-zinc-600">{txPage}</span>
                <Btn variant="ghost" size="xs" disabled={txPage * 20 >= (transactions.total ?? 0)} onClick={() => setTxPage(p => p + 1)}>Next →</Btn>
              </div>
            )}
          </div>
        )}
      </div>

      {showRequest && wallet && (
        <RequestPayoutModal wallet={wallet} onClose={() => setShowRequest(false)} />
      )}
    </div>
  )
}
