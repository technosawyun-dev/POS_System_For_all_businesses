import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '@/shared/utils'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { ResellerPermissionProvider } from './ResellerPermissionContext'
import { ROLE_BADGE_STYLES } from '@/shared/constants/rbac'
import { IconMenu, IconX, IconLogout } from '@/components/icons'



interface ResellerNavItem {
  to: string
  label: string
  icon: string
}

const RESELLER_NAV: ResellerNavItem[] = [
  { to: '/reseller/dashboard',     label: 'Dashboard',     icon: '🏠' },
  { to: '/reseller/referrals',     label: 'Referrals',     icon: '🔗' },
  { to: '/reseller/plans',         label: 'Plans',         icon: '📋' },
  { to: '/reseller/wallet',        label: 'Wallet',        icon: '💰' },
  { to: '/reseller/notifications', label: 'Notifications', icon: '🔔' },
]

function NavItems({ onClose }: { onClose?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {RESELLER_NAV.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onClose}
          className={({ isActive }) => cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent',
          )}
        >
          {({ isActive }) => (
            <>
              <span className={cn('w-[18px] h-[18px] flex items-center justify-center text-base leading-none flex-shrink-0', isActive ? 'text-orange-400' : 'text-zinc-500')}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}


function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  if (!user) return null
  const roleStyle = ROLE_BADGE_STYLES[user.role]

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800 flex-shrink-0">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-black font-black text-lg flex-shrink-0 shadow-lg shadow-orange-900/40">
            R
          </div>
          <div>
            <p className="font-bold text-zinc-100 text-sm leading-tight">Reseller Portal</p>
            <p className="text-zinc-500 text-[10px] leading-tight tracking-wider uppercase">NexusPOS</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <NavItems onClose={onClose} />

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-zinc-800 flex-shrink-0 space-y-3">
        <Link
          to="/reseller/profile"
          onClick={onClose}
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-zinc-800 transition-colors group"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 border"
            style={{ background: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
          >
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-zinc-100 text-sm font-medium truncate leading-tight group-hover:text-orange-300 transition-colors">{user.full_name}</p>
            <p className="text-zinc-500 text-xs leading-tight">Reseller</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-red-400 hover:bg-red-950 border border-transparent hover:border-red-900 transition-all duration-150"
        >
          <IconLogout width="14" height="14" />
          Sign Out
        </button>
      </div>
    </div>
  )
}


function ResellerLayoutInner({ children }: { children?: ReactNode }) {
  const { sidebarOpen, closeSidebar, toggleSidebar } = useUIStore()
  const { isOnline } = useUIStore()

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) closeSidebar() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [closeSidebar])

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col h-full">
        <SidebarContent />
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={closeSidebar} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'lg:hidden fixed top-0 left-0 h-full w-64 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-black font-black text-sm">R</div>
            <span className="font-bold text-zinc-100 text-sm">Reseller</span>
          </div>
          <button onClick={closeSidebar} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
            <IconX width="16" height="16" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarContent onClose={closeSidebar} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isOnline && (
          <div className="flex-shrink-0 bg-amber-950 border-b border-amber-800 px-4 py-1.5">
            <span className="text-amber-400 text-xs font-medium">Working offline — changes will sync when reconnected</span>
          </div>
        )}

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
          <button onClick={toggleSidebar} className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
            <IconMenu width="16" height="16" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-500 flex items-center justify-center flex-shrink-0">
              <span className="text-black font-black text-xs">R</span>
            </div>
            <span className="text-xs font-semibold text-zinc-400">Reseller Portal</span>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}

export default function ResellerLayout() {
  return (
    <ResellerPermissionProvider>
      <ResellerLayoutInner />
    </ResellerPermissionProvider>
  )
}
