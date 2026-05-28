import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmt, fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Input, Spinner } from '@/components/ui'
import { customersService } from '@/services/customers/customers.service'
import { useResellerStore } from '@/store/reseller.store'
import { useResellerPermissions } from './ResellerPermissionContext'
import type { Customer } from '@/shared/types'

function NoBusiness() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-3xl">👥</div>
      <div>
        <p className="text-zinc-200 font-semibold">Select a Business</p>
        <p className="text-zinc-500 text-sm mt-1">Choose a business from the sidebar to view customers.</p>
      </div>
    </div>
  )
}

function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <span className="text-4xl">🔒</span>
      <div>
        <p className="text-zinc-300 font-medium">No Customer Access</p>
        <p className="text-zinc-600 text-sm mt-1">You do not have permission to view customers for this business.</p>
      </div>
    </div>
  )
}

function PaymentModal({
  customer,
  onClose,
}: {
  customer: Customer
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => customersService.recordPayment(customer.id, { amount, note: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller-customers'] })
      toast.success('Payment recorded')
      onClose()
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to record payment'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Record Payment</h2>
        <p className="text-zinc-500 text-sm">
          Customer: <span className="text-zinc-300">{customer.name}</span>
        </p>
        <p className="text-zinc-500 text-sm">
          Outstanding: <span className="text-red-400 font-semibold">{fmt(customer.balance)}</span>
        </p>
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <Input
          label="Notes (optional)"
          type="text"
          placeholder="Payment reference…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <Btn variant="secondary" size="sm" fullWidth onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            size="sm"
            fullWidth
            disabled={!amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Record Payment'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function ResellerCustomersPage() {
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)
  const perms = useResellerPermissions()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reseller-customers', selectedTenantId, { search, page }],
    queryFn: () => customersService.list({
      search: search || undefined,
      page,
      page_size: 20,
      tenant_id: selectedTenantId,
    } as never),
    enabled: !!selectedTenantId && perms.canViewCustomers(),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  })

  if (!selectedTenantId) return <NoBusiness />
  if (!perms.canViewCustomers()) return <PermissionDenied />

  const customers = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="h-full overflow-y-auto p-6">
      {selectedCustomer && perms.canRecordCustomerPayments() && (
        <PaymentModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Customers</h1>
        <p className="text-zinc-500 text-sm mt-1">{total} customer{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search customers…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Spinner size={28} />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">No customers found.</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Phone</th>
                  {perms.canViewCustomerDebt() && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Outstanding</th>
                  )}
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  {perms.canRecordCustomerPayments() && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-zinc-200 font-medium">{c.name}</p>
                      {c.email && <p className="text-zinc-600 text-xs">{c.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-zinc-400">{c.phone ?? '—'}</td>
                    {perms.canViewCustomerDebt() && (
                      <td className="px-5 py-3 text-right">
                        <span className={Number(c.balance ?? 0) > 0 ? 'text-red-400 font-medium' : 'text-zinc-500'}>
                          {fmt(c.balance)}
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <Badge variant={c.is_active ? 'success' : 'default'} size="xs" dot>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {perms.canRecordCustomerPayments() && (
                      <td className="px-5 py-3 text-right">
                        {Number(c.balance ?? 0) > 0 && (
                          <Btn
                            variant="ghost"
                            size="xs"
                            onClick={() => setSelectedCustomer(c)}
                          >
                            Record Payment
                          </Btn>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">{total} total</span>
              <div className="flex items-center gap-2">
                <Btn variant="ghost" size="xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
                <Btn variant="ghost" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
