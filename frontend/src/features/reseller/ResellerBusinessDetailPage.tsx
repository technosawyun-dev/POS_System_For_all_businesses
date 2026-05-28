import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { resellersService } from '@/services/resellers/resellers.service'
import { useResellerStore } from '@/store/reseller.store'
import { useResellerPermissions } from './ResellerPermissionContext'

// Mapping from backend permission key → human label
const PERM_LABELS: Record<string, string> = {
  view_revenue:              'View Revenue',
  view_profit:               'View Profit',
  view_analytics:            'View Analytics',
  view_inventory:            'View Inventory',
  adjust_inventory:          'Adjust Inventory',
  transfer_inventory:        'Transfer Inventory',
  view_customers:            'View Customers',
  view_customer_debt:        'View Customer Debt',
  record_customer_payment:   'Record Customer Payment',
  view_procurement:          'View Procurement',
  create_purchase_order:     'Create Purchase Order',
  approve_purchase_order:    'Approve Purchase Order',
  view_subscription_status:  'View Subscription',
  view_staff:                'View Staff',
  manage_staff:              'Manage Staff',
  export_data:               'Export Data',
  view_branch_reports:       'View Branch Reports',
}

const ALL_PERMISSIONS = Object.keys(PERM_LABELS)

export default function ResellerBusinessDetailPage() {
  const { id: tenantId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setSelectedTenant } = useResellerStore()
  const perms = useResellerPermissions()

  const { data: businesses = [], isLoading: bizLoading } = useQuery({
    queryKey: ['reseller-businesses'],
    queryFn: resellersService.getMyBusinesses,
    staleTime: 5 * 60 * 1000,
  })

  const { data: branchData, isLoading: branchLoading } = useQuery({
    queryKey: ['reseller-branches', tenantId],
    queryFn: () => resellersService.getMyBranches(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ['reseller-permissions', tenantId],
    queryFn: () => resellersService.getMyPermissions(tenantId!),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  })

  const assignment = businesses.find(b => b.tenant_id === tenantId)
  const isLoading = bizLoading || branchLoading || permLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Spinner size={32} />
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center p-6">
        <p className="text-zinc-400">Business not found or not assigned to your account.</p>
        <Btn variant="secondary" size="sm" onClick={() => navigate('/reseller/businesses')}>
          Back to Businesses
        </Btn>
      </div>
    )
  }

  const daysLeft = assignment.access_expires_at
    ? Math.ceil((new Date(assignment.access_expires_at).getTime() - Date.now()) / 86_400_000)
    : null

  const permissionsMap = permData?.permissions ?? {}

  function handleSetActive() {
    if (tenantId) setSelectedTenant(tenantId)
    navigate('/reseller/dashboard')
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-600 mb-6">
        <button onClick={() => navigate('/reseller/businesses')} className="hover:text-zinc-400 transition-colors">
          Businesses
        </button>
        <span>/</span>
        <span className="text-zinc-400">{tenantId?.slice(0, 12)}…</span>
      </div>

      {/* Title */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Business Detail</h1>
          <p className="text-zinc-500 text-sm mt-1 font-mono">{tenantId}</p>
        </div>
        <Btn variant="primary" size="sm" onClick={handleSetActive}>
          Set Active Business
        </Btn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Assignment</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Status</span>
                <Badge
                  variant={assignment.is_access_valid ? 'success' : 'danger'}
                  size="xs"
                >
                  {assignment.is_access_valid ? 'Valid' : 'Invalid'}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Active</span>
                <Badge variant={assignment.is_active ? 'success' : 'default'} size="xs">
                  {assignment.is_active ? 'Yes' : 'Deactivated'}
                </Badge>
              </div>
              {assignment.access_starts_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Starts</span>
                  <span className="text-zinc-300">{fmtDate(assignment.access_starts_at)}</span>
                </div>
              )}
              {assignment.access_expires_at ? (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Expires</span>
                  <span className={daysLeft !== null && daysLeft <= 7 ? 'text-amber-400 font-medium' : 'text-zinc-300'}>
                    {daysLeft !== null && daysLeft < 0
                      ? 'Expired'
                      : daysLeft !== null && daysLeft <= 7
                        ? `${daysLeft}d remaining`
                        : fmtDate(assignment.access_expires_at)}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Expires</span>
                  <span className="text-zinc-500">No expiration</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Assigned</span>
                <span className="text-zinc-400">{fmtDate(assignment.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Branches */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Branches</h2>
            {branchData?.all_branches_allowed ? (
              <div className="flex items-center gap-2">
                <Badge variant="info" size="xs" dot>All Branches</Badge>
                <span className="text-zinc-500 text-xs">Full access</span>
              </div>
            ) : (
              <div className="space-y-2">
                {(branchData?.branch_ids ?? assignment.allowed_branch_ids).map(id => (
                  <div key={id} className="bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-zinc-300 text-xs font-mono">{id.slice(0, 20)}…</p>
                  </div>
                ))}
                {assignment.allowed_branch_ids.length === 0 && !branchData && (
                  <p className="text-zinc-600 text-sm">Loading branches…</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Permission Matrix
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map(key => {
                const allowed = permissionsMap[key as keyof typeof permissionsMap] ?? false
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-800/50"
                  >
                    <span className="text-zinc-400 text-xs">{PERM_LABELS[key]}</span>
                    <Badge
                      variant={allowed ? 'success' : 'danger'}
                      size="xs"
                      dot
                    >
                      {allowed ? 'Allowed' : 'Denied'}
                    </Badge>
                  </div>
                )
              })}
            </div>
            {Object.keys(permissionsMap).length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-4">
                Select this business as active to load permissions.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
