// pos-nav.jsx — AppShell, Sidebar, TopBar, SyncBadge

const { ROLE_LABELS, ROLE_BADGE_STYLES, canAccess } = window;
const { useApp: navUseApp, fmt: navFmt, timeAgo: navTimeAgo } = window;
const { useState: navUseState, useEffect: navUseEffect, useCallback: navUseCallback } = React;

// Sync status badge (top bar)
function SyncBadge({ onClick }) {
  const { state, dispatch } = navUseApp();
  const { isOnline, syncStatus, syncQueue, lastSync } = state;
  const pending = syncQueue.filter(op => op.status === 'pending').length;
  const failed  = syncQueue.filter(op => op.status === 'failed').length;

  const handleSync = navUseCallback(() => {
    if (!isOnline || syncStatus === 'syncing') return;
    dispatch({ type: 'START_SYNC' });
    setTimeout(() => {
      if (Math.random() > 0.15) {
        dispatch({ type: 'SYNC_SUCCESS' });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Sync complete', type: 'success' } });
      } else {
        dispatch({ type: 'SYNC_ERROR' });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Sync failed — will retry', type: 'error' } });
      }
    }, 2000);
  }, [isOnline, syncStatus, dispatch]);

  if (!isOnline) {
    return (
      <button onClick={onClick} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors">
        <IconWifiOff width="13" height="13" className="text-red-400" />
        <span className="text-xs font-medium text-red-400">Offline</span>
        {pending > 0 && <span className="ml-0.5 text-[10px] bg-red-900 text-red-300 rounded-full px-1.5 py-px font-mono">{pending}</span>}
      </button>
    );
  }

  if (syncStatus === 'syncing') {
    return (
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950 border border-blue-800 cursor-not-allowed">
        <Spinner size={12} />
        <span className="text-xs font-medium text-blue-400">Syncing…</span>
      </button>
    );
  }

  if (failed > 0) {
    return (
      <button onClick={onClick} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950 border border-red-800 hover:bg-red-900 transition-colors">
        <IconAlert width="13" height="13" className="text-red-400" />
        <span className="text-xs font-medium text-red-400">{failed} failed</span>
      </button>
    );
  }

  if (pending > 0) {
    return (
      <button onClick={handleSync} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950 border border-amber-800 hover:bg-amber-900 transition-colors">
        <IconSync width="13" height="13" className="text-amber-400" />
        <span className="text-xs font-medium text-amber-400">{pending} pending</span>
      </button>
    );
  }

  return (
    <button onClick={handleSync} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors group">
      <IconWifi width="13" height="13" className="text-green-500" />
      <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
        {lastSync ? navTimeAgo(lastSync) : 'Synced'}
      </span>
    </button>
  );
}

// Offline Banner
function OfflineBanner() {
  const { state } = navUseApp();
  if (state.isOnline) return null;
  return (
    <div className="bg-amber-950 border-b border-amber-900 px-4 py-2 flex items-center gap-2 flex-shrink-0">
      <IconWifiOff width="14" height="14" className="text-amber-400 flex-shrink-0" />
      <span className="text-xs text-amber-300 font-medium">Working offline — all sales will sync when connection is restored</span>
    </div>
  );
}

