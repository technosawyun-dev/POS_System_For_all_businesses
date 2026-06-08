import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { useSubscriptionStore } from '@/store/subscription.store'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

function UpgradeModal({ onClose, isTrial }: { onClose: () => void; isTrial: boolean }) {
  const navigate = useNavigate()

  function goToSubscription() {
    onClose()
    navigate('/app/subscription/current')
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-amber-400">
            <path d="M12 2L2 19h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 9v5M12 16.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-zinc-100 text-center mb-2">
          {isTrial ? 'Your trial has ended' : 'Your subscription has expired'}
        </h2>
        <p className="text-zinc-400 text-sm text-center mb-6">
          {isTrial
            ? 'Your free trial has ended. Upgrade to a paid plan to continue using NexusPOS and keep all your data.'
            : 'Your subscription has expired. Submit your payment proof to reactivate your plan, or switch to a different plan.'}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={goToSubscription}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
          >
            {isTrial ? 'Upgrade Plan' : 'Manage Subscription'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-colors border border-zinc-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExpiredPlanGate() {
  const [modalOpen, setModalOpen] = useState(false)
  const user = useAuthStore(s => s.user)
  const storeExpired = useSubscriptionStore(s => s.isExpiredOrSuspended)

  const { data: sub } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.getMySubscription,
    enabled: !!user && user.role === 'BUSINESS_OWNER',
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const isExpired =
    storeExpired ||
    sub?.status === 'EXPIRED' ||
    sub?.status === 'SUSPENDED'

  const isTrial = sub?.status === 'TRIAL'

  if (!isExpired) return null
  if (!user || user.role !== 'BUSINESS_OWNER') return null

  return (
    <>
      {/* Transparent overlay - captures all clicks, allows mouse-wheel scroll */}
      <div
        className="absolute inset-0 z-50 cursor-not-allowed"
        onClick={() => setModalOpen(true)}
        onTouchStart={(e) => { e.preventDefault(); setModalOpen(true) }}
        title="Your plan has expired — click to manage subscription"
      />
      {modalOpen && <UpgradeModal isTrial={isTrial} onClose={() => setModalOpen(false)} />}
    </>
  )
}
