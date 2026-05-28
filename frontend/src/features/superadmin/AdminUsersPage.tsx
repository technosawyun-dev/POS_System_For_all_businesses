import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { cn } from '@/shared/utils'
import { usersService } from '@/services/users/users.service'
import { tenantService } from '@/services/tenant/tenant.service'

function CreateResellerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' })

  const mutation = useMutation({
    mutationFn: () =>
      usersService.create({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: 'RESELLER',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Reseller account created')
      onClose()
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to create reseller'),
  })

  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'
  const isValid = form.first_name && form.last_name && form.email && form.password.length >= 8

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">New Reseller Account</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">First Name *</label>
              <input className={inp} value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Last Name *</label>
              <input className={inp} value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Email *</label>
            <input type="email" className={inp} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Phone</label>
            <input className={inp} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Password * (min 8 chars, upper + lower + digit)</label>
            <input type="password" className={inp} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={!isValid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Creating…' : 'Create Reseller'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

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
  const [showCreateReseller, setShowCreateReseller] = useState(false)

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
    <>
      {showCreateReseller && <CreateResellerModal onClose={() => setShowCreateReseller(false)} />}
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
        <Btn size="sm" onClick={() => setShowCreateReseller(true)}>+ New Reseller</Btn>
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
                    {tenant ? (
                      <p className="text-xs text-zinc-600 mt-0.5">{tenant.name}</p>
                    ) : user.role === 'RESELLER' ? (
                      <p className="text-xs text-zinc-600 mt-0.5">Platform reseller · no tenant</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={user.role === 'RESELLER' ? 'purple' : 'default'} size="xs">{ROLE_LABELS[user.role] ?? user.role}</Badge>
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
    </>
  )
}
