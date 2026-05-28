import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

export default function TrialBanner() {
  const user = useAuthStore(s => s.user)

  const { data: status } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionsService.getTrialStatus,
    enabled: !!user && (user.role === 'BUSINESS_OWNER' || user.role === 'MANAGER'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  if (!status || status.status !== 'TRIAL') return null

  const days = status.days_remaining
  const urgent = days <= 3

  return (
    <div className={`px-4 py-2 flex items-center justify-between gap-4 text-xs font-medium ${
      urgent
        ? 'bg-red-950 border-b border-red-900 text-red-300'
        : 'bg-amber-950/60 border-b border-amber-900/40 text-amber-300'
    }`}>
      <span>
        {urgent
          ? `⚠️ Trial expires in ${days} day${days !== 1 ? 's' : ''} — upgrade now to keep your data`
          : `🕐 Free trial · ${days} day${days !== 1 ? 's' : ''} remaining`
        }
      </span>
      <Link
        to="/app/subscription/billing"
        className={`flex-shrink-0 px-3 py-1 rounded-lg font-semibold transition-colors ${
          urgent
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-amber-500 hover:bg-amber-400 text-black'
        }`}
      >
        Upgrade Plan
      </Link>
    </div>
  )
}
