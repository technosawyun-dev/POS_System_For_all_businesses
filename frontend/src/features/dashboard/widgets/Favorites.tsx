import { useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '@/store/workspace.store'
import { DashboardSection } from './DashboardSection'

const TYPE_ICONS: Record<string, string> = {
  customer: '👤',
  product:  '📦',
  report:   '📊',
  page:     '📄',
}

export function Favorites() {
  const navigate = useNavigate()
  const { favorites, removeFavorite } = useWorkspaceStore()

  if (!favorites.length) return null

  return (
    <DashboardSection title="Pinned">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {favorites.map(item => (
          <div
            key={item.id}
            className="relative flex items-center gap-2 bg-zinc-900 border border-amber-800/30 rounded-xl px-3 py-2.5 group hover:border-amber-700/50 transition-colors"
          >
            <button
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
              onClick={() => navigate(item.path)}
            >
              <span className="text-base flex-shrink-0">{TYPE_ICONS[item.type] ?? '📄'}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-zinc-100">
                  {item.label}
                </p>
                {item.sub && (
                  <p className="text-[10px] text-zinc-600 truncate mt-0.5">{item.sub}</p>
                )}
              </div>
            </button>
            <button
              onClick={() => removeFavorite(item.id)}
              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-zinc-400 transition-all flex-shrink-0 text-xs"
              title="Unpin"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
