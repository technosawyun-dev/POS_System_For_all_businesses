import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { usersService } from '@/services/users/users.service'
import { tenantService } from '@/services/tenant/tenant.service'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE:               'success',
  SUSPENDED:            'warning',
  INACTIVE:             'default',
  PENDING_VERIFICATION: 'default',
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:     'Super Admin',
  RESELLER:        'Reseller',
  BUSINESS_OWNER:  'Owner',
  MANAGER:         'Manager',
  CASHIER:         'Cashier',
  INVENTORY_STAFF: 'Inventory',
}

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [search, setSearch] = useState('')

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'tenants', 'all'],
    queryFn: () => tenantService.listTenants({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page, selectedTenantId],
    queryFn: () => usersService.list({
      page,
      page_size: 25,
      tenant_id: selectedTenantId || undefined,
    }),
  })

  const tenants = tenantsQuery.data?.items ?? []

  const items = (usersQuery.data?.items ?? []).filter(u =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  )

  function handleTenantChange(tenantId: string) {
    setSelectedTenantId(tenantId)
    setPage(1)
  }

  const selectedTenant = tenants.find(t => t.id === selectedTenantId)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Users</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {usersQuery.data?.total ?? 0} users
            {selectedTenant ? ` · ${selectedTenant.name}` : ' · all businesses'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            value={selectedTenantId}
            onChange={e => handleTenantChange(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="">All businesses</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
            ))}
          </select>
          {selectedTenantId && (
            <Btn variant="secondary" size="sm" onClick={() => handleTenantChange('')}>
              Clear
            </Btn>
          )}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {usersQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : items.length === 0 ? (
          <Empty title="No users found" />
        ) : (
          <div className="max-w-4xl space-y-2">
            {items.map(user => {
              const tenant = tenants.find(t => t.id === user.tenant_id)
              return (
                <div
                  key={user.id}
                  onClick={() => navigate(`/super-admin/users/${user.id}`)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3.5 cursor-pointer transition-colors flex items-center gap-3 flex-wrap"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{user.full_name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{user.email}</p>
                    {tenant && (
                      <p className="text-xs text-zinc-600 mt-0.5">{tenant.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="default" size="xs">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                    <Badge variant={STATUS_VARIANT[user.status] ?? 'default'} size="xs">{user.status}</Badge>
                    <span className="text-xs text-zinc-600">{fmtDate(user.created_at)}</span>
                  </div>
                </div>
              )
            })}

            {(usersQuery.data?.total_pages ?? 0) > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-500 self-center">{page} / {usersQuery.data?.total_pages}</span>
                <Btn variant="secondary" size="xs" disabled={!usersQuery.data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
