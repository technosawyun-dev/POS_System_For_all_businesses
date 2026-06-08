import { useState, useEffect, useRef } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import axios from 'axios'
import { useCartStore, useCartTotals } from '@/store/cartStore'
import { useSessionStore } from '@/store/session.store'
import { useAuthStore } from '@/store/auth.store'
import { checkoutService } from '@/services/sales/sales.service'
import { tenantService } from '@/services/tenant/tenant.service'
import { fmt, cn, extractApiMsg, genId } from '@/lib/utils'
import { OfflineError } from '@/app/lib/axios'
import { enqueueSyncOp } from '@/offline/db'
import { IconX, IconCash, IconCard, IconSplit } from '@/components/icons'
import { Spinner } from '@/components/ui'
import type { PaymentMethod } from '@/types'
import CashPayment   from '@/features/payment/CashPayment'
import CardPayment   from '@/features/payment/CardPayment'
import SplitPayment  from '@/features/payment/SplitPayment'
import ReceiptScreen from '@/features/payment/ReceiptScreen'

const METHODS: { id: PaymentMethod; label: string; icon: typeof IconCash; activeClass: string }[] = [
  { id: 'cash',  label: 'Cash',         icon: IconCash,  activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-400' },
  { id: 'card',  label: 'Digital/Card', icon: IconCard,  activeClass: 'bg-blue-500/20 border-blue-500/50 text-blue-400' },
  { id: 'split', label: 'Split',        icon: IconSplit, activeClass: 'bg-violet-500/20 border-violet-500/50 text-violet-400' },
]

// Split method values are already backend enum values (CASH, KPAY, WAVEPAY, etc.)
// Only 'cash' (lowercase UI value) needs mapping to 'CASH'
function toBackendMethod(method: string): string {
  return method === 'cash' ? 'CASH' : method
}

export default function PaymentOverlay() {
  const qc = useQueryClient()
  const [isProcessing, setIsProcessing] = useState(false)

  const tenantId = useAuthStore(s => s.user?.tenant_id)
  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => tenantService.getTenantSettings(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })

  const items           = useCartStore(s => s.items)
  const discount        = useCartStore(s => s.discount)
  const note            = useCartStore(s => s.note)
  const checkoutStep    = useCartStore(s => s.checkoutStep)
  const setCheckoutStep = useCartStore(s => s.setCheckoutStep)
  const paymentMethod    = useCartStore(s => s.paymentMethod)
  const setPaymentMethod = useCartStore(s => s.setPaymentMethod)
  const cardSubMethod      = useCartStore(s => s.cardSubMethod)
  const bankTransferBank   = useCartStore(s => s.bankTransferBank)

  // Apply default payment method from settings once when overlay opens
  const appliedDefault = useRef(false)
  useEffect(() => {
    if (!appliedDefault.current && tenantSettings && checkoutStep === 'payment') {
      const ex = tenantSettings.extra_settings as Record<string, unknown>
      const def = ((ex?.default_payment_method as string) || 'CASH').toUpperCase()
      const mapped: PaymentMethod = def === 'CARD' ? 'card' : 'cash'
      setPaymentMethod(mapped)
      appliedDefault.current = true
    }
  }, [tenantSettings, checkoutStep, setPaymentMethod])
  const paymentAmount   = useCartStore(s => s.paymentAmount)
  const setPaymentAmount = useCartStore(s => s.setPaymentAmount)
  const splitPayments   = useCartStore(s => s.splitPayments)
  const addSplitPayment = useCartStore(s => s.addSplitPayment)
  const removeSplitPayment = useCartStore(s => s.removeSplitPayment)
  const completeOrder   = useCartStore(s => s.completeOrder)
  const totals          = useCartTotals()

  const { activeSession } = useSessionStore()

  if (checkoutStep === 'receipt') return <ReceiptScreen />

  async function doProcess() {
    if (isProcessing) return
    if (!activeSession) {
      toast.error('No active session. Please open a session first.')
      setCheckoutStep('cart')
      return
    }

    // Build the checkout payload once — reused in both the primary call
    // and the offline blink queue so there is no duplicated logic.
    const tenantTaxRate  = totals.taxEnabled ? totals.taxRate / 100 : 0
    const orderDiscountAmt = totals.orderDiscAmt
    const checkoutItems = items.map(item => {
      // For inclusive pricing, send the pre-tax unit price so the backend
      // formula (price * tax_rate) still yields the correct tax extracted amount.
      const unitPrice = totals.taxEnabled && totals.taxInclusive
        ? item.price / (1 + tenantTaxRate)
        : item.price
      const lineDiscAmt = ((item.lineDiscount || 0) / 100) * unitPrice * item.qty
      return {
        product_id:      item.id,
        quantity:        item.qty.toString(),
        unit_price:      unitPrice.toFixed(4),
        discount_amount: lineDiscAmt > 0 ? lineDiscAmt.toFixed(2) : undefined,
        tax_rate:        tenantTaxRate.toFixed(4),
      }
    })
    const payments: { payment_method: string; amount: string; notes?: string }[] =
      paymentMethod === 'split'
        ? splitPayments.map(sp => ({
            payment_method: toBackendMethod(sp.method),
            amount: sp.amount.toFixed(2),
            notes: sp.notes || undefined,
          }))
        : [{
            payment_method: paymentMethod === 'card' ? cardSubMethod : toBackendMethod(paymentMethod),
            amount: totals.total.toFixed(2),
            notes: (paymentMethod === 'card' && cardSubMethod === 'BANK_TRANSFER' && bankTransferBank)
              ? bankTransferBank
              : undefined,
          }]

    const checkoutPayload = {
      cashier_session_id: activeSession.id,
      items:              checkoutItems,
      payments,
      discount_amount:    orderDiscountAmt > 0 ? orderDiscountAmt.toFixed(2) : undefined,
      notes:              note || undefined,
    }

    setIsProcessing(true)
    setCheckoutStep('processing')

    try {
      const order = await checkoutService.checkout(checkoutPayload)

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['inventory'] }),
        qc.invalidateQueries({ queryKey: ['orders'] }),
        qc.invalidateQueries({ queryKey: ['session-orders'] }),
      ])

      completeOrder(order.id)
    } catch (err: unknown) {
      // Offline gate blocked the request — server is unreachable.
      if (err instanceof OfflineError) {
        toast.error('Server is offline. No changes can be made while offline.')
        setCheckoutStep('payment')
        return
      }

      // Network blip mid-flight (request was sent but connection dropped).
      // Queue the sale locally; the HealthPinger will auto-sync on next successful ping.
      if (axios.isAxiosError(err) && !err.response) {
        try {
          await enqueueSyncOp({
            id:        genId('sale'),
            type:      'SALE_CREATE',
            payload:   checkoutPayload,
            status:    'pending',
            createdAt: new Date(),
            retries:   0,
          })
          useCartStore.getState().clearCart()
          toast.info('Connection lost — sale saved locally. It will sync automatically when reconnected.', { duration: 6000 })
        } catch {
          toast.error('Connection lost and could not save the sale locally. Please try again.')
          setCheckoutStep('payment')
        }
        return
      }

      const msg = extractApiMsg(err) ?? 'Checkout failed. Please try again.'
      toast.error(msg)
      setCheckoutStep('payment')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => !isProcessing && checkoutStep === 'payment' && setCheckoutStep('cart')}
      />

      {/* Slide-in panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl animate-slideIn"
        style={{ width: 'min(100vw, 28rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <p className="text-base font-bold text-zinc-100">Payment</p>
            <span className="text-xs text-zinc-600">{totals.itemCount} item{totals.itemCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-amber-400">{fmt(totals.total)}</span>
            <button
              onClick={() => !isProcessing && setCheckoutStep('cart')}
              className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-100 transition-colors"
            >
              <IconX width="14" height="14" />
            </button>
          </div>
        </div>

        {/* Method tabs */}
        <div className="flex gap-1.5 px-4 pt-4 pb-2 flex-shrink-0">
          {METHODS.map(m => {
            const Icon = m.icon
            const isActive = paymentMethod === m.id
            return (
              <button
                key={m.id}
                onClick={() => !isProcessing && setPaymentMethod(m.id)}
                className={cn(
                  'flex-1 h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border',
                  isActive
                    ? m.activeClass
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700',
                )}
              >
                <Icon width="13" height="13" />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
          {paymentMethod === 'cash' && (
            <CashPayment total={totals.total} amount={paymentAmount} onAmountChange={setPaymentAmount} onProcess={doProcess} />
          )}
          {paymentMethod === 'card' && (
            <CardPayment total={totals.total} onProcess={doProcess} />
          )}
          {paymentMethod === 'split' && (
            <SplitPayment
              total={totals.total}
              splitPayments={splitPayments}
              onAdd={addSplitPayment}
              onRemove={removeSplitPayment}
              onProcess={doProcess}
            />
          )}
        </div>
      </div>

      {/* Full-screen processing overlay */}
      {(checkoutStep === 'processing' || isProcessing) && (
        <div className="fixed inset-0 z-[60] bg-zinc-950/95 flex flex-col items-center justify-center gap-4">
          <Spinner size={48} />
          <p className="text-sm font-semibold text-zinc-400 animate-pulse">Processing Payment…</p>
        </div>
      )}
    </>
  )
}

