// pos-sales.jsx — Sales history, order detail, sync screen

const { useApp: salesUseApp, fmt: salesFmt, fmtDateTime: salesFmtDT, fmtDate: salesFmtDate, timeAgo: salesTimeAgo } = window;
const { useState: salesUseState, useMemo: salesUseMemo } = React;

const STATUS_STYLES = {
  completed: { badge: 'success', label: 'Completed' },
  refunded:  { badge: 'info',    label: 'Refunded'  },
  voided:    { badge: 'danger',  label: 'Voided'    },
};

const METHOD_ICON = {
  cash:  <IconCash  width="12" height="12" className="text-amber-400" />,
  card:  <IconCard  width="12" height="12" className="text-blue-400"  />,
  split: <IconSplit width="12" height="12" className="text-violet-400"/>,
};

// Order Detail Panel
function OrderDetailPanel({ order, onClose }) {
  const { dispatch } = salesUseApp();
  const [refunding, setRefunding] = salesUseState(false);

  const handleRefund = () => {
    setRefunding(true);
    setTimeout(() => {
      setRefunding(false);
      dispatch({ type: 'SHOW_TOAST', payload: { message: `Refund initiated for ${order.id}`, type: 'info' } });
      onClose();
    }, 1200);
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col flex-shrink-0 animate-slideIn">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200 font-mono">{order.id}</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">{salesFmtDT(order.date)}</p>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
          <IconX width="13" height="13" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Status + method */}
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_STYLES[order.status]?.badge || 'default'} dot>
            {STATUS_STYLES[order.status]?.label || order.status}
          </Badge>
          <Badge variant="default">
            {METHOD_ICON[order.paymentMethod]}
            <span className="capitalize ml-0.5">{order.paymentMethod}</span>
          </Badge>
        </div>

        {/* Cashier */}
        <div className="flex items-center gap-2.5 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
            {order.cashier?.initials || 'XX'}
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-300">{order.cashier?.name || 'Unknown'}</p>
            <p className="text-[10px] text-zinc-600">{window.ROLE_LABELS?.[order.cashier?.role] || 'Cashier'}</p>
          </div>
        </div>

        {/* Items */}
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-2">Items ({order.items.length})</p>
          <div className="space-y-1.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: item.color || '#71717A' }} />
                  <span className="text-xs text-zinc-300 truncate">{item.name}</span>
                  <span className="text-[10px] text-zinc-600 flex-shrink-0">×{item.qty}</span>
                </div>
                <span className="font-mono text-xs text-zinc-200 flex-shrink-0">{salesFmt(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 space-y-1.5">
          <div className="flex justify-between text-xs"><span className="text-zinc-500">Subtotal</span><span className="font-mono text-zinc-300">{salesFmt(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-xs"><span className="text-zinc-500">Discount</span><span className="font-mono text-green-400">–{salesFmt(order.discount)}</span></div>}
          <div className="flex justify-between text-xs"><span className="text-zinc-500">Tax</span><span className="font-mono text-zinc-300">{salesFmt(order.tax)}</span></div>
          <Divider />
          <div className="flex justify-between font-semibold"><span className="text-zinc-200">Total</span><span className="font-mono text-amber-400 text-base">{salesFmt(order.total)}</span></div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <Btn variant="secondary" size="sm" className="flex-1">
          <IconPrint width="13" height="13" />Reprint
        </Btn>
        {order.status === 'completed' && (
          <Btn variant="outline" size="sm" onClick={handleRefund} disabled={refunding} className="flex-1">
            {refunding ? <Spinner size={12} /> : <IconRefund width="13" height="13" />}
            Refund
          </Btn>
        )}
      </div>
    </div>
  );
}

// Sales Screen
function SalesScreen() {
  const { state, dispatch } = salesUseApp();
  const [search, setSearch]    = salesUseState('');
  const [dateFilter, setDate]  = salesUseState('today');
  const [methodFilter, setMeth]= salesUseState('all');

  const now = new Date();
  const startOf = {
    today:  new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    week:   new Date(now - 7 * 86400000),
    month:  new Date(now.getFullYear(), now.getMonth(), 1),
  };

  const filtered = salesUseMemo(() => {
    let list = state.sales;
    const cutoff = startOf[dateFilter];
    if (cutoff) list = list.filter(s => new Date(s.date) >= cutoff);
    if (methodFilter !== 'all') list = list.filter(s => s.paymentMethod === methodFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.id.toLowerCase().includes(q) ||
        s.cashier?.name?.toLowerCase().includes(q) ||
        s.items.some(i => i.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [state.sales, dateFilter, methodFilter, search]);

  const totalRevenue = filtered.filter(s => s.status==='completed').reduce((s,o) => s + o.total, 0);
  const avgOrder     = filtered.length ? totalRevenue / filtered.filter(s=>s.status==='completed').length : 0;
  const refunded     = filtered.filter(s => s.status==='refunded').length;

  const activeOrder = state.activeOrderId ? state.sales.find(s => s.id === state.activeOrderId) : null;

  return (
    <AppShell title="Sales History" search={search} onSearchChange={setSearch}>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-zinc-800 flex-shrink-0">
            <StatCard label="Revenue"    value={salesFmt(totalRevenue)} accent icon={<IconTrending width="14" height="14"/>} />
            <StatCard label="Orders"     value={filtered.filter(s=>s.status==='completed').length} icon={<IconReceipt width="14" height="14"/>} />
            <StatCard label="Avg Order"  value={salesFmt(avgOrder)}     icon={<IconSales width="14" height="14"/>} />
            <StatCard label="Refunds"    value={refunded}               icon={<IconRefund width="14" height="14"/>} />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 flex-shrink-0 overflow-x-auto" style={{scrollbarWidth:'none'}}>
            <div className="flex gap-1">
              {[{id:'today',label:'Today'},{id:'week',label:'7 days'},{id:'month',label:'This month'}].map(f => (
                <button key={f.id} onClick={() => setDate(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${dateFilter===f.id ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}>{f.label}</button>
              ))}
            </div>
            <div className="w-px h-4 bg-zinc-800 mx-1" />
            <div className="flex gap-1">
              {[{id:'all',label:'All'},{id:'cash',label:'Cash'},{id:'card',label:'Card'},{id:'split',label:'Split'}].map(f => (
                <button key={f.id} onClick={() => setMeth(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1 ${methodFilter===f.id ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}>
                  {f.id !== 'all' && METHOD_ICON[f.id]}{f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Order ID</Th>
                  <Th>Date / Time</Th>
                  <Th>Cashier</Th>
                  <Th right>Items</Th>
                  <Th right>Total</Th>
                  <Th>Method</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const st = STATUS_STYLES[order.status] || STATUS_STYLES.completed;
                  const isActive = state.activeOrderId === order.id;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => dispatch({ type: 'SET_ACTIVE_ORDER', payload: isActive ? null : order.id })}
                      className={`cursor-pointer transition-colors ${isActive ? 'bg-zinc-800/80' : 'hover:bg-zinc-900/60'}`}
                    >
                      <Td mono className="font-semibold text-zinc-100">{order.id}</Td>
                      <Td>
                        <div>
                          <p className="text-xs text-zinc-300">{salesFmtDate(order.date)}</p>
                          <p className="text-[10px] text-zinc-600">{salesTimeAgo(order.date)}</p>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                            {order.cashier?.initials || '??'}
                          </div>
                          <span className="text-xs text-zinc-300">{order.cashier?.name?.split(' ')[0]}</span>
                        </div>
                      </Td>
                      <Td right muted>{order.items.reduce((s,i)=>s+i.qty,0)}</Td>
                      <Td right mono className="font-semibold text-amber-400">{salesFmt(order.total)}</Td>
                      <Td>
                        <span className="flex items-center gap-1 text-xs text-zinc-400">
                          {METHOD_ICON[order.paymentMethod]}
                          <span className="capitalize">{order.paymentMethod}</span>
                        </span>
                      </Td>
                      <Td><Badge variant={st.badge} dot>{st.label}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {filtered.length === 0 && (
              <Empty icon={<IconSales width="36" height="36"/>} title="No orders found" subtitle="Try a different date range or filter" />
            )}
          </div>

          <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-zinc-600">{filtered.length} orders · {salesFmt(totalRevenue)} total</p>
          </div>
        </div>

        {/* Detail panel */}
        {activeOrder && (
          <OrderDetailPanel
            order={activeOrder}
            onClose={() => dispatch({ type: 'SET_ACTIVE_ORDER', payload: null })}
          />
        )}
      </div>
    </AppShell>
  );
}

// Sync Screen
function SyncScreen() {
  const { state, dispatch } = salesUseApp();
  const { syncQueue, syncStatus, lastSync, isOnline } = state;

  const pending = syncQueue.filter(op => op.status === 'pending');
  const failed  = syncQueue.filter(op => op.status === 'failed');

  const handleSync = () => {
    if (!isOnline || syncStatus === 'syncing') return;
    dispatch({ type: 'START_SYNC' });
    setTimeout(() => {
      dispatch({ type: 'SYNC_SUCCESS' });
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'All operations synced', type: 'success' } });
    }, 2000);
  };

  const OP_LABELS = {
    SALE_CREATE:       'New Sale',
    INVENTORY_UPDATE:  'Inventory Update',
    PRODUCT_UPDATE:    'Product Update',
    PAYMENT_PROCESS:   'Payment',
  };

  return (
    <AppShell title="Sync & Connectivity">
      <div className="flex flex-col h-full overflow-y-auto p-6 gap-6 max-w-2xl">
        {/* Connection status */}
        <div className={`rounded-2xl border p-5 flex items-center gap-4 ${
          isOnline
            ? 'bg-green-950/30 border-green-900/50'
            : 'bg-red-950/30 border-red-900/50'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOnline ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
            {isOnline ? <IconWifi width="24" height="24" className="text-green-400" /> : <IconWifiOff width="24" height="24" className="text-red-400" />}
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-base ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
              {isOnline ? 'Connected' : 'Offline Mode'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isOnline ? `Last sync: ${lastSync ? salesTimeAgo(lastSync) : 'never'}` : 'All changes saved locally and will sync when reconnected'}
            </p>
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={() => dispatch({ type: 'TOGGLE_ONLINE' })}>
              {isOnline ? 'Simulate Offline' : 'Go Online'}
            </Btn>
            {isOnline && (
              <Btn variant="primary" size="sm" onClick={handleSync} disabled={syncStatus === 'syncing'}>
                {syncStatus === 'syncing' ? <Spinner size={12} /> : <IconSync width="12" height="12" />}
                {syncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
              </Btn>
            )}
          </div>
        </div>

        {/* Queue stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Pending"  value={pending.length} icon={<IconSync width="14" height="14"/>} />
          <StatCard label="Failed"   value={failed.length}  icon={<IconAlert width="14" height="14"/>} />
          <StatCard label="Total Queue" value={syncQueue.length} />
        </div>

        {/* Failed operations */}
        {failed.length > 0 && (
          <div>
            <SectionHeader title="Failed Operations" subtitle="These operations failed and need attention" />
            <div className="flex flex-col gap-2 mt-3">
              {failed.map(op => (
                <div key={op.id} className="flex items-center gap-3 p-3 bg-red-950/30 border border-red-900/40 rounded-xl">
                  <IconAlert width="14" height="14" className="text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200">{OP_LABELS[op.type] || op.type}</p>
                    <p className="text-[10px] text-zinc-600">{op.id} · {salesTimeAgo(op.createdAt)} · {op.retries} retries</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Btn variant="outline" size="xs" onClick={() => dispatch({ type: 'RETRY_SYNC_ITEM', payload: op.id })}>
                      Retry
                    </Btn>
                    <Btn variant="ghost" size="xs" onClick={() => dispatch({ type: 'DISMISS_SYNC_ITEM', payload: op.id })}>
                      Dismiss
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending operations */}
        {pending.length > 0 && (
          <div>
            <SectionHeader title="Pending Sync" subtitle="Queued operations waiting to be sent to server" />
            <div className="flex flex-col gap-2 mt-3">
              {pending.map(op => (
                <div key={op.id} className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-300">{OP_LABELS[op.type] || op.type}</p>
                    <p className="text-[10px] text-zinc-600">{op.id} · {salesTimeAgo(op.createdAt)}</p>
                  </div>
                  <Badge variant="warning" size="xs">Pending</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {syncQueue.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-900/30 border border-green-800/30 flex items-center justify-center mb-3">
              <IconCheck width="24" height="24" className="text-green-500" />
            </div>
            <p className="text-zinc-300 font-medium">All caught up</p>
            <p className="text-zinc-600 text-sm mt-1">No pending or failed operations</p>
          </div>
        )}

        {/* Sync info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Sync Configuration</p>
          <div className="space-y-2">
            {[
              { label: 'Auto-sync interval',   value: 'Every 30 seconds' },
              { label: 'Retry strategy',        value: 'Exponential backoff (max 5)' },
              { label: 'Offline storage',       value: 'IndexedDB (Dexie.js)' },
              { label: 'Conflict resolution',   value: 'Server wins (last-write)' },
              { label: 'Device ID',             value: 'POS-MAIN-001' },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-xs">
                <span className="text-zinc-600">{row.label}</span>
                <span className="text-zinc-400 font-mono">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { SalesScreen, SyncScreen });
