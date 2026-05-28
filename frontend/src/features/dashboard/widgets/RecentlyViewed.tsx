import { useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '@/store/workspace.store'
import { DashboardSection } from './DashboardSection'

const TYPE_ICONS: Record<string, string> = {
  customer:       '👤',
  product:        '📦',
  purchase_order: '🛒',
  supplier:       '🏭',
}

export function RecentlyViewed() {
  const navigate = useNavigate()
  const { recentItems, clearRecent } = useWorkspaceStore()

  if (!recentItems.length) return null

  return (
    <DashboardSection
      title="Recently Viewed"
      action={{ label: 'Clear', onClick: clearRecent }}
    >
      <div className="flex flex-wrap gap-2">
        {recentItems.slice(0, 8).map(item => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => navigate(item.path)}
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-3 py-2 text-xs text-zinc-300 hover:text-zinc-100 transition-all duration-150"
          >
            <span>{TYPE_ICONS[item.type] ?? '📄'}</span>
            <span className="max-w-[120px] truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </DashboardSection>
  )
}
