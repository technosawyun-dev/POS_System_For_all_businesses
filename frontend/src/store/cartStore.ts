import { create } from 'zustand'
import { useMemo } from 'react'
import type { CartItem, Product, CheckoutStep, PaymentMethod, SplitPayment, CartTotals } from '@/types'

interface CartState {
  items: CartItem[]
  discount: number    // order-level %
  note: string

  // Checkout flow
  checkoutStep: CheckoutStep
  paymentMethod: PaymentMethod
  paymentAmount: string
  splitPayments: SplitPayment[]

  // Completed order tracking (replaces completedSale)
  completedOrderId: string | null

  // Actions — cart
  addItem: (product: Product) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  updateLineDiscount: (id: string, discount: number) => void
  setDiscount: (pct: number) => void
  setNote: (note: string) => void
  clearCart: () => void

  // Actions — checkout
  setCheckoutStep: (step: CheckoutStep) => void
  setPaymentMethod: (method: PaymentMethod) => void
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
  note: '',
  checkoutStep: 'cart',
  paymentMethod: 'cash',
  paymentAmount: '',
  splitPayments: [],
  completedOrderId: null,

  addItem: (product) => set(state => {
    const existing = state.items.find(i => i.id === product.id)
    if (existing) {
      return { items: state.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) }
    }
    return { items: [...state.items, { ...product, qty: 1, lineDiscount: 0 }] }
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
  setNote: (note) => set({ note }),

  clearCart: () => set({
    items: [], discount: 0, note: '',
    checkoutStep: 'cart', paymentAmount: '', splitPayments: [],
    completedOrderId: null,
  }),

  setCheckoutStep: (checkoutStep) => set({ checkoutStep }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod, paymentAmount: '', splitPayments: [] }),
  setPaymentAmount: (paymentAmount) => set({ paymentAmount }),
  addSplitPayment: (p) => set(state => ({ splitPayments: [...state.splitPayments, p] })),
  removeSplitPayment: (index) => set(state => ({
    splitPayments: state.splitPayments.filter((_, i) => i !== index),
  })),

  completeOrder: (orderId) => set({ completedOrderId: orderId, checkoutStep: 'receipt' }),

  newSale: () => set({
    items: [], discount: 0, note: '',
    checkoutStep: 'cart', paymentAmount: '', splitPayments: [],
    completedOrderId: null,
  }),
}))

export function useCartTotals(): CartTotals {
  const items = useCartStore(s => s.items)
  const discount = useCartStore(s => s.discount)

  return useMemo(() => {
    let itemSubtotal = 0
    let rawTax = 0
    let itemCount = 0

    for (const item of items) {
      const lineTotal = item.price * item.qty
      const lineDisc = (item.lineDiscount || 0) / 100 * lineTotal
      const lineNet = lineTotal - lineDisc
      itemSubtotal += lineNet
      rawTax += lineNet * (item.taxRate || 0)
      itemCount += item.qty
    }

    const orderDiscAmt = (discount || 0) / 100 * itemSubtotal
    const afterDiscount = itemSubtotal - orderDiscAmt
    // Distribute order-level discount proportionally across tax
    const taxMultiplier = itemSubtotal > 0 ? afterDiscount / itemSubtotal : 1
    const tax = Math.max(0, rawTax * taxMultiplier)
    const total = Math.max(0, afterDiscount + tax)

    return {
      itemSubtotal: Math.round(itemSubtotal * 100) / 100,
      orderDiscAmt: Math.round(orderDiscAmt * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
      itemCount,
    }
  }, [items, discount])
}
