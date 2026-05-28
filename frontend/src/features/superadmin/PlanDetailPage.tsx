import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { cn } from '@/shared/utils'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: plan, isLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => subscriptionsService.getPlan(id!),
  })

  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => subscriptionsService.updatePlan(id!, { is_active: active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan', id] })
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success('Plan updated')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update plan'),
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  if (!plan) return <div className="flex items-center justify-center h-full"><p className="text-zinc-500 text-sm">Plan not found.</p></div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
        <button onClick={() => navigate('/super-admin/plans')} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-zinc-100 truncate">{plan.name}</h2>
        </div>
        <div className="flex gap-2">
          <Btn
            variant={plan.is_active ? 'secondary' : 'success'}
            size="sm"
            onClick={() => toggleMutation.mutate(!plan.is_active)}
            disabled={toggleMutation.isPending}
          >
            {plan.is_active ? 'Deactivate' : 'Activate'}
          </Btn>
          <Btn size="sm" onClick={() => navigate(`/super-admin/plans/${id}/edit`)}>Edit</Btn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-4">
          {/* Overview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-zinc-100">{plan.name}</h3>
                  <Badge variant={plan.is_active ? 'success' : 'default'}>{plan.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {plan.description && <p className="text-sm text-zinc-500 mt-1">{plan.description}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-zinc-100">
                  {plan.currency} {Number(plan.price).toFixed(2)}
                </p>
                <p className="text-xs text-zinc-500">{plan.billing_cycle.toLowerCase()}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Code</p>
                <p className="text-zinc-300 font-mono text-xs">{plan.code}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Trial</p>
                <p className="text-zinc-300">{plan.trial_days} days</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Sort Order</p>
                <p className="text-zinc-300">{plan.sort_order}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Created</p>
                <p className="text-zinc-300 text-xs">{fmtDate(plan.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Updated</p>
                <p className="text-zinc-300 text-xs">{fmtDate(plan.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* Entitlements */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-sm font-medium text-zinc-100">Features & Limits</p>
            </div>
            {plan.entitlements.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">No entitlements configured.</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {plan.entitlements.map(e => (
                  <div key={e.feature_code} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
                        e.enabled ? 'bg-green-900 text-green-400' : 'bg-zinc-800 text-zinc-600',
                      )}>
                        {e.enabled ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        )}
                      </span>
                      <span className={cn('text-sm capitalize', e.enabled ? 'text-zinc-200' : 'text-zinc-600')}>
                        {e.feature_code.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {e.limit_value === null ? 'Unlimited' : e.limit_value === 0 ? 'Unlimited' : `Limit: ${e.limit_value}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
