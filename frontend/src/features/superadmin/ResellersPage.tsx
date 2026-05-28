import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Btn, Spinner, Empty, Badge } from '@/components/ui'
import { usersService } from '@/services/users/users.service'
import { tenantService } from '@/services/tenant/tenant.service'
import { resellerFinanceAdminService, type TenantReferralResponse } from '@/services/reseller_finance/reseller_finance.service'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE:               'success',
  SUSPENDED:            'warning',
  INACTIVE:             'default',
  PENDING_VERIFICATION: 'default',
}


// Create Reseller Modal

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
      qc.invalidateQueries({ queryKey: ['admin', 'users', 'resellers'] })
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


// Main Page

export default function ResellersPage() {
  const navigate = useNavigate()
  const [showCreateReseller, setShowCreateReseller] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const results = useQueries({
    queries: [
      {
        queryKey: ['admin', 'users', 'resellers', page],
        queryFn: () => usersService.list({ role: 'RESELLER', page_size: 20, page }),
      },
      {
        queryKey: ['admin', 'reseller-finance', 'referrals', 'all'],
        queryFn: () => resellerFinanceAdminService.listAllReferrals({ page_size: 200 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'tenants', 'all-for-resellers'],
        queryFn: () => tenantService.listTenants({ page_size: 200 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'reseller-finance', 'wallets'],
        queryFn: () => resellerFinanceAdminService.listWallets(),
        staleTime: 60_000,
      },
    ],
  })

  const [resellersResult, referralsResult, tenantsResult, walletsResult] = results
  const resellers = resellersResult.data?.items ?? []
  const total = resellersResult.data?.total ?? 0
  const totalPages = resellersResult.data?.total_pages ?? 1
  const allReferrals = referralsResult.data?.items ?? []
  const allTenants = tenantsResult.data?.items ?? []
  const allWallets = walletsResult.data ?? []

  // Build referral map: reseller_id -> referral records
  const referralMap = allReferrals.reduce<Record<string, TenantReferralResponse[]>>((acc, r) => {
    if (!acc[r.reseller_id]) acc[r.reseller_id] = []
    acc[r.reseller_id].push(r)
    return acc
  }, {})

  // Build tenant name map: tenant_id -> name
  const tenantNameMap = allTenants.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.name
    return acc
  }, {})

  // Build promo code map: reseller_id -> primary_code
  const promoCodeMap = allWallets.reduce<Record<string, string | null>>((acc, w) => {
    acc[w.reseller_id] = w.primary_code
    return acc
  }, {})

  const isLoading = resellersResult.isLoading

  const filtered = resellers.filter(u =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  )

  function handleSearchChange(value: string) {
    setSearch(value)
    if (page !== 1) setPage(1)
  }

  return (
    <>
      {showCreateReseller && <CreateResellerModal onClose={() => setShowCreateReseller(false)} />}

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Resellers</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{total} reseller{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" onClick={() => setShowCreateReseller(true)}>+ New Reseller</Btn>
          </div>
        </div>

        {/* Search */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800">
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : filtered.length === 0 ? (
            <Empty
              title={search ? 'No resellers match your search' : 'No resellers yet'}
              subtitle={search ? 'Try a different name or email' : 'Create a reseller account to get started'}
            />
          ) : (
            <div className="max-w-4xl space-y-2">
              {filtered.map(user => {
                const promoCode = promoCodeMap[user.id]
                return (
                  <div
                    key={user.id}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3.5 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/super-admin/resellers/${user.id}`)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-zinc-100 hover:text-amber-400 transition-colors">
                            {user.full_name}
                          </p>
                          <Badge variant={STATUS_VARIANT[user.status] ?? 'default'} size="xs">
                            {user.status}
                          </Badge>
                          {promoCode && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              {promoCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{user.email}</p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          Joined {fmtDate(user.created_at)}
                        </p>
                        {(referralMap[user.id]?.length ?? 0) > 0 && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            <span className="text-zinc-600">Referred via promo: </span>
                            {referralMap[user.id].slice(0, 3).map(r => tenantNameMap[r.tenant_id] ?? `#${r.tenant_id.slice(0, 6)}`).join(', ')}
                            {referralMap[user.id].length > 3 && (
                              <span className="text-zinc-600"> +{referralMap[user.id].length - 3} more</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Btn
                          variant="secondary"
                          size="xs"
                          onClick={() => navigate(`/super-admin/resellers/${user.id}`)}
                        >
                          View →
                        </Btn>
                      </div>
                    </div>
                  </div>
                )
              })}

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                  <span className="text-xs text-zinc-500 self-center">{page} / {totalPages}</span>
                  <Btn variant="secondary" size="xs" disabled={!resellersResult.data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
