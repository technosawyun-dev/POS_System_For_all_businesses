import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm font-semibold text-zinc-100">{value}</span>
    </div>
  )
}

export default function PlatformAnalyticsPage() {
  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: subscriptionsService.adminGetOverview,
  })

  const ov = overviewQuery.data
  const mrr = ov ? Number(ov.monthly_revenue) : 0
  const arr = mrr * 12

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-100">Platform Analytics</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Financial and subscription metrics</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Backend gap notice */}
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-400 font-medium">Partial backend support</p>
          <p className="text-xs text-amber-300/70 mt-1">
            Only subscription-level platform metrics are available. Detailed analytics (tenant growth, churn, revenue by plan,
            user counts, order volume) require dedicated platform admin endpoints not yet implemented in the backend.
          </p>
        </div>

        {overviewQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : ov ? (
          <>
            {/* Revenue cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'MRR', value: `MMK ${mrr.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: 'Monthly recurring revenue' },
                { label: 'ARR (est.)', value: `MMK ${arr.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: 'MRR × 12' },
                { label: 'Total Businesses', value: ov.total_tenants.toLocaleString(), sub: 'All tenants' },
                { label: 'Active', value: ov.active_subscriptions.toLocaleString(), sub: 'Active subscriptions' },
              ].map(card => (
                <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-xs text-zinc-500">{card.label}</p>
                  <p className="text-xl font-bold text-zinc-100 mt-1">{card.value}</p>
                  <p className="text-xs text-zinc-600 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Subscription breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Subscription Breakdown</h3>
              <StatRow label="Active" value={<span className="text-green-400">{ov.active_subscriptions}</span>} />
              <StatRow label="Trial" value={<span className="text-blue-400">{ov.trial_subscriptions}</span>} />
              <StatRow label="Expired" value={<span className="text-red-400">{ov.expired_subscriptions}</span>} />
              <StatRow label="Suspended" value={<span className="text-amber-400">{ov.suspended_subscriptions}</span>} />
              <StatRow
                label="Paid Conversion"
                value={
                  ov.total_tenants > 0
                    ? `${((ov.active_subscriptions / ov.total_tenants) * 100).toFixed(1)}%`
                    : '—'
                }
              />
            </div>

            {/* What's missing notice */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Planned Metrics (Backend Gaps)</h3>
              {[
                'Revenue by plan distribution',
                'Tenant growth over time (MoM, YoY)',
                'Trial-to-paid conversion rate by cohort',
                'Churn rate and churned MRR',
                'Top resellers by managed revenue',
                'Most active businesses by order volume',
                'Platform usage metrics (users, branches, devices)',
              ].map(item => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-zinc-600 text-xs mt-0.5">○</span>
                  <p className="text-xs text-zinc-500">{item}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
