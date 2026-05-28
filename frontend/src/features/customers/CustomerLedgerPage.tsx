import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmt, fmtDate, cn } from '@/lib/utils'
import { Spinner, Table, Th, Td, Badge, Empty, Btn } from '@/components/ui'
import { IconChevLeft, IconChevRight } from '@/components/icons'
import { customersService } from '@/services/customers/customers.service'
import type { LedgerEntry, LedgerEntryType } from '@/shared/types'

const TYPE_BADGE: Partial<Record<LedgerEntryType, 'success' | 'warning' | 'info' | 'purple' | 'default'>> = {
  PAYMENT:     'success',
  SALE:        'warning',
  ADJUSTMENT:  'info',
  CREDIT_NOTE: 'purple',
  NOTE:        'default',
}

export default function CustomerLedgerPage() {
  const { id } = useParams<{ id: string }>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['customer-ledger', id, page],
    queryFn: () => customersService.getLedger(id!, { page }),
    enabled: !!id,
    placeholderData: prev => prev,
  })

  const entries: LedgerEntry[] = data?.items ?? []
  const totalPages = data?.total_pages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Ledger Entries</h3>
          {total > 0 && <span className="text-xs text-zinc-500">{total} total</span>}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size={28} />
          </div>
        ) : entries.length === 0 ? (
          <Empty title="No ledger entries" subtitle="Transactions will appear here" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>Reference</Th>
                <Th right>Debit</Th>
                <Th right>Credit</Th>
                <Th right>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id ?? i} className="hover:bg-zinc-800/40 transition-colors">
                  <Td muted>{entry.date ? fmtDate(entry.date) : '—'}</Td>
                  <Td>
                    <Badge variant={TYPE_BADGE[entry.type] ?? 'default'} size="xs">
                      {entry.type}
                    </Badge>
                  </Td>
                  <Td>{entry.description || '—'}</Td>
                  <Td muted mono>{entry.reference ?? '—'}</Td>
                  <Td right>
                    {entry.debit && parseFloat(entry.debit) > 0
                      ? <span className="font-mono text-amber-400">{fmt(entry.debit)}</span>
                      : <span className="text-zinc-700">—</span>}
                  </Td>
                  <Td right>
                    {entry.credit && parseFloat(entry.credit) > 0
                      ? <span className="font-mono text-green-400">{fmt(entry.credit)}</span>
                      : <span className="text-zinc-700">—</span>}
                  </Td>
                  <Td right>
                    <span className={cn(
                      'font-mono font-semibold',
                      parseFloat(entry.balance) > 0 ? 'text-amber-400' : 'text-zinc-400',
                    )}>
                      {fmt(entry.balance)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Page {page} of {totalPages}</span>
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
  )
}
