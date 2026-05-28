import { cn } from '@/lib/utils'

export interface ActivityItem {
  id: string
  label: string
  sub?: string
  time?: string
  icon?: string
  onClick?: () => void
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-xl bg-zinc-800 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
        <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-1/2" />
      </div>
      <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-14 flex-shrink-0" />
    </div>
  )
}

interface ActivityFeedProps {
  items: ActivityItem[]
  isLoading?: boolean
  emptyText?: string
}

export function ActivityFeed({ items, isLoading, emptyText = 'No recent activity' }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-8 text-center">
        <p className="text-sm text-zinc-600">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 divide-y divide-zinc-800">
      {items.map(item => (
        <div
          key={item.id}
          className={cn(
            'flex items-center gap-3 py-3',
            item.onClick && 'cursor-pointer hover:bg-zinc-800/40 -mx-4 px-4 transition-colors rounded-xl',
          )}
          onClick={item.onClick}
        >
          {item.icon && (
            <span className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-sm flex-shrink-0">
              {item.icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 truncate">{item.label}</p>
            {item.sub && <p className="text-xs text-zinc-500 truncate mt-0.5">{item.sub}</p>}
          </div>
          {item.time && <span className="text-xs text-zinc-600 flex-shrink-0">{item.time}</span>}
        </div>
      ))}
    </div>
  )
}
