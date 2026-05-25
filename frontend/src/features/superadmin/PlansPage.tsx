import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

export default function PlansPage() {
  const navigate = useNavigate()
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['plans', { includeInactive, page }],
    queryFn: () => subscriptionsService.listPlans({ include_inactive: includeInactive, page, page_size: 20 }),
  })

  const plans = data?.items ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Subscription Plans</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{data?.total ?? 0} plan{data?.total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={e => { setIncludeInactive(e.target.checked); setPage(1) }}
              className="rounded"
            />
            Show inactive
          </label>
          <Btn size="sm" onClick={() => navigate('/super-admin/plans/new')}>+ New Plan</Btn>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : plans.length === 0 ? (
          <Empty title="No plans found" />
        ) : (
          <div className="max-w-4xl space-y-3">
            {plans.map(plan => (
              <div
                key={plan.id}
                onClick={() => navigate(`/super-admin/plans/${plan.id}`)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        {plan.name}
                      </h3>
                      <Badge variant={plan.is_active ? 'success' : 'default'} size="xs">
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-xs text-zinc-600 font-mono">{plan.code}</span>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{plan.description}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-zinc-100">
                      {plan.currency} {Number(plan.price).toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-500">{plan.billing_cycle.toLowerCase()}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                  <span>Trial: {plan.trial_days} days</span>
                  <span>Features: {plan.entitlements.filter(e => e.enabled).length}</span>
                  <span>Sort: {plan.sort_order}</span>
                </div>
              </div>
            ))}

            {(data?.total_pages ?? 0) > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-500 self-center">{page} / {data?.total_pages}</span>
                <Btn variant="secondary" size="xs" disabled={!data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
