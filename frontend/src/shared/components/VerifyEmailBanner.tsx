import { useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { authService } from '@/services/auth/auth.service'
import { extractApiMsg } from '@/lib/utils'

// Soft reminder only — verifying doesn't gate login. Scoped to BUSINESS_OWNER
// and RESELLER — the only roles that manage their own email/password at all
// (BUSINESS_OWNER via self-service registration, RESELLER via their profile
// page after being created by an admin). Staff accounts (manager/cashier/
// inventory) are created by the owner via invite and never get a
// verification email, so nagging them would be a dead end.
export default function VerifyEmailBanner() {
  const user = useAuthStore(s => s.user)
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)

  const isEligible = !!user && (user.role === 'BUSINESS_OWNER' || user.role === 'RESELLER') && !user.email_verified_at

  if (!isEligible || dismissed) return null

  async function handleResend() {
    if (!user) return
    setSending(true)
    try {
      await authService.resendVerification(user.email)
      toast.success('Verification email sent — check your inbox.')
    } catch (err) {
      toast.error(extractApiMsg(err) ?? 'Failed to send verification email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="px-4 py-2 flex items-center justify-between gap-4 text-xs font-medium bg-blue-950/60 border-b border-blue-900/40 text-blue-300 flex-shrink-0">
      <span>Please verify your email address ({user.email}) to secure your account.</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleResend}
          disabled={sending}
          className="px-3 py-1 rounded-lg font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Resend email'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-blue-400 hover:text-blue-200 px-1"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
