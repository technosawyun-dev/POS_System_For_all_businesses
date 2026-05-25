// pos-checkout.jsx — Main POS screen: search, products, cart

const { useApp: posUseApp, fmt: posFmt } = window;
const { useState: posUseState, useMemo: posUseMemo, useEffect: posUseEffect, useRef: posUseRef, useCallback: posUseCallback } = React;

// Category Filter Bar
function CategoryFilter() {
  const { state, dispatch } = posUseApp();
  const { categories, activeCategory } = state;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
      {categories.map(cat => {
        const active = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_CATEGORY', payload: cat.id })}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
              active
                ? 'text-black font-semibold border-transparent'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
            }`}
            style={active ? { background: cat.color, borderColor: cat.color } : {}}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}

// Product Card
function ProductCard({ product, cartQty, onAdd }) {
  const outOfStock = product.stock === 0;
  const lowStock   = product.stock > 0 && product.stock <= 10;

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`relative flex flex-col p-3 rounded-xl border text-left transition-all duration-150 select-none group ${
        outOfStock
          ? 'bg-zinc-900/40 border-zinc-800/50 opacity-50 cursor-not-allowed'
          : cartQty > 0
            ? 'bg-zinc-800 border-amber-500/40 cursor-pointer shadow-lg shadow-amber-900/20'
            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 active:scale-95 cursor-pointer'
      }`}
    >
      {/* Category color stripe */}
      <div className="h-0.5 w-full rounded-full mb-3 opacity-70" style={{ background: product.color }} />

      {/* Name */}
      <p className="text-zinc-100 text-xs font-medium leading-snug line-clamp-2 flex-1 mb-1.5" style={{ minHeight: '2.5rem' }}>
        {product.name}
      </p>

      {/* SKU */}
      <p className="text-zinc-600 text-[10px] mb-2 font-mono">{product.sku}</p>

      {/* Price row */}
      <div className="flex items-end justify-between gap-1">
        <p className="font-mono text-amber-400 font-bold text-sm leading-none">{posFmt(product.price)}</p>
        {lowStock && <span className="text-[9px] text-amber-500 font-medium">{product.stock} left</span>}
        {outOfStock && <span className="text-[9px] text-red-500 font-medium">Out</span>}
      </div>

      {/* Cart quantity badge */}
      {cartQty > 0 && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
          <span className="text-black text-[10px] font-black leading-none">{cartQty}</span>
        </div>
      )}
    </button>
  );
}

// Product Grid
function ProductGrid({ products, cartItems, onAdd }) {
  if (products.length === 0) {
    return (
      <Empty
        icon={<IconSearch width="40" height="40" />}
        title="No products found"
        subtitle="Try a different search or category"
      />
    );
  }
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
      {products.map(p => (
        <ProductCard
          key={p.id}
          product={p}
          cartQty={cartItems.find(i => i.id === p.id)?.qty || 0}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

// Cart Item
function CartItem({ item }) {
  const { dispatch } = posUseApp();
  const lineTotal = item.price * item.qty;
  const discAmt   = (item.lineDiscount || 0) / 100 * lineTotal;

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-zinc-800/60 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 leading-snug line-clamp-1">{item.name}</p>
        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{posFmt(item.price)} × {item.qty}</p>
        {item.lineDiscount > 0 && (
          <p className="text-[10px] text-green-500 mt-0.5">–{item.lineDiscount}% disc.</p>
        )}
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => dispatch({ type: 'UPDATE_QTY', payload: { id: item.id, qty: item.qty - 1 } })}
          className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <IconMinus width="10" height="10" />
        </button>
        <span className="w-6 text-center text-xs font-mono font-semibold text-zinc-200">{item.qty}</span>
        <button
          onClick={() => dispatch({ type: 'UPDATE_QTY', payload: { id: item.id, qty: item.qty + 1 } })}
          className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <IconPlus width="10" height="10" />
        </button>
      </div>

      {/* Line total + remove */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className="font-mono text-xs font-semibold text-zinc-100">{posFmt(lineTotal - discAmt)}</span>
        <button
          onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: item.id })}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
        >
          <IconX width="11" height="11" />
        </button>
      </div>
    </div>
  );
}

// Discount Input (inline)
function DiscountRow() {
  const { state, dispatch } = posUseApp();
  const [show, setShow] = posUseState(false);
  const [val, setVal]   = posUseState(String(state.cart.discount || ''));

  const apply = () => {
    const d = Math.min(100, Math.max(0, parseFloat(val) || 0));
    dispatch({ type: 'SET_CART_DISCOUNT', payload: d });
    setShow(false);
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-amber-400 transition-colors"
      >
        <IconDiscount width="11" height="11" />
        {state.cart.discount > 0 ? `${state.cart.discount}% discount applied` : 'Add discount'}
      </button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        autoFocus
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') setShow(false); }}
        placeholder="0"
        min="0"
        max="100"
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-xs px-2.5 py-1.5 font-mono focus:outline-none focus:border-amber-500"
      />
      <span className="text-zinc-500 text-xs">%</span>
      <button onClick={apply} className="text-xs text-amber-400 hover:text-amber-300 font-medium">Apply</button>
      <button onClick={() => setShow(false)} className="text-zinc-600 hover:text-zinc-400">
        <IconX width="11" height="11" />
      </button>
    </div>
  );
}

// Cart Panel
function CartPanel() {
  const { state, dispatch, cartCalc } = posUseApp();
  const { cart, checkoutStep } = state;
  const { itemSubtotal, orderDiscAmt, tax, total, itemCount } = cartCalc;

  // If in payment/processing/receipt steps, hide the regular cart UI
  if (checkoutStep !== 'cart') return null;

  return (
    <div className="flex flex-col border-l border-zinc-800 bg-zinc-950" style={{ width: '320px', minWidth: '280px', maxWidth: '360px' }}>
      {/* Cart header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <IconCart className="text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-200">Order</span>
          {itemCount > 0 && (
            <span className="bg-amber-500 text-black text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {itemCount}
            </span>
          )}
        </div>
        {cart.items.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'CLEAR_CART' })}
            className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 select-none">
            <IconCart width="36" height="36" className="opacity-20 mb-3" />
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="text-xs mt-1 text-zinc-800">Tap products to add</p>
          </div>
        ) : (
          <div className="px-4">
            {cart.items.map(item => <CartItem key={item.id} item={item} />)}
          </div>
        )}
      </div>

      {/* Totals + checkout */}
      {cart.items.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-3 flex flex-col gap-2 flex-shrink-0">
          <DiscountRow />
          <Divider />

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-mono text-zinc-300">{posFmt(itemSubtotal)}</span>
            </div>
            {orderDiscAmt > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-green-500">{state.cart.discount}% discount</span>
                <span className="font-mono text-green-400">–{posFmt(orderDiscAmt)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Tax (10%)</span>
              <span className="font-mono text-zinc-400">{posFmt(tax)}</span>
            </div>
          </div>

          <div className="flex justify-between items-baseline pt-1.5 border-t border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">Total</span>
            <span className="font-mono font-black text-amber-400 text-xl">{posFmt(total)}</span>
          </div>

          <button
            onClick={() => dispatch({ type: 'SET_CHECKOUT_STEP', payload: 'payment' })}
            className="w-full h-14 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-xl text-black font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/40 mt-1"
          >
            Checkout
            <IconChevRight className="text-black/70" />
          </button>

          {/* Shortcut hint */}
          <p className="text-center text-[10px] text-zinc-700">
            <Kbd keys="F9" /> quick checkout · <Kbd keys="Esc" /> clear
          </p>
        </div>
      )}
    </div>
  );
}

// POS Screen
function POSScreen() {
  const { state, dispatch, cartCalc } = posUseApp();
  const { products, cart, activeCategory, productSearch, checkoutStep } = state;
  const searchRef = posUseRef(null);

  // Filter products
  const filtered = posUseMemo(() => {
    let list = products;
    if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory);
    if (productSearch) {
      const q = productSearch.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
      );
    }
    return list;
  }, [products, activeCategory, productSearch]);

  const handleAdd = posUseCallback((product) => {
    dispatch({ type: 'ADD_TO_CART', payload: product });
  }, [dispatch]);

  // Keyboard: F9 = checkout, Esc = clear, / = focus search
  posUseEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F9' && cart.items.length > 0) {
        dispatch({ type: 'SET_CHECKOUT_STEP', payload: 'payment' });
      }
      if (e.key === 'Escape' && checkoutStep === 'cart' && cart.items.length > 0) {
        dispatch({ type: 'CLEAR_CART' });
      }
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.items.length, checkoutStep, dispatch]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: products */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search + category row */}
        <div className="px-4 pt-3 pb-2.5 border-b border-zinc-800 flex flex-col gap-2.5 flex-shrink-0 bg-zinc-950/80">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none">
              <IconSearch width="14" height="14" />
            </span>
            <input
              ref={searchRef}
              type="text"
              value={productSearch}
              onChange={e => dispatch({ type: 'SET_PRODUCT_SEARCH', payload: e.target.value })}
              placeholder="Search products, scan barcode, enter SKU…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/10 transition-all text-sm py-2.5 pl-9 pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <IconBarcode width="14" height="14" className="text-zinc-700" />
              <Kbd keys="/" />
            </div>
          </div>
          <CategoryFilter />
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <ProductGrid
            products={filtered}
            cartItems={cart.items}
            onAdd={handleAdd}
          />
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-t border-zinc-900 bg-zinc-950 flex-shrink-0">
          <span className="text-[10px] text-zinc-700 flex items-center gap-1"><Kbd keys="/" /> Search</span>
          <span className="text-[10px] text-zinc-700 flex items-center gap-1"><Kbd keys="F9" /> Checkout</span>
          <span className="text-[10px] text-zinc-700 flex items-center gap-1"><Kbd keys="Esc" /> Clear cart</span>
          <span className="ml-auto text-[10px] text-zinc-700">
            {filtered.length} of {products.length} items · {cartCalc.itemCount} in cart
          </span>
        </div>
      </div>

      {/* Right: cart */}
      <CartPanel />

      {/* Payment overlays */}
      {checkoutStep !== 'cart' && <PaymentOverlay />}
    </div>
  );
}

Object.assign(window, { POSScreen, CategoryFilter, ProductGrid, CartPanel });
