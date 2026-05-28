import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmt, fmtDateTime } from '@/lib/utils'
import { Btn, Modal, Spinner, Empty, Table, Th, Td, StatCard } from '@/components/ui'
import { IconPlus, IconCash } from '@/components/icons'
import { customersService } from '@/services/customers/customers.service'
import type { LedgerEntry } from '@/shared/types'

export default function CustomerPaymentsPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const [showModal, setShowModal]   = useState(false)
  const [amount, setAmount]         = useState('')
  const [note, setNote]             = useState('')
  const [reference, setReference]   = useState('')

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['customer-ledger', id, 1],
    queryFn: () => customersService.getLedger(id!, { page: 1 }),
    enabled: !!id,
  })

  const paymentMutation = useMutation({
    mutationFn: () => customersService.recordPayment(id!, {
      amount,
      note:           note || undefined,
      reference_type: reference ? 'MANUAL' : undefined,
      reference_id:   reference || undefined,
    }),
    onSuccess: () => {
      toast.success('Payment recorded')
      setShowModal(false)
      setAmount('')
      setNote('')
      setReference('')
      qc.invalidateQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: ['customer-ledger', id] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: () => toast.error('Failed to record payment'),
  })

  const allEntries: LedgerEntry[] = ledgerData?.items ?? []
  const payments = allEntries.filter(e => e.type === 'PAYMENT')
  const totalPaid = payments.reduce((sum, e) => sum + parseFloat(e.credit ?? '0'), 0)

  function closeModal() {
    setShowModal(false)
    setAmount('')
    setNote('')
    setReference('')
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Summary + action */}
      <div className="flex items-center justify-between">
        <StatCard label="Payments (this page)" value={fmt(totalPaid)} />
        <Btn onClick={() => setShowModal(true)}>
          <IconPlus width="14" height="14" /> Record Payment
        </Btn>
      </div>

      {/* Payment history */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Payment History</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size={28} />
          </div>
        ) : payments.length === 0 ? (
          <Empty
            icon={<IconCash width="40" height="40" />}
            title="No payments recorded"
            subtitle="Use the button above to record a payment"
            action={
              <Btn size="sm" onClick={() => setShowModal(true)}>
                <IconPlus width="14" height="14" /> Record Payment
              </Btn>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Reference</Th>
                <Th right>Amount</Th>
                <Th right>Balance After</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((entry, i) => (
                <tr key={entry.id ?? i} className="hover:bg-zinc-800/40 transition-colors">
                  <Td muted>{entry.date ? fmtDateTime(entry.date) : '—'}</Td>
                  <Td>{entry.description || 'Payment'}</Td>
                  <Td muted mono>{entry.reference ?? '—'}</Td>
                  <Td right>
                    <span className="font-mono font-semibold text-green-400">{fmt(entry.credit ?? 0)}</span>
                  </Td>
                  <Td right>
                    <span className="font-mono text-zinc-400">{fmt(entry.balance)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal open={showModal} onClose={closeModal} title="Record Payment">
        <div className="space-y-4">
          <ModalField label="Amount" required>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 py-2.5 px-3"
            />
          </ModalField>

          <ModalField label="Reference">
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Receipt #, bank ref…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 py-2.5 px-3"
            />
          </ModalField>

          <ModalField label="Note">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 py-2.5 px-3 resize-none"
            />
          </ModalField>

          <div className="flex gap-3">
            <Btn variant="secondary" fullWidth onClick={closeModal}>Cancel</Btn>
            <Btn
              fullWidth
              disabled={!amount || parseFloat(amount) <= 0 || paymentMutation.isPending}
              onClick={() => paymentMutation.mutate()}
            >
              {paymentMutation.isPending ? <Spinner size={16} /> : 'Record Payment'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ModalField({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
