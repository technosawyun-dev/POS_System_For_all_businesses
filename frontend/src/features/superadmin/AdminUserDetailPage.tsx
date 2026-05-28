import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fmtDate, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { usersService } from '@/services/users/users.service'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE:                'success',
  SUSPENDED:             'warning',
  INACTIVE:              'default',
  PENDING_VERIFICATION:  'default',
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:      'Super Admin',
  RESELLER:         'Reseller',
  BUSINESS_OWNER:   'Business Owner',
  MANAGER:          'Manager',
  CASHIER:          'Cashier',
  INVENTORY_STAFF:  'Inventory Staff',
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const userQuery = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => usersService.get(id!),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => usersService.updateStatus(id!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Status updated')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const user = userQuery.data

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
        <button
          onClick={() => navigate(-1)}
          className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          {userQuery.isLoading ? (
            <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-100">{user?.full_name}</h2>
              {user && <Badge variant={STATUS_VARIANT[user.status] ?? 'default'} size="xs">{user.status}</Badge>}
            </div>
          )}
          <p className="text-xs text-zinc-500 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {userQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : user ? (
          <div className="max-w-xl space-y-4">
            {/* Profile */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Profile</h3>
              <dl className="space-y-3">
                {[
                  { label: 'Full Name', value: user.full_name },
                  { label: 'Email', value: user.email },
                  { label: 'Phone', value: user.phone ?? '—' },
                  { label: 'Role', value: ROLE_LABELS[user.role] ?? user.role },
                  { label: 'Status', value: user.status },
                  { label: 'Tenant', value: user.tenant_id ? <span className="font-mono text-xs">{user.tenant_id}</span> : '—' },
                  { label: 'Last Login', value: user.last_login_at ? fmtDate(user.last_login_at) : 'Never' },
                  { label: 'Created', value: fmtDate(user.created_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4">
                    <dt className="text-xs text-zinc-500 w-28 flex-shrink-0 pt-0.5">{label}</dt>
                    <dd className="text-sm text-zinc-200">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Protected SUPER_ADMIN notice */}
            {user.role === 'SUPER_ADMIN' ? (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <p className="text-sm font-semibold text-zinc-100">Protected Account</p>
                </div>
                <p className="text-xs text-zinc-400">This is the sole SUPER_ADMIN account. Its role, status, and existence are permanently locked and cannot be changed.</p>
              </div>
            ) : (
              <>
                {/* Status Actions */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Status Management</h3>
                  <div className="flex flex-wrap gap-2">
                    <Btn
                      variant="secondary"
                      size="sm"
                      disabled={statusMutation.isPending || user.status === 'ACTIVE'}
                      onClick={() => statusMutation.mutate('ACTIVE')}
                    >
                      Activate
                    </Btn>
                    <Btn
                      variant="secondary"
                      size="sm"
                      disabled={statusMutation.isPending || user.status === 'SUSPENDED'}
                      onClick={() => confirm(`Suspend ${user.full_name}?`) && statusMutation.mutate('SUSPENDED')}
                    >
                      Suspend
                    </Btn>
                    <Btn
                      variant="secondary"
                      size="sm"
                      disabled={statusMutation.isPending || user.status === 'INACTIVE'}
                      onClick={() => statusMutation.mutate('INACTIVE')}
                    >
                      Deactivate
                    </Btn>
                  </div>
                </div>

              </>
            )}

            {/* Navigate to business */}
            {user.tenant_id && (
              <div className="flex justify-end">
                <Btn variant="secondary" size="sm" onClick={() => navigate(`/super-admin/businesses/${user.tenant_id}`)}>
                  View Business →
                </Btn>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
