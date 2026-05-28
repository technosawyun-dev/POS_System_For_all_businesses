import { useState } from 'react'
import { cn } from '@/shared/utils'
import { useTenantStore } from '@/store/tenant.store'

interface BranchSelectorProps {
  compact?: boolean
}

export default function BranchSelector({ compact = false }: BranchSelectorProps) {
  const { selectedBranch, availableBranches, setSelectedBranch } = useTenantStore()
  const [open, setOpen] = useState(false)

  if (!availableBranches.length) {
    return (
      <div className={cn('px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800', compact && 'text-[10px]')}>
        <span className="text-zinc-500 text-xs">No branch</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors w-full text-left',
          compact ? 'text-[10px]' : 'text-xs',
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-zinc-300 font-medium truncate">
          {selectedBranch?.name ?? 'Select branch'}
        </span>
        <svg className="w-3 h-3 text-zinc-500 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 py-1">
          {availableBranches.map(branch => (
            <button
              key={branch.id}
              onClick={() => { setSelectedBranch(branch); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors',
                selectedBranch?.id === branch.id ? 'text-amber-400' : 'text-zinc-300',
              )}
            >
              {branch.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
