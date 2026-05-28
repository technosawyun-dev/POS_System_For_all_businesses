import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

export interface AlertItem {
  id: string
  label: string
  sub?: string
  severity: 'critical' | 'warning' | 'info'
  action?: { label: string; path: string }
}

const SEVERITY: Record<AlertItem['severity'], { border: string; dot: string; text: string }> = {
  critical: { border: 'border-red-800/50',   dot: 'bg-red-400',    text: 'text-red-400'    },
  warning:  { border: 'border-amber-800/50', dot: 'bg-amber-400',  text: 'text-amber-400'  },
  info:     { border: 'border-blue-800/50',  dot: 'bg-blue-400',   text: 'text-blue-400'   },
}

function SkeletonAlert() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="h-3 bg-zinc-800 animate-pulse rounded w-3/4 mb-1.5" />
      <div className="h-2.5 bg-zinc-800 animate-pulse rounded w-1/2" />
    </div>
  )
}

export function AlertPanel({ items, isLoading }: { items: AlertItem[]; isLoading?: boolean }) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <SkeletonAlert key={i} />)}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-6 text-center">
        <p className="text-sm text-green-400 font-medium">✓ All clear — no active alerts</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const s = SEVERITY[item.severity]
        return (
          <div key={item.id} className={cn('bg-zinc-900 border rounded-xl px-4 py-3', s.border)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', s.dot)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                  {item.sub && <p className="text-xs text-zinc-500 mt-0.5">{item.sub}</p>}
                </div>
              </div>
              {item.action && (
                <button
                  onClick={() => navigate(item.action!.path)}
                  className={cn('text-xs font-medium flex-shrink-0 transition-opacity hover:opacity-70', s.text)}
                >
                  {item.action.label} →
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
