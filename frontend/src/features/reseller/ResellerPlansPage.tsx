import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { Badge, Spinner } from '@/components/ui'
import { cn } from '@/shared/utils'
import type { Plan } from '@/shared/types'

// Feature display helpers

const FEATURE_LABELS: Record<string, string> = {
  users:         'Staff / Users',
  branches:      'Branches',
  products:      'Products',
  customers:     'Customers',
  devices:       'Devices',
  analytics:     'Analytics',
  procurement:   'Procurement',
  sync:          'Offline Sync',
  notifications: 'Notifications',
  sales:         'Sales Engine',
  inventory:     'Inventory',
  pos:           'POS / Checkout',
}

const FEATURE_ICONS: Record<string, string> = {
  users:         '👥',
  branches:      '🏪',
  products:      '📦',
  customers:     '🧑‍💼',
  devices:       '📱',
  analytics:     '📊',
  procurement:   '🛒',
  sync:          '🔄',
  notifications: '🔔',
  sales:         '💳',
  inventory:     '🗃️',
  pos:           '🖥️',
}

function featureLabel(code: string) {
  return FEATURE_LABELS[code] ?? code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function featureIcon(code: string) {
  return FEATURE_ICONS[code] ?? '✦'
}

function formatLimit(limit: number | null): string {
  if (limit === null || limit === 0) return 'Unlimited'
  return limit.toLocaleString()
}

function formatPrice(price: string, currency: string, cycle: string): string {
  const num = Number(price)
  if (num === 0) return 'Free'
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 0 })
  const curr = currency === 'MMK' ? 'Kyats' : currency
  const per = cycle === 'YEARLY' ? 'yr' : 'mo'
  return `${formatted} ${curr} / ${per}`
}

//  Plan Card 

