import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { Badge, Btn, Spinner } from '@/components/ui'
import { fmtDate } from '@/lib/utils'

export default function TrialExpiredPage() {
  const { user, logout } = useAuthStore()

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ['subscription-me'],
    queryFn: subscriptionsService.getMySubscription,
    retry: 1,
  })

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['public-plans'],
    queryFn: subscriptionsService.getPublicPlans,
    staleTime: 5 * 60 * 1000,
  })

  // Super admin never sees this page
  if (user?.role === 'SUPER_ADMIN') return <Navigate to="/admin/dashboard" replace />

  // If subscription is actually active/trial, redirect to app
  if (!subLoading && sub && sub.status !== 'EXPIRED' && sub.status !== 'SUSPENDED' && sub.status !== 'CANCELLED') {
    return <Navigate to="/app/dashboard" replace />
  }

  const isLoading = subLoading || plansLoading

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-900/40 border border-red-800/60 shadow-2xl mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">
            {sub?.status === 'SUSPENDED' ? 'Account Suspended' : 'Trial Period Ended'}
          </h1>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            {sub?.status === 'SUSPENDED'
              ? 'Your account has been suspended. Contact support to resolve this.'
              : 'Your free trial has expired. Activate a subscription to continue using NexusPOS.'}
          </p>
        </div>

        {/* Current plan info card */}
        {sub && !subLoading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Current Plan</p>
                <p className="text-zinc-100 font-semibold mt-0.5">{sub.plan?.name ?? 'Trial Plan'}</p>
              </div>
              <Badge variant="danger">{sub.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-zinc-500 text-xs">Started</p>
                <p className="text-zinc-300">{fmtDate(sub.started_at)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Expired</p>
                <p className="text-red-400 font-medium">{fmtDate(sub.expires_at)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <Link to="/app/subscription/billing">
            <Btn variant="primary" size="lg" fullWidth>
              Submit Payment Proof to Activate
            </Btn>
          </Link>
          <Link to="/app/subscription/current">
            <Btn variant="secondary" size="lg" fullWidth>
              View Subscription Options
            </Btn>
          </Link>
        </div>

        {/* Available plans */}
        {!plansLoading && plans && plans.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider text-center mb-4">Available Plans</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((plan, i) => (
                <div
                  key={plan.id}
                  className={`bg-zinc-900 border rounded-xl p-4 ${
                    i === Math.floor(plans.length / 2)
                      ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                      : 'border-zinc-800'
                  }`}
                >
                  {i === Math.floor(plans.length / 2) && (
                    <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">Most Popular</p>
                  )}
                  <p className="text-zinc-100 font-semibold">{plan.name}</p>
                  <p className="text-2xl font-bold text-zinc-100 mt-1">
                    {plan.currency} {Number(plan.price).toFixed(0)}
                    <span className="text-sm font-normal text-zinc-500">/{plan.billing_cycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
                  </p>
                  <ul className="mt-3 space-y-1">
                    {plan.entitlements.slice(0, 3).map(ent => (
                      <li key={ent.feature_code} className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <span className="text-green-500">✓</span>
                        {ent.feature_code.replace(/_/g, ' ')}
                        {ent.limit_value ? `: ${ent.limit_value}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner size={24} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-6 mt-8 text-xs text-zinc-600">
          <button onClick={logout} className="hover:text-zinc-400 transition-colors">
            Log out
          </button>
          <span>·</span>
          <a href="mailto:support@nexuspos.com" className="hover:text-zinc-400 transition-colors">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
