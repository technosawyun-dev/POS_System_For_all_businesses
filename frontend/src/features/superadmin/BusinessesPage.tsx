import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { tenantService } from '@/services/tenant/tenant.service'
import { usersService } from '@/services/users/users.service'

// Businesses tab

const BIZ_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  SUSPENDED: 'warning',
  EXPIRED:   'danger',
  INACTIVE:  'default',
  PENDING:   'default',
}

const STATUSES = ['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'INACTIVE']

function BusinessesTab() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'businesses', page],
    queryFn: () => tenantService.listTenants({ page, page_size: 20 }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ tenantId, status }: { tenantId: string; status: string }) =>
      tenantService.updateTenantStatus(tenantId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'businesses'] })
      toast.success('Status updated')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update status'),
  })

  const items = (data?.items ?? []).filter(t => {
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filters */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
          className="flex-1 min-w-[160px] bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors',
                statusFilter === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
              )}
            >
              {s === 'ALL' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : items.length === 0 ? (
          <Empty title="No businesses found" />
        ) : (
          <div className="max-w-5xl space-y-2">
            {items.map(tenant => (
              <div
                key={tenant.id}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3.5 transition-colors"
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/super-admin/businesses/${tenant.id}`)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-100 hover:text-amber-400 transition-colors">{tenant.name}</p>
                      <Badge variant={BIZ_STATUS_VARIANT[tenant.status] ?? 'default'} size="xs">{tenant.status}</Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      <span className="font-mono">{tenant.slug}</span>
                      {' · '}
                      Plan: <span className="text-zinc-400">{tenant.subscription_plan || 'None'}</span>
                      {tenant.subscription_expires_at && ` · expires ${fmtDate(tenant.subscription_expires_at)}`}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">Created {fmtDate(tenant.created_at)}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {tenant.status !== 'SUSPENDED' ? (
                      <Btn
                        variant="secondary"
                        size="xs"
                        disabled={statusMutation.isPending}
                        onClick={() => confirm(`Suspend ${tenant.name}?`) && statusMutation.mutate({ tenantId: tenant.id, status: 'SUSPENDED' })}
                      >
                        Suspend
                      </Btn>
                    ) : (
                      <Btn
                        variant="secondary"
                        size="xs"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ tenantId: tenant.id, status: 'ACTIVE' })}
                      >
                        Activate
                      </Btn>
                    )}
                    <Btn
                      variant="secondary"
                      size="xs"
                      onClick={() => navigate(`/super-admin/businesses/${tenant.id}`)}
                    >
                      View
                    </Btn>
                  </div>
                </div>
              </div>
            ))}

            {(data?.total_pages ?? 0) > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-500 self-center">{page} / {data?.total_pages}</span>
                <Btn variant="secondary" size="xs" disabled={!data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Users tab

const USER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
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

function UsersTab() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [search, setSearch] = useState('')

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'tenants', 'all'],
    queryFn: () => tenantService.listTenants({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page, selectedTenantId],
    queryFn: () => usersService.list({ page, page_size: 25, tenant_id: selectedTenantId || undefined }),
  })

  const tenants = tenantsQuery.data?.items ?? []

  const items = (usersQuery.data?.items ?? []).filter(u =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedTenant = tenants.find(t => t.id === selectedTenantId)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filters */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            value={selectedTenantId}
            onChange={e => { setSelectedTenantId(e.target.value); setPage(1) }}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="">All businesses</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
            ))}
          </select>
          {selectedTenantId && (
            <Btn variant="secondary" size="sm" onClick={() => { setSelectedTenantId(''); setPage(1) }}>
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
        {selectedTenant && (
          <p className="text-xs text-zinc-500">
            Showing users for <span className="text-zinc-300">{selectedTenant.name}</span>
          </p>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <p className="text-xs text-zinc-600 mb-3">{usersQuery.data?.total ?? 0} users total</p>
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
                    {tenant ? (
                      <p className="text-xs text-zinc-600 mt-0.5">{tenant.name}</p>
                    ) : user.role === 'RESELLER' ? (
                      <p className="text-xs text-zinc-600 mt-0.5">Platform reseller · no tenant</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={user.role === 'RESELLER' ? 'purple' : 'default'} size="xs">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                    <Badge variant={USER_STATUS_VARIANT[user.status] ?? 'default'} size="xs">{user.status}</Badge>
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

// Main page

type Tab = 'businesses' | 'users'

export default function BusinessesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as Tab) ?? 'businesses'

  function setTab(t: Tab) {
    setSearchParams(t === 'businesses' ? {} : { tab: t }, { replace: true })
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'businesses', label: 'Businesses' },
    { id: 'users',      label: 'Users' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-100">Businesses & Users</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Manage tenants and their staff</p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-zinc-800 px-4 gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === t.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'businesses' && <BusinessesTab />}
      {activeTab === 'users' && <UsersTab />}
    </div>
  )
}
