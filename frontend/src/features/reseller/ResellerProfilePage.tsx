import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'
import { ROLE_BADGE_STYLES } from '@/shared/constants/rbac'

export default function ResellerProfilePage() {
  const user = useAuthStore(s => s.user)
  if (!user) return null

  const roleStyle = ROLE_BADGE_STYLES[user.role]

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Profile</h1>
        <p className="text-zinc-500 text-sm mt-1">Your reseller account information</p>
      </div>

      <div className="max-w-sm">
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
            {user.phone && (
              <div className="py-2 border-b border-zinc-800">
                <p className="text-xs text-zinc-500 mb-0.5">Phone</p>
                <p className="text-zinc-300 text-sm">{user.phone}</p>
              </div>
            )}
            <div className="py-2 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">Account Status</p>
              <Badge variant="success" size="xs" dot>Active</Badge>
            </div>
            {user.last_login_at && (
              <div className="py-2 border-b border-zinc-800">
                <p className="text-xs text-zinc-500 mb-0.5">Last Login</p>
                <p className="text-zinc-400 text-sm">{fmtDate(user.last_login_at)}</p>
              </div>
            )}
            <div className="py-2">
              <p className="text-xs text-zinc-500 mb-0.5">Member Since</p>
              <p className="text-zinc-400 text-sm">{fmtDate(user.created_at)}</p>
            </div>
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
            <p className="text-zinc-500 text-xs">
              Contact your administrator to update account details or change your password.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
