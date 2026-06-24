import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/shared/utils'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { usePreferencesStore } from '@/store/preferences.store'
import { useLocaleStore } from '@/i18n/localeStore'
import { canAccess, ROLE_LABELS, ROLE_BADGE_STYLES } from '@/shared/constants/rbac'
import BranchSelector from '@/shared/components/BranchSelector'
import NotificationBell from '@/shared/components/NotificationBell'
import GlobalSearch from '@/shared/components/GlobalSearch'
import TrialBanner from '@/shared/components/TrialBanner'
import ExpiredPlanGate from '@/shared/components/ExpiredPlanGate'
import { TenantFormatterSync } from '@/components/TenantFormatterSync'
import { notificationsService } from '@/services/notifications/notifications.service'
import { tenantService } from '@/services/tenant/tenant.service'
import {
  IconMenu, IconX, IconPOS, IconProducts, IconInventory,
  IconSales, IconLogout,
} from '@/components/icons'

interface NavItem {
  to: string
  label: string
  section: string
  icon: ReactNode
  /** Hide this item on mobile-width browsers (< 768px). Tablet and wider still show it. */
  tabletOnly?: boolean
}

const APP_NAV: NavItem[] = [
  { to: '/app/dashboard',     section: 'dashboard',     label: 'nav.dashboard',     icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🏠</span> },
  { to: '/app/pos',           section: 'pos',           label: 'nav.checkout',      icon: <IconPOS       width="18" height="18" />, tabletOnly: true },
  { to: '/app/sales',         section: 'sales',         label: 'nav.sales',         icon: <IconSales     width="18" height="18" /> },
  { to: '/app/products',      section: 'products',      label: 'nav.products',      icon: <IconProducts  width="18" height="18" /> },
  { to: '/app/inventory',     section: 'inventory',     label: 'nav.inventory',     icon: <IconInventory width="18" height="18" /> },
  { to: '/app/customers',     section: 'customers',     label: 'nav.customers',     icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">👥</span> },
  { to: '/app/procurement',   section: 'procurement',   label: 'nav.procurement',   icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">📦</span> },
  { to: '/app/analytics',     section: 'analytics',     label: 'nav.analytics',     icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">📊</span> },
  { to: '/app/notifications', section: 'notifications', label: 'nav.notifications', icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🔔</span> },
  { to: '/app/subscription',  section: 'subscription',  label: 'nav.subscription',  icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">💳</span> },
  { to: '/app/settings',      section: 'settings',      label: 'nav.settings',      icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">⚙️</span> },
]

const SUPER_ADMIN_NAV: NavItem[] = [
  { to: '/super-admin/dashboard',        section: 'dashboard',        label: 'nav.sa.dashboard',        icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🏠</span> },
  { to: '/super-admin/businesses',       section: 'businesses',       label: 'nav.sa.businesses',       icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🏢</span> },
  { to: '/super-admin/resellers',        section: 'resellers',        label: 'nav.sa.resellers',        icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🤝</span> },
  { to: '/super-admin/plans',            section: 'plans',            label: 'nav.sa.plans',            icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">📋</span> },
  { to: '/super-admin/payment-methods',  section: 'payment-methods',  label: 'nav.sa.payment_methods',  icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">💳</span> },
  { to: '/super-admin/notifications',    section: 'notifications',    label: 'nav.sa.notifications',    icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🔔</span> },
  { to: '/super-admin/audit-logs',       section: 'audit-logs',       label: 'nav.sa.audit_logs',       icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">📝</span> },
  { to: '/super-admin/reseller-finance', section: 'reseller-finance', label: 'nav.sa.reseller_finance', icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">💰</span> },
]

const RESELLER_NAV: NavItem[] = [
  { to: '/reseller/dashboard',  section: 'dashboard',  label: 'nav.re.dashboard',  icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🏠</span> },
  { to: '/reseller/businesses', section: 'businesses', label: 'nav.re.businesses', icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">🏢</span> },
  { to: '/reseller/analytics',  section: 'analytics',  label: 'nav.re.analytics',  icon: <span className="w-[18px] h-[18px] flex items-center justify-center text-base leading-none">📊</span> },
]

interface DashboardLayoutProps {
  navGroup?: 'app' | 'super-admin' | 'reseller'
}

function SidebarContent({ navGroup, onClose, onSearch }: { navGroup: string; onClose?: () => void; onSearch?: () => void }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const t = useLocaleStore(s => s.t)
  const timeFormat = usePreferencesStore(s => s.timeFormat)

  const tenantId = user?.tenant_id
  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenant(tenantId!),
    enabled: !!tenantId && navGroup === 'app',
    staleTime: 10 * 60 * 1000,
  })

  const tz       = tenant?.timezone ?? 'UTC'
  const locale   = tenant?.locale   ?? 'en-US'
  const currency = tenant?.currency ?? 'MMK'

  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h', timeZone: tz }),
  )

  useEffect(() => {
    function tick() {
      setClock(new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h', timeZone: tz }))
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [locale, tz, timeFormat])

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsService.getUnreadCount,
    enabled: !!user && navGroup === 'app',
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
  const unreadCount = unreadData?.unread_count ?? 0

  if (!user) return null

  const roleStyle = ROLE_BADGE_STYLES[user.role]

  let navItems: NavItem[] = APP_NAV
  if (navGroup === 'super-admin') navItems = SUPER_ADMIN_NAV
  if (navGroup === 'reseller') navItems = RESELLER_NAV

  const filtered = navItems.filter(item => canAccess(user.role, item.section))

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800 flex-shrink-0">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-black font-black text-lg flex-shrink-0 shadow-lg shadow-amber-900/40">
            N
          </div>
          <div>
            <p className="font-bold text-zinc-100 text-sm leading-tight">NexusPOS</p>
            <p className="text-zinc-500 text-[10px] leading-tight tracking-wider uppercase">Enterprise</p>
          </div>
        </Link>
        {navGroup === 'app' && (user?.role === 'BUSINESS_OWNER' || user?.role === 'SUPER_ADMIN') && (
          <div className="mt-3 space-y-2">
            <BranchSelector compact />
            {onSearch && (
              <button
                onClick={onSearch}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all duration-150"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="flex-1 text-left">{t('common.search')}</span>
                <kbd className="text-[9px] bg-zinc-800 border border-zinc-700 rounded px-1">⌘K</kbd>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filtered.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.endsWith('/pos')}
            onClick={onClose}
            className={({ isActive }) => cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left',
              item.tabletOnly && 'hidden md:flex',
              isActive
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent',
            )}
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex-shrink-0', isActive ? 'text-amber-400' : 'text-zinc-500')}>
                  {item.icon}
                </span>
                <span className="flex-1">{t(item.label)}</span>
                {item.section === 'notifications' && unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-zinc-800 flex-shrink-0 space-y-3">
        {navGroup === 'app' && (
          <div className="px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-zinc-200">{clock}</span>
              <span className="text-[10px] text-zinc-600 truncate ml-2">{tz.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-semibold text-amber-400">{currency === 'MMK' ? t('currency.mmk') : currency}</span>
              <span className="text-zinc-700 text-[10px]">·</span>
              <span className="text-[10px] text-zinc-500">{locale}</span>
            </div>
          </div>
        )}
        <Link
          to={navGroup === 'app' ? '/app/profile' : '#'}
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
            <p className="text-zinc-100 text-sm font-medium truncate leading-tight group-hover:text-amber-300 transition-colors">{user.full_name}</p>
            <p className="text-zinc-500 text-xs leading-tight">{ROLE_LABELS[user.role]}</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-red-400 hover:bg-red-950 border border-transparent hover:border-red-900 transition-all duration-150"
        >
          <IconLogout width="14" height="14" />
          {t('common.sign_out')}
        </button>
      </div>
    </div>
  )
}

export default function DashboardLayout({ navGroup = 'app' }: DashboardLayoutProps) {
  const { sidebarOpen, closeSidebar, toggleSidebar, isOnline, posFocusMode } = useUIStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const t = useLocaleStore(s => s.t)
  const location = useLocation()

  // Don't gate the subscription management pages — users must be able to upgrade
  const isSubscriptionRoute = location.pathname.startsWith('/app/subscription')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) closeSidebar() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [closeSidebar])

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* Sync tenant currency/locale/timezone into formatter config */}
      <TenantFormatterSync />

      {/* Global search modal */}
      {navGroup === 'app' && (
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}

      {/* Desktop sidebar — hidden in POS focus mode */}
      {!posFocusMode && (
        <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col h-full">
          <SidebarContent navGroup={navGroup} onSearch={navGroup === 'app' ? () => setSearchOpen(true) : undefined} />
        </aside>
      )}

      {/* Mobile backdrop — hidden in POS focus mode */}
      {sidebarOpen && !posFocusMode && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={closeSidebar} />
      )}

      {/* Mobile sidebar — hidden in POS focus mode */}
      {!posFocusMode && (
        <aside className={cn(
          'lg:hidden fixed top-0 left-0 h-full w-64 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-black font-black text-sm">N</div>
              <span className="font-bold text-zinc-100 text-sm">NexusPOS</span>
            </div>
            <button onClick={closeSidebar} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
              <IconX width="16" height="16" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SidebarContent
              navGroup={navGroup}
              onClose={closeSidebar}
              onSearch={navGroup === 'app' ? () => { setSearchOpen(true); closeSidebar() } : undefined}
            />
          </div>
        </aside>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isOnline && (
          <div className="flex-shrink-0 bg-red-950 border-b border-red-800 px-4 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
            <span className="text-red-400 text-xs font-semibold">{t('offline.banner')}</span>
          </div>
        )}
        {navGroup === 'app' && <TrialBanner />}
        {/* Mobile top bar — hidden in POS focus mode */}
        {!posFocusMode && (
          <header className="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
            <button onClick={toggleSidebar} className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
              <IconMenu width="16" height="16" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-black font-black text-xs">N</span>
              </div>
              <span className="text-xs font-semibold text-zinc-400">NexusPOS</span>
            </div>
            <div className="flex-1" />
            {navGroup === 'app' && (
              <button
                onClick={() => setSearchOpen(true)}
                className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                title="Search (Ctrl+K)"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <NotificationBell />
          </header>
        )}
        {/* Child route renders here — relative wrapper so the expired gate overlay positions correctly */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <main className="h-full overflow-y-auto">
            <Outlet />
          </main>
          {navGroup === 'app' && !isSubscriptionRoute && <ExpiredPlanGate />}
        </div>
      </div>
    </div>
  )
}
