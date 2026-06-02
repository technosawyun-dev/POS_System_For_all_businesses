import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/shared/utils'
import { useLocaleStore } from '@/i18n/localeStore'

const TABS = [
  { to: '/app/settings/business',    labelKey: 'settings.tab.business' },
  { to: '/app/settings/branches',    labelKey: 'settings.tab.branches' },
  { to: '/app/settings/staff',       labelKey: 'settings.tab.staff' },
  { to: '/app/settings/receipt',     labelKey: 'settings.tab.receipt' },
  { to: '/app/settings/tax',         labelKey: 'settings.tab.tax' },
  { to: '/app/settings/preferences', labelKey: 'settings.tab.preferences' },
]

export default function SettingsLayout() {
  const t = useLocaleStore(s => s.t)
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-4 pb-0 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-100 mb-3">{t('settings.title')}</h1>
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => cn(
                'px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                isActive
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-200',
              )}
            >
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
