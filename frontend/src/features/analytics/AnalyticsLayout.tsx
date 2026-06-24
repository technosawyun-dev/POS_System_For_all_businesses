import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/analytics/dashboard', label: 'Dashboard' },
  { to: '/app/analytics/sales',     label: 'Sales'     },
  { to: '/app/analytics/inventory', label: 'Inventory' },
  { to: '/app/analytics/customers', label: 'Customers' },
  { to: '/app/analytics/financial', label: 'Financial' },
  { to: '/app/analytics/staff',     label: 'Staff'     },
  { to: '/app/analytics/exports',   label: 'Exports'   },
]

export default function AnalyticsLayout() {
  const location = useLocation()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950">
        <nav className="flex overflow-x-auto px-4 lg:px-6 gap-0">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={{ pathname: tab.to, search: location.search }}
              className={({ isActive }) => cn(
                'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-150',
                isActive
                  ? 'text-amber-400 border-amber-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-200',
              )}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
