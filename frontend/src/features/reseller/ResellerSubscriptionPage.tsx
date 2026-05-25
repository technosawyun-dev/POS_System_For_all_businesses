import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge, Spinner } from '@/components/ui'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { resellersService } from '@/services/resellers/resellers.service'
import { useResellerStore } from '@/store/reseller.store'
import { useResellerPermissions } from './ResellerPermissionContext'

function NoBusiness() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-3xl">💳</div>
      <div>
        <p className="text-zinc-200 font-semibold">Select a Business</p>
        <p className="text-zinc-500 text-sm mt-1">Choose a business from the sidebar to view subscription status.</p>
      </div>
    </div>
  )
}

function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <span className="text-4xl">🔒</span>
      <div>
        <p className="text-zinc-300 font-medium">No Subscription Access</p>
        <p className="text-zinc-600 text-sm mt-1">You do not have permission to view subscription information.</p>
      </div>
    </div>
  )
}

const SUB_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE:    'success',
  TRIAL:     'info',
  SUSPENDED: 'warning',
  EXPIRED:   'danger',
  PENDING:   'default',
  CANCELLED: 'default',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className="text-zinc-200 text-sm font-medium">{value}</span>
    </div>
  )
}

export default function ResellerSubscriptionPage() {
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)
  const perms = useResellerPermissions()

  const { data: businesses = [] } = useQuery({
    queryKey: ['reseller-businesses'],
    queryFn: resellersService.getMyBusinesses,
    staleTime: 5 * 60 * 1000,
  })

  if (!selectedTenantId) return <NoBusiness />
  if (!perms.canViewSubscription()) return <PermissionDenied />

  const assignment = businesses.find(b => b.tenant_id === selectedTenantId)
  const daysLeft = assignment?.access_expires_at
    ? Math.ceil((new Date(assignment.access_expires_at).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Subscription Status</h1>
        <p className="text-zinc-500 text-sm mt-1">Read-only view of business subscription information</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Assignment Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Your Assignment</h2>
          {assignment ? (
            <div>
              <InfoRow label="Business ID" value={<span className="font-mono text-xs">{selectedTenantId.slice(0, 20)}…</span>} />
              <InfoRow label="Assignment Status" value={
                <Badge variant={assignment.is_access_valid ? 'success' : 'danger'} size="xs">
                  {assignment.is_access_valid ? 'Valid' : 'Expired'}
                </Badge>
              } />
              <InfoRow label="Active" value={
                <Badge variant={assignment.is_active ? 'success' : 'default'} size="xs">
                  {assignment.is_active ? 'Yes' : 'Deactivated'}
                </Badge>
              } />
              {assignment.access_starts_at && (
                <InfoRow label="Access Since" value={fmtDate(assignment.access_starts_at)} />
              )}
              {assignment.access_expires_at ? (
                <InfoRow
                  label="Your Access Expires"
                  value={
                    <span className={daysLeft !== null && daysLeft <= 7 ? 'text-amber-400 font-semibold' : ''}>
                      {daysLeft !== null && daysLeft < 0
                        ? 'Expired'
                        : daysLeft !== null && daysLeft <= 7
                          ? `${daysLeft} days remaining`
                          : fmtDate(assignment.access_expires_at)}
                    </span>
                  }
                />
              ) : (
                <InfoRow label="Your Access Expires" value={<span className="text-zinc-500">No expiration</span>} />
              )}
              <InfoRow label="Assigned Branches" value={
                assignment.allowed_branch_ids.length === 0
                  ? 'All branches'
                  : `${assignment.allowed_branch_ids.length} branch${assignment.allowed_branch_ids.length > 1 ? 'es' : ''}`
              } />
              <InfoRow label="Restricted Permissions" value={
                assignment.restricted_permissions.length === 0
                  ? <Badge variant="success" size="xs">Full access</Badge>
                  : <Badge variant="warning" size="xs">{assignment.restricted_permissions.length} restrictions</Badge>
              } />
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Assignment data not available.</p>
          )}
        </div>

        {/* Read-only note */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg flex-shrink-0">ℹ️</span>
          <div>
            <p className="text-zinc-300 text-sm font-medium">Read-only view</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              As a reseller, you have read-only visibility into subscription and assignment status.
              Contact your administrator to make changes or renew access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
