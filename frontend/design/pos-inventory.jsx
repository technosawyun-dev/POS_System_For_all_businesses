// pos-inventory.jsx — Inventory dashboard + stock adjustment

const { useApp: invUseApp, fmt: invFmt } = window;
const { useState: invUseState, useMemo: invUseMemo } = React;

// Stock Level Bar
function StockBar({ stock, max = 200 }) {
  const pct = Math.min(100, (stock / max) * 100);
  const color = stock === 0 ? '#EF4444' : stock <= 10 ? '#F59E0B' : '#22C55E';
  return (
    <div className="flex items-center gap-2.5 flex-1">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{stock}</span>
    </div>
  );
}

// Adjustment Modal
function AdjustmentModal({ product, onClose }) {
  const { dispatch } = invUseApp();
  const [type,   setType]   = invUseState('add');
  const [qty,    setQty]    = invUseState('');
  const [reason, setReason] = invUseState('recount');

  const delta   = type === 'add' ? (parseInt(qty)||0) : -(parseInt(qty)||0);
  const newStock = Math.max(0, product.stock + delta);
  const canApply = parseInt(qty) > 0;

  const reasons = ['recount','damaged','returned','transferred_in','transferred_out','opening_stock','shrinkage'];

  const apply = () => {
    dispatch({ type: 'ADJUST_STOCK', payload: { id: product.id, delta } });
    dispatch({ type: 'SHOW_TOAST', payload: {
      message: `${product.name} stock ${type === 'add' ? 'increased' : 'decreased'} by ${qty}`,
      type: 'success',
    }});
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Stock Adjustment" size="sm">
      <div className="flex flex-col gap-4">
        {/* Product info */}
        <div className="flex items-center gap-3 p-3 bg-zinc-800/60 rounded-xl border border-zinc-800">
          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: product.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{product.name}</p>
            <p className="text-xs text-zinc-500 font-mono">{product.sku}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Current</p>
            <p className="font-mono font-bold text-zinc-100">{product.stock}</p>
          </div>
        </div>

        {/* Adjustment type */}
        <div className="flex gap-2">
          {[
            { id:'add',    label:'Add Stock',    color:'text-green-400 border-green-800 bg-green-950/50' },
            { id:'remove', label:'Remove Stock',  color:'text-red-400 border-red-800 bg-red-950/50' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${type===t.id ? t.color : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Qty input */}
        <Input
          label="Quantity"
          value={qty}
          onChange={e => setQty(e.target.value)}
          type="number"
          placeholder="0"
          min="1"
          autoFocus
        />

        {/* Reason */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Reason</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 transition-all"
          >
            {reasons.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
          </select>
        </div>

        {/* Preview */}
        {qty && (
          <div className={`flex items-center justify-between p-3 rounded-xl border ${type==='add' ? 'bg-green-950/40 border-green-900/50' : 'bg-red-950/40 border-red-900/50'}`}>
            <span className="text-xs text-zinc-400">New stock level</span>
            <span className={`font-mono font-bold text-base ${type==='add' ? 'text-green-400' : 'text-red-400'}`}>{newStock}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1 border-t border-zinc-800">
          <Btn variant="secondary" size="md" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn variant={type==='add' ? 'success' : 'danger'} size="md" onClick={apply} disabled={!canApply} className="flex-1">
            <IconCheck width="13" height="13" />Apply
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// Inventory Screen
function InventoryScreen() {
  const { state, dispatch } = invUseApp();
  const [search, setSearch]     = invUseState('');
  const [filter, setFilter]     = invUseState('all'); // all | low | out
  const [sortBy, setSortBy]     = invUseState('name');

  const adjustingProduct = state.adjustingProductId
    ? state.products.find(p => p.id === state.adjustingProductId)
    : null;

  const filtered = invUseMemo(() => {
    let list = state.products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (filter === 'low') list = list.filter(p => p.stock > 0 && p.stock <= 10);
    if (filter === 'out') list = list.filter(p => p.stock === 0);
    if (sortBy === 'name')  list = [...list].sort((a,b) => a.name.localeCompare(b.name));
    if (sortBy === 'stock') list = [...list].sort((a,b) => a.stock - b.stock);
    if (sortBy === 'value') list = [...list].sort((a,b) => (b.stock*b.cost) - (a.stock*a.cost));
    return list;
  }, [state.products, search, filter, sortBy]);

  // Summary stats
  const totalSKUs   = state.products.length;
  const outOfStock  = state.products.filter(p => p.stock === 0).length;
  const lowStockCnt = state.products.filter(p => p.stock > 0 && p.stock <= 10).length;
  const totalCost   = state.products.reduce((s,p) => s + p.stock * p.cost,  0);
  const totalRetail = state.products.reduce((s,p) => s + p.stock * p.price, 0);

  return (
    <AppShell
      title="Inventory"
      search={search}
      onSearchChange={setSearch}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 border-b border-zinc-800 flex-shrink-0">
          <StatCard label="Total SKUs"    value={totalSKUs}       icon={<IconPackage width="14" height="14"/>} />
          <StatCard label="Out of Stock"  value={outOfStock}      icon={<IconAlert width="14" height="14"/>} />
          <StatCard label="Low Stock"     value={lowStockCnt}     icon={<IconAlert width="14" height="14"/>} />
          <StatCard label="Cost Value"    value={invFmt(totalCost)} icon={<IconTrending width="14" height="14"/>} />
          <StatCard label="Retail Value"  value={invFmt(totalRetail)} accent icon={<IconTrending width="14" height="14"/>} />
        </div>

        {/* Filters + sort */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
          <div className="flex gap-1.5">
            {[
              { id:'all', label:'All'       },
              { id:'low', label:'Low Stock' },
              { id:'out', label:'Out of Stock' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filter===f.id
                    ? f.id==='out' ? 'bg-red-950/60 border-red-800 text-red-400'
                      : f.id==='low' ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                      : 'bg-zinc-700 border-zinc-600 text-zinc-100'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-zinc-600">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 text-xs px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="name">Name</option>
              <option value="stock">Stock (low→high)</option>
              <option value="value">Value (high→low)</option>
            </select>
          </div>
        </div>

        {/* Inventory table */}
        <div className="flex-1 overflow-y-auto">
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Category</Th>
                <Th>Stock Level</Th>
                <Th right>Cost</Th>
                <Th right>Value</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const cat = window.CATEGORIES_DATA.find(c => c.id === p.category);
                const value = p.stock * p.cost;
                return (
                  <tr key={p.id} className="hover:bg-zinc-900/40 transition-colors">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: p.color }} />
                        <span className="text-zinc-100 text-xs font-medium">{p.name}</span>
                      </div>
                    </Td>
                    <Td muted mono>{p.sku}</Td>
                    <Td>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: (cat?.color || '#71717A') + '20', color: cat?.color || '#71717A' }}>
                        {cat?.name}
                      </span>
                    </Td>
                    <Td className="w-44">
                      <StockBar stock={p.stock} />
                    </Td>
                    <Td right mono muted>{invFmt(p.cost)}</Td>
                    <Td right mono>{invFmt(value)}</Td>
                    <Td><StockBadge stock={p.stock} /></Td>
                    <Td>
                      <button
                        onClick={() => dispatch({ type: 'SET_ADJUSTING_PRODUCT', payload: p.id })}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 border border-zinc-700 transition-all"
                      >
                        Adjust
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {filtered.length === 0 && (
            <Empty icon={<IconInventory width="36" height="36"/>} title="No items found" subtitle="Adjust your filter or search term" />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-zinc-600">{filtered.length} of {totalSKUs} SKUs shown</p>
          <Btn variant="secondary" size="xs">
            <IconSync width="11" height="11" />Refresh stock
          </Btn>
        </div>
      </div>

      {/* Adjustment modal */}
      {adjustingProduct && (
        <AdjustmentModal
          product={adjustingProduct}
          onClose={() => dispatch({ type: 'SET_ADJUSTING_PRODUCT', payload: null })}
        />
      )}
    </AppShell>
  );
}

Object.assign(window, { InventoryScreen });
