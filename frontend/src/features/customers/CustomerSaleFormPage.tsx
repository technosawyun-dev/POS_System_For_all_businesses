import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { customersService } from '@/services/customers/customers.service'
import { checkoutService } from '@/services/sales/sales.service'
import { productsService } from '@/services/products/products.service'
import { inventoryService } from '@/services/inventory/inventory.service'
import { useSessionStore } from '@/store/session.store'
import { useTenantStore } from '@/store/tenant.store'
import { fmt, cn } from '@/lib/utils'
import { Btn, Spinner } from '@/components/ui'
import { IconSearch, IconPlus, IconMinus, IconTrash } from '@/components/icons'
import type { Product } from '@/shared/types'

interface SaleItem {
  product: Product
  quantity: number
  unit_price: number
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'KBZPAY', label: 'KBZPay' },
]

interface SaleItemRowProps {
  item: SaleItem
  onUpdateQty: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
}

function SaleItemRow({ item, onUpdateQty, onRemove }: SaleItemRowProps) {
  const [localQty, setLocalQty] = useState(String(item.quantity))
  useEffect(() => { setLocalQty(String(item.quantity)) }, [item.quantity])

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-200 truncate leading-tight">{item.product.name}</p>
        <p className="text-[11px] text-zinc-500 font-mono">{fmt(String(item.unit_price))} ea</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onUpdateQty(item.product.id, item.quantity - 1)}
          className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 flex items-center justify-center transition-colors"
        >
          <IconMinus width="10" height="10" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={localQty}
          onFocus={e => e.currentTarget.select()}
          onChange={e => setLocalQty(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => {
            const n = parseInt(localQty, 10)
            if (n >= 1) onUpdateQty(item.product.id, n)
            else setLocalQty(String(item.quantity))
          }}
          onKeyDown={e => {
            if (e.key === 'Enter')  e.currentTarget.blur()
            if (e.key === 'Escape') { setLocalQty(String(item.quantity)); e.currentTarget.blur() }
          }}
          className="w-8 h-6 text-center text-sm text-zinc-200 font-mono bg-zinc-800 border border-zinc-700 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-colors"
        />
        <button
          onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
          className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 flex items-center justify-center transition-colors"
        >
          <IconPlus width="10" height="10" />
        </button>
      </div>

      <span className="w-20 text-right font-mono text-sm text-zinc-200 flex-shrink-0">
        {fmt(String(item.unit_price * item.quantity))}
      </span>

      <button
        onClick={() => onRemove(item.product.id)}
        className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <IconTrash width="14" height="14" />
      </button>
    </div>
  )
}