// Nav item
function NavItem({ id, label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'
      }`}
    >
      <Icon className={active ? 'text-amber-400' : 'text-zinc-600'} />
      <span>{label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
    </button>
  );
}

// Sidebar
function Sidebar() {
  const { state, dispatch } = navUseApp();
  const { screen, user, session, sidebarOpen } = state;

  const NAV_ITEMS = [
    { id:'pos',       label:'Checkout',  icon:IconPOS },
    { id:'products',  label:'Products',  icon:IconProducts },
    { id:'inventory', label:'Inventory', icon:IconInventory },
    { id:'sales',     label:'Sales',     icon:IconSales },
    { id:'sync',      label:'Sync',      icon:IconSync },
  ];

  const navigate = (screen) => {
    dispatch({ type: 'SET_SCREEN', payload: screen });
  };

  const roleStyle = ROLE_BADGE_STYLES[user?.role] || ROLE_BADGE_STYLES.CASHIER;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 h-full border-r border-zinc-800 bg-zinc-950 flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-black font-bold text-sm">N</span>
            </div>
            <div>
              <p className="font-bold text-zinc-100 text-sm leading-none">NexusPOS</p>
              <p className="text-[10px] text-zinc-600 mt-0.5 leading-none">Enterprise</p>
            </div>
          </div>
        </div>

        {/* Session indicator */}
        {session && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-green-950/50 border border-green-900/50">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              <span className="text-xs text-green-400 font-medium">Session Open</span>
            </div>
            <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{session.id}</p>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS
            .filter(item => canAccess(user?.role, item.id))
            .map(item => (
              <NavItem
                key={item.id}
                {...item}
                active={screen === item.id}
                onClick={navigate}
              />
            ))
          }
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: roleStyle.bg, color: roleStyle.text }}
            >
              {user?.initials || '??'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">{user?.name}</p>
              <p className="text-[10px]" style={{ color: roleStyle.text }}>
                {ROLE_LABELS[user?.role]}
              </p>
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'CLOSE_SESSION' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-red-400 hover:bg-red-950/40 transition-all border border-transparent hover:border-red-900/50"
          >
            <IconLogout width="13" height="13" />
            Close Session
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 z-30 border-r border-zinc-800 bg-zinc-950 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-black font-bold text-xs">N</span>
            </div>
            <span className="font-bold text-zinc-100 text-sm">NexusPOS</span>
          </div>
          <button onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })} className="text-zinc-500 hover:text-zinc-200 p-1">
            <IconX width="16" height="16" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
          {NAV_ITEMS
            .filter(item => canAccess(user?.role, item.id))
            .map(item => (
              <NavItem key={item.id} {...item} active={screen === item.id} onClick={(id) => { navigate(id); dispatch({ type: 'CLOSE_SIDEBAR' }); }} />
            ))
          }
        </nav>
        <div className="px-3 py-3 border-t border-zinc-800">
          <button onClick={() => dispatch({ type: 'CLOSE_SESSION' })} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-all">
            <IconLogout width="13" height="13" />Close Session
          </button>
        </div>
      </aside>
    </>
  );
}

// Top Bar
function TopBar({ title, action, search, onSearchChange }) {
  const { state, dispatch } = navUseApp();
  const { isOnline } = state;

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm flex-shrink-0 min-h-[56px]">
      {/* Mobile menu button */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        className="lg:hidden text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <IconMenu width="16" height="16" />
      </button>

      {/* Title */}
      {title && <h1 className="text-sm font-semibold text-zinc-300 hidden sm:block">{title}</h1>}

      {/* Search (if provided) */}
      {search !== undefined && (
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none">
              <IconSearch width="13" height="13" />
            </span>
            <input
              type="text"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search by name, SKU, barcode…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-all text-xs py-2 pl-8 pr-3"
            />
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {action}
        <SyncBadge onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'sync' })} />

        {/* Online toggle (demo) */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_ONLINE' })}
          title={isOnline ? 'Simulate offline' : 'Go online'}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isOnline ? 'text-zinc-600 hover:bg-zinc-800' : 'text-red-500 bg-red-950/40'}`}
        >
          {isOnline ? <IconWifi width="14" height="14" /> : <IconWifiOff width="14" height="14" />}
        </button>
      </div>
    </header>
  );
}

// App Shell
function AppShell({ children, title, action, search, onSearchChange }) {
  const { state, dispatch } = navUseApp();
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      {/* Mobile overlay backdrop */}
      {state.sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-20"
          onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <OfflineBanner />
        <TopBar title={title} action={action} search={search} onSearchChange={onSearchChange} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

Object.assign(window, { SyncBadge, OfflineBanner, Sidebar, TopBar, AppShell });
