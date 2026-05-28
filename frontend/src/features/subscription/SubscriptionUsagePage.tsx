import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui'
import { cn } from '@/shared/utils'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

const FEATURE_LABELS: Record<string, string> = {
  users:         'Users / Staff',
  branches:      'Branches',
  products:      'Products',
  customers:     'Customers',
  devices:       'Devices',
  analytics:     'Analytics',
  procurement:   'Procurement',
  sync:          'Offline Sync',
  notifications: 'Notifications',
  sales:         'Sales',
  inventory:     'Inventory',
  // Plans may use max_* prefixed codes
  max_users:     'Users / Staff',
  max_branches:  'Branches',
  max_products:  'Products',
  max_customers: 'Customers',
  max_devices:   'Devices',
  max_staff:     'Users / Staff',
}

function label(code: string) {
  return FEATURE_LABELS[code] ?? code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function LimitRow({
  code,
  enabled,
  limit,
  used,
}: {
  code: string
  enabled: boolean
  limit: number | null
  used: number | null
}) {
  const isUnlimited = limit === null || limit === 0
  const pct = (!isUnlimited && used !== null && limit) ? Math.min((used / limit) * 100, 100) : 0

  let barColor = 'bg-green-500'
  if (pct >= 90) barColor = 'bg-red-500'
  else if (pct >= 75) barColor = 'bg-amber-500'

  return (
    <div className={cn('px-4 py-3.5', !enabled && 'opacity-40')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn(
            'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
            enabled ? 'bg-green-900 text-green-400' : 'bg-zinc-800 text-zinc-600',
          )}>
            {enabled ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            )}
          </span>
          <span className="text-sm text-zinc-200 capitalize">{label(code)}</span>
        </div>
        <span className="text-xs text-zinc-500 flex-shrink-0">
          {!enabled
            ? 'Disabled'
            : isUnlimited
            ? (used !== null ? `${used} used · Unlimited` : 'Unlimited')
            : used !== null
            ? `${used} / ${limit}`
            : `Limit: ${limit}`}
        </span>
      </div>
      {enabled && !isUnlimited && limit !== null && used !== null && (
        <div className="mt-2 ml-6">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
          </div>
          {pct >= 90 && (
            <p className="text-[10px] text-red-400 mt-1">Approaching limit</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SubscriptionUsagePage() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: subscriptionsService.getTrialStatus,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={28} />
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-sm">No subscription found.</p>
      </div>
    )
  }

  const usageEntries = Object.entries(status.usage)

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl space-y-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-100">Plan Usage: {status.plan_name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {status.days_remaining} days remaining · expires {status.expires_at.split('T')[0]}
              </p>
            </div>
            <span className={cn(
              'text-xs px-2 py-1 rounded-lg border font-medium',
              status.status === 'ACTIVE' ? 'bg-green-950 border-green-800 text-green-400'
                : status.status === 'TRIAL' ? 'bg-blue-950 border-blue-800 text-blue-400'
                : 'bg-red-950 border-red-800 text-red-400',
            )}>
              {status.status}
            </span>
          </div>
          <div className="divide-y divide-zinc-800">
            {usageEntries.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">No usage data available.</p>
            ) : (
              usageEntries.map(([code, info]) => (
                <LimitRow
                  key={code}
                  code={code}
                  enabled={info.limit !== 0}
                  limit={info.limit}
                  used={info.used}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
