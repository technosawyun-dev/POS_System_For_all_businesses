import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Btn, Table, Th, Td, Empty, Spinner, SectionHeader } from '@/components/ui'
import { IconSearch, IconPlus, IconChevRight, IconChevLeft } from '@/components/icons'
import { procurementService } from '@/services/procurement/procurement.service'
import { SupplierStatusBadge } from './procurementHelpers'

const PAGE_SIZE = 20

export default function SuppliersPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', statusFilter, page],
    queryFn: () => procurementService.listSuppliers({ status: statusFilter, page, page_size: PAGE_SIZE }),
    placeholderData: prev => prev,
  })

  const suppliers  = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="Suppliers"
        subtitle={`${total} supplier${total !== 1 ? 's' : ''}`}
        action={
          <Btn size="sm" onClick={() => navigate('/app/procurement/suppliers/new')}>
            <IconPlus width="14" height="14" /> New Supplier
          </Btn>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-1">
          {([
            { label: 'All',      value: undefined  },
            { label: 'Active',   value: 'ACTIVE'   },
            { label: 'Inactive', value: 'INACTIVE' },
          ] as const).map(f => (
            <button
              key={f.label}
              onClick={() => { setStatusFilter(f.value as string | undefined); setPage(1) }}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-medium transition-colors border',
                statusFilter === f.value
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
          ) : suppliers.length === 0 ? (
            <Empty
              icon={<span className="text-4xl">🏭</span>}
              title="No suppliers found"
              subtitle="Add your first supplier to get started"
              action={
                <Btn size="sm" onClick={() => navigate('/app/procurement/suppliers/new')}>
                  <IconPlus width="14" height="14" /> New Supplier
                </Btn>
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th>Code</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/app/procurement/suppliers/${s.id}`)}
                    className="cursor-pointer hover:bg-zinc-800/60 transition-colors"
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-zinc-400">
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-zinc-100">{s.name}</span>
                      </div>
                    </Td>
                    <Td muted mono>{s.code}</Td>
                    <Td><SupplierStatusBadge status={s.status} /></Td>
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
