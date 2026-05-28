import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn, fmt, fmtDate } from '@/lib/utils'
import { Btn, Table, Th, Td, Empty, Spinner, SectionHeader } from '@/components/ui'
import { IconPlus, IconChevRight, IconChevLeft } from '@/components/icons'
import { procurementService } from '@/services/procurement/procurement.service'
import { POStatusBadge } from './procurementHelpers'

const PAGE_SIZE = 20

const STATUS_FILTERS = [
  { label: 'All',             value: undefined               },
  { label: 'Ordered',         value: 'APPROVED'              },
  { label: 'Partial Receipt', value: 'PARTIALLY_RECEIVED'    },
  { label: 'Received',        value: 'RECEIVED'              },
  { label: 'Cancelled',       value: 'CANCELLED'             },
]

export default function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', { status, page }],
    queryFn: () => procurementService.listOrders({ status, page, page_size: PAGE_SIZE }),
    placeholderData: prev => prev,
  })

  const orders     = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="Purchase Orders"
        subtitle={`${total} order${total !== 1 ? 's' : ''}`}
        action={
          <Btn size="sm" onClick={() => navigate('/app/procurement/purchase-orders/new')}>
            <IconPlus width="14" height="14" /> New PO
          </Btn>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Status filters */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => { setStatus(f.value); setPage(1) }}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-medium transition-colors border',
                status === f.value
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Spinner size={28} /></div>
          ) : orders.length === 0 ? (
            <Empty
              icon={<span className="text-4xl">📋</span>}
              title="No purchase orders found"
              subtitle="Create your first purchase order"
              action={
                <Btn size="sm" onClick={() => navigate('/app/procurement/purchase-orders/new')}>
                  <IconPlus width="14" height="14" /> New PO
                </Btn>
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>PO Number</Th>
                  <Th>Status</Th>
                  <Th right>Total</Th>
                  <Th>Order Date</Th>
                  <Th>Expected</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {orders.map(po => (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/app/procurement/purchase-orders/${po.id}`)}
                    className="cursor-pointer hover:bg-zinc-800/60 transition-colors"
                  >
                    <Td>
                      <span className="font-mono font-semibold text-amber-400">{po.po_number}</span>
                    </Td>
                    <Td><POStatusBadge status={po.status} /></Td>
                    <Td right><span className="font-mono">{fmt(po.total_amount)}</span></Td>
                    <Td muted>{fmtDate(po.order_date)}</Td>
                    <Td muted>{po.expected_date ? fmtDate(po.expected_date) : '—'}</Td>
                    <Td>
                      <IconChevRight width="14" height="14" className="text-zinc-600" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Page {page} of {totalPages} · {total} total</span>
            <div className="flex gap-1">
              <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <IconChevLeft width="12" height="12" />
              </Btn>
              <Btn variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <IconChevRight width="12" height="12" />
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
