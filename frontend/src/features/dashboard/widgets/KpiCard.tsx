import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: ReactNode
  sub?: string
  icon?: string
  accent?: boolean
  isLoading?: boolean
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-zinc-800 animate-pulse', className)} />
}

export function KpiCard({ label, value, sub, icon, accent, isLoading }: KpiCardProps) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <SkeletonBlock className="h-3 w-20 mb-3" />
        <SkeletonBlock className="h-7 w-28 mb-2" />
        <SkeletonBlock className="h-2.5 w-16" />
      </div>
    )
  }

  return (
    <div className={cn(
      'bg-zinc-900 border rounded-2xl p-5 transition-colors',
      accent ? 'border-amber-800/50 bg-amber-950/10' : 'border-zinc-800',
    )}>
      {icon && (
        <div className="mb-3 w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-base">
          {icon}
        </div>
      )}
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}
