import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmt, fmtDate, fmtDateTime, cn } from '@/lib/utils'
import { Spinner, StatCard, Table, Th, Td, Badge, Empty, Btn } from '@/components/ui'
import { customersService } from '@/services/customers/customers.service'
import type { LedgerEntryType } from '@/shared/types'

const TYPE_VARIANT: Partial<Record<LedgerEntryType, 'success' | 'warning' | 'info' | 'purple' | 'default'>> = {
  PAYMENT: 'success', SALE: 'warning', ADJUSTMENT: 'info', CREDIT_NOTE: 'purple',
}

export default function CustomerStatementPage() {
  const { id } = useParams<{ id: string }>()

  const { data: statement, isLoading } = useQuery({
    queryKey: ['customer-statement', id],
    queryFn: () => customersService.getStatement(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner size={28} />
      </div>
    )
  }

  if (!statement) {
    return (
      <div className="p-6">
        <Empty title="No statement available" subtitle="Statement data could not be loaded" />
      </div>
    )
  }

  const entries = statement.entries ?? []

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Customer Statement</h3>
          {statement.generated_at && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Generated {fmtDateTime(statement.generated_at)}
            </p>
          )}
        </div>
        <Btn variant="secondary" size="sm" onClick={() => window.print()}>
          Print / PDF
        </Btn>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statement.opening_balance != null && (
          <StatCard label="Opening Balance" value={fmt(statement.opening_balance)} />
        )}
        {statement.total_debits != null && (
          <StatCard label="Total Charges" value={fmt(statement.total_debits)} />
        )}
        {statement.total_credits != null && (
          <StatCard label="Total Payments" value={fmt(statement.total_credits)} />
        )}
        {statement.closing_balance != null && (
          <StatCard
            label="Closing Balance"
            value={fmt(statement.closing_balance)}
            accent={parseFloat(statement.closing_balance) > 0}
          />
        )}
      </div>

      {/* Transactions */}
      {entries.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <Empty title="No transactions in this period" />
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">
              Transactions ({entries.length})
            </h3>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Description</Th>
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
                    <Badge
                      variant={TYPE_VARIANT[entry.type as LedgerEntryType] ?? 'default'}
                      size="xs"
                    >
                      {entry.type}
                    </Badge>
                  </Td>
                  <Td>{entry.description || '—'}</Td>
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
                      parseFloat(entry.balance ?? '0') > 0 ? 'text-amber-400' : 'text-zinc-400',
                    )}>
                      {fmt(entry.balance ?? 0)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
