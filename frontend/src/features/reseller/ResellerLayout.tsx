import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/shared/utils'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { useResellerStore } from '@/store/reseller.store'
import { resellersService } from '@/services/resellers/resellers.service'
import { ResellerPermissionProvider, useResellerPermissions } from './ResellerPermissionContext'
import { ROLE_BADGE_STYLES } from '@/shared/constants/rbac'
import { IconMenu, IconX, IconLogout } from '@/components/icons'
import type { MyBusinessResponse } from '@/shared/types'


function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}


function BusinessSelector({ businesses }: { businesses: MyBusinessResponse[] }) {
  const { selectedTenantId, setSelectedTenant } = useResellerStore()

  const active = businesses.filter(b => b.is_access_valid)
  if (!active.length) return null

  return (
    <div className="px-3 pt-2">
      <label className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest block mb-1 px-1">
        Business
      </label>
      <select
        value={selectedTenantId ?? ''}
        onChange={e => setSelectedTenant(e.target.value || null)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-200 text-xs px-3 py-2 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
      >
        <option value="">Select a business…</option>
        {active.map(b => (
          <option key={b.tenant_id} value={b.tenant_id}>
            {b.tenant_id.slice(0, 8)}…
          </option>
        ))}
      </select>
    </div>
  )
}


function BranchSelector({ tenantId }: { tenantId: string }) {
  const { selectedBranchId, setSelectedBranch } = useResellerStore()

  const { data } = useQuery({
    queryKey: ['reseller-branches', tenantId],
    queryFn: () => resellersService.getMyBranches(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })

  const branches = data?.branch_ids ?? []
  if (!branches.length) return null

  return (
    <div className="px-3 pt-1">
      <label className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest block mb-1 px-1">
        Branch
      </label>
      <select
        value={selectedBranchId ?? ''}
        onChange={e => setSelectedBranch(e.target.value || null)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-200 text-xs px-3 py-2 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
      >
        <option value="">All branches</option>
        {branches.map(id => (
          <option key={id} value={id}>
            {id.slice(0, 8)}…
          </option>
        ))}
      </select>
    </div>
  )
}


function ExpiryBanner({ businesses }: { businesses: MyBusinessResponse[] }) {
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)
  if (!selectedTenantId) return null

  const assignment = businesses.find(b => b.tenant_id === selectedTenantId)
  if (!assignment?.access_expires_at) return null

  const days = daysUntil(assignment.access_expires_at)
  if (days === null) return null

  if (days < 0) {
    return (
      <div className="flex-shrink-0 bg-red-950 border-b border-red-800 px-4 py-2 flex items-center gap-2">
        <span className="text-red-400 text-xs font-semibold">
          ⚠ Assignment expired — contact your administrator to restore access.
        </span>
      </div>
    )
  }

  if (days <= 7) {
    return (
      <div className="flex-shrink-0 bg-amber-950 border-b border-amber-800 px-4 py-2 flex items-center gap-2">
        <span className="text-amber-400 text-xs font-semibold">
          ⏳ Access expires in {days} day{days !== 1 ? 's' : ''} — contact your administrator.
        </span>
      </div>
    )
  }

  return null
}


interface ResellerNavItem {
  to: string
  label: string
  icon: string
  permissionKey?: keyof ReturnType<typeof useResellerPermissions>
}

const STATIC_NAV: ResellerNavItem[] = [
  { to: '/reseller/dashboard',     label: 'Dashboard',     icon: '🏠' },
  { to: '/reseller/businesses',    label: 'Businesses',    icon: '🏢' },
  { to: '/reseller/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/reseller/profile',       label: 'Profile',       icon: '👤' },
]

const PERMISSION_NAV: Array<ResellerNavItem & { permKey: string }> = [
  { to: '/reseller/analytics',     label: 'Analytics',     icon: '📊', permKey: 'canViewAnalytics'  },
  { to: '/reseller/customers',     label: 'Customers',     icon: '👥', permKey: 'canViewCustomers'  },
  { to: '/reseller/inventory',     label: 'Inventory',     icon: '📦', permKey: 'canViewInventory'  },
  { to: '/reseller/procurement',   label: 'Procurement',   icon: '🛒', permKey: 'canViewProcurement'},
  { to: '/reseller/subscriptions', label: 'Subscription',  icon: '💳', permKey: 'canViewSubscription'},
]

function NavItems({ onClose }: { onClose?: () => void }) {
  const perms = useResellerPermissions()
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)

  const permissionedItems = PERMISSION_NAV.filter(item => {
    if (!selectedTenantId) return false
    const fn = perms[item.permKey as keyof typeof perms]
    return typeof fn === 'function' ? (fn as () => boolean)() : true
  })

  const allItems = [...STATIC_NAV, ...permissionedItems].sort((a, b) =>
    a.to.localeCompare(b.to)
  )

  // Keep dashboard first
  const sorted = [
    ...allItems.filter(i => i.to === '/reseller/dashboard'),
    ...allItems.filter(i => i.to !== '/reseller/dashboard'),
  ]

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {sorted.map(item => (
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


function SidebarContent({
  businesses,
  onClose,
}: {
  businesses: MyBusinessResponse[]
  onClose?: () => void
}) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)

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
        <Link to="/" className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-black font-black text-lg flex-shrink-0 shadow-lg shadow-orange-900/40">
            R
          </div>
          <div>
            <p className="font-bold text-zinc-100 text-sm leading-tight">Reseller Portal</p>
            <p className="text-zinc-500 text-[10px] leading-tight tracking-wider uppercase">NexusPOS</p>
          </div>
        </Link>
        <BusinessSelector businesses={businesses} />
        {selectedTenantId && <BranchSelector tenantId={selectedTenantId} />}
      </div>

      {/* Nav */}
      <NavItems onClose={onClose} />

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-zinc-800 flex-shrink-0 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 border"
            style={{ background: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
          >
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-zinc-100 text-sm font-medium truncate leading-tight">{user.full_name}</p>
            <p className="text-zinc-500 text-xs leading-tight">Reseller</p>
          </div>
        </div>
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

  const { data: businesses = [] } = useQuery({
    queryKey: ['reseller-businesses'],
    queryFn: resellersService.getMyBusinesses,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) closeSidebar() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [closeSidebar])

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col h-full">
        <SidebarContent businesses={businesses} />
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
          <SidebarContent businesses={businesses} onClose={closeSidebar} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isOnline && (
          <div className="flex-shrink-0 bg-amber-950 border-b border-amber-800 px-4 py-1.5">
            <span className="text-amber-400 text-xs font-medium">Working offline — changes will sync when reconnected</span>
          </div>
        )}

        <ExpiryBanner businesses={businesses} />

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

        <main className="flex-1 overflow-hidden">
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
