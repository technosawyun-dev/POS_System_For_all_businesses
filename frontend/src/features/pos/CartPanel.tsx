import { useState } from 'react'
import { useCartStore, useCartTotals } from '@/store/cartStore'
import { IconCart, IconX, IconRefund, IconChevLeft } from '@/components/icons'
import { Divider, Kbd } from '@/components/ui'
import { fmt } from '@/lib/utils'
import { useLocaleStore } from '@/i18n/localeStore'
import CartItem from '@/features/pos/CartItem'
import DiscountRow from '@/features/pos/DiscountRow'
import RefundModal from '@/features/pos/RefundModal'

export default function CartPanel({ onBackToProducts }: { onBackToProducts?: () => void }) {
  const items           = useCartStore(s => s.items)
  const discount        = useCartStore(s => s.discount)
  const discountType    = useCartStore(s => s.discountType)
  const clearCart       = useCartStore(s => s.clearCart)
  const checkoutStep    = useCartStore(s => s.checkoutStep)
  const setCheckoutStep = useCartStore(s => s.setCheckoutStep)
  const totals          = useCartTotals()
  const t               = useLocaleStore(s => s.t)

  const [showRefund, setShowRefund] = useState(false)

  if (checkoutStep !== 'cart') return null

  return (
    <>
      {showRefund && (
        <RefundModal onClose={() => setShowRefund(false)} />
      )}

      <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800 flex-shrink-0 w-full lg:w-80">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {onBackToProducts && (
              <button
                onClick={onBackToProducts}
                className="lg:hidden flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400 transition-colors mr-1"
                title="Back to products"
              >
                <IconChevLeft width="14" height="14" />
                Products
              </button>
            )}
            <IconCart width="16" height="16" className="text-amber-400" />
            <span className="text-sm font-semibold text-zinc-100">Order</span>
            {totals.itemCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                {totals.itemCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRefund(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
              title="Process a refund"
            >
              <IconRefund width="13" height="13" />
              {t('pos.refund')}
            </button>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-red-400 hover:border-red-500/50 transition-colors"
              >
                <IconX width="11" height="11" />
                {t('pos.clear')}
              </button>
            )}
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <IconCart width="40" height="40" className="text-zinc-800" />
              <p className="text-xs text-zinc-600 text-center">
                Cart is empty
                <br />
                <span className="text-zinc-700">Tap a product to add</span>
              </p>
            </div>
          ) : (
            <div className="py-2 px-1">
              {items.map(item => (
                <CartItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-zinc-800 px-4 pt-3 pb-3 flex-shrink-0 flex flex-col gap-2">
            <DiscountRow />
            <Divider />

            {discount > 0 && (
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{fmt(totals.itemSubtotal + totals.orderDiscAmt)}</span>
                </div>
                <div className="flex justify-between text-amber-500">
                  <span>
                    Discount ({discountType === 'amount'
                      ? `${discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ks`
                      : `${discount}%`})
                  </span>
                  <span className="font-mono">-{fmt(totals.orderDiscAmt)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between text-xs text-zinc-500">
              <span>
                {totals.taxEnabled && totals.taxInclusive
                  ? `${totals.taxName} (included)`
                  : totals.taxEnabled
                    ? `${totals.taxName} (${totals.taxRate}%)`
                    : 'Tax'}
              </span>
              <span className="font-mono">
                {totals.taxEnabled ? fmt(totals.tax) : '-'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-t border-zinc-800 mt-0.5">
              <span className="text-sm font-semibold text-zinc-200">Total</span>
              <span className="font-mono text-lg font-bold text-amber-400">
                {fmt(totals.total)}
              </span>
            </div>

            <button
              onClick={() => setCheckoutStep('payment')}
              className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-base transition-all duration-150 shadow-lg shadow-amber-900/30 active:scale-[0.98]"
            >
              Checkout
            </button>

            <div className="flex items-center justify-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-zinc-700 text-[10px]">
                <Kbd keys="F9" /> checkout
              </span>
              <span className="flex items-center gap-1 text-zinc-700 text-[10px]">
                <Kbd keys="Esc" /> clear
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
