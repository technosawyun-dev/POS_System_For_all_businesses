import type { ReactNode } from 'react'

interface DashboardSectionProps {
  title: string
  action?: { label: string; onClick: () => void }
  children: ReactNode
}

export function DashboardSection({ title, action, children }: DashboardSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
