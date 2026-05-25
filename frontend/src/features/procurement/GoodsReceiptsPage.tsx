import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmtDate, timeAgo } from '@/lib/utils'
import { Btn, Badge, Table, Th, Td, Empty, Spinner, SectionHeader } from '@/components/ui'
import { IconChevRight, IconChevLeft } from '@/components/icons'
import { procurementService } from '@/services/procurement/procurement.service'

const PAGE_SIZE = 20

export default function GoodsReceiptsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['goods-receipts', { page }],
    queryFn: () => procurementService.listReceipts({ page, page_size: PAGE_SIZE }),
    placeholderData: prev => prev,
  })

  const receipts   = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="Goods Receipts"
        subtitle={`${total} receipt${total !== 1 ? 's' : ''}`}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Spinner size={28} /></div>
          ) : receipts.length === 0 ? (
            <Empty
              icon={<span className="text-4xl">📦</span>}
              title="No goods receipts yet"
              subtitle="Receipts are created when you receive goods on approved purchase orders"
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Receipt #</Th>
                  <Th>Status</Th>
                  <Th>PO Reference</Th>
                  <Th>Receipt Date</Th>
                  <Th>Created</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/app/procurement/receipts/${r.id}`)}
                    className="cursor-pointer hover:bg-zinc-800/60 transition-colors"
                  >
                    <Td>
                      <span className="font-mono font-semibold text-blue-400">{r.receipt_number}</span>
                    </Td>
                    <Td>
                      <Badge
                        variant={r.status === 'RECEIVED' ? 'success' : 'danger'}
                        size="xs"
                        dot
                      >
                        {r.status}
                      </Badge>
                    </Td>
                    <Td muted mono>{r.purchase_order_id.slice(0, 8)}…</Td>
                    <Td muted>{fmtDate(r.receipt_date)}</Td>
                    <Td muted>{timeAgo(r.created_at)}</Td>
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
