import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { fmt, fmtDate, fmtDateTime, extractApiMsg } from '@/lib/utils'
import { Btn, Table, Th, Td, Spinner, SectionHeader, Badge } from '@/components/ui'
import { procurementService } from '@/services/procurement/procurement.service'
import { PayableStatusBadge, inputCls, FormField } from './procurementHelpers'
import type { SupplierPayableDetail } from '@/shared/types'


const paymentSchema = z.object({
  payment_method:   z.string().min(1, 'Payment method required'),
  amount:           z.string().min(1).refine(v => parseFloat(v) > 0, 'Must be > 0'),
  payment_date:     z.string().min(1, 'Date required'),
  reference_number: z.string(),
  notes:            z.string(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'MOBILE_PAYMENT']

function RecordPaymentModal({
  payable,
  onClose,
}: {
  payable: SupplierPayableDetail
  onClose: () => void
}) {
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_method:   'BANK_TRANSFER',
      amount:           payable.remaining_amount,
      payment_date:     new Date().toISOString().split('T')[0],
      reference_number: '',
      notes:            '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: PaymentFormValues) => procurementService.recordPayment(payable.id, {
      payment_method:   data.payment_method,
      amount:           data.amount,
      payment_date:     new Date(data.payment_date).toISOString(),
      reference_number: data.reference_number || undefined,
      notes:            data.notes || undefined,
    }),
    onSuccess: (payment) => {
      toast.success(`Payment of ${fmt(payment.amount)} recorded`)
      qc.invalidateQueries({ queryKey: ['supplier-payables'] })
      qc.invalidateQueries({ queryKey: ['payable-detail', payable.id] })
      qc.invalidateQueries({ queryKey: ['purchase-order', payable.purchase_order_id] })
      qc.invalidateQueries({ queryKey: ['procurement-dashboard'] })
      onClose()
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to record payment'),
  })

  const pending = isSubmitting || mutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">Record Payment</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-5 space-y-4">
          <div className="bg-zinc-800/50 rounded-xl p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Outstanding</span>
              <span className="font-mono font-semibold text-amber-400">{fmt(payable.remaining_amount)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-zinc-500">Total</span>
              <span className="font-mono text-zinc-400">{fmt(payable.total_amount)}</span>
            </div>
          </div>

          <FormField label="Payment Method" error={errors.payment_method?.message} required>
            <select {...register('payment_method')} className={inputCls(!!errors.payment_method)}>
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Amount" error={errors.amount?.message} required>
            <input
              {...register('amount')}
              type="number"
              min="0.01"
              step="0.01"
              className={inputCls(!!errors.amount)}
            />
          </FormField>

          <FormField label="Payment Date" error={errors.payment_date?.message} required>
            <input {...register('payment_date')} type="date" className={inputCls(!!errors.payment_date)} />
          </FormField>

          <FormField label="Reference Number">
            <input {...register('reference_number')} placeholder="TXN-12345" className={inputCls(false)} />
          </FormField>

          <FormField label="Notes">
            <textarea {...register('notes')} placeholder="Optional notes…" rows={2} className={`${inputCls(false)} resize-none`} />
          </FormField>

          <div className="flex gap-3 pt-1">
            <Btn type="button" variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn type="submit" disabled={pending} fullWidth>
              {pending ? <Spinner size={16} /> : 'Record Payment'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}


function PayableRow({ payableId }: { payableId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['payable-detail', payableId],
    queryFn: () => procurementService.getPayable(payableId),
    enabled: expanded,
  })

  return (
    <>
      {expanded && detail && (
        <tr className="bg-zinc-800/30">
          <td colSpan={6} className="px-4 py-3">
            <div className="space-y-3">
              {/* Payment history */}
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Payment History</h4>
                {detail.status !== 'PAID' && (
                  <Btn size="xs" onClick={() => setShowModal(true)}>
                    + Record Payment
                  </Btn>
                )}
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center h-12"><Spinner size={16} /></div>
              ) : detail.payments.length === 0 ? (
                <p className="text-xs text-zinc-600">No payments recorded yet</p>
              ) : (
                <div className="space-y-1">
                  {detail.payments.map(p => (
                    <div key={p.id} className="flex items-center gap-3 text-xs bg-zinc-800 rounded-lg px-3 py-2">
                      <span className="text-zinc-500">{fmtDate(p.payment_date)}</span>
                      <Badge size="xs" variant={p.status === 'CONFIRMED' ? 'success' : p.status === 'VOIDED' ? 'danger' : 'default'}>
                        {p.payment_method.replace('_', ' ')}
                      </Badge>
                      {p.reference_number && <span className="font-mono text-zinc-500">{p.reference_number}</span>}
                      <span className="ml-auto font-mono font-semibold text-green-400">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
      {expanded && detail && showModal && (
        <RecordPaymentModal payable={detail} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}


export default function SupplierPaymentsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [activePayable, setActivePayable] = useState<SupplierPayableDetail | null>(null)

  const { data: openData, isLoading: loadingOpen } = useQuery({
    queryKey: ['supplier-payables', { status: 'OPEN', page_size: 50 }],
    queryFn: () => procurementService.listPayables({ status: 'OPEN', page_size: 50 }),
  })

  const { data: partialData, isLoading: loadingPartial } = useQuery({
    queryKey: ['supplier-payables', { status: 'PARTIAL', page_size: 50 }],
    queryFn: () => procurementService.listPayables({ status: 'PARTIAL', page_size: 50 }),
  })

  const isLoading = loadingOpen || loadingPartial
  const payables  = [...(openData?.items ?? []), ...(partialData?.items ?? [])]

  async function openPayModal(payableId: string) {
    const detail = await procurementService.getPayable(payableId)
    setActivePayable(detail)
    setShowModal(true)
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        <SectionHeader
          title="Supplier Payments"
          subtitle="Record payments against outstanding payables"
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            Showing open and partial payables. Click "Pay" to record a payment. Fully paid payables appear in the Payables tab.
          </div>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-40"><Spinner size={28} /></div>
            ) : payables.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <span className="text-4xl">✅</span>
                <p className="text-zinc-400 text-sm font-medium">All payables are settled</p>
                <p className="text-zinc-600 text-xs">No outstanding balances to pay</p>
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Payable ID</Th>
                    <Th>Status</Th>
                    <Th right>Total</Th>
                    <Th right>Paid</Th>
                    <Th right>Remaining</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {payables.map(p => (
                    <>
                      <tr
                        key={p.id}
                        className="hover:bg-zinc-800/60 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                      >
                        <Td muted mono>{p.id.slice(0, 8)}…</Td>
                        <Td><PayableStatusBadge status={p.status} /></Td>
                        <Td right><span className="font-mono">{fmt(p.total_amount)}</span></Td>
                        <Td right><span className="font-mono text-green-400">{fmt(p.paid_amount)}</span></Td>
                        <Td right><span className="font-mono font-semibold text-amber-400">{fmt(p.remaining_amount)}</span></Td>
                        <Td>
                          <Btn
                            size="xs"
                            onClick={e => { e.stopPropagation(); openPayModal(p.id) }}
                          >
                            Pay
                          </Btn>
                        </Td>
                      </tr>
                      {expandedId === p.id && <PayableRow payableId={p.id} />}
                    </>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {showModal && activePayable && (
        <RecordPaymentModal payable={activePayable} onClose={() => { setShowModal(false); setActivePayable(null) }} />
      )}
    </>
  )
}
