import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmt, fmtDate, fmtDateTime, extractApiMsg } from '@/lib/utils'
import { Btn, Table, Th, Td, Spinner, SectionHeader, Badge } from '@/components/ui'
import { procurementService } from '@/services/procurement/procurement.service'
import { POStatusBadge, PayableStatusBadge, inputCls } from './procurementHelpers'
import type { PurchaseOrderItem } from '@/shared/types'


function ReceiveGoodsModal({
  poId, branchId, items, onClose,
}: {
  poId: string
  branchId: string
  items: PurchaseOrderItem[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(items.map(i => [i.id, i.ordered_quantity]))
  )

  const mutation = useMutation({
    mutationFn: () => procurementService.createReceipt({
      purchase_order_id: poId,
      branch_id:         branchId,
      receipt_date:      new Date(receiveDate).toISOString(),
      notes:             notes || undefined,
      items:             items
        .filter(i => parseFloat(quantities[i.id] ?? '0') > 0)
        .map(i => ({
          purchase_order_item_id: i.id,
          received_quantity:      quantities[i.id],
          unit_cost:              i.unit_cost,
        })),
    }),
    onSuccess: (receipt) => {
      toast.success(`Receipt ${receipt.receipt_number} created — inventory updated`)
      qc.invalidateQueries({ queryKey: ['purchase-order', poId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      onClose()
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to create receipt'),
  })

  const hasItems = items.some(i => parseFloat(quantities[i.id] ?? '0') > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">Receive Goods</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Receipt Date</label>
              <input
                type="date"
                value={receiveDate}
                onChange={e => setReceiveDate(e.target.value)}
                className={inputCls(false)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes"
                className={inputCls(false)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_100px] gap-2 px-1">
              <span className="text-xs text-zinc-500 uppercase">Item</span>
              <span className="text-xs text-zinc-500 uppercase text-right">Ordered</span>
              <span className="text-xs text-zinc-500 uppercase text-right">Receiving</span>
            </div>
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_100px] gap-2 items-center bg-zinc-800/40 rounded-xl p-2">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 font-mono truncate">{item.product_id.slice(0, 8)}…</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-zinc-400">{item.ordered_quantity}</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max={item.ordered_quantity}
                  step="any"
                  value={quantities[item.id] ?? ''}
                  onChange={e => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                  className={`${inputCls(false)} text-right`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5 pt-3 border-t border-zinc-800">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !hasItems}
            fullWidth
          >
            {mutation.isPending ? <Spinner size={16} /> : 'Confirm Receipt'}
          </Btn>
        </div>
      </div>
    </div>
  )
}


function CancelModal({ poId, onClose }: { poId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => procurementService.cancelOrder(poId, reason),
    onSuccess: () => {
      toast.success('Purchase order cancelled')
      qc.invalidateQueries({ queryKey: ['purchase-order', poId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      onClose()
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to cancel'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-zinc-100">Cancel Purchase Order</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Reason (required)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason for cancellation…"
              rows={3}
              className={`${inputCls(false)} resize-none`}
            />
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={onClose}>Back</Btn>
            <Btn
              variant="danger"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !reason.trim()}
              fullWidth
            >
              {mutation.isPending ? <Spinner size={16} /> : 'Cancel Order'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}


export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showReceive, setShowReceive] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => procurementService.getOrder(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
  if (!po) return (
    <div className="p-6 text-center text-zinc-500">
      Purchase order not found.{' '}
      <button onClick={() => navigate('/app/procurement/purchase-orders')} className="text-amber-400 hover:underline">Back</button>
    </div>
  )

  const canReceive = po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED'
  const canCancel  = po.status === 'APPROVED'

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        <SectionHeader
          title={po.po_number}
          subtitle={`Purchase Order · ${fmtDate(po.order_date)}`}
          action={
            <div className="flex gap-2 flex-wrap justify-end">
              {canReceive && (
                <Btn size="sm" onClick={() => setShowReceive(true)}>
                  Receive Goods
                </Btn>
              )}
              {canCancel && (
                <Btn size="sm" variant="danger" onClick={() => setShowCancel(true)}>
                  Cancel Order
                </Btn>
              )}
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-100">Order Info</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Status</dt>
                  <dd><POStatusBadge status={po.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Order Date</dt>
                  <dd className="text-zinc-200">{fmtDate(po.order_date)}</dd>
                </div>
                {po.expected_date && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Expected</dt>
                    <dd className="text-zinc-200">{fmtDate(po.expected_date)}</dd>
                  </div>
                )}
                {po.approved_at && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Ordered</dt>
                    <dd className="text-zinc-200">{fmtDateTime(po.approved_at)}</dd>
                  </div>
                )}
                {po.notes && (
                  <div className="pt-2 border-t border-zinc-800">
                    <dt className="text-zinc-500 mb-1">Notes</dt>
                    <dd className="text-zinc-400 text-xs">{po.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-100">Order Total</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Subtotal</dt>
                  <dd className="font-mono text-zinc-200">{fmt(po.subtotal)}</dd>
                </div>
                {parseFloat(po.discount_amount) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Discount</dt>
                    <dd className="font-mono text-red-400">-{fmt(po.discount_amount)}</dd>
                  </div>
                )}
                {parseFloat(po.tax_amount) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Tax</dt>
                    <dd className="font-mono text-zinc-200">{fmt(po.tax_amount)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-700 pt-2 font-semibold">
                  <dt className="text-zinc-300">Total</dt>
                  <dd className="font-mono text-amber-400">{fmt(po.total_amount)}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">Payment</h3>
                {po.payable && <PayableStatusBadge status={po.payable.status} />}
              </div>
              {po.payable ? (() => {
                const remaining = parseFloat(po.payable.remaining_amount)
                const paid      = parseFloat(po.payable.paid_amount)
                const isFullyPaid = remaining === 0 && paid > 0
                return (
                  <>
                    {isFullyPaid ? (
                      <div className="flex flex-col items-center gap-1 py-3">
                        <span className="text-2xl">✅</span>
                        <p className="text-sm font-semibold text-green-400">Fully Paid</p>
                        <p className="text-xs text-zinc-500 font-mono">{fmt(po.payable.paid_amount)}</p>
                      </div>
                    ) : (
                      <>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-zinc-500">Amount Due</dt>
                            <dd className="font-mono text-zinc-200">{fmt(po.payable.total_amount)}</dd>
                          </div>
                          {paid > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-zinc-500">Paid</dt>
                              <dd className="font-mono text-green-400">{fmt(po.payable.paid_amount)}</dd>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-zinc-700 pt-2 font-semibold">
                            <dt className="text-zinc-300">Remaining</dt>
                            <dd className="font-mono text-amber-400">{fmt(po.payable.remaining_amount)}</dd>
                          </div>
                        </dl>
                        <Btn size="sm" variant="outline" fullWidth onClick={() => navigate('/app/procurement/payments')}>
                          {paid > 0 ? 'Pay Remaining' : 'Make Payment'}
                        </Btn>
                      </>
                    )}
                  </>
                )
              })() : (
                <p className="text-sm text-zinc-600">No payable created yet.</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Items ({po.items.length})</h3>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Product ID</Th>
                  <Th right>Ordered</Th>
                  <Th right>Received</Th>
                  <Th right>Unit Cost</Th>
                  <Th right>Line Total</Th>
                  <Th>Progress</Th>
                </tr>
              </thead>
              <tbody>
                {po.items.map(item => {
                  const ordered  = parseFloat(item.ordered_quantity)
                  const received = parseFloat(item.received_quantity)
                  const pct      = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0
                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                      <Td muted mono>{item.product_id.slice(0, 8)}…</Td>
                      <Td right><span className="font-mono">{item.ordered_quantity}</span></Td>
                      <Td right>
                        <span className={`font-mono ${received >= ordered ? 'text-green-400' : received > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                          {item.received_quantity}
                        </span>
                      </Td>
                      <Td right><span className="font-mono">{fmt(item.unit_cost)}</span></Td>
                      <Td right><span className="font-mono">{fmt(item.line_total)}</span></Td>
                      <Td>
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-zinc-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500">{pct}%</span>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        </div>
      </div>

      {showReceive && (
        <ReceiveGoodsModal
          poId={po.id}
          branchId={po.branch_id}
          items={po.items}
          onClose={() => setShowReceive(false)}
        />
      )}
      {showCancel && (
        <CancelModal
          poId={po.id}
          onClose={() => setShowCancel(false)}
        />
      )}
    </>
  )
}
