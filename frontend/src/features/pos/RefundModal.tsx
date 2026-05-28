import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { checkoutService, refundService } from '@/services/sales/sales.service'
import { fmt, fmtDateTime } from '@/lib/utils'
import { Btn, Spinner } from '@/components/ui'
import { IconX, IconSearch, IconRefund } from '@/components/icons'
import type { Order, OrderItem } from '@/shared/types'

type RefundMethod = 'CASH' | 'REPLACEMENT'

interface SelectedItem {
  orderItem: OrderItem
  qty: number
  amount: number
}

interface Props {
  onClose: () => void
  onSuccess?: () => void
}

export default function RefundModal({ onClose, onSuccess }: Props) {
  const [step, setStep]               = useState<'search' | 'items'>('search')
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder]             = useState<Order | null>(null)
  const [searching, setSearching]     = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected, setSelected]       = useState<Record<string, SelectedItem>>({})
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH')
  const [reason, setReason]           = useState('')
  const [notes, setNotes]             = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Search

  async function handleSearch() {
    const num = orderNumber.trim().toUpperCase()
    if (!num) return
    setSearching(true)
    setSearchError(null)
    try {
      const found = await checkoutService.getOrderByNumber(num)
      if (found.order_status === 'VOIDED') {
        setSearchError('This order has been voided and cannot be refunded.')
        return
      }
      if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(found.order_status)) {
        setSearchError(`Order status is "${found.order_status}" — only Completed orders can be refunded.`)
        return
      }
      setOrder(found)
      setSelected({})
      setStep('items')
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.detail
      setSearchError(msg ?? 'Order not found. Check the order number and try again.')
    } finally {
      setSearching(false)
    }
  }

  // Item selection

  function toggleItem(item: OrderItem) {
    setSelected(prev => {
      if (prev[item.id]) {
        const next = { ...prev }
        delete next[item.id]
        return next
      }
      const qty = parseFloat(item.quantity)
      const unitPrice = parseFloat(item.unit_price)
      return {
        ...prev,
        [item.id]: {
          orderItem: item,
          qty,
          amount: parseFloat((unitPrice * qty).toFixed(2)),
        },
      }
    })
  }

  function setQty(item: OrderItem, raw: string) {
    const max = parseFloat(item.quantity)
    let qty = parseInt(raw, 10)
    if (isNaN(qty) || qty < 1) qty = 1
    if (qty > max) qty = max
    const amount = parseFloat((parseFloat(item.unit_price) * qty).toFixed(2))
    setSelected(prev => ({
      ...prev,
      [item.id]: { orderItem: item, qty, amount },
    }))
  }


  const selectedList = Object.values(selected)
  const totalRefund  = selectedList.reduce((s, x) => s + x.amount, 0)
  const canSubmit    = selectedList.length > 0 && reason.trim().length >= 3

  // Submit

  const mutation = useMutation({
    mutationFn: () =>
      refundService.create({
        order_id:      order!.id,
        reason:        reason.trim(),
        notes:         notes.trim() || undefined,
        refund_method: refundMethod,
        items: selectedList.map(x => ({
          order_item_id: x.orderItem.id,
          quantity:      String(x.qty),
          amount:        String(x.amount),
        })),
      }),
    onSuccess: (refund) => {
      const label = refundMethod === 'REPLACEMENT' ? 'Replacement' : 'Refund'
      toast.success(`${label} ${refund.refund_number} processed`)
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.detail ?? 'Refund failed.'
      toast.error(msg)
    },
  })

  // Render

  const items: OrderItem[] = (order?.items ?? []) as OrderItem[]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <IconRefund width="16" height="16" className="text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Process Refund</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
            <IconX width="14" height="14" />
          </button>
        </div>

        {/* Step 1: Search */}
        {step === 'search' && (
          <div className="flex flex-col gap-4 p-5">
            <p className="text-xs text-zinc-500">Enter the order number to look up the sale.</p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                autoFocus
                value={orderNumber}
                onChange={e => { setOrderNumber(e.target.value.toUpperCase()); setSearchError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. ORD-HQ-0001"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono uppercase"
              />
              <Btn variant="primary" onClick={handleSearch} disabled={searching || !orderNumber.trim()}>
                {searching ? <Spinner size={16} /> : <IconSearch width="16" height="16" />}
                Find
              </Btn>
            </div>
            {searchError && (
              <div className="px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 text-red-400 text-xs">
                {searchError}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select items */}
        {step === 'items' && order && (
          <>
            {/* Order summary bar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
              <button
                onClick={() => { setStep('search'); setOrder(null); setSelected({}) }}
                className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1"
              >
                ← Back
              </button>
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs font-bold text-amber-400">{order.order_number}</span>
                <span className="ml-2 text-zinc-500 text-xs">{fmtDateTime(order.created_at)}</span>
              </div>
              <span className="font-mono text-xs text-zinc-300">{fmt(parseFloat(order.total_amount))}</span>
            </div>

            {/* Refund method toggle */}
            <div className="px-5 pt-4 pb-2 flex-shrink-0">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Refund Type</p>
              <div className="flex rounded-xl overflow-hidden border border-zinc-700">
                <button
                  onClick={() => setRefundMethod('CASH')}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    refundMethod === 'CASH'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  💵 Cash Refund
                </button>
                <button
                  onClick={() => setRefundMethod('REPLACEMENT')}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    refundMethod === 'REPLACEMENT'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🔄 Replacement
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                {refundMethod === 'CASH'
                  ? 'Money returned to customer · inventory restored'
                  : 'New product given to customer · inventory reduced'}
              </p>
            </div>

            {/* Items list */}
            <div className="overflow-y-auto flex-1 min-h-0 px-5 py-2 flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Select items
              </p>
              {items.length === 0 ? (
                <p className="text-xs text-zinc-600">No items found on this order.</p>
              ) : items.map(item => {
                const sel = selected[item.id]
                const maxQty = parseFloat(item.quantity)
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                      sel
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-zinc-800/50 border-zinc-700/60 hover:border-zinc-600'
                    }`}
                    onClick={() => toggleItem(item)}
                  >
                    {/* Checkbox */}
                    <div className={`w-4 h-4 mt-0.5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      sel ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'
                    }`}>
                      {sel && <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-100 truncate">
                        {item.product_name}
                        {item.variant_name && <span className="ml-1 text-zinc-500 text-[10px]">({item.variant_name})</span>}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {fmt(parseFloat(item.unit_price))} × {maxQty.toFixed(0)} = {fmt(parseFloat(item.total))}
                      </p>
                    </div>

                    {/* Qty input (only when selected) */}
                    {sel && (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          className="w-6 h-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-bold flex items-center justify-center"
                          onClick={() => setQty(item, String(sel.qty - 1))}
                        >−</button>
                        <input
                          type="number"
                          min={1}
                          max={maxQty}
                          value={sel.qty}
                          onChange={e => setQty(item, e.target.value)}
                          className="w-10 text-center bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 text-xs py-1 focus:outline-none focus:border-amber-500"
                        />
                        <button
                          className="w-6 h-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-bold flex items-center justify-center"
                          onClick={() => setQty(item, String(sel.qty + 1))}
                        >+</button>
                        <span className="ml-1 text-xs font-mono text-amber-400 w-16 text-right">{fmt(sel.amount)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Reason + Notes + footer */}
            <div className="border-t border-zinc-800 px-5 py-4 flex-shrink-0 flex flex-col gap-3">
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (required, min 3 chars)…"
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 resize-none"
              />
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional notes (optional)…"
                rows={1}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 resize-none"
              />

              <div className="flex items-center justify-between">
                <div>
                  {selectedList.length > 0 && (
                    <p className="text-xs text-zinc-400">
                      {selectedList.length} item{selectedList.length > 1 ? 's' : ''} ·{' '}
                      <span className="font-mono font-bold text-amber-400">{fmt(totalRefund)}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Btn variant="secondary" size="sm" onClick={onClose} disabled={mutation.isPending}>Cancel</Btn>
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => mutation.mutate()}
                    disabled={!canSubmit || mutation.isPending}
                  >
                    {mutation.isPending
                      ? <><Spinner size={14} /> Processing…</>
                      : <><IconRefund width="14" height="14" /> Refund</>
                    }
                  </Btn>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
