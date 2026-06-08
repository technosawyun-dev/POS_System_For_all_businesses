import { create } from 'zustand'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CartItem, Product, CheckoutStep, PaymentMethod, CardSubMethod, SplitPayment, CartTotals } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { tenantService } from '@/services/tenant/tenant.service'

interface CartState {
  items: CartItem[]
  discount: number             // order-level value (% when type=percent, absolute when type=amount)
  discountType: 'percent' | 'amount'
  note: string

  // Checkout flow
  checkoutStep: CheckoutStep
  paymentMethod: PaymentMethod
  cardSubMethod: CardSubMethod   // active sub-method when paymentMethod === 'card'
  bankTransferBank: string       // bank name when cardSubMethod === 'BANK_TRANSFER'
  paymentAmount: string
  splitPayments: SplitPayment[]

  // Completed order tracking (replaces completedSale)
  completedOrderId: string | null

  // Actions — cart
  addItem: (product: Product) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  updateLineDiscount: (id: string, discount: number) => void
  setDiscount: (val: number) => void
  setDiscountType: (type: 'percent' | 'amount') => void
  setNote: (note: string) => void
  clearCart: () => void

  // Actions — checkout
  setCheckoutStep: (step: CheckoutStep) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setCardSubMethod: (method: CardSubMethod) => void
  setBankTransferBank: (bank: string) => void
  setPaymentAmount: (amount: string) => void
  addSplitPayment: (p: SplitPayment) => void
  removeSplitPayment: (index: number) => void
  completeOrder: (orderId: string) => void
  newSale: () => void
}

// Derived totals hook
export const useCartStore = create<CartState>()((set) => ({
  items: [],
  discount: 0,
  discountType: 'percent',
  note: '',
  checkoutStep: 'cart',
  paymentMethod: 'cash',
  cardSubMethod: 'CARD',
  bankTransferBank: '',
  paymentAmount: '',
  splitPayments: [],
  completedOrderId: null,

  addItem: (product) => set(state => {
    const existing = state.items.find(i => i.id === product.id)
    if (existing) {
      return { items: state.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) }
    }
    const autoDiscount = product.promoDiscountPct ?? 0
    return { items: [...state.items, { ...product, qty: 1, lineDiscount: autoDiscount }] }
  }),

  removeItem: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),

  updateQty: (id, qty) => set(state => {
    if (qty <= 0) return { items: state.items.filter(i => i.id !== id) }
    return { items: state.items.map(i => i.id === id ? { ...i, qty } : i) }
  }),

  updateLineDiscount: (id, discount) => set(state => ({
    items: state.items.map(i => i.id === id ? { ...i, lineDiscount: discount } : i),
  })),

  setDiscount: (discount) => set({ discount }),
  setDiscountType: (discountType) => set({ discountType }),
  setNote: (note) => set({ note }),

  clearCart: () => set({
    items: [], discount: 0, discountType: 'percent', note: '',
    checkoutStep: 'cart', paymentAmount: '', splitPayments: [],
    cardSubMethod: 'CARD', bankTransferBank: '', completedOrderId: null,
  }),

  setCheckoutStep: (checkoutStep) => set({ checkoutStep }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod, paymentAmount: '', splitPayments: [] }),
  setCardSubMethod: (cardSubMethod) => set({ cardSubMethod, bankTransferBank: '' }),
  setBankTransferBank: (bankTransferBank) => set({ bankTransferBank }),
  setPaymentAmount: (paymentAmount) => set({ paymentAmount }),
  addSplitPayment: (p) => set(state => ({ splitPayments: [...state.splitPayments, p] })),
  removeSplitPayment: (index) => set(state => ({
    splitPayments: state.splitPayments.filter((_, i) => i !== index),
  })),

  completeOrder: (orderId) => set({ completedOrderId: orderId, checkoutStep: 'receipt' }),

  newSale: () => set({
    items: [], discount: 0, discountType: 'percent', note: '',
    checkoutStep: 'cart', paymentAmount: '', splitPayments: [],
    cardSubMethod: 'CARD', bankTransferBank: '', completedOrderId: null,
  }),
}))

export function useCartTotals(): CartTotals {
  const items        = useCartStore(s => s.items)
  const discount     = useCartStore(s => s.discount)
  const discountType = useCartStore(s => s.discountType)
  const tenantId     = useAuthStore(s => s.user?.tenant_id)

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => tenantService.getTenantSettings(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })

  const ex          = settings?.extra_settings as Record<string, unknown> | undefined
  const taxEnabled  = !!settings && settings.tax_rate != null && settings.tax_rate > 0
  const taxRate     = taxEnabled ? settings!.tax_rate! : 0   // 0–100
  const taxInclusive = settings?.tax_inclusive ?? false
  const taxName      = (ex?.tax_name as string) || 'Tax'
  const rateDecimal  = taxRate / 100

  return useMemo(() => {
    let rawTotal = 0
    let itemCount = 0

    for (const item of items) {
      const lineTotal = item.price * item.qty
      const lineDisc  = (item.lineDiscount || 0) / 100 * lineTotal
      rawTotal += lineTotal - lineDisc
      itemCount += item.qty
    }

    const orderDiscAmt   = discountType === 'amount'
      ? Math.min(discount || 0, rawTotal)
      : (discount || 0) / 100 * rawTotal
    const afterOrderDisc = rawTotal - orderDiscAmt

    let subtotal: number, tax: number, total: number

    if (taxEnabled && taxInclusive) {
      // Tax is baked into prices.
      // Show the gross (item prices as-is) as subtotal so it matches
      // the sum the customer sees on the item lines.
      tax      = afterOrderDisc * rateDecimal / (1 + rateDecimal)
      subtotal = afterOrderDisc          // gross — same as what items show
      total    = afterOrderDisc          // no extra added; tax is already in price
    } else if (taxEnabled) {
      subtotal = afterOrderDisc
      tax      = subtotal * rateDecimal
      total    = subtotal + tax
    } else {
      subtotal = afterOrderDisc
      tax      = 0
      total    = subtotal
    }

    return {
      itemSubtotal: Math.round(subtotal  * 100) / 100,
      orderDiscAmt: Math.round(orderDiscAmt * 100) / 100,
      tax:          Math.round(tax     * 100) / 100,
      total:        Math.max(0, Math.round(total * 100) / 100),
      itemCount,
      taxEnabled,
      taxName,
      taxInclusive,
      taxRate,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, discount, discountType, taxEnabled, taxRate, taxInclusive, taxName])
}
