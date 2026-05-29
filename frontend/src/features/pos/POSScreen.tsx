import { useRef, useEffect, useCallback, useState, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCartStore, useCartTotals } from '@/store/cartStore'
import { useSessionStore } from '@/store/session.store'
import { useTenantStore } from '@/store/tenant.store'
import { useUIStore } from '@/store/ui.store'
import { productsService } from '@/services/products/products.service'
import { inventoryService } from '@/services/inventory/inventory.service'
import { categoriesService } from '@/services/categories/categories.service'
import { IconSearch, IconBarcode, IconCash, IconExpand, IconCompress } from '@/components/icons'
import { Kbd, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
// ScannerInputCapture is lightweight (keyboard listener only — no camera library)
import { ScannerInputCapture } from '@/components/hardware/ScannerInputCapture'
import { lookupProductBySku } from '@/hooks/useProductScan'
import type { Product } from '@/types'
import type { Product as SharedProduct } from '@/shared/types'
import CategoryFilter from '@/features/pos/CategoryFilter'
import ProductGrid from '@/features/pos/ProductGrid'
import CartPanel from '@/features/pos/CartPanel'
import PaymentOverlay from '@/features/payment/PaymentOverlay'

// Lazy-load camera scanner — quagga2 only loads when scanner modal is opened
const HardwareScannerModal = lazy(() =>
  import('@/components/hardware/HardwareScannerModal').then(m => ({ default: m.HardwareScannerModal }))
)

// Map backend product + inventory qty to legacy Product shape
function mapProduct(
  p: import('@/shared/types').Product,
  inventoryMap: Map<string, number>,
  categoryMap: Map<string, string>,
): Product {
  return {
    id:       p.id,
    sku:      p.sku,
    name:     p.name,
    category: categoryMap.get(p.category_id ?? '') ?? p.category_id ?? 'other',
    price:    parseFloat(p.selling_price),
    cost:     parseFloat(p.cost_price),
    stock:    inventoryMap.get(p.id) ?? 0,
    unit:     'item',
    taxRate:  parseFloat(p.tax_rate),
    barcode:  p.barcode ?? '',
    color:    '#71717A',
  }
}

export default function POSScreen() {
  const navigate    = useNavigate()
  const searchRef   = useRef<HTMLInputElement>(null)
  const [rawSearch, setRawSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeCategory, setActiveCategory]   = useState('all')
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')
  const [scannerOpen, setScannerOpen] = useState(false)

  const { posFocusMode, togglePosFocusMode, setPosFocusMode } = useUIStore()

  // Desktop: hide sidebar + enter browser fullscreen together
  function toggleDesktopFocusMode() {
    togglePosFocusMode()
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // If user exits browser fullscreen externally (Esc / F11), also exit sidebar focus mode
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) setPosFocusMode(false)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [setPosFocusMode])

  // Reset both on unmount (navigate away)
  useEffect(() => () => {
    setPosFocusMode(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [setPosFocusMode])

  const { activeSession }  = useSessionStore()
  const { selectedBranch } = useTenantStore()
  const addItem            = useCartStore(s => s.addItem)
  const items              = useCartStore(s => s.items)
  const clearCart          = useCartStore(s => s.clearCart)
  const checkoutStep       = useCartStore(s => s.checkoutStep)
  const setCheckoutStep    = useCartStore(s => s.setCheckoutStep)
  const totals             = useCartTotals()

  // Debounce search 300 ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(rawSearch), 300)
    return () => clearTimeout(id)
  }, [rawSearch])

  // Redirect to session-open if no active session
  useEffect(() => {
    if (!activeSession) navigate('/app/session-open', { replace: true })
  }, [activeSession, navigate])

  const branchId = activeSession?.branch_id ?? selectedBranch?.id ?? ''

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', debouncedSearch],
    queryFn: () => productsService.list({ search: debouncedSearch || undefined, page_size: 200, is_active: true }),
    enabled: !!activeSession,
  })

  // Fetch inventory for the session's branch
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: () => inventoryService.getBranchInventory(branchId, { page_size: 500 }),
    enabled: !!branchId,
  })

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesService.list({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  // Build lookup maps
  const inventoryMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const item of inventoryData?.items ?? []) {
      m.set(item.product_id, parseFloat(item.quantity_available))
    }
    return m
  }, [inventoryData])

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const cat of categoriesData?.items ?? []) {
      m.set(cat.id, cat.name)
    }
    return m
  }, [categoriesData])

  // Map backend products to legacy Product format
  const allProducts: Product[] = useMemo(() =>
    (productsData?.items ?? []).map(p => mapProduct(p, inventoryMap, categoryMap)),
    [productsData, inventoryMap, categoryMap],
  )

  // Build dynamic category list from loaded products
  const dynamicCategories = useMemo(() => {
    const seen = new Map<string, string>()
    seen.set('all', 'All Items')
    for (const p of allProducts) {
      if (!seen.has(p.category)) seen.set(p.category, p.category)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [allProducts])

  // Filter products by category
  const filtered = useMemo(() =>
    allProducts.filter(p => activeCategory === 'all' || p.category === activeCategory),
    [allProducts, activeCategory],
  )

  const handleAdd = useCallback((product: Product) => { addItem(product) }, [addItem])

  // Handle a scan result — map SharedProduct → legacy Product then add to cart
  const handleScanResult = useCallback((scanned: SharedProduct) => {
    const legacy = mapProduct(scanned, inventoryMap, categoryMap)
    addItem(legacy)
    setScannerOpen(false)
    toast.success(`Added: ${scanned.name}`)
  }, [inventoryMap, categoryMap, addItem])

  // Handle USB/Bluetooth keyboard-emulation scanner input
  const handleHardwareScan = useCallback(async (code: string) => {
    const result = await lookupProductBySku(code)
    if (result.status === 'found') {
      handleScanResult(result.product)
    } else if (result.status === 'not_found') {
      toast.error(`Product not found: ${code}`)
    } else {
      toast.error(result.message)
    }
  }, [handleScanResult])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

      if (e.key === 'F9') {
        e.preventDefault()
        if (items.length > 0 && checkoutStep === 'cart') setCheckoutStep('payment')
        return
      }
      if (e.key === 'Escape') {
        if (checkoutStep === 'cart') clearCart()
        return
      }
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [items.length, checkoutStep, setCheckoutStep, clearCart])

  if (!activeSession) return null

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* USB/Bluetooth hardware scanner — always listening when POS is active */}
      <ScannerInputCapture
        onScan={handleHardwareScan}
        enabled={!scannerOpen && checkoutStep === 'cart'}
      />

      {/* Camera scanner modal — lazy-loaded, quagga2 only downloads when opened */}
      {scannerOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            <Spinner size={36} />
          </div>
        }>
          <HardwareScannerModal
            title="Scan Product Barcode"
            onResult={handleScanResult}
            onNotFound={code => { toast.error(`Product not found: ${code}`); setScannerOpen(false) }}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      )}
      {/* Mobile tab bar — hidden on desktop */}
      <div className="lg:hidden flex flex-shrink-0 border-b border-zinc-800 bg-zinc-950">
        <button
          onClick={() => setMobileTab('products')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors border-b-2',
            mobileTab === 'products'
              ? 'text-amber-400 border-amber-500'
              : 'text-zinc-500 border-transparent hover:text-zinc-300',
          )}
        >
          Products
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors border-b-2 relative',
            mobileTab === 'cart'
              ? 'text-amber-400 border-amber-500'
              : 'text-zinc-500 border-transparent hover:text-zinc-300',
          )}
        >
          Cart
          {totals.itemCount > 0 && (
            <span className="absolute top-2 right-[calc(50%-24px)] w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
              {totals.itemCount > 9 ? '9+' : totals.itemCount}
            </span>
          )}
        </button>
        <button
          onClick={togglePosFocusMode}
          className="w-12 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors border-b-2 border-transparent"
          aria-label={posFocusMode ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={posFocusMode ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {posFocusMode ? <IconCompress width="16" height="16" /> : <IconExpand width="16" height="16" />}
        </button>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column — products */}
        <div className={cn(
          'flex flex-col flex-1 min-w-0 overflow-hidden',
          mobileTab === 'cart' ? 'hidden lg:flex' : 'flex',
        )}>
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                <IconSearch width="15" height="15" />
              </span>
              <input
                ref={searchRef}
                type="text"
                value={rawSearch}
                onChange={e => setRawSearch(e.target.value)}
                placeholder="Search products…"
                className={cn(
                  'w-full bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm',
                  'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all duration-150',
                  'py-2.5 pl-9 pr-16',
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Kbd keys="/" />
              </span>
            </div>
            <button
              onClick={() => setScannerOpen(true)}
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Scan barcode"
              title="Scan barcode (camera)"
            >
              <IconBarcode width="17" height="17" />
            </button>
            <button
              onClick={toggleDesktopFocusMode}
              className="hidden lg:flex w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label={posFocusMode ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={posFocusMode ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {posFocusMode ? <IconCompress width="16" height="16" /> : <IconExpand width="16" height="16" />}
            </button>
          </div>

          {/* Category filter — dynamic from backend */}
          <div className="px-3 pb-2 flex-shrink-0">
            <CategoryFilter
              categories={dynamicCategories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {productsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Spinner size={32} />
              </div>
            ) : (
              <ProductGrid
                products={filtered}
                cartItems={items}
                onAdd={handleAdd}
              />
            )}
          </div>

          {/* Shortcuts bar — desktop only */}
          <div className="hidden lg:flex items-center justify-between px-4 py-2 border-t border-zinc-900 bg-zinc-950 text-[10px] text-zinc-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Kbd keys="/" /> search</span>
              <span className="flex items-center gap-1"><Kbd keys="F9" /> checkout</span>
              <span className="flex items-center gap-1"><Kbd keys="Esc" /> clear cart</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-zinc-600 font-mono">{totals.itemCount} item{totals.itemCount !== 1 ? 's' : ''} in cart</span>
              {activeSession && (
                <span className="flex items-center gap-1 text-green-600">
                  <IconCash width="10" height="10" />
                  Session open
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right column — cart */}
        <div className={cn(
          'flex flex-col w-full lg:w-auto flex-shrink-0',
          mobileTab === 'products' ? 'hidden lg:flex' : 'flex',
        )}>
          <CartPanel onBackToProducts={() => setMobileTab('products')} />
        </div>
      </div>

      {/* Payment overlay */}
      {checkoutStep !== 'cart' && <PaymentOverlay />}
    </div>
  )
}
