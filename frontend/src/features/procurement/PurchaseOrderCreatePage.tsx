import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmt, extractApiMsg } from '@/lib/utils'
import { Btn, Spinner, SectionHeader } from '@/components/ui'
import { procurementService } from '@/services/procurement/procurement.service'
import { productsService } from '@/services/products/products.service'
import { useTenantStore } from '@/store/tenant.store'
import { inputCls, FormField } from './procurementHelpers'

const itemSchema = z.object({
  product_id:        z.string().min(1, 'Product required'),
  product_name:      z.string(),
  ordered_quantity:  z.string().min(1).refine(v => parseFloat(v) > 0, 'Must be > 0'),
  unit_cost:         z.string().min(1).refine(v => parseFloat(v) >= 0, 'Must be ≥ 0'),
})

const schema = z.object({
  supplier_id:   z.string().min(1, 'Supplier required'),
  branch_id:     z.string().min(1, 'Branch required'),
  order_date:    z.string().min(1, 'Order date required'),
  expected_date: z.string(),
  notes:         z.string(),
  items:         z.array(itemSchema).min(1, 'Add at least one item'),
})

type FormValues = z.infer<typeof schema>

export default function PurchaseOrderCreatePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { availableBranches } = useTenantStore()
  const [productSearch, setProductSearch] = useState('')

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', undefined, 1],
    queryFn: () => procurementService.listSuppliers({ status: 'ACTIVE', page_size: 100 }),
  })

  const { data: productsData } = useQuery({
    queryKey: ['products', productSearch],
    queryFn: () => productsService.list({ search: productSearch || undefined, page_size: 50 }),
    placeholderData: prev => prev,
  })

  const suppliers = suppliersData?.items ?? []
  const products  = productsData?.items ?? []

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_id:   '',
      branch_id:     availableBranches[0]?.id ?? '',
      order_date:    new Date().toISOString().split('T')[0],
      expected_date: '',
      notes:         '',
      items:         [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchedItems = watch('items')
  const subtotal = watchedItems.reduce((sum, item) => {
    const qty  = parseFloat(item.ordered_quantity) || 0
    const cost = parseFloat(item.unit_cost) || 0
    return sum + qty * cost
  }, 0)

  function addProduct(product: { id: string; name: string; cost_price: string }) {
    const existing = watchedItems.findIndex(i => i.product_id === product.id)
    if (existing >= 0) {
      toast.info('Product already in list')
      return
    }
    append({
      product_id:       product.id,
      product_name:     product.name,
      ordered_quantity: '1',
      unit_cost:        product.cost_price,
    })
    setProductSearch('')
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => procurementService.createOrder({
      branch_id:     data.branch_id,
      supplier_id:   data.supplier_id,
      order_date:    new Date(data.order_date).toISOString(),
      expected_date: data.expected_date ? new Date(data.expected_date).toISOString() : undefined,
      notes:         data.notes || undefined,
      items:         data.items.map(item => ({
        product_id:       item.product_id,
        ordered_quantity: item.ordered_quantity,
        unit_cost:        item.unit_cost,
      })),
    }),
    onSuccess: (po) => {
      toast.success(`Purchase order ${po.po_number} created`)
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['supplier-payables'] })
      navigate(`/app/procurement/purchase-orders/${po.id}`)
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to create purchase order'),
  })

  const pending = isSubmitting || createMutation.isPending

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="New Purchase Order"
        subtitle="Create a purchase order to send to a supplier"
      />

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">

          {/* Header fields */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Order Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Supplier" error={errors.supplier_id?.message} required>
                <select {...register('supplier_id')} className={inputCls(!!errors.supplier_id)}>
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Branch" error={errors.branch_id?.message} required>
                <select {...register('branch_id')} className={inputCls(!!errors.branch_id)}>
                  <option value="">Select branch…</option>
                  {availableBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Order Date" error={errors.order_date?.message} required>
                <input {...register('order_date')} type="date" className={inputCls(!!errors.order_date)} />
              </FormField>

              <FormField label="Expected Delivery">
                <input {...register('expected_date')} type="date" className={inputCls(false)} />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea {...register('notes')} placeholder="Internal notes…" rows={2} className={`${inputCls(false)} resize-none`} />
            </FormField>
          </div>

          {/* Product search + item list */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Order Items</h3>

            {/* Product search */}
            <div className="space-y-2">
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search products to add…"
                className={inputCls(false)}
              />
              {productSearch && products.length > 0 && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {products.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-zinc-700 transition-colors flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-sm text-zinc-100">{p.name}</span>
                        <span className="text-xs text-zinc-500 ml-2">{p.sku}</span>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 flex-shrink-0">{fmt(p.cost_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items */}
            {fields.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-4">
                Search for products above to add them
              </p>
            ) : (
              <div className="space-y-2">
                {/* Header row */}
                <div className="hidden sm:grid grid-cols-[1fr_120px_120px_80px_36px] gap-2 px-1">
                  <span className="text-xs text-zinc-500 uppercase">Product</span>
                  <span className="text-xs text-zinc-500 uppercase text-right">Qty</span>
                  <span className="text-xs text-zinc-500 uppercase text-right">Unit Cost</span>
                  <span className="text-xs text-zinc-500 uppercase text-right">Total</span>
                  <span />
                </div>

                {fields.map((field, i) => {
                  const qty  = parseFloat(watchedItems[i]?.ordered_quantity) || 0
                  const cost = parseFloat(watchedItems[i]?.unit_cost) || 0
                  const lineTotal = qty * cost
                  return (
                    <div key={field.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_80px_36px] gap-2 items-center bg-zinc-800/40 rounded-xl p-3 sm:p-2">
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-100 truncate">{field.product_name}</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 sm:hidden">Qty</label>
                        <Controller
                          control={control}
                          name={`items.${i}.ordered_quantity`}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              type="number"
                              min="0.0001"
                              step="any"
                              className={`${inputCls(!!errors.items?.[i]?.ordered_quantity)} text-right`}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 sm:hidden">Unit Cost</label>
                        <Controller
                          control={control}
                          name={`items.${i}.unit_cost`}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              type="number"
                              min="0"
                              step="any"
                              className={`${inputCls(!!errors.items?.[i]?.unit_cost)} text-right`}
                            />
                          )}
                        />
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm text-zinc-200">{fmt(lineTotal)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {errors.items?.root && (
              <p className="text-xs text-red-400">{errors.items.root.message}</p>
            )}

            {/* Totals */}
            {fields.length > 0 && (
              <div className="border-t border-zinc-800 pt-3 flex justify-end">
                <div className="space-y-1 text-sm text-right min-w-[200px]">
                  <div className="flex justify-between gap-8">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="font-mono text-zinc-200">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-8 font-semibold border-t border-zinc-700 pt-1 mt-1">
                    <span className="text-zinc-300">Total</span>
                    <span className="font-mono text-amber-400">{fmt(subtotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Btn
              type="button"
              variant="secondary"
              onClick={() => navigate('/app/procurement/purchase-orders')}
            >
              Cancel
            </Btn>
            <Btn type="submit" disabled={pending || fields.length === 0} fullWidth>
              {pending ? <Spinner size={16} /> : 'Create Purchase Order'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
