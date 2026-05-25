import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { checkoutService } from '@/services/sales/sales.service'
import { useTenantStore } from '@/store/tenant.store'
import { fmt, fmtDateTime, timeAgo } from '@/lib/utils'
import { StatCard, Table, Th, Td, Btn, Badge, Empty, Divider, Spinner } from '@/components/ui'
import { IconSales, IconX, IconRefund, IconSearch, IconCash, IconCard, IconSplit } from '@/components/icons'
import type { Order } from '@/shared/types'

type StatusFilter = 'all' | 'COMPLETED' | 'VOIDED' | 'REFUNDED'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  COMPLETED: 'success',
  REFUNDED:  'warning',
  VOIDED:    'danger',
}

function PaymentIcon({ method }: { method: string }) {
  const cls = 'w-4 h-4 flex-shrink-0'
  if (method === 'cash') return <IconCash className={cls} />
  if (method === 'card') return <IconCard className={cls} />
  return <IconSplit className={cls} />
}

export default function SalesScreen() {
  const qc = useQueryClient()
  const { selectedBranch, availableBranches } = useTenantStore()

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Sales history is a management view — always follows the globally selected branch.
  const branchId   = selectedBranch?.id ?? ''
  const branchName = availableBranches.find(b => b.id === branchId)?.name ?? selectedBranch?.name ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['orders', branchId, statusFilter],
    queryFn: () => checkoutService.listOrders({
      branch_id:    branchId || undefined,
      order_status: statusFilter !== 'all' ? statusFilter : undefined,
      page_size:    200,
    }),
    enabled: !!branchId,
  })

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      checkoutService.voidOrder(id, { reason }),
    onSuccess: () => {
      toast.success('Order voided')
      setSelectedOrder(null)
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => toast.error('Failed to void order'),
  })

  const orders = data?.items ?? []

  const filtered = orders.filter(o => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.id.toLowerCase().includes(q) ||
      o.order_number.toLowerCase().includes(q)
    )
  })

  const totalRevenue = orders.filter(o => o.order_status === 'COMPLETED').reduce((s, o) => s + parseFloat(o.total_amount), 0)
  const totalVoided  = orders.filter(o => o.order_status === 'VOIDED').length
  const avgOrder     = orders.length > 0 ? totalRevenue / Math.max(1, orders.filter(o => o.order_status === 'COMPLETED').length) : 0

  if (!branchId) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-3 p-6">
        <IconSales width="48" height="48" className="text-zinc-700" />
        <p className="text-zinc-400 font-medium">No branch selected</p>
        <p className="text-zinc-600 text-sm text-center max-w-xs">
          Select a branch from the sidebar to view sales history.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Page header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-zinc-100">Sales History</h2>
            {branchName && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                {branchName}
              </span>
            )}
          </div>
          <div className="relative">
            <IconSearch width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders…"
              className="bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all
                py-2 pl-8 pr-4 w-56"
            />
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-auto h-full">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Orders"    value={orders.length} />
            <StatCard label="Revenue"         value={fmt(totalRevenue)} accent />
            <StatCard label="Voided"          value={totalVoided} />
            <StatCard label="Avg Order Value" value={fmt(avgOrder)} />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
            {(['all', 'COMPLETED', 'REFUNDED', 'VOIDED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Order #</Th>
                    <Th>Date</Th>
                    <Th right>Total</Th>
                    <Th right>Items</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <Empty icon={<IconSales width="40" height="40" />} title="No orders found" subtitle="Adjust your search or filter" />
                      </td>
                    </tr>
                  ) : filtered.map(order => {
                    const isActive = selectedOrder?.id === order.id
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(isActive ? null : order)}
                        className={`cursor-pointer transition-colors ${isActive ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'}`}
                      >
                        <Td mono>
                          <span className="text-amber-400 text-xs">{order.order_number}</span>
                        </Td>
                        <Td muted className="whitespace-nowrap text-xs">{fmtDateTime(order.created_at)}</Td>
                        <Td right mono>
                          <span className="text-amber-400">{fmt(parseFloat(order.total_amount))}</span>
                        </Td>
                        <Td right muted>—</Td>
                        <Td>
                          <Badge variant={STATUS_VARIANT[order.order_status] ?? 'warning'} dot>
                            {order.order_status.charAt(0) + order.order_status.slice(1).toLowerCase()}
                          </Badge>
                        </Td>
                        <Td>
                          {order.order_status === 'COMPLETED' && (
                            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                              <Btn
                                variant="ghost"
                                size="xs"
                                onClick={() => voidMutation.mutate({ id: order.id, reason: 'Manual void from sales screen' })}
                                disabled={voidMutation.isPending}
                              >
                                Void
                              </Btn>
                            </div>
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
            <div className="px-4 py-2.5 border-t border-zinc-800 flex-shrink-0">
              <p className="text-xs text-zinc-500">{filtered.length} of {orders.length} orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order detail panel */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onVoid={() => voidMutation.mutate({ id: selectedOrder.id, reason: 'Manual void' })}
          isVoiding={voidMutation.isPending}
        />
      )}
    </div>
  )
}

function OrderDetailPanel({
  order, onClose, onVoid, isVoiding,
}: {
  order: Order
  onClose: () => void
  onVoid: () => void
  isVoiding: boolean
}) {
  return (
    <div className="w-80 flex-shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <span className="text-sm font-semibold text-zinc-100">Order Detail</span>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
          <IconX width="14" height="14" />
        </button>
      </div>

      <div className="px-4 py-4 border-b border-zinc-800 flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-amber-400">{order.order_number}</span>
          <Badge variant={STATUS_VARIANT[order.order_status] ?? 'warning'} dot>
            {order.order_status.charAt(0) + order.order_status.slice(1).toLowerCase()}
          </Badge>
        </div>
        <p className="text-xs text-zinc-500 mt-1">{fmtDateTime(order.created_at)}</p>
        <p className="text-xs text-zinc-600">{timeAgo(order.created_at)}</p>
      </div>

      <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Subtotal</span>
            <span className="font-mono">{fmt(parseFloat(order.subtotal))}</span>
          </div>
          {parseFloat(order.discount_amount) > 0 && (
            <div className="flex justify-between text-xs text-amber-500">
              <span>Discount</span>
              <span className="font-mono">−{fmt(parseFloat(order.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Tax</span>
            <span className="font-mono">{fmt(parseFloat(order.tax_amount))}</span>
          </div>
          <Divider />
          <div className="flex justify-between text-sm font-semibold text-zinc-100">
            <span>Total</span>
            <span className="font-mono text-amber-400">{fmt(parseFloat(order.total_amount))}</span>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <p className="text-xs text-zinc-500 mb-1">Notes</p>
          <p className="text-xs text-zinc-300">{order.notes}</p>
        </div>
      )}

      {order.void_reason && (
        <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <p className="text-xs text-zinc-500 mb-1">Void Reason</p>
          <p className="text-xs text-red-400">{order.void_reason}</p>
        </div>
      )}

      <div className="flex-1" />

      {order.order_status === 'COMPLETED' && (
        <div className="px-4 py-4 border-t border-zinc-800 flex-shrink-0">
          <Btn variant="danger" fullWidth size="sm" onClick={onVoid} disabled={isVoiding}>
            <IconRefund width="14" height="14" />
            {isVoiding ? 'Voiding…' : 'Void Order'}
          </Btn>
        </div>
      )}
    </div>
  )
}
