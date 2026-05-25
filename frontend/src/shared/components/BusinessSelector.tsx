import { useState } from 'react'
import { cn } from '@/shared/utils'
import { useTenantStore } from '@/store/tenant.store'

export default function BusinessSelector() {
  const { selectedBusiness, availableBusinesses, setSelectedBusiness } = useTenantStore()
  const [open, setOpen] = useState(false)

  if (!availableBusinesses.length) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-xs text-left w-full"
      >
        <span className="w-2 h-2 rounded-sm bg-amber-500 flex-shrink-0" />
        <span className="text-zinc-300 font-medium truncate">
          {selectedBusiness?.name ?? 'Select business'}
        </span>
        <svg className="w-3 h-3 text-zinc-500 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 py-1">
          {availableBusinesses.map(biz => (
            <button
              key={biz.id}
              onClick={() => { setSelectedBusiness(biz); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors',
                selectedBusiness?.id === biz.id ? 'text-amber-400' : 'text-zinc-300',
              )}
            >
              <p className="font-medium">{biz.name}</p>
              <p className="text-zinc-500 text-[10px]">{biz.slug}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