function PlanCard({ plan, highlight }: { plan: Plan; highlight?: boolean }) {
  const [copied, setCopied] = useState(false)
  const price = Number(plan.price)
  const isFree = price === 0

  const enabledFeatures = plan.entitlements.filter(e => e.enabled)
  const disabledFeatures = plan.entitlements.filter(e => !e.enabled)

  const pitchText = [
    `📋 ${plan.name} Plan`,
    `💰 ${formatPrice(plan.price, plan.currency, plan.billing_cycle)}`,
    plan.description ? `\n${plan.description}` : '',
    '',
    '✅ Included:',
    ...enabledFeatures.map(e => {
      const limit = e.limit_value ? ` (up to ${formatLimit(e.limit_value)})` : ''
      return `  • ${featureLabel(e.feature_code)}${limit}`
    }),
    disabledFeatures.length > 0 ? '\n❌ Not included:' : '',
    ...disabledFeatures.map(e => `  • ${featureLabel(e.feature_code)}`),
  ].filter(l => l !== undefined).join('\n')

  function copyPitch() {
    navigator.clipboard.writeText(pitchText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      'relative flex flex-col bg-zinc-900 border rounded-2xl overflow-hidden transition-all duration-200',
      highlight
        ? 'border-orange-500/60 shadow-lg shadow-orange-900/20'
        : 'border-zinc-800 hover:border-zinc-700',
    )}>
      {highlight && (
        <div className="bg-orange-500 text-black text-[10px] font-bold tracking-widest uppercase text-center py-1">
          Most Popular
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-zinc-100">{plan.name}</h3>
          {plan.trial_days > 0 && (
            <Badge variant="info" size="xs">{plan.trial_days}d trial</Badge>
          )}
        </div>
        {plan.description && (
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{plan.description}</p>
        )}
        <div className="mt-3">
          {isFree ? (
            <p className="text-2xl font-black text-zinc-100">Free</p>
          ) : (
            <>
              <p className="text-2xl font-black text-zinc-100 tabular-nums">
                {Number(plan.price).toLocaleString()}
                <span className="text-sm font-normal text-zinc-500 ml-1">
                  {plan.currency === 'MMK' ? 'Kyats' : plan.currency}
                </span>
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">
                per {plan.billing_cycle === 'YEARLY' ? 'year' : 'month'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 px-5 py-4 space-y-2">
        {enabledFeatures.length === 0 && (
          <p className="text-xs text-zinc-600 italic">No features listed</p>
        )}
        {enabledFeatures.map(e => (
          <div key={e.feature_code} className="flex items-center gap-2">
            <span className="text-green-500 flex-shrink-0 text-xs">✓</span>
            <span className="text-xs leading-none">
              <span className="mr-1">{featureIcon(e.feature_code)}</span>
              <span className="text-zinc-300">{featureLabel(e.feature_code)}</span>
              {e.limit_value !== null && e.limit_value > 0 && (
                <span className="text-zinc-500 ml-1">up to {formatLimit(e.limit_value)}</span>
              )}
              {(e.limit_value === null || e.limit_value === 0) && (
                <span className="text-zinc-500 ml-1">unlimited</span>
              )}
            </span>
          </div>
        ))}
        {disabledFeatures.length > 0 && (
          <div className="pt-1 space-y-1.5 border-t border-zinc-800/50 mt-2">
            {disabledFeatures.map(e => (
              <div key={e.feature_code} className="flex items-center gap-2 opacity-40">
                <span className="text-zinc-600 flex-shrink-0 text-xs">✕</span>
                <span className="text-xs text-zinc-500 line-through leading-none">
                  <span className="mr-1">{featureIcon(e.feature_code)}</span>
                  {featureLabel(e.feature_code)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="px-5 pb-5">
        <button
          onClick={copyPitch}
          className={cn(
            'w-full py-2 rounded-xl text-xs font-semibold border transition-all duration-150',
            copied
              ? 'bg-green-900/40 border-green-700 text-green-400'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-zinc-100',
          )}
        >
          {copied ? '✓ Copied to clipboard' : '📋 Copy pitch text'}
        </button>
      </div>
    </div>
  )
}

//  Comparison table 

function ComparisonTable({ plans }: { plans: Plan[] }) {
  // Collect all unique feature codes across all plans (enabled or disabled)
  const allCodes = Array.from(
    new Set(plans.flatMap(p => p.entitlements.map(e => e.feature_code)))
  ).sort((a, b) => featureLabel(a).localeCompare(featureLabel(b)))

  function getEntitlement(plan: Plan, code: string) {
    return plan.entitlements.find(e => e.feature_code === code)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium w-40">Feature</th>
            {plans.map(p => (
              <th key={p.id} className="text-center px-4 py-3 text-xs font-semibold min-w-[120px]">
                <p className="text-zinc-100">{p.name}</p>
                <p className="text-zinc-500 font-normal mt-0.5">{formatPrice(p.price, p.currency, p.billing_cycle)}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allCodes.map(code => (
            <tr key={code} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
              <td className="px-4 py-2.5 text-xs text-zinc-400">
                <span className="mr-1.5">{featureIcon(code)}</span>
                {featureLabel(code)}
              </td>
              {plans.map(plan => {
                const ent = getEntitlement(plan, code)
                if (!ent || !ent.enabled) {
                  return (
                    <td key={plan.id} className="px-4 py-2.5 text-center">
                      <span className="text-zinc-700 text-sm">—</span>
                    </td>
                  )
                }
                return (
                  <td key={plan.id} className="px-4 py-2.5 text-center">
                    {ent.limit_value !== null && ent.limit_value > 0 ? (
                      <span className="text-xs font-medium text-zinc-300 bg-zinc-800 rounded-lg px-2 py-0.5">
                        {formatLimit(ent.limit_value)}
                      </span>
                    ) : (
                      <span className="text-green-500 text-sm font-bold">✓</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

//  Main page 

export default function ResellerPlansPage() {
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const { data, isLoading } = useQuery({
    queryKey: ['plans', 'reseller-view'],
    queryFn: () => subscriptionsService.listPlans({ page_size: 50 }),
    staleTime: 5 * 60 * 1000,
  })

  const plans = (data?.items ?? [])
    .filter(p => p.is_active && !p.is_referral_plan)
    .sort((a, b) => a.sort_order - b.sort_order || Number(a.price) - Number(b.price))

  // Highlight the middle / most expensive non-free plan
  const paidPlans = plans.filter(p => Number(p.price) > 0)
  const highlightId = paidPlans.length > 1
    ? paidPlans[Math.floor(paidPlans.length / 2)]?.id
    : paidPlans[0]?.id

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Plans & Pricing</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Active subscription plans you can present to prospective businesses.
          </p>
        </div>
        <div className="flex gap-1 bg-zinc-800 rounded-xl p-1 border border-zinc-700 self-start">
          {(['cards', 'table'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
                view === v
                  ? 'bg-zinc-700 text-zinc-100 shadow'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {v === 'cards' ? '⊞ Cards' : '⊟ Compare'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size={28} />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-600 text-sm">
          No active plans available at the moment.
        </div>
      ) : (
        <>
          {view === 'cards' ? (
            <div className={cn(
              'grid gap-5',
              plans.length === 1 ? 'grid-cols-1 max-w-sm' :
              plans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            )}>
              {plans.map(plan => (
                <PlanCard key={plan.id} plan={plan} highlight={plan.id === highlightId} />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <ComparisonTable plans={plans} />
            </div>
          )}

          {/* Tips */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tips for resellers</p>
            <ul className="space-y-1.5 text-xs text-zinc-500 list-none">
              <li className="flex items-start gap-2"><span className="text-orange-400 flex-shrink-0">→</span>Use "Copy pitch text" on any plan card to instantly copy a formatted summary you can paste into a chat or email.</li>
              <li className="flex items-start gap-2"><span className="text-orange-400 flex-shrink-0">→</span>Switch to Compare view to show a side-by-side feature breakdown when prospects are deciding between plans.</li>
              <li className="flex items-start gap-2"><span className="text-orange-400 flex-shrink-0">→</span>After a business registers with your referral code, use the Referrals page to submit their payment proof and activate their chosen plan.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
