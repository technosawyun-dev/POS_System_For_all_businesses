import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn, fmt, timeAgo } from '@/lib/utils'
import { Btn, Table, Th, Td, Empty, Spinner, SectionHeader, StatCard } from '@/components/ui'
import { IconChevRight, IconChevLeft } from '@/components/icons'
import { procurementService } from '@/services/procurement/procurement.service'
import { PayableStatusBadge } from './procurementHelpers'

const PAGE_SIZE = 20

export default function SupplierPayablesPage() {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-payables', { status, page }],
    queryFn: () => procurementService.listPayables({ status, page, page_size: PAGE_SIZE }),
    placeholderData: prev => prev,
  })

  // Stats queries
  const { data: openData }    = useQuery({ queryKey: ['supplier-payables', { status: 'OPEN',    page_size: 100 }], queryFn: () => procurementService.listPayables({ status: 'OPEN',    page_size: 100 }) })
  const { data: partialData } = useQuery({ queryKey: ['supplier-payables', { status: 'PARTIAL', page_size: 100 }], queryFn: () => procurementService.listPayables({ status: 'PARTIAL', page_size: 100 }) })

  const payables   = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  const openTotal    = (openData?.items    ?? []).reduce((s, p) => s + parseFloat(p.remaining_amount), 0)
  const partialTotal = (partialData?.items ?? []).reduce((s, p) => s + parseFloat(p.remaining_amount), 0)
  const outstanding  = openTotal + partialTotal

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="Supplier Payables"
        subtitle={`${total} payable${total !== 1 ? 's' : ''}`}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Open Payables"    value={(openData?.total ?? 0).toLocaleString()} />
          <StatCard label="Partial Payments" value={(partialData?.total ?? 0).toLocaleString()} />
          <StatCard label="Total Outstanding" value={fmt(outstanding)} accent={outstanding > 0} />
        </div>

        {/* Status filters */}
        <div className="flex gap-1">
          {([
            { label: 'All',     value: undefined  },
            { label: 'Open',    value: 'OPEN'     },
            { label: 'Partial', value: 'PARTIAL'  },
            { label: 'Paid',    value: 'PAID'     },
          ] as const).map(f => (
            <button
              key={f.label}
              onClick={() => { setStatus(f.value as string | undefined); setPage(1) }}
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
          ) : payables.length === 0 ? (
            <Empty
              icon={<span className="text-4xl">💳</span>}
              title="No payables found"
              subtitle="Payables are created automatically when purchase orders are approved and received"
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Payable ID</Th>
                  <Th>Status</Th>
                  <Th right>Total</Th>
                  <Th right>Paid</Th>
                  <Th right>Remaining</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {payables.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-800/60 transition-colors">
                    <Td muted mono>{p.id.slice(0, 8)}…</Td>
                    <Td><PayableStatusBadge status={p.status} /></Td>
                    <Td right><span className="font-mono">{fmt(p.total_amount)}</span></Td>
                    <Td right><span className="font-mono text-green-400">{fmt(p.paid_amount)}</span></Td>
                    <Td right>
                      <span className={`font-mono font-semibold ${p.status === 'PAID' ? 'text-zinc-500' : 'text-amber-400'}`}>
                        {fmt(p.remaining_amount)}
                      </span>
                    </Td>
                    <Td muted>{timeAgo(p.created_at)}</Td>
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
