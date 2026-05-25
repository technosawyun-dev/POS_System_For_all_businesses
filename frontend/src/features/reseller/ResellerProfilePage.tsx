import { useQuery } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'
import { useResellerStore } from '@/store/reseller.store'
import { resellersService } from '@/services/resellers/resellers.service'
import { ROLE_BADGE_STYLES } from '@/shared/constants/rbac'
import type { MyBusinessResponse } from '@/shared/types'

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

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function BusinessCard({ b }: { b: MyBusinessResponse }) {
  const days = daysUntil(b.access_expires_at)

  return (
    <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-zinc-200 text-sm font-medium font-mono">{b.tenant_id.slice(0, 20)}…</p>
        <Badge
          variant={b.is_access_valid ? 'success' : 'danger'}
          size="xs"
          dot
        >
          {b.is_access_valid ? 'Valid' : 'Expired'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-zinc-500">Branches</span>
          <p className="text-zinc-300 mt-0.5">
            {b.allowed_branch_ids.length === 0 ? 'All' : `${b.allowed_branch_ids.length} assigned`}
          </p>
        </div>
        <div>
          <span className="text-zinc-500">Restrictions</span>
          <p className="text-zinc-300 mt-0.5">
            {b.restricted_permissions.length === 0 ? 'None' : `${b.restricted_permissions.length} restricted`}
          </p>
        </div>
        {b.access_expires_at && (
          <div>
            <span className="text-zinc-500">Expires</span>
            <p className={`mt-0.5 font-medium ${days !== null && days <= 7 ? 'text-amber-400' : 'text-zinc-300'}`}>
              {days !== null && days < 0
                ? 'Expired'
                : days !== null && days <= 7
                  ? `${days}d`
                  : fmtDate(b.access_expires_at)}
            </p>
          </div>
        )}
        <div>
          <span className="text-zinc-500">Assigned</span>
          <p className="text-zinc-400 mt-0.5">{fmtDate(b.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

export default function ResellerProfilePage() {
  const user = useAuthStore(s => s.user)
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)

  const { data: businesses = [] } = useQuery({
    queryKey: ['reseller-businesses'],
    queryFn: resellersService.getMyBusinesses,
    staleTime: 5 * 60 * 1000,
  })

  const { data: permData } = useQuery({
    queryKey: ['reseller-permissions', selectedTenantId],
    queryFn: () => resellersService.getMyPermissions(selectedTenantId!),
    enabled: !!selectedTenantId,
    staleTime: 2 * 60 * 1000,
  })

  if (!user) return null

  const roleStyle = ROLE_BADGE_STYLES[user.role]
  const permissions = permData?.permissions ?? {}
  const allPerms = Object.keys(PERM_LABELS)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Profile</h1>
        <p className="text-zinc-500 text-sm mt-1">Your reseller account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* Account Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black border flex-shrink-0"
              style={{ background: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
            >
              {user.first_name[0]}{user.last_name[0]}
            </div>
            <div>
              <p className="text-zinc-100 font-semibold">{user.full_name}</p>
              <Badge variant="orange" size="xs">Reseller</Badge>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 pt-2">
            <div className="py-2 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">Email</p>
              <p className="text-zinc-300 text-sm">{user.email}</p>
            </div>
            <div className="py-2 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">Role</p>
              <p className="text-zinc-300 text-sm">Reseller / Middleman</p>
            </div>
            <div className="py-2 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">Account Status</p>
              <Badge variant="success" size="xs" dot>Active</Badge>
            </div>
            {user.last_login_at && (
              <div className="py-2">
                <p className="text-xs text-zinc-500 mb-0.5">Last Login</p>
                <p className="text-zinc-400 text-sm">{fmtDate(user.last_login_at)}</p>
              </div>
            )}
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
            <p className="text-zinc-500 text-xs">
              Read-only profile. Contact your administrator to update account details.
            </p>
          </div>
        </div>

        {/* Assigned Businesses */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Assigned Businesses ({businesses.length})
          </h2>
          {businesses.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-zinc-600 text-sm">No businesses assigned.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {businesses.map(b => <BusinessCard key={b.tenant_id} b={b} />)}
            </div>
          )}
        </div>

        {/* Permission Summary for active tenant */}
        {selectedTenantId && (
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Permissions — Active Business
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              {allPerms.map(key => {
                const allowed = permissions[key as keyof typeof permissions] ?? false
                return (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <span className="text-zinc-400 text-xs">{PERM_LABELS[key]}</span>
                    <Badge
                      variant={allowed ? 'success' : 'danger'}
                      size="xs"
                      dot
                    >
                      {allowed ? 'On' : 'Off'}
                    </Badge>
                  </div>
                )
              })}
              {!permData && (
                <p className="text-zinc-600 text-xs text-center py-2">
                  Loading permissions…
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
