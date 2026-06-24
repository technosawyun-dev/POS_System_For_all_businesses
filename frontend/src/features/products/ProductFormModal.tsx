import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { productsService } from '@/services/products/products.service'
import { categoriesService } from '@/services/categories/categories.service'
import { brandsService } from '@/services/brands/brands.service'
import { inventoryService } from '@/services/inventory/inventory.service'
import { useTenantStore } from '@/store/tenant.store'
import { Btn, Spinner, Input } from '@/components/ui'
import { RawScannerModal, ScannerInputCapture, lookupProductByBarcode } from '@/scanner'
import type { Product as BackendProduct } from '@/shared/types'

export function generateSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = 'SKU-'
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
  return s
}

export interface ProductFormModalProps {
  product?: BackendProduct
  initialBarcode?: string
  onClose: () => void
  onSaved: (created?: BackendProduct) => void
}

export function ProductFormModal({ product, initialBarcode, onClose, onSaved }: ProductFormModalProps) {
  const isEdit = !!product
  const selectedBranch = useTenantStore(s => s.selectedBranch)

  // Disable camera scanner and USB scanner on mobile-width browsers (< 700px)
  const [isMobileWidth, setIsMobileWidth] = useState(() => window.innerWidth < 700)
  useEffect(() => {
    const fn = () => setIsMobileWidth(window.innerWidth < 700)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoriesService.list({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  })
  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn:  () => brandsService.list({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const categories = categoriesData?.items ?? []
  const brands     = brandsData?.items     ?? []

  // For edit: fetch branch-specific inventory to read reorder_point
  const { data: invData } = useQuery({
    queryKey: ['inventory-product', selectedBranch?.id, product?.id],
    queryFn: () => inventoryService.getBranchInventory(selectedBranch!.id, { product_id: product!.id, page_size: 1 }),
    enabled: isEdit && !!selectedBranch?.id && !!product?.id,
    staleTime: 0,
  })

  const [form, setForm] = useState({
    sku:           product?.sku           ?? generateSKU(),
    name:          product?.name          ?? '',
    description:   product?.description   ?? '',
    product_type:  'SIMPLE' as const,
    category_id:   product?.category_id   ?? '',
    brand_id:      product?.brand_id      ?? '',
    barcode:       product?.barcode        ?? initialBarcode ?? '',
    cost_price:    product?.cost_price    ? parseFloat(product.cost_price).toFixed(2)    : '',
    selling_price: product?.selling_price ? parseFloat(product.selling_price).toFixed(2) : '',
    reorder_point: String(product?.reorder_point ?? 0),
    is_active:     product?.is_active ?? true,
    initial_stock: '',
    // Promotion / discount
    has_discount:      !!(product?.discount_type),
    discount_type:     (product?.discount_type ?? 'PERCENTAGE') as 'PERCENTAGE' | 'AMOUNT',
    discount_value:    product?.discount_value ? parseFloat(product.discount_value).toFixed(2) : '',
    discount_start_at: product?.discount_start_at ? product.discount_start_at.slice(0, 16) : '',
    discount_end_at:   product?.discount_end_at   ? product.discount_end_at.slice(0, 16)   : '',
  })
  const [saving, setSaving]             = useState(false)
  const [error,  setError]              = useState<string | null>(null)
  const [showScanner, setShowScanner]   = useState(false)
  const [barcodeConflict, setBarcodeConflict] = useState<{ name: string; sku: string } | null>(null)
  const [barcodeChecking, setBarcodeChecking] = useState(false)

  useEffect(() => {
    const rp = invData?.items?.[0]?.reorder_point
    if (rp != null) setForm(prev => ({ ...prev, reorder_point: String(Math.round(Number(rp))) }))
  }, [invData])

  const handleScan = useCallback(async (code: string) => {
    if (isEdit) {
      setForm(prev => ({ ...prev, sku: prev.sku || code, barcode: code }))
      toast.success(`Scanned: ${code}`)
      return
    }
    setBarcodeChecking(true)
    setBarcodeConflict(null)
    let conflict: { name: string; sku: string } | null = null
    try {
      const result = await lookupProductByBarcode(code)
      if (result.status === 'found') conflict = { name: result.product.name, sku: result.product.sku }
    } catch { /* network error — allow form fill */ }
    setBarcodeChecking(false)
    if (conflict) { setBarcodeConflict(conflict); return }
    setForm(prev => ({ ...prev, sku: prev.sku || code, barcode: code }))
    toast.success(`Scanned: ${code}`)
  }, [isEdit])


  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setError(null)
    }
  }

  const canSubmit =
    form.sku.trim() && form.name.trim() && form.cost_price && form.selling_price &&
    (isEdit || !!form.category_id) && !barcodeConflict && !saving

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const discountPayload = form.has_discount && form.discount_value
        ? {
            discount_type:     form.discount_type,
            discount_value:    form.discount_value,
            discount_start_at: form.discount_start_at || undefined,
            discount_end_at:   form.discount_end_at   || undefined,
          }
        : {}
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
        reorder_point: parseInt(form.reorder_point || '0', 10),
        ...discountPayload,
      }
      const reorderPt = parseInt(form.reorder_point || '0', 10)
      let savedProduct: BackendProduct | undefined
      if (isEdit) {
        const hadDiscount = !!(product.discount_type)
        const clearDiscount = hadDiscount && !form.has_discount
        await productsService.update(product.id, { ...payload, is_active: form.is_active, ...(clearDiscount ? { clear_discount: true } : {}) })
        if (selectedBranch && reorderPt >= 0) {
          try {
            await inventoryService.setReorderLevels(selectedBranch.id, product.id, { reorder_point: reorderPt, reorder_quantity: 0 })
          } catch { /* non-fatal */ }
        }
        toast.success('Product updated')
      } else {
        const created = await productsService.create(payload)
        savedProduct = created
        const qty = parseInt(form.initial_stock || '0', 10)
        if (selectedBranch) {
          if (qty > 0) {
            try {
              await inventoryService.setOpeningStock({ branch_id: selectedBranch.id, items: [{ product_id: created.id, quantity: String(qty), cost_price: form.cost_price }] })
            } catch { toast.warning('Product created but initial stock could not be set — add it via Inventory.') }
          }
          if (reorderPt > 0) {
            try {
              await inventoryService.setReorderLevels(selectedBranch.id, created.id, { reorder_point: reorderPt, reorder_quantity: 0 })
            } catch { /* non-fatal */ }
          }
        }
        toast.success('Product created')
      }
      onSaved(savedProduct)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.detail ?? 'Failed to save product. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ScannerInputCapture onScan={handleScan} enabled={!showScanner && !isMobileWidth} />
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
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
            <h2 className="text-base font-semibold text-zinc-100">{isEdit ? 'Edit Product' : 'New Product'}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none">×</button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
            {!isMobileWidth && (
              <button
                type="button"
                disabled={barcodeChecking}
                onClick={() => setShowScanner(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-700 hover:border-amber-500 hover:text-amber-400 text-zinc-400 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <rect x="7" y="7" width="3" height="10" rx="1"/><rect x="14" y="7" width="3" height="10" rx="1"/>
                </svg>
                {barcodeChecking ? 'Checking barcode…' : form.barcode ? `Scanned: ${form.barcode} — tap to re-scan` : 'Tap to scan barcode'}
              </button>
            )}

            {!isEdit && barcodeConflict && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-950 border border-amber-800">
                <span className="shrink-0 text-base leading-none mt-0.5">⚠️</span>
                <div>
                  <p className="text-xs font-semibold text-amber-400">Barcode already in use</p>
                  <p className="text-xs text-amber-500 mt-0.5">
                    "{barcodeConflict.name}" ({barcodeConflict.sku}) already has this barcode. Use a different barcode or scan another item.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">SKU</label>
                <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-2.5">
                  <span className="font-mono text-sm text-amber-400 flex-1">{form.sku}</span>
                  {!isEdit && (
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, sku: generateSKU() }))} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Regenerate SKU">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <Input label="Barcode" value={form.barcode} onChange={e => { set('barcode')(e); setBarcodeConflict(null) }} placeholder="auto-filled by scan" />
            </div>

            <Input label="Name *" value={form.name} onChange={set('name')} placeholder="Product name" required />

            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">Description</label>
              <textarea value={form.description} onChange={set('description')} placeholder="Optional description…" rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Category <span className="text-red-400 normal-case">*</span></label>
                  {categories.length === 0 && <Link to="/app/categories" onClick={onClose} className="text-[10px] text-amber-400 hover:text-amber-300">+ Create one</Link>}
                </div>
                <select value={form.category_id} onChange={set('category_id')} required
                  className={`w-full bg-zinc-800 border rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 ${!isEdit && !form.category_id ? 'border-zinc-600 text-zinc-500' : 'border-zinc-700 text-zinc-100'}`}>
                  <option value="">— Select Category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Brand</label>
                  {brands.length === 0 && <Link to="/app/brands" onClick={onClose} className="text-[10px] text-amber-400 hover:text-amber-300">+ Create one</Link>}
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

            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">
                Reorder Point <span className="ml-1 text-zinc-600 normal-case font-normal">— alert when stock ≤ this</span>
              </label>
              <Input type="number" min="0" step="1" value={form.reorder_point} onChange={set('reorder_point')} placeholder="0" />
            </div>

            {!isEdit && (
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">
                  Opening Stock <span className="ml-1 text-zinc-600 normal-case font-normal">— how many units you have right now</span>
                </label>
                <Input type="number" min="0" step="1" value={form.initial_stock} onChange={set('initial_stock')} placeholder="0" />
              </div>
            )}

            {/* Promotion / Discount */}
            <div className="border border-zinc-700 rounded-xl p-3 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.has_discount}
                  onChange={e => setForm(prev => ({ ...prev, has_discount: e.target.checked }))}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-sm font-medium text-zinc-200">Enable Promotion / Discount</span>
              </label>

              {form.has_discount && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">Type</label>
                      <select
                        value={form.discount_type}
                        onChange={e => setForm(prev => ({ ...prev, discount_type: e.target.value as 'PERCENTAGE' | 'AMOUNT' }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:border-amber-500"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="AMOUNT">Fixed Amount (Kyats)</option>
                      </select>
                    </div>
                    <Input
                      label={form.discount_type === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (Kyats)'}
                      type="number"
                      min="0"
                      step={form.discount_type === 'PERCENTAGE' ? '1' : '0.01'}
                      max={form.discount_type === 'PERCENTAGE' ? '100' : undefined}
                      value={form.discount_value as string}
                      onChange={e => setForm(prev => ({ ...prev, discount_value: e.target.value }))}
                      placeholder={form.discount_type === 'PERCENTAGE' ? '10' : '500.00'}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">Start Date <span className="text-zinc-600 normal-case font-normal">(optional)</span></label>
                      <input
                        type="datetime-local"
                        value={form.discount_start_at}
                        onChange={e => setForm(prev => ({ ...prev, discount_start_at: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">End Date <span className="text-zinc-600 normal-case font-normal">(optional)</span></label>
                      <input
                        type="datetime-local"
                        value={form.discount_end_at}
                        onChange={e => setForm(prev => ({ ...prev, discount_end_at: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  {form.discount_value && (
                    <p className="text-[11px] text-amber-400">
                      {form.discount_type === 'PERCENTAGE'
                        ? `${form.discount_value}% off will be auto-applied at checkout`
                        : `${Number(form.discount_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kyats off will be auto-applied at checkout`}
                      {(form.discount_start_at || form.discount_end_at) && ` within the set period`}
                    </p>
                  )}
                </div>
              )}
            </div>

            {isEdit && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))} className="w-4 h-4 rounded accent-amber-500" />
                <span className="text-sm text-zinc-300">Active</span>
              </label>
            )}

            {error && (
              <div className="px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 text-red-400 text-xs">{error}</div>
            )}
          </form>

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
