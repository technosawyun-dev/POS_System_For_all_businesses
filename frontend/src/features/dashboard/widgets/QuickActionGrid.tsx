import { useNavigate } from 'react-router-dom'
import { useLocaleStore } from '@/i18n/localeStore'

export interface QuickAction {
  labelKey: string
  descKey?: string
  icon: string
  path: string
}

export function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  const navigate = useNavigate()
  const t = useLocaleStore(s => s.t)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {actions.map(a => (
        <button
          key={a.path}
          onClick={() => navigate(a.path)}
          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-4 text-left transition-all duration-150 group"
        >
          <span className="text-2xl block mb-2">{a.icon}</span>
          <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors leading-tight">
            {t(a.labelKey)}
          </p>
          {a.descKey && (
            <p className="text-xs text-zinc-600 mt-1 leading-tight">{t(a.descKey)}</p>
          )}
        </button>
      ))}
    </div>
  )
}
