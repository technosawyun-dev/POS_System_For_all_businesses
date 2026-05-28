import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmt, timeAgo, cn } from '@/lib/utils'
import { Btn, Badge, Table, Th, Td, Empty, Spinner, StatCard, SectionHeader } from '@/components/ui'
import { IconSearch, IconPlus, IconUser, IconChevRight, IconChevLeft } from '@/components/icons'
import { customersService } from '@/services/customers/customers.service'

const PAGE_SIZE = 20

export default function CustomersScreen() {
  const navigate = useNavigate()
  const [rawSearch, setRawSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter]     = useState<boolean | undefined>(undefined)
  const [page, setPage]                     = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(rawSearch); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [rawSearch])

  const { data, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch, activeFilter, page],
    queryFn: () => customersService.list({
      search:    debouncedSearch || undefined,
      is_active: activeFilter,
      page,
      page_size: PAGE_SIZE,
    }),
    placeholderData: prev => prev,
  })

  const customers  = data?.items ?? []
  const totalPages = data?.total_pages ?? 1
  const total      = data?.total ?? 0

  const totalOutstanding = customers.reduce((sum, c) => sum + parseFloat(c.balance), 0)
  const activeCount      = customers.filter(c => c.is_active).length
  const withBalance      = customers.filter(c => parseFloat(c.balance) > 0).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="Customers"
        subtitle={`${total} customer${total !== 1 ? 's' : ''}`}
        action={
          <Btn size="sm" onClick={() => navigate('/app/customers/new')}>
            <IconPlus width="14" height="14" /> New Customer
          </Btn>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total"        value={total}              />
            <StatCard label="Active"       value={activeCount}        />
            <StatCard label="With Balance" value={withBalance}        />
            <StatCard label="Outstanding"  value={fmt(totalOutstanding)} accent />
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                <IconSearch width="14" height="14" />
              </span>
              <input
                type="text"
                value={rawSearch}
                onChange={e => setRawSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all duration-150 py-2.5 pl-9 pr-3"
              />
            </div>
            <div className="flex gap-1">
              {([
                { label: 'All',      value: undefined },
                { label: 'Active',   value: true      },
                { label: 'Inactive', value: false     },
              ] as const).map(f => (
                <button
                  key={f.label}
                  onClick={() => { setActiveFilter(f.value as boolean | undefined); setPage(1) }}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-medium transition-colors border',
                    activeFilter === f.value
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Spinner size={28} />
              </div>
            ) : customers.length === 0 ? (
              <Empty
                icon={<IconUser width="40" height="40" />}
                title="No customers found"
                subtitle={rawSearch ? 'Try a different search term' : 'Add your first customer to get started'}
                action={
                  <Btn size="sm" onClick={() => navigate('/app/customers/new')}>
                    <IconPlus width="14" height="14" /> New Customer
                  </Btn>
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>Phone</Th>
                    <Th>Email</Th>
                    <Th right>Balance</Th>
                    <Th>Status</Th>
                    <Th>Updated</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const bal = parseFloat(c.balance)
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/app/customers/${c.id}`)}
                        className="cursor-pointer hover:bg-zinc-800/60 transition-colors"
                      >
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-zinc-400">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-zinc-100">{c.name}</span>
                          </div>
                        </Td>
                        <Td muted>{c.phone}</Td>
                        <Td muted>{c.email ?? '—'}</Td>
                        <Td right>
                          <span className={cn('font-mono font-semibold', bal > 0 ? 'text-amber-400' : 'text-zinc-500')}>
                            {fmt(c.balance)}
                          </span>
                        </Td>
                        <Td>
                          <Badge variant={c.is_active ? 'success' : 'default'} dot size="xs">
                            {c.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </Td>
                        <Td muted>{timeAgo(c.updated_at)}</Td>
                        <Td>
                          <IconChevRight width="14" height="14" className="text-zinc-600" />
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </div>

          {/* Pagination */}
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
    </div>
  )
}
