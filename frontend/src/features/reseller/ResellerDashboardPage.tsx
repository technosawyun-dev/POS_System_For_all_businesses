import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { resellerFinanceService } from '@/services/reseller_finance/reseller_finance.service'
import { notificationsService } from '@/services/notifications/notifications.service'
import { Spinner } from '@/components/ui'

function StatCard({ label, value, sub, accent = false }: {
  label: string
  value: React.ReactNode
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`bg-zinc-900 border rounded-2xl p-5 ${accent ? 'border-orange-500/30' : 'border-zinc-800'}`}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-orange-400' : 'text-zinc-100'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}

export default function ResellerDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['reseller', 'referral-stats'],
    queryFn: resellerFinanceService.getReferralStats,
    staleTime: 2 * 60 * 1000,
  })

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['reseller', 'wallet'],
    queryFn: resellerFinanceService.getMyWallet,
    staleTime: 2 * 60 * 1000,
  })

  const { data: unreadData } = useQuery({
    queryKey: ['reseller', 'notifications', 'unread'],
    queryFn: notificationsService.getUnreadCount,
    staleTime: 60 * 1000,
  })

  const unreadCount = unreadData?.unread_count ?? 0
  const isLoading = statsLoading || walletLoading

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Welcome back{user ? `, ${user.first_name}` : ''}!
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Here's your reseller overview.</p>
      </div>

      {/* Unread notifications alert */}
      {unreadCount > 0 && (
        <button
          onClick={() => navigate('/reseller/notifications')}
          className="w-full bg-blue-950 border border-blue-800 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-blue-900 transition-colors"
        >
          <span className="text-2xl">🔔</span>
          <div>
            <p className="text-blue-400 font-semibold text-sm">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
            <p className="text-blue-700 text-xs">Tap to view</p>
          </div>
        </button>
      )}

      {/* Referral Stats */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Referral Performance</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Referrals"
              value={stats?.total_referrals ?? 0}
              accent
            />
            <StatCard
              label="Converted"
              value={stats?.converted_referrals ?? 0}
              sub="Paying customers"
            />
            <StatCard
              label="In Trial"
              value={stats?.trial_referrals ?? 0}
              sub="Active trials"
            />
            <StatCard
              label="Conversion Rate"
              value={`${stats?.conversion_rate ?? 0}%`}
              sub="Trial → paid"
            />
          </div>
        )}
      </div>

      {/* Wallet */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Wallet</h2>
        {walletLoading ? (
          <div className="flex items-center justify-center py-6"><Spinner size={20} /></div>
        ) : wallet ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Available Balance"
              value={`${wallet.currency_code} ${Number(wallet.available_balance).toLocaleString()}`}
              accent
            />
            <StatCard
              label="Locked Balance"
              value={`${wallet.currency_code} ${Number(wallet.locked_balance).toLocaleString()}`}
              sub="Pending clearance"
            />
            <StatCard
              label="Total Paid Out"
              value={`${wallet.currency_code} ${Number(wallet.total_paid_out).toLocaleString()}`}
              sub="All time"
            />
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-600 text-sm">
            Wallet not set up yet. Contact your administrator.
          </div>
        )}
      </div>

      {/* Quick nav */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/reseller/referrals')}
            className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/30 rounded-2xl p-5 flex flex-col items-center gap-2 transition-all group"
          >
            <span className="text-2xl">🔗</span>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-medium">Referrals</span>
          </button>
          <button
            onClick={() => navigate('/reseller/wallet')}
            className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/30 rounded-2xl p-5 flex flex-col items-center gap-2 transition-all group"
          >
            <span className="text-2xl">💰</span>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-medium">Wallet</span>
          </button>
        </div>
      </div>
    </div>
  )
}