export default function CustomerSaleFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { activeSession } = useSessionStore()
  const { selectedBranch } = useTenantStore()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [items, setItems] = useState<SaleItem[]>([])
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: customer } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.get(id!),
    enabled: !!id,
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['customer-sale-products', debouncedSearch],
    queryFn: () =>
      productsService.list({ search: debouncedSearch || undefined, page_size: 500, is_active: true }),
  })

  const branchId = activeSession?.branch_id ?? selectedBranch?.id ?? ''

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: () => inventoryService.getBranchInventory(branchId, { page_size: 500 }),
    enabled: !!branchId,
  })

  const inventoryMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const inv of inventoryData?.items ?? []) {
      m.set(inv.product_id, parseFloat(inv.quantity_available))
    }
    return m
  }, [inventoryData])

  const products = productsData?.items ?? []

  function addItem(product: Product) {
    const stock = inventoryMap.get(product.id) ?? 0
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(`Only ${stock} in stock`)
          return prev
        }
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      if (stock <= 0) {
        toast.error('Out of stock')
        return prev
      }
      return [...prev, { product, quantity: 1, unit_price: parseFloat(product.selling_price) }]
    })
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.product.id !== productId))
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) { removeItem(productId); return }
    const stock = inventoryMap.get(productId) ?? 0
    if (qty > stock) { toast.error(`Only ${stock} in stock`); return }
    setItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
  }

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const rawPaid = parseFloat(paidAmount) || 0
  const paid = Math.min(Math.max(rawPaid, 0), subtotal)
  const remaining = subtotal - paid
  const currentBalance = parseFloat(customer?.balance ?? '0')
  const newBalance = currentBalance + remaining

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!activeSession) throw new Error('No active cashier session')
      if (items.length === 0) throw new Error('Add at least one item')

      return checkoutService.checkout({
        cashier_session_id: activeSession.id,
        items: items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity.toString(),
          unit_price: item.unit_price.toFixed(4),
          discount_amount: '0',
          tax_rate: (parseFloat(item.product.tax_rate ?? '0') / 100).toFixed(4),
        })),
        payments: paid > 0
          ? [{ payment_method: paymentMethod, amount: paid.toFixed(4) }]
          : [],
        customer_id: id,
        notes: notes || undefined,
      })
    },
    onSuccess: order => {
      toast.success(`Order #${order.order_number} created`)
      qc.invalidateQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: ['customer-ledger', id] })
      qc.invalidateQueries({ queryKey: ['inventory', branchId] })
      navigate(`/app/customers/${id}`)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to create order')
    },
  })

  if (!activeSession) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-zinc-500 text-sm">A cashier session must be open to create orders.</p>
        <Btn size="sm" onClick={() => navigate('/app/session-open')}>Open Session</Btn>
      </div>
    )
  }

  const submitLabel =
    items.length === 0
      ? 'Add items to continue'
      : paid >= subtotal && subtotal > 0
        ? 'Create Order — Paid in Full'
        : paid > 0
          ? 'Create Order — Partially Paid'
          : 'Create Order — On Account'

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">New Order</h2>
        {customer && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Current Balance</p>
            <p className={cn(
              'font-mono text-sm font-bold',
              currentBalance > 0 ? 'text-amber-400' : 'text-zinc-500',
            )}>
              {fmt(customer.balance)}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/*  Left: product search */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Products</h3>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              <IconSearch width="14" height="14" />
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 py-2 pl-8 pr-3 transition-all"
            />
          </div>

          {/* Product list */}
          <div className="space-y-0.5 max-h-80 overflow-y-auto -mx-1 px-1">
            {productsLoading ? (
              <div className="flex justify-center py-6"><Spinner size={20} /></div>
            ) : products.length === 0 ? (
              <p className="text-center text-zinc-600 text-sm py-6">No products found</p>
            ) : (
              products.map(product => {
                const stock = inventoryMap.get(product.id) ?? 0
                const inCart = items.find(i => i.product.id === product.id)
                const maxed = !!inCart && inCart.quantity >= stock
                const disabled = stock <= 0 || maxed

                return (
                  <button
                    key={product.id}
                    onClick={() => addItem(product)}
                    disabled={disabled}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                      disabled
                        ? 'opacity-40 cursor-not-allowed text-zinc-500'
                        : 'hover:bg-zinc-800 text-zinc-200 active:bg-zinc-700',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">{product.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{product.sku} · Stock: {stock}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-amber-400 text-xs">{fmt(product.selling_price)}</span>
                      {inCart ? (
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                          {inCart.quantity}
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-zinc-700 text-zinc-400 flex items-center justify-center">
                          <IconPlus width="10" height="10" />
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: order items + payment */}
        <div className="space-y-4">
          {/* Order items */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Order Items</h3>

            {items.length === 0 ? (
              <p className="text-center text-zinc-600 text-sm py-4">
                Select products from the list
              </p>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <SaleItemRow
                    key={item.product.id}
                    item={item}
                    onUpdateQty={updateQty}
                    onRemove={removeItem}
                  />
                ))}

                {/* Subtotal row */}
                <div className="border-t border-zinc-800 pt-2 flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Sale Total</span>
                  <span className="font-mono font-bold text-zinc-200">{fmt(String(subtotal))}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Payment</h3>

            <div className="space-y-3">
              {/* Paid now */}
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Paid Now</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    min={0}
                    max={subtotal}
                    step="0.01"
                    placeholder="0 = on account"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 py-2 px-3 transition-all"
                  />
                  <Btn
                    size="sm"
                    variant="ghost"
                    disabled={subtotal === 0}
                    onClick={() => setPaidAmount(subtotal.toFixed(2))}
                  >
                    Full
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    disabled={subtotal === 0}
                    onClick={() => setPaidAmount('')}
                  >
                    None
                  </Btn>
                </div>
              </div>

              {/* Payment method — only visible when something is being paid */}
              {paid > 0 && (
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-amber-500 py-2 px-3"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Order notes…"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 py-2 px-3 transition-all"
                />
              </div>
            </div>

            {/* Balance preview — only show when items are in the cart */}
            {items.length > 0 && (
              <div className="border-t border-zinc-800 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Sale total</span>
                  <span className="font-mono">{fmt(String(subtotal))}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Paying now</span>
                  <span className="font-mono text-green-400">{fmt(String(paid))}</span>
                </div>
                {remaining === 0 && items.length > 0 && (
                  <div className="flex justify-between text-xs text-green-400">
                    <span>Fully settled</span>
                    <span className="font-mono">✓</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-zinc-800">
                  <span className="text-zinc-300">Remaining Balance</span>
                  <span className={cn('font-mono', newBalance > 0 ? 'text-amber-400' : 'text-zinc-400')}>
                    {fmt(String(newBalance))}
                  </span>
                </div>
              </div>
            )}

            <Btn
              className="w-full"
              disabled={items.length === 0 || checkoutMutation.isPending}
              loading={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
            >
              {submitLabel}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
