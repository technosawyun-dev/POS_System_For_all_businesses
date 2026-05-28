import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { checkoutService, refundService } from '@/services/sales/sales.service'
import { useTenantStore } from '@/store/tenant.store'
import { fmt, fmtDateTime, timeAgo } from '@/lib/utils'
import { StatCard, Table, Th, Td, Badge, Empty, Divider, Spinner } from '@/components/ui'
import { IconSales, IconX, IconSearch, IconRefund } from '@/components/icons'
import type { Order, OrderItem, RefundRecord } from '@/shared/types'

type TabFilter = 'all' | 'COMPLETED' | 'REFUNDED'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  COMPLETED:          'success',
  REFUNDED:           'warning',
  PARTIALLY_REFUNDED: 'warning',
}

export default function SalesScreen() {
  const { selectedBranch, availableBranches } = useTenantStore()

  const [search, setSearch]               = useState('')
  const [tab, setTab]                     = useState<TabFilter>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null)

  const branchId   = selectedBranch?.id ?? ''
  const branchName = availableBranches.find(b => b.id === branchId)?.name ?? selectedBranch?.name ?? null

  // Orders query (used for All + Completed tabs)
  const ordersQuery = useQuery({
    queryKey: ['orders', branchId, tab],
    queryFn: () => checkoutService.listOrders({
      branch_id:    branchId || undefined,
      order_status: tab === 'COMPLETED' ? 'COMPLETED' : undefined,
      page_size:    200,
    }),
    enabled: !!branchId && tab !== 'REFUNDED',
  })

  // Refunds query (used for Refunded tab)
  const refundsQuery = useQuery({
    queryKey: ['refunds', branchId],
    queryFn: () => refundService.list({ page_size: 200 }),
    enabled: tab === 'REFUNDED',
  })

  const orders  = ordersQuery.data?.items ?? []
  const refunds = refundsQuery.data?.items ?? []

  const filteredOrders = orders.filter(o => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return o.id.toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q)
  })

  const filteredRefunds = refunds.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.refund_number.toLowerCase().includes(q) ||
      r.order_id.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    )
  })

  const totalRevenue = orders
    .filter(o => o.order_status === 'COMPLETED')
    .reduce((s, o) => s + parseFloat(o.total_amount), 0)
  const avgOrder = orders.length > 0
    ? totalRevenue / Math.max(1, orders.filter(o => o.order_status === 'COMPLETED').length)
    : 0

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

  const isLoading = tab === 'REFUNDED' ? refundsQuery.isLoading : ordersQuery.isLoading

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden">
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="text-base font-semibold text-zinc-100 flex-shrink-0">Sales History</h2>
            {branchName && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 truncate">
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
              placeholder={tab === 'REFUNDED' ? 'Search refunds…' : 'Search orders…'}
              className="bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all
                py-2 pl-8 pr-4 w-full sm:w-56"
            />
          </div>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 lg:overflow-auto lg:flex-1 lg:min-h-0">
          {/* Stats (orders only) */}
          {tab !== 'REFUNDED' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <StatCard label="Total Orders"    value={orders.length} />
              <StatCard label="Revenue"         value={fmt(totalRevenue)} accent />
              <StatCard label="Avg Order Value" value={fmt(avgOrder)} />
            </div>
          )}
          {tab === 'REFUNDED' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <StatCard label="Total Refunds" value={refunds.length} />
              <StatCard label="Refunded Total" value={fmt(refunds.reduce((s, r) => s + parseFloat(r.amount), 0))} accent />
              <StatCard label="Avg Refund" value={fmt(refunds.length > 0 ? refunds.reduce((s, r) => s + parseFloat(r.amount), 0) / refunds.length : 0)} />
            </div>
          )}

          {/* Tab filter */}
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
            {(['all', 'COMPLETED', 'REFUNDED'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedOrder(null); setSelectedRefund(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === t ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === 'all' ? 'All' : t === 'REFUNDED' ? 'Refunded' : 'Completed'}
              </button>
            ))}
          </div>

          {/* Orders table */}
          {tab !== 'REFUNDED' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto flex flex-col flex-1 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Order #</Th>
                      <Th>Date</Th>
                      <Th right>Total</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          <Empty icon={<IconSales width="40" height="40" />} title="No orders found" subtitle="Adjust your search or filter" />
                        </td>
                      </tr>
                    ) : filteredOrders.map(order => {
                      const isActive = selectedOrder?.id === order.id
                      return (
                        <tr
                          key={order.id}
                          onClick={() => { setSelectedOrder(isActive ? null : order); setSelectedRefund(null) }}
                          className={`cursor-pointer transition-colors ${isActive ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'}`}
                        >
                          <Td mono>
                            <span className="text-amber-400 text-xs">{order.order_number}</span>
                          </Td>
                          <Td muted className="whitespace-nowrap text-xs">{fmtDateTime(order.created_at)}</Td>
                          <Td right mono>
                            <span className="text-amber-400">{fmt(parseFloat(order.total_amount))}</span>
                          </Td>
                          <Td>
                            <Badge variant={STATUS_VARIANT[order.order_status] ?? 'warning'} dot>
                              {order.order_status.charAt(0) + order.order_status.slice(1).toLowerCase().replace('_', ' ')}
                            </Badge>
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}
              <div className="px-4 py-2.5 border-t border-zinc-800 flex-shrink-0">
                <p className="text-xs text-zinc-500">{filteredOrders.length} of {orders.length} orders</p>
              </div>
            </div>
          )}

          {/* Refunds table */}
          {tab === 'REFUNDED' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto flex flex-col flex-1 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Refund #</Th>
                      <Th>Order #</Th>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th right>Items</Th>
                      <Th right>Amount</Th>
                      <Th>Reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRefunds.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <Empty icon={<IconRefund width="40" height="40" />} title="No refunds found" subtitle="Processed refunds will appear here" />
                        </td>
                      </tr>
                    ) : filteredRefunds.map(refund => {
                      const isActive = selectedRefund?.id === refund.id
                      return (
                        <tr
                          key={refund.id}
                          onClick={() => { setSelectedRefund(isActive ? null : refund); setSelectedOrder(null) }}
                          className={`cursor-pointer transition-colors ${isActive ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'}`}
                        >
                          <Td mono>
                            <span className="text-amber-400 text-xs">{refund.refund_number}</span>
                          </Td>
                          <Td mono muted className="text-xs">{refund.order_id.slice(0, 8)}…</Td>
                          <Td muted className="whitespace-nowrap text-xs">{fmtDateTime(refund.processed_at)}</Td>
                          <Td>
                            {refund.refund_type === 'REPLACEMENT'
                              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-950 border border-violet-800 text-violet-400">Replace</span>
                              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400">Cash</span>
                            }
                          </Td>
                          <Td right muted>{refund.items.length}</Td>
                          <Td right mono>
                            <span className={refund.refund_type === 'REPLACEMENT' ? 'text-violet-400' : 'text-red-400'}>
                              {refund.refund_type !== 'REPLACEMENT' && '−'}{fmt(parseFloat(refund.amount))}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-xs text-zinc-400 truncate max-w-[140px] block">{refund.reason}</span>
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}
              <div className="px-4 py-2.5 border-t border-zinc-800 flex-shrink-0">
                <p className="text-xs text-zinc-500">{filteredRefunds.length} of {refunds.length} refunds</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order detail panel */}
      {selectedOrder && (
        <OrderDetailPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {/* Refund detail panel */}
      {selectedRefund && (
        <RefundDetailPanel refund={selectedRefund} onClose={() => setSelectedRefund(null)} />
      )}
    </div>
  )
}

// Order Detail Panel

function OrderDetailPanel({ order, onClose }: { order: Order; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['order-detail', order.id],
    queryFn: () => checkoutService.getOrder(order.id),
    staleTime: 30_000,
  })

  const items: OrderItem[] = (detail?.items ?? []) as OrderItem[]

  return (
    <div className="w-full lg:w-96 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <span className="text-sm font-semibold text-zinc-100">Order Receipt</span>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
          <IconX width="14" height="14" />
        </button>
      </div>

      <div className="px-4 py-4 border-b border-zinc-800 flex-shrink-0 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold text-amber-400">{order.order_number}</span>
          <Badge variant={STATUS_VARIANT[order.order_status] ?? 'warning'} dot>
            {order.order_status.charAt(0) + order.order_status.slice(1).toLowerCase().replace('_', ' ')}
          </Badge>
        </div>
        <p className="text-xs text-zinc-400">{fmtDateTime(order.created_at)}</p>
        <p className="text-xs text-zinc-600">{timeAgo(order.created_at)}</p>
      </div>

      <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Items</p>
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner size={20} /></div>
        ) : items.length === 0 ? (
          <p className="text-xs text-zinc-600 py-2">No items found.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <div key={item.id ?? idx} className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center justify-center">
                  {parseFloat(item.quantity).toFixed(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-100 truncate">
                    {item.product_name}
                    {item.variant_name && <span className="ml-1 text-zinc-500">({item.variant_name})</span>}
                  </p>
                  {item.sku && <p className="text-[10px] text-zinc-600 font-mono">{item.sku}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-mono text-zinc-200">{fmt(parseFloat(item.total))}</p>
                  <p className="text-[10px] text-zinc-600 font-mono">
                    {fmt(parseFloat(item.unit_price))} × {parseFloat(item.quantity).toFixed(0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
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
          {detail?.refunded_amount && parseFloat(detail.refunded_amount) > 0 && (
            <div className="flex justify-between text-xs text-red-400">
              <span>Refunded</span>
              <span className="font-mono">−{fmt(parseFloat(detail.refunded_amount))}</span>
            </div>
          )}
          <Divider />
          <div className="flex justify-between text-sm font-bold text-zinc-100">
            <span>Total</span>
            <span className="font-mono text-amber-400">{fmt(parseFloat(order.total_amount))}</span>
          </div>
        </div>
      </div>

      {detail?.payment_status && (
        <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Payment</span>
            <span className="text-zinc-300 capitalize">{detail.payment_status.toLowerCase()}</span>
          </div>
        </div>
      )}

      {order.notes && (
        <div className="px-4 py-3 flex-shrink-0">
          <p className="text-xs text-zinc-500 mb-1">Notes</p>
          <p className="text-xs text-zinc-300">{order.notes}</p>
        </div>
      )}

      <div className="flex-1" />
    </div>
  )
}

// Refund Detail Panel

function RefundDetailPanel({ refund, onClose }: { refund: RefundRecord; onClose: () => void }) {
  return (
    <div className="w-full lg:w-96 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <span className="text-sm font-semibold text-zinc-100">Refund Detail</span>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
          <IconX width="14" height="14" />
        </button>
      </div>

      {/* Meta */}
      <div className="px-4 py-4 border-b border-zinc-800 flex-shrink-0 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold text-amber-400">{refund.refund_number}</span>
          {refund.refund_type === 'REPLACEMENT'
            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950 border border-violet-800 text-violet-400 font-semibold">Replacement</span>
            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-semibold">Cash Refund</span>
          }
        </div>
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>Order ID</span>
          <span className="font-mono text-zinc-400">{refund.order_id.slice(0, 8)}…</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Refund Date</span>
          <span className="text-zinc-300">{fmtDateTime(refund.processed_at)}</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{timeAgo(refund.processed_at)}</span>
        </div>
      </div>

      {/* Refunded items */}
      <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Refunded Items</p>
        {refund.items.length === 0 ? (
          <p className="text-xs text-zinc-600 py-1">No item details available.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {refund.items.map((item, idx) => (
              <div key={item.id ?? idx} className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center justify-center">
                  {parseFloat(item.quantity).toFixed(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">
                    {item.product_name ?? '—'}
                    {item.variant_name && <span className="ml-1 text-zinc-500 text-[10px]">({item.variant_name})</span>}
                  </p>
                </div>
                <span className="text-xs font-mono text-red-400">−{fmt(parseFloat(item.amount))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total */}
      <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex justify-between text-sm font-bold">
          <span className="text-zinc-400">
            {refund.refund_type === 'REPLACEMENT' ? 'Item Value' : 'Refunded Total'}
          </span>
          <span className={`font-mono ${refund.refund_type === 'REPLACEMENT' ? 'text-violet-400' : 'text-red-400'}`}>
            {refund.refund_type === 'REPLACEMENT' ? '' : '−'}{fmt(parseFloat(refund.amount))}
          </span>
        </div>
      </div>

      {/* Reason + Notes */}
      <div className="px-4 py-3 flex-shrink-0">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Reason</p>
        <p className="text-xs text-zinc-300">{refund.reason}</p>
        {refund.notes && (
          <>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-3 mb-1">Notes</p>
            <p className="text-xs text-zinc-400">{refund.notes}</p>
          </>
        )}
      </div>

      <div className="flex-1" />
    </div>
  )
}
