import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/auth.store'
import { receiptsService } from '@/services/receipts/receipts.service'
import { tenantService } from '@/services/tenant/tenant.service'
import { fmt, fmtDateTime } from '@/lib/utils'
import { getPaymentMethodLabel } from '@/lib/paymentMethod'
import { IconCheck, IconPrint, IconAlert } from '@/components/icons'
import { Spinner } from '@/components/ui'
import { ReceiptPrintPreviewModal } from '@/components/hardware/PrintPreviewModal'

export default function ReceiptScreen() {
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const completedOrderId = useCartStore(s => s.completedOrderId)
  const newSale          = useCartStore(s => s.newSale)
  const tenantId         = useAuthStore(s => s.user?.tenant_id)

  const { data: receipt, isLoading, isError } = useQuery({
    queryKey: ['receipt', 'order', completedOrderId],
    queryFn: () => receiptsService.getByOrderId(completedOrderId!),
    enabled: !!completedOrderId,
    retry: 2,
  })

  const { data: taxSettings } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => tenantService.getTenantSettings(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })

  const taxEnabled        = !!taxSettings && (taxSettings.tax_rate ?? 0) > 0
  const taxInclusive      = taxSettings?.tax_inclusive ?? false
  const ex                = taxSettings?.extra_settings as Record<string, unknown> | undefined
  const taxName           = (ex?.tax_name as string) || 'Tax'
  const autoPrint         = (ex?.auto_print_receipt as boolean) ?? false
  const showTaxOnReceipt  = (ex?.show_tax_on_receipt as boolean) ?? true

  // Auto-open print preview once when receipt loads and auto-print is enabled
  const autoPrinted = useRef(false)
  useEffect(() => {
    if (autoPrint && receipt && !autoPrinted.current) {
      autoPrinted.current = true
      setShowPrintPreview(true)
    }
  }, [autoPrint, receipt])

  if (!completedOrderId) return null

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950/95 flex flex-col items-center justify-center gap-4">
        <Spinner size={40} />
        <p className="text-sm text-zinc-400">Generating receipt…</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm flex flex-col items-center gap-5">

        {/* Success indicator */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
            <IconCheck width="28" height="28" className="text-green-400" />
          </div>
          <p className="text-lg font-bold text-zinc-100">Payment Complete</p>
          {receipt && (
            <p className="text-xs text-zinc-500 font-mono">{receipt.receipt_number}</p>
          )}
        </div>

        {isError && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-950 border border-amber-800 text-amber-400 text-xs w-full">
            <IconAlert width="14" height="14" className="flex-shrink-0" />
            <span>Receipt unavailable — order was saved successfully.</span>
          </div>
        )}

        {receipt && (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800 text-center">
              <p className="text-sm font-semibold text-zinc-100">{receipt.tenant_name}</p>
              <p className="text-xs text-zinc-500">{receipt.branch_name}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{fmtDateTime(receipt.issued_at)}</p>
            </div>

            {/* Items */}
            <div className="px-5 py-3 flex flex-col gap-1.5 border-b border-zinc-800">
              {receipt.items_snapshot.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-zinc-400 flex-1 min-w-0">
                    {item.product_name}
                    {item.variant_name && <span className="text-zinc-600"> · {item.variant_name}</span>}
                    <span className="text-zinc-600"> × {item.quantity}</span>
                  </span>
                  <span className="font-mono text-zinc-200 flex-shrink-0">
                    {fmt(parseFloat(item.total))}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-5 py-3 flex flex-col gap-1 border-b border-zinc-800">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Subtotal</span>
                {/* For inclusive tax, subtotal = total_amount (gross) so item lines match */}
                <span className="font-mono">
                  {fmt(parseFloat(taxEnabled && taxInclusive ? receipt.total_amount : receipt.subtotal))}
                </span>
              </div>
              {parseFloat(receipt.discount_amount) > 0 && (
                <div className="flex justify-between text-xs text-amber-500">
                  <span>Discount</span>
                  <span className="font-mono">-{fmt(parseFloat(receipt.discount_amount))}</span>
                </div>
              )}
              {taxEnabled && showTaxOnReceipt && parseFloat(receipt.tax_amount) > 0 && (
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>{taxName}{taxInclusive ? ' (incl.)' : ''}</span>
                  <span className="font-mono">{fmt(parseFloat(receipt.tax_amount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-zinc-100 mt-1 pt-1 border-t border-zinc-800">
                <span>Total</span>
                <span className="font-mono text-amber-400">{fmt(parseFloat(receipt.total_amount))}</span>
              </div>
            </div>

            {/* Payment info */}
            <div className="px-5 py-3 flex flex-col gap-1 text-xs text-zinc-500">
              {receipt.payment_methods.map((pm, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {getPaymentMethodLabel(pm.method ?? '')}
                    {pm.notes && <span className="text-zinc-600"> · {pm.notes}</span>}
                  </span>
                  <span className="font-mono text-zinc-300">{fmt(parseFloat(pm.amount))}</span>
                </div>
              ))}
              {parseFloat(receipt.amount_paid) > parseFloat(receipt.total_amount) && (
                <>
                  <div className="flex justify-between">
                    <span>Tendered</span>
                    <span className="font-mono text-zinc-300">{fmt(parseFloat(receipt.amount_paid))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span className="font-mono text-green-400 font-semibold">{fmt(parseFloat(receipt.change_amount))}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between mt-1 pt-1 border-t border-zinc-800">
                <span>Cashier</span>
                <span className="text-zinc-400">{receipt.cashier_name}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={() => setShowPrintPreview(true)}
            disabled={!receipt}
            className="flex-1 h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          >
            <IconPrint width="15" height="15" />
            Print
          </button>
          <button
            onClick={newSale}
            className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-sm transition-all shadow-lg shadow-amber-900/30"
          >
            New Sale
          </button>
        </div>
      </div>

      {receipt && showPrintPreview && (
        <ReceiptPrintPreviewModal
          receipt={receipt}
          onClose={() => setShowPrintPreview(false)}
          autoTrigger={autoPrint && autoPrinted.current}
        />
      )}
    </div>
  )
}
