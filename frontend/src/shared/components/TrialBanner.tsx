import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

export default function TrialBanner() {
  const user = useAuthStore(s => s.user)
  const isEligible = !!user && user.role === 'BUSINESS_OWNER'

  const { data: status } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionsService.getTrialStatus,
    enabled: isEligible,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  if (!status) return null

  const isTrial = status.status === 'TRIAL'
  const isExpired = status.status === 'EXPIRED' || status.status === 'SUSPENDED'
  const isActivePaidApproaching =
    status.status === 'ACTIVE' &&
    status.days_remaining >= 0 &&
    status.days_remaining <= 14

  if (!isTrial && !isExpired && !isActivePaidApproaching) return null

  if (isExpired) {
    return (
      <div className="px-4 py-2 flex items-center justify-between gap-4 text-xs font-medium bg-red-950 border-b border-red-900 text-red-300 flex-shrink-0">
        <span>Your plan has expired — upgrade to continue using NexusPOS</span>
        <Link
          to="/app/subscription/current"
          className="flex-shrink-0 px-3 py-1 rounded-lg font-semibold transition-colors bg-red-600 hover:bg-red-500 text-white"
        >
          Upgrade Now
        </Link>
      </div>
    )
  }

  const days = status.days_remaining
  const urgent = days <= 3

  if (isActivePaidApproaching) {
    return (
      <div className={`px-4 py-2 flex items-center justify-between gap-4 text-xs font-medium flex-shrink-0 ${
        urgent
          ? 'bg-red-950 border-b border-red-900 text-red-300'
          : 'bg-amber-950/60 border-b border-amber-900/40 text-amber-300'
      }`}>
        <span>
          {urgent
            ? `${status.plan_name} expires in ${days} day${days !== 1 ? 's' : ''} — renew now to avoid interruption`
            : `${status.plan_name} · ${days} day${days !== 1 ? 's' : ''} remaining — renew to continue`
          }
        </span>
        <Link
          to="/app/subscription/current"
          className={`flex-shrink-0 px-3 py-1 rounded-lg font-semibold transition-colors ${
            urgent
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
          }`}
        >
          Renew Plan
        </Link>
      </div>
    )
  }

  return (
    <div className={`px-4 py-2 flex items-center justify-between gap-4 text-xs font-medium flex-shrink-0 ${
      urgent
        ? 'bg-red-950 border-b border-red-900 text-red-300'
        : 'bg-amber-950/60 border-b border-amber-900/40 text-amber-300'
    }`}>
      <span>
        {urgent
          ? `Trial expires in ${days} day${days !== 1 ? 's' : ''} — upgrade now to keep your data`
          : `Free trial · ${days} day${days !== 1 ? 's' : ''} remaining`
        }
      </span>
      <Link
        to="/app/subscription/current"
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
