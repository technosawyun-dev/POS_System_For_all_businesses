import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { usersService } from '@/services/users/users.service'
import { resellerFinanceAdminService } from '@/services/reseller_finance/reseller_finance.service'

type Tab = 'overview' | 'referrals' | 'finance'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE:               'success',
  SUSPENDED:            'warning',
  INACTIVE:             'default',
  PENDING_VERIFICATION: 'default',
}

const CREDIT_TYPES = new Set(['COMMISSION', 'CREDIT', 'ADJUSTMENT_CREDIT', 'REFERRAL_BONUS'])

export default function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const userQuery = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => usersService.get(id!),
    enabled: !!id,
  })

  const referralsQuery = useQuery({
    queryKey: ['admin', 'reseller-referrals', id],
    queryFn: () => resellerFinanceAdminService.listAllReferrals({ reseller_id: id, page_size: 100 }),
    enabled: !!id && (tab === 'referrals' || tab === 'overview'),
  })

  const walletQuery = useQuery({
    queryKey: ['admin', 'reseller-wallet', id],
    queryFn: () => resellerFinanceAdminService.getWallet(id!),
    enabled: !!id && (tab === 'finance' || tab === 'overview'),
  })

  const transactionsQuery = useQuery({
    queryKey: ['admin', 'reseller-transactions', id],
    queryFn: () => resellerFinanceAdminService.listResellerTransactions(id!, { page_size: 20 }),
    enabled: !!id && tab === 'finance',
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => usersService.updateStatus(id!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'users', 'resellers'] })
      toast.success('Status updated')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const user = userQuery.data
  const referrals = referralsQuery.data?.items ?? []

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',  label: 'Overview'  },
    { key: 'referrals', label: 'Referrals' },
    { key: 'finance',   label: 'Finance'   },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
        <button
          onClick={() => navigate('/super-admin/resellers')}
          className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          {userQuery.isLoading ? (
            <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-100">{user?.full_name}</h2>
              {user && <Badge variant={STATUS_VARIANT[user.status] ?? 'default'} size="xs">{user.status}</Badge>}
              <Badge variant="default" size="xs">Reseller</Badge>
            </div>
          )}
          <p className="text-xs text-zinc-500 mt-0.5">{user?.email}</p>
        </div>
        {user && (
          <div className="flex gap-2 flex-shrink-0">
            {user.status !== 'SUSPENDED' ? (
              <Btn
                variant="secondary" size="sm"
                disabled={statusMutation.isPending}
                onClick={() => confirm(`Suspend ${user.full_name}?`) && statusMutation.mutate('SUSPENDED')}
              >
                Suspend
              </Btn>
            ) : (
              <Btn
                variant="secondary" size="sm"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('ACTIVE')}
              >
                Activate
              </Btn>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center px-4 py-2 border-b border-zinc-800 gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              tab === t.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">

        {/* ── Overview ─────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="max-w-xl">
            {userQuery.isLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : user ? (
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Profile</h3>
                  <dl className="space-y-3">
                    {[
                      { label: 'Full Name',   value: user.full_name },
                      { label: 'Email',       value: user.email },
                      { label: 'Phone',       value: user.phone ?? '—' },
                      { label: 'Status',      value: <Badge variant={STATUS_VARIANT[user.status] ?? 'default'} size="xs">{user.status}</Badge> },
                      { label: 'Joined',      value: fmtDate(user.created_at) },
                      { label: 'Last Login',  value: user.last_login_at ? fmtDate(user.last_login_at) : 'Never' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-4">
                        <dt className="text-xs text-zinc-500 w-24 flex-shrink-0 pt-0.5">{label}</dt>
                        <dd className="text-sm text-zinc-200">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-400">
                      {referralsQuery.isLoading ? '…' : referrals.length}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">Total Referrals</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">
                      {walletQuery.isLoading ? '…' : `MMK ${Number(walletQuery.data?.available_balance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">Available Balance</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
                <p className="text-sm text-red-400">Reseller not found.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Referrals ────────────────────────────────────────────── */}
        {tab === 'referrals' && (
          <div className="max-w-2xl">
            {referralsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : referrals.length === 0 ? (
              <Empty title="No referrals yet" subtitle="No businesses have signed up using this reseller's promo code." />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 mb-3">
                  {referrals.length} business{referrals.length !== 1 ? 'es' : ''} referred via promo code
                  {' · '}
                  {referrals.filter(r => r.first_paid_subscription_at).length} converted to paid
                </p>
                {referrals.map(r => (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/super-admin/businesses/${r.tenant_id}`)}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3.5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-zinc-100 hover:text-amber-400 transition-colors">
                            {r.tenant_name ?? `Business ${r.tenant_id.slice(0, 8)}…`}
                          </p>
                          {r.first_paid_subscription_at ? (
                            <Badge variant="success" size="xs">Converted</Badge>
                          ) : (
                            <Badge variant="info" size="xs">Trial</Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Code: <span className="font-mono text-amber-400/80">{r.referral_code_snapshot}</span>
                          {' · '}
                          Referred {fmtDate(r.referred_at)}
                        </p>
                        {r.first_paid_subscription_at && (
                          <p className="text-xs text-zinc-600 mt-0.5">
                            Converted {fmtDate(r.first_paid_subscription_at)}
                          </p>
                        )}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 flex-shrink-0 mt-0.5"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Finance ──────────────────────────────────────────────── */}
        {tab === 'finance' && (
          <div className="max-w-xl space-y-4">
            {walletQuery.isLoading ? (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            ) : walletQuery.error ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-sm text-zinc-400">No wallet found for this reseller.</p>
              </div>
            ) : walletQuery.data ? (
              <>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Wallet</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Available Balance', value: `MMK ${Number(walletQuery.data.available_balance).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, amber: true },
                      { label: 'Locked Balance',    value: `MMK ${Number(walletQuery.data.locked_balance).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                      { label: 'Total Paid Out',    value: `MMK ${Number(walletQuery.data.total_paid_out).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                      { label: 'Commission Rate',   value: `${Number(walletQuery.data.commission_rate_pct).toFixed(2)}%` },
                      { label: 'Min Payout',        value: `MMK ${Number(walletQuery.data.min_payout_amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-xs text-zinc-500 mb-0.5">{item.label}</p>
                        <p className={cn('text-sm font-medium', item.amber ? 'text-amber-400' : 'text-zinc-200')}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800">
                    <p className="text-sm font-medium text-zinc-100">Recent Transactions</p>
                  </div>
                  {transactionsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Spinner size={20} /></div>
                  ) : (transactionsQuery.data?.items ?? []).length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">No transactions yet</p>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {(transactionsQuery.data?.items ?? []).map(tx => {
                        const isCredit = CREDIT_TYPES.has(tx.transaction_type)
                        return (
                          <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-200 capitalize">
                                {tx.transaction_type.replace(/_/g, ' ').toLowerCase()}
                              </p>
                              <p className="text-xs text-zinc-500 mt-0.5">{fmtDate(tx.created_at)}</p>
                              {tx.note && <p className="text-xs text-zinc-600 mt-0.5 italic">{tx.note}</p>}
                            </div>
                            <p className={cn('text-sm font-medium flex-shrink-0', isCredit ? 'text-green-400' : 'text-red-400')}>
                              {isCredit ? '+' : '-'}{tx.currency_code} {Number(tx.amount).toLocaleString()}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

      </div>
    </div>
  )
}
