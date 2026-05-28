// pos-products.jsx — Product management screen

const { useApp: prodUseApp, fmt: prodFmt } = window;
const { useState: prodUseState, useMemo: prodUseMemo } = React;
const { ROLE_BADGE_STYLES: prodRoleStyles } = window;

// Product Form Modal
function ProductFormModal({ product, onSave, onClose }) {
  const [form, setForm] = prodUseState(product ? { ...product } : {
    sku:'', name:'', category:'beverages', price:'', cost:'',
    stock:'', unit:'item', taxRate:0.10, barcode:'',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name || !form.sku || !form.price) return;
    onSave({
      ...form,
      id: product?.id || `p${Date.now()}`,
      price: parseFloat(form.price) || 0,
      cost:  parseFloat(form.cost)  || 0,
      stock: parseInt(form.stock)   || 0,
      taxRate: parseFloat(form.taxRate) || 0,
      color: window.CATEGORIES_DATA.find(c => c.id === form.category)?.color || '#71717A',
    });
    onClose();
  };

  const cats = window.CATEGORIES_DATA.filter(c => c.id !== 'all');

  return (
    <Modal open onClose={onClose} title={product ? 'Edit Product' : 'New Product'} size="lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="SKU" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="BEV-001" />
          <Input label="Barcode" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="1234567890" />
        </div>
        <Input label="Product Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Espresso" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Category</label>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 transition-all"
          >
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Price" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" prefix="$" type="number" />
          <Input label="Cost" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0.00" prefix="$" type="number" />
          <Input label="Stock" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500">
              {['item','cup','bottle','pack','box','kg','litre'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tax Rate</label>
            <select value={form.taxRate} onChange={e => set('taxRate', parseFloat(e.target.value))} className="bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500">
              <option value={0}>0% (exempt)</option>
              <option value={0.05}>5%</option>
              <option value={0.10}>10% (standard)</option>
              <option value={0.15}>15%</option>
              <option value={0.20}>20%</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2 border-t border-zinc-800">
          <Btn variant="secondary" size="md" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn variant="primary" size="md" onClick={handleSave} className="flex-1">
            <IconCheck width="14" height="14" />{product ? 'Update' : 'Create'} Product
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// Product Detail Panel
function ProductDetailPanel({ product, onEdit, onClose }) {
  const { dispatch } = prodUseApp();
  const margin = product.price > 0 ? ((product.price - product.cost) / product.price * 100).toFixed(1) : '0';
  const catColor = window.CATEGORIES_DATA.find(c => c.id === product.category)?.color || '#71717A';

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col animate-slideIn flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200">Product Detail</h3>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
          <IconX width="13" height="13" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Color + name */}
        <div>
          <div className="h-1 w-16 rounded-full mb-3" style={{ background: catColor }} />
          <p className="text-lg font-bold text-zinc-100">{product.name}</p>
          <p className="text-xs text-zinc-600 font-mono mt-0.5">{product.sku} · {product.barcode}</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label:'Price',    value: prodFmt(product.price), accent: true },
            { label:'Cost',     value: prodFmt(product.cost) },
            { label:'Margin',   value: `${margin}%` },
            { label:'Tax Rate', value: `${(product.taxRate*100).toFixed(0)}%` },
          ].map(m => (
            <div key={m.label} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{m.label}</p>
              <p className={`font-mono text-base font-bold mt-0.5 ${m.accent ? 'text-amber-400' : 'text-zinc-200'}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Stock */}
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Current Stock</p>
            <StockBadge stock={product.stock} />
          </div>
          <p className="font-mono text-2xl font-black text-zinc-100">{product.stock} <span className="text-sm text-zinc-600 font-normal">{product.unit}s</span></p>
        </div>

        {/* Category */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: catColor }} />
          <span className="text-sm text-zinc-300">{window.CATEGORIES_DATA.find(c => c.id === product.category)?.name}</span>
        </div>

        {/* Value calc */}
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Inventory Value</p>
          <p className="font-mono font-bold text-zinc-200">{prodFmt(product.stock * product.cost)} <span className="text-zinc-600 text-xs font-normal">at cost</span></p>
          <p className="font-mono font-bold text-amber-400 mt-0.5">{prodFmt(product.stock * product.price)} <span className="text-zinc-600 text-xs font-normal">retail</span></p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <Btn variant="secondary" size="sm" onClick={onEdit} className="flex-1">
          <IconEdit width="13" height="13" />Edit
        </Btn>
        <Btn variant="primary" size="sm" onClick={() => { dispatch({ type: 'ADD_TO_CART', payload: product }); dispatch({ type: 'SET_SCREEN', payload: 'pos' }); }} className="flex-1">
          <IconCart width="13" height="13" />Add to Cart
        </Btn>
      </div>
    </div>
  );
}

// Products Screen
function ProductsScreen() {
  const { state, dispatch } = prodUseApp();
  const [search, setSearch]       = prodUseState('');
  const [catFilter, setCatFilter] = prodUseState('all');
  const [showForm, setShowForm]   = prodUseState(false);
  const [editProduct, setEditProd]= prodUseState(null);

  const activeProduct = state.products.find(p => p.id === state.productEditId) || null;

  const filtered = prodUseMemo(() => {
    let list = state.products;
    if (catFilter !== 'all') list = list.filter(p => p.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.includes(q)
      );
    }
    return list;
  }, [state.products, catFilter, search]);

  const handleSave = (product) => {
    dispatch({ type: 'UPDATE_PRODUCT', payload: product });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `${product.name} updated`, type: 'success' } });
  };

  const cats = window.CATEGORIES_DATA;

  // Stats
  const outOfStock = state.products.filter(p => p.stock === 0).length;
  const lowStock   = state.products.filter(p => p.stock > 0 && p.stock <= 10).length;
  const totalValue = state.products.reduce((s, p) => s + p.stock * p.cost, 0);

  return (
    <AppShell
      title="Products"
      search={search}
      onSearchChange={setSearch}
      action={
        <Btn variant="primary" size="sm" onClick={() => { setEditProd(null); setShowForm(true); }}>
          <IconPlus width="13" height="13" />New Product
        </Btn>
      }
    >
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 p-4 border-b border-zinc-800 flex-shrink-0">
            <StatCard label="Total SKUs"   value={state.products.length} icon={<IconProducts width="14" height="14"/>} />
            <StatCard label="Out of Stock" value={outOfStock} icon={<IconAlert width="14" height="14"/>} />
            <StatCard label="Low Stock"    value={lowStock}   icon={<IconPackage width="14" height="14"/>} />
            <StatCard label="Total Value"  value={prodFmt(totalValue)} accent icon={<IconTrending width="14" height="14"/>} />
          </div>

          {/* Category filter pills */}
          <div className="flex gap-1.5 px-4 py-2.5 border-b border-zinc-800 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth:'none' }}>
            {cats.map(c => (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  catFilter === c.id
                    ? 'text-black font-semibold border-transparent'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
                style={catFilter === c.id ? { background: c.color, borderColor: c.color } : {}}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th>Category</Th>
                  <Th right>Price</Th>
                  <Th right>Cost</Th>
                  <Th right>Stock</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const cat = cats.find(c => c.id === p.category);
                  const isActive = state.productEditId === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => dispatch({ type: 'SET_PRODUCT_EDIT', payload: isActive ? null : p.id })}
                      className={`cursor-pointer transition-colors ${isActive ? 'bg-zinc-800/80' : 'hover:bg-zinc-900/60'}`}
                    >
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: p.color }} />
                          <span className="text-zinc-100 font-medium text-xs">{p.name}</span>
                        </div>
                      </Td>
                      <Td muted mono>{p.sku}</Td>
                      <Td>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cat?.color + '20', color: cat?.color }}>
                          {cat?.name}
                        </span>
                      </Td>
                      <Td right mono>{prodFmt(p.price)}</Td>
                      <Td right mono muted>{prodFmt(p.cost)}</Td>
                      <Td right mono>{p.stock}</Td>
                      <Td><StockBadge stock={p.stock} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {filtered.length === 0 && (
              <Empty icon={<IconProducts width="36" height="36"/>} title="No products found" subtitle="Try adjusting your search or filter" />
            )}
          </div>

          {/* Footer count */}
          <div className="px-4 py-2 border-t border-zinc-800 flex-shrink-0">
            <p className="text-xs text-zinc-600">{filtered.length} of {state.products.length} products</p>
          </div>
        </div>

        {/* Detail panel */}
        {activeProduct && (
          <ProductDetailPanel
            product={activeProduct}
            onEdit={() => { setEditProd(activeProduct); setShowForm(true); }}
            onClose={() => dispatch({ type: 'SET_PRODUCT_EDIT', payload: null })}
          />
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <ProductFormModal
          product={editProduct}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditProd(null); }}
        />
      )}
    </AppShell>
  );
}

Object.assign(window, { ProductsScreen });
