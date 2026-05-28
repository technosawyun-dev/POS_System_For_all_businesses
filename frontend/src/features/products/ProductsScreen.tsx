import { useState, useMemo, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { productsService } from '@/services/products/products.service'
import { categoriesService } from '@/services/categories/categories.service'
import { brandsService } from '@/services/brands/brands.service'
import { inventoryService } from '@/services/inventory/inventory.service'
import { useTenantStore } from '@/store/tenant.store'
import { fmt } from '@/lib/utils'
import { StatCard, Table, Th, Td, Btn, Empty, Spinner, Input } from '@/components/ui'
import { IconPlus, IconProducts, IconSearch } from '@/components/icons'
import { ProductBarcodeCard } from '@/components/hardware/ProductBarcodeCard'
import { LabelPrintPreviewModal } from '@/components/hardware/PrintPreviewModal'
import { RawScannerModal } from '@/components/hardware/RawScannerModal'
import type { Product as BackendProduct } from '@/shared/types'

interface ProductFormModalProps {
  product?: BackendProduct
  categories: { id: string; name: string }[]
  brands: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}


function ProductFormModal({ product, categories, brands, onClose, onSaved }: ProductFormModalProps) {
  const isEdit = !!product
  const selectedBranch = useTenantStore(s => s.selectedBranch)
  const [form, setForm] = useState({
    sku:           product?.sku           ?? '',
    name:          product?.name          ?? '',
    description:   product?.description   ?? '',
    product_type:  'SIMPLE' as const,
    category_id:   product?.category_id   ?? '',
    brand_id:      product?.brand_id      ?? '',
    barcode:       product?.barcode        ?? '',
    cost_price:    product?.cost_price     ?? '',
    selling_price: product?.selling_price  ?? '',
    tax_rate:      product ? String(parseFloat(product.tax_rate) * 100) : '0',
    reorder_point: String(product?.reorder_point ?? 0),
    is_active:     product?.is_active ?? true,
    initial_stock: '',
  })
  const [saving, setSaving]         = useState(false)
  const [error,  setError]          = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  // USB/HID scanner: listen for rapid keystrokes when no input is focused
  const usbBuffer    = useRef('')
  const usbLastTime  = useRef(0)
  const usbTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScan = useCallback((code: string) => {
    setForm(prev => ({ ...prev, sku: prev.sku || code, barcode: code }))
    toast.success(`Scanned: ${code}`)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? ''
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const now = Date.now()

      if (e.key === 'Enter') {
        const code = usbBuffer.current.trim()
        usbBuffer.current   = ''
        usbLastTime.current = 0
        if (usbTimer.current) { clearTimeout(usbTimer.current); usbTimer.current = null }
        if (code.length >= 3) handleScan(code)
        return
      }

      if (e.key.length === 1) {
        const gap = now - usbLastTime.current
        if (usbLastTime.current > 0 && gap > 50) usbBuffer.current = ''
        usbBuffer.current  += e.key
        usbLastTime.current = now

        if (usbTimer.current) clearTimeout(usbTimer.current)
        usbTimer.current = setTimeout(() => {
          const code = usbBuffer.current.trim()
          usbBuffer.current   = ''
          usbLastTime.current = 0
          usbTimer.current    = null
          if (code.length >= 3) handleScan(code)
        }, 200)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (usbTimer.current) clearTimeout(usbTimer.current)
    }
  }, [handleScan])

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setError(null)
    }
  }

  const canSubmit =
    form.sku.trim() &&
    form.name.trim() &&
    form.cost_price &&
    form.selling_price &&
    (isEdit || !!form.category_id) &&
    !saving

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        sku:           form.sku.trim(),
        name:          form.name.trim(),
        description:   form.description.trim() || undefined,
        product_type:  form.product_type,
        category_id:   form.category_id || undefined,
        brand_id:      form.brand_id || undefined,
        barcode:       form.barcode.trim() || undefined,
        cost_price:    form.cost_price,
        selling_price: form.selling_price,
        tax_rate:      String(parseFloat(form.tax_rate || '0') / 100),
        reorder_point: parseInt(form.reorder_point || '0', 10),
      }
      if (isEdit) {
        await productsService.update(product.id, { ...payload, is_active: form.is_active })
        toast.success('Product updated')
      } else {
        const created = await productsService.create(payload)
        const qty = parseInt(form.initial_stock || '0', 10)
        if (qty > 0 && selectedBranch) {
          try {
            await inventoryService.setOpeningStock({
              branch_id: selectedBranch.id,
              items: [{ product_id: created.id, quantity: String(qty), cost_price: form.cost_price }],
            })
          } catch {
            toast.warning('Product created but initial stock could not be set — add it via Inventory.')
          }
        }
        toast.success('Product created')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
        err?.response?.data?.detail ??
        'Failed to save product. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    {showScanner && (
      <RawScannerModal
        title="Scan Product Barcode"
        hint="Scan once — fills both SKU and Barcode automatically"
        onScan={code => { handleScan(code); setShowScanner(false) }}
        onClose={() => setShowScanner(false)}
      />
    )}

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-zinc-100">{isEdit ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* Single scan button */}
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-700 hover:border-amber-500 hover:text-amber-400 text-zinc-400 text-sm font-medium transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <rect x="7" y="7" width="3" height="10" rx="1"/><rect x="14" y="7" width="3" height="10" rx="1"/>
            </svg>
            {form.barcode ? `Scanned: ${form.barcode} — tap to re-scan` : 'Tap to scan barcode'}
          </button>

          {/* SKU + Barcode — plain inputs, auto-filled by scan */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="SKU *" value={form.sku} onChange={set('sku')} placeholder="auto-filled by scan" required />
            <Input label="Barcode" value={form.barcode} onChange={set('barcode')} placeholder="auto-filled by scan" />
          </div>

          <Input label="Name *" value={form.name} onChange={set('name')} placeholder="Product name" required />

          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              placeholder="Optional description…"
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Category <span className="text-red-400 normal-case">*</span>
                </label>
                {categories.length === 0 && (
                  <Link to="/app/categories" onClick={onClose} className="text-[10px] text-amber-400 hover:text-amber-300">+ Create one</Link>
                )}
              </div>
              <select
                value={form.category_id}
                onChange={set('category_id')}
                required
                className={`w-full bg-zinc-800 border rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 ${
                  !isEdit && !form.category_id ? 'border-zinc-600 text-zinc-500' : 'border-zinc-700 text-zinc-100'
                }`}
              >
                <option value="">— Select Category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Brand</label>
                {brands.length === 0 && (
                  <Link to="/app/brands" onClick={onClose} className="text-[10px] text-amber-400 hover:text-amber-300">+ Create one</Link>
                )}
              </div>
              <select value={form.brand_id} onChange={set('brand_id')}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500">
                <option value="">— None —</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Cost Price *" type="number" min="0" step="0.01" value={form.cost_price} onChange={set('cost_price')} placeholder="0.00" required />
            <Input label="Selling Price *" type="number" min="0" step="0.01" value={form.selling_price} onChange={set('selling_price')} placeholder="0.00" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Tax Rate (%)" type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={set('tax_rate')} placeholder="0" />
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">
                Reorder Point
                <span className="ml-1 text-zinc-600 normal-case font-normal">— alert when stock ≤ this</span>
              </label>
              <Input type="number" min="0" step="1" value={form.reorder_point} onChange={set('reorder_point')} placeholder="0" />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">
                Opening Stock
                <span className="ml-1 text-zinc-600 normal-case font-normal">— how many units you have right now</span>
              </label>
              <Input type="number" min="0" step="1" value={form.initial_stock} onChange={set('initial_stock')} placeholder="0" />
            </div>
          )}

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm text-zinc-300">Active</span>
            </label>
          )}

          {error && (
            <div className="px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 text-red-400 text-xs">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-zinc-800 flex-shrink-0">
          <Btn variant="secondary" size="lg" fullWidth onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" size="lg" fullWidth onClick={handleSubmit as any} disabled={!canSubmit}>
            {saving ? <><Spinner size={16} /> Saving…</> : isEdit ? 'Save Changes' : 'Create Product'}
          </Btn>
        </div>
      </div>
    </div>
    </>
  )
}

function CategoryBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border bg-zinc-800 border-zinc-700 text-zinc-300">
      {name}
    </span>
  )
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-400">Out of Stock</span>
  if (qty <= 10) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-400">Low Stock</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-950 border border-green-800 text-green-400">In Stock</span>
}

export default function ProductsScreen() {
  const qc = useQueryClient()
  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [showForm, setShowForm]           = useState(false)
  const [editProduct, setEditProduct]     = useState<BackendProduct | null>(null)

  // Debounce search
  function handleSearch(q: string) {
    setSearch(q)
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t)
    const t = setTimeout(() => setDebouncedSearch(q), 300)
    ;(handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = t
  }

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch, categoryFilter],
    queryFn: () => productsService.list({
      search: debouncedSearch || undefined,
      category_id: categoryFilter || undefined,
      page_size: 200,
    }),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesService.list({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsService.list({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsService.delete(id),
    onSuccess: () => {
      toast.success('Product deleted')
      setSelectedId(null)
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => toast.error('Failed to delete product'),
  })

  const products = productsData?.items ?? []
  const categories = categoriesData?.items ?? []
  const brands = brandsData?.items ?? []

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])

  const selectedProduct = selectedId ? products.find(p => p.id === selectedId) : null

  return (
    <>
    {showForm && (
      <ProductFormModal
        product={editProduct ?? undefined}
        categories={categories}
        brands={brands}
        onClose={() => setShowForm(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['products'] })}
      />
    )}
    <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
        {/* Sub-navigation */}
        <div className="flex-shrink-0 flex items-center gap-1 px-4 sm:px-6 pt-3 sm:pt-4 border-b border-zinc-800 pb-0">
          <span className="px-3 py-1.5 text-xs font-semibold text-amber-400 border-b-2 border-amber-500 -mb-px">Products</span>
          <Link to="/app/categories" className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 border-b-2 border-transparent -mb-px transition-colors">Categories</Link>
          <Link to="/app/brands" className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 border-b-2 border-transparent -mb-px transition-colors">Brands</Link>
        </div>

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-zinc-100 flex-shrink-0">Products</h2>
          <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
            <div className="relative flex-1 sm:flex-none">
              <IconSearch width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search products…"
                className="bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm
                  focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all
                  py-2 pl-8 pr-4 w-full sm:w-56"
              />
            </div>
            <Btn size="sm" onClick={() => { setEditProduct(null); setShowForm(true) }}>
              <IconPlus width="14" height="14" />
              <span className="hidden sm:inline">New Product</span>
              <span className="sm:hidden">New</span>
            </Btn>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 lg:overflow-auto lg:flex-1 lg:min-h-0">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Total SKUs"  value={products.length} />
            <StatCard label="Active"      value={products.filter(p => p.is_active).length} accent />
            <StatCard label="Inactive"    value={products.filter(p => !p.is_active).length} />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
            <button
              onClick={() => setCategoryFilter('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                !categoryFilter ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              All Items
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  categoryFilter === cat.id ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto flex-1 flex flex-col min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>SKU</Th>
                    <Th>Category</Th>
                    <Th right>Price</Th>
                    <Th right>Cost</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <Empty icon={<IconProducts width="40" height="40" />} title="No products found" subtitle="Try adjusting your search or filter" />
                      </td>
                    </tr>
                  ) : products.map(product => {
                    const active = selectedId === product.id
                    return (
                      <tr
                        key={product.id}
                        onClick={() => setSelectedId(active ? null : product.id)}
                        className={`cursor-pointer transition-colors duration-100 ${active ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'}`}
                      >
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-8 rounded-full flex-shrink-0 bg-amber-500/60" />
                            <span className="font-medium text-zinc-100">{product.name}</span>
                          </div>
                        </Td>
                        <Td mono muted>{product.sku}</Td>
                        <Td>
                          <CategoryBadge name={categoryMap.get(product.category_id ?? '') ?? '—'} />
                        </Td>
                        <Td right mono>{fmt(parseFloat(product.selling_price))}</Td>
                        <Td right mono muted>{fmt(parseFloat(product.cost_price))}</Td>
                        <Td>
                          {product.is_active
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-950 border border-green-800 text-green-400">Active</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500">Inactive</span>
                          }
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
            <div className="px-4 py-2.5 border-t border-zinc-800 flex-shrink-0">
              <p className="text-xs text-zinc-500">{products.length} products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedProduct && (
        <ProductDetailPanel
          product={selectedProduct}
          categoryMap={categoryMap}
          onClose={() => setSelectedId(null)}
          onEdit={() => { setEditProduct(selectedProduct); setShowForm(true) }}
          onDelete={() => deleteMutation.mutate(selectedProduct.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
    </>
  )
}

function ProductDetailPanel({
  product, categoryMap, onClose, onEdit, onDelete, isDeleting,
}: {
  product: BackendProduct
  categoryMap: Map<string, string>
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const [showLabelPrint, setShowLabelPrint] = useState(false)

  return (
    <>
    {showLabelPrint && (
      <LabelPrintPreviewModal
        product={product}
        onClose={() => setShowLabelPrint(false)}
      />
    )}
    <div className="w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-100">Product Detail</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">×</button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <p className="text-lg font-bold text-zinc-100">{product.name}</p>
          <p className="text-xs font-mono text-zinc-500">{product.sku}</p>
          {product.barcode && <p className="text-xs font-mono text-zinc-600 mt-0.5">Barcode: {product.barcode}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-0.5">Selling Price</p>
            <p className="font-mono font-bold text-amber-400">{fmt(parseFloat(product.selling_price))}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-0.5">Cost Price</p>
            <p className="font-mono font-bold text-zinc-200">{fmt(parseFloat(product.cost_price))}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Category</span>
            <span className="text-zinc-200">{categoryMap.get(product.category_id ?? '') ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tax Rate</span>
            <span className="text-zinc-200">{(parseFloat(product.tax_rate) * 100).toFixed(0)}%</span>
          </div>
          {product.description && (
            <div>
              <p className="text-zinc-500 mb-1">Description</p>
              <p className="text-zinc-300 text-xs">{product.description}</p>
            </div>
          )}
        </div>

        {(product.variants ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Variants ({(product.variants ?? []).length})</p>
            {(product.variants ?? []).map(v => (
              <div key={v.id} className="flex justify-between items-center py-1.5 border-b border-zinc-800 text-xs">
                <span className="text-zinc-300">{v.name}</span>
                <span className="font-mono text-zinc-400">{v.sku}</span>
              </div>
            ))}
          </div>
        )}

        {/* Barcode section */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Barcode</p>
          <ProductBarcodeCard product={product} showPrice compact={false} />
          <button
            onClick={() => setShowLabelPrint(true)}
            className="w-full mt-2 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            Print Label
          </button>
        </div>

        <div className="pt-2 border-t border-zinc-800 flex gap-2">
          <Btn variant="outline" size="sm" fullWidth onClick={onEdit}>
            Edit
          </Btn>
          <Btn variant="danger" size="sm" fullWidth onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Btn>
        </div>
      </div>
    </div>
    </>
  )
}
