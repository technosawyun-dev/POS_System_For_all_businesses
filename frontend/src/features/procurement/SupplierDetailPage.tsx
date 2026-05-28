import { useNavigate, useParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { fmt, fmtDate, timeAgo } from '@/lib/utils'
import { Btn, Badge, Table, Th, Td, Spinner, SectionHeader } from '@/components/ui'
import { procurementService } from '@/services/procurement/procurement.service'
import { SupplierStatusBadge, POStatusBadge, PayableStatusBadge } from './procurementHelpers'

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [supplierQ, balanceQ, ordersQ, payablesQ] = useQueries({
    queries: [
      {
        queryKey: ['supplier', id],
        queryFn: () => procurementService.getSupplier(id!),
        enabled: !!id,
      },
      {
        queryKey: ['supplier-balance', id],
        queryFn: () => procurementService.getSupplierBalance(id!),
        enabled: !!id,
      },
      {
        queryKey: ['purchase-orders', { supplier_id: id, page_size: 5 }],
        queryFn: () => procurementService.listOrders({ supplier_id: id!, page_size: 5 }),
        enabled: !!id,
      },
      {
        queryKey: ['supplier-payables', { supplier_id: id, page_size: 5 }],
        queryFn: () => procurementService.listPayables({ supplier_id: id!, page_size: 5 }),
        enabled: !!id,
      },
    ],
  })

  const supplier = supplierQ.data
  const balance  = balanceQ.data
  const orders   = ordersQ.data?.items ?? []
  const payables = payablesQ.data?.items ?? []

  if (supplierQ.isLoading) {
    return <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center text-zinc-500">
        Supplier not found.
        <button onClick={() => navigate('/app/procurement/suppliers')} className="ml-2 text-amber-400 hover:underline">
          Back to suppliers
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title={supplier.name}
        subtitle={`Code: ${supplier.code}`}
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={() => navigate(`/app/procurement/suppliers/${id}/edit`)}>
              Edit
            </Btn>
            <Btn size="sm" onClick={() => navigate('/app/procurement/purchase-orders/new')}>
              New PO
            </Btn>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Supplier Info + Balance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Info card */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Supplier Info</h3>
              <SupplierStatusBadge status={supplier.status} />
            </div>
            <dl className="space-y-2 text-sm">
              {supplier.email && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Email</dt>
                  <dd className="text-zinc-200">{supplier.email}</dd>
                </div>
              )}
              {supplier.phone && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Phone</dt>
                  <dd className="text-zinc-200">{supplier.phone}</dd>
                </div>
              )}
              {supplier.address && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Address</dt>
                  <dd className="text-zinc-200 text-right">{supplier.address}{supplier.city ? `, ${supplier.city}` : ''}</dd>
                </div>
              )}
              {supplier.country && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Country</dt>
                  <dd className="text-zinc-200">{supplier.country}</dd>
                </div>
              )}
              {supplier.website && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Website</dt>
                  <dd className="text-zinc-200 truncate max-w-[200px]">{supplier.website}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">Added</dt>
                <dd className="text-zinc-500">{timeAgo(supplier.created_at)}</dd>
              </div>
            </dl>
            {supplier.notes && (
              <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">{supplier.notes}</p>
            )}
          </div>

          {/* Balance card */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-100">Payment Summary</h3>
            {balanceQ.isLoading ? (
              <div className="flex items-center justify-center h-20"><Spinner size={20} /></div>
            ) : balance ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Total Payable</dt>
                  <dd className="font-mono text-zinc-200">{fmt(balance.total_payable)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Total Paid</dt>
                  <dd className="font-mono text-green-400">{fmt(balance.total_paid)}</dd>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-2">
                  <dt className="text-zinc-400 font-medium">Outstanding</dt>
                  <dd className="font-mono font-bold text-amber-400">{fmt(balance.outstanding_balance)}</dd>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <dt className="text-zinc-600">Open payables</dt>
                  <dd className="text-zinc-500">{balance.open_count}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-zinc-600">Partial payables</dt>
                  <dd className="text-zinc-500">{balance.partial_count}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-zinc-600 text-sm">No payment data</p>
            )}
          </div>
        </div>

        {/* Contacts */}
        {supplier.contacts.filter(c => !c.is_deleted).length > 0 && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Contacts</h3>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Position</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Primary</Th>
                </tr>
              </thead>
              <tbody>
                {supplier.contacts.filter(c => !c.is_deleted).map(c => (
                  <tr key={c.id}>
                    <Td>{c.name}</Td>
                    <Td muted>{c.position ?? '—'}</Td>
                    <Td muted mono>{c.phone ?? '—'}</Td>
                    <Td muted>{c.email ?? '—'}</Td>
                    <Td>
                      {c.is_primary && <Badge variant="success" size="xs">Primary</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* Recent Purchase Orders */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Recent Purchase Orders</h3>
            <button
              onClick={() => navigate('/app/procurement/purchase-orders')}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all
            </button>
          </div>
          {ordersQ.isLoading ? (
            <div className="flex items-center justify-center h-20"><Spinner size={20} /></div>
          ) : orders.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-6">No purchase orders for this supplier</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>PO #</Th>
                  <Th>Status</Th>
                  <Th right>Total</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map(po => (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/app/procurement/purchase-orders/${po.id}`)}
                    className="cursor-pointer hover:bg-zinc-800/60 transition-colors"
                  >
                    <Td><span className="font-mono text-amber-400">{po.po_number}</span></Td>
                    <Td><POStatusBadge status={po.status} /></Td>
                    <Td right><span className="font-mono">{fmt(po.total_amount)}</span></Td>
                    <Td muted>{fmtDate(po.order_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* Recent Payables */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Payables</h3>
            <button
              onClick={() => navigate('/app/procurement/payables')}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all
            </button>
          </div>
          {payablesQ.isLoading ? (
            <div className="flex items-center justify-center h-20"><Spinner size={20} /></div>
          ) : payables.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-6">No payables for this supplier</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th right>Total</Th>
                  <Th right>Paid</Th>
                  <Th right>Remaining</Th>
                </tr>
              </thead>
              <tbody>
                {payables.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                    <Td><PayableStatusBadge status={p.status} /></Td>
                    <Td right><span className="font-mono">{fmt(p.total_amount)}</span></Td>
                    <Td right><span className="font-mono text-green-400">{fmt(p.paid_amount)}</span></Td>
                    <Td right><span className="font-mono text-amber-400 font-semibold">{fmt(p.remaining_amount)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
