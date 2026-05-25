import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge, Spinner } from '@/components/ui'
import { resellersService } from '@/services/resellers/resellers.service'
import { useResellerStore } from '@/store/reseller.store'
import type { MyBusinessResponse } from '@/shared/types'

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function assignmentStatus(b: MyBusinessResponse): 'active' | 'expiring' | 'expired' | 'inactive' {
  if (!b.is_active) return 'inactive'
  if (!b.is_access_valid) return 'expired'
  const days = daysUntil(b.access_expires_at)
  if (days !== null && days <= 7) return 'expiring'
  return 'active'
}

const STATUS_VARIANT = {
  active:   'success' as const,
  expiring: 'warning' as const,
  expired:  'danger'  as const,
  inactive: 'default' as const,
}

const STATUS_LABEL = {
  active:   'Active',
  expiring: 'Expiring Soon',
  expired:  'Expired',
  inactive: 'Inactive',
}

export default function ResellerBusinessesPage() {
  const navigate = useNavigate()
  const { setSelectedTenant } = useResellerStore()

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['reseller-businesses'],
    queryFn: resellersService.getMyBusinesses,
    staleTime: 5 * 60 * 1000,
  })

  function handleSelect(tenantId: string) {
    setSelectedTenant(tenantId)
    navigate(`/reseller/businesses/${tenantId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Assigned Businesses</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {businesses.length} business{businesses.length !== 1 ? 'es' : ''} assigned to your account
        </p>
      </div>

      {businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl">
            🏢
          </div>
          <div>
            <p className="text-zinc-300 font-medium">No businesses assigned</p>
            <p className="text-zinc-600 text-sm mt-1">Contact your administrator to be assigned to a business.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {businesses.map(b => {
            const status = assignmentStatus(b)
            const days = daysUntil(b.access_expires_at)
            return (
              <button
                key={b.tenant_id}
                onClick={() => handleSelect(b.tenant_id)}
                className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 rounded-2xl p-5 text-left transition-all hover:bg-zinc-800/50 group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xl flex-shrink-0">
                    🏢
                  </div>
                  <Badge variant={STATUS_VARIANT[status]} size="xs">
                    {STATUS_LABEL[status]}
                  </Badge>
                </div>

                {/* Tenant ID (no tenant name in API) */}
                <p className="text-zinc-100 font-semibold text-sm truncate group-hover:text-orange-300 transition-colors">
                  Business {b.tenant_id.slice(0, 16)}…
                </p>
                <p className="text-zinc-600 text-xs mt-0.5 font-mono">{b.tenant_id}</p>

                {/* Details */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Branches</span>
                    <span className="text-zinc-300">
                      {b.allowed_branch_ids.length === 0
                        ? 'All branches'
                        : `${b.allowed_branch_ids.length} assigned`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Permissions</span>
                    <span className="text-zinc-300">
                      {b.restricted_permissions.length === 0
                        ? 'Full access'
                        : `${b.restricted_permissions.length} restricted`}
                    </span>
                  </div>
                  {b.access_expires_at && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Expires</span>
                      <span className={days !== null && days <= 7 ? 'text-amber-400 font-medium' : 'text-zinc-300'}>
                        {days !== null && days < 0
                          ? 'Expired'
                          : days !== null && days <= 7
                            ? `${days}d remaining`
                            : fmtDate(b.access_expires_at)}
                      </span>
                    </div>
                  )}
                  {!b.access_expires_at && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Expires</span>
                      <span className="text-zinc-500">No expiration</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Assigned</span>
                    <span className="text-zinc-400">{fmtDate(b.created_at)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
