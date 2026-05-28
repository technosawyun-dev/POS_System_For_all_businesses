import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { ROLE_HOME } from '@/shared/constants/rbac'
import { Btn, Input, Spinner } from '@/components/ui/index'
import { IconAlert } from '@/components/icons'
import { fmtDate } from '@/lib/utils'

type LoginMode = 'owner' | 'staff'

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [mode, setMode]               = useState<LoginMode>('owner')
  const [identifier, setIdentifier]   = useState('')  // email or phone for owner/reseller
  const [password, setPassword]       = useState('')
  const [businessCode, setBusinessCode] = useState('')
  const [staffIdentifier, setStaffIdentifier] = useState('')

  function switchMode(m: LoginMode) {
    setMode(m)
    clearError()
  }

  function buildOwnerPayload() {
    const val = identifier.trim()
    // phone: starts with digit or +, no @
    if (val && !val.includes('@') && /^[+0-9]/.test(val)) {
      return { phone: val, password }
    }
    return { email: val, password }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    try {
      if (mode === 'owner') {
        await login(buildOwnerPayload())
      } else {
        await login({
          business_code: businessCode.trim().toUpperCase(),
          identifier: staffIdentifier.trim(),
          password,
        })
      }
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname
      const user = useAuthStore.getState().user
      const home = user ? (ROLE_HOME[user.role] ?? '/app/pos') : '/app/pos'
      const ROLE_PREFIXES: Record<string, string[]> = {
        SUPER_ADMIN:     ['/super-admin', '/app'],
        RESELLER:        ['/reseller'],
        BUSINESS_OWNER:  ['/app'],
        MANAGER:         ['/app'],
        CASHIER:         ['/app'],
        INVENTORY_STAFF: ['/app'],
      }
      const allowed = user ? (ROLE_PREFIXES[user.role] ?? []) : []
      const safeFrom = from && allowed.some(p => from.startsWith(p)) ? from : null
      navigate(safeFrom ?? home, { replace: true })
    } catch {
      // error is already set in store
    }
  }

  const ownerReady = !!identifier && !!password
  const staffReady = !!businessCode && !!staffIdentifier && !!password
  const canSubmit  = !isLoading && (mode === 'owner' ? ownerReady : staffReady)

  return (
    <div className="relative w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 shadow-2xl shadow-amber-900/50 mb-4">
          <span className="text-black font-black text-3xl">N</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">NexusPOS</h1>
        <p className="text-zinc-500 text-sm mt-1">Enterprise Point of Sale</p>
      </div>

      {/* Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        {/* Tab toggle */}
        <div className="flex bg-zinc-950 rounded-xl p-1 mb-5 gap-1">
          {(['owner', 'staff'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === m
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {m === 'owner' ? 'Owner / Reseller / Admin' : 'Staff'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-3">
            {mode === 'owner' ? (
              <>
                <Input
                  label="Email or Phone"
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); clearError() }}
                  placeholder="you@company.com or 09xxxxxxxx"
                  autoComplete="username"
                  required
                />
                <p className="text-[11px] text-zinc-600 -mt-1">
                  Business owners, resellers, and admins sign in here.
                </p>
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError() }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </>
            ) : (
              <>
                <Input
                  label="Business Code"
                  type="text"
                  value={businessCode}
                  onChange={e => { setBusinessCode(e.target.value.toUpperCase()); clearError() }}
                  placeholder="e.g. BAKE4F2A"
                  autoComplete="off"
                  required
                />
                <p className="text-[11px] text-zinc-600 -mt-1">
                  Ask your business owner for the 8-character business code.
                </p>
                <Input
                  label="Phone or Email"
                  type="text"
                  value={staffIdentifier}
                  onChange={e => { setStaffIdentifier(e.target.value); clearError() }}
                  placeholder="09123456789 or you@example.com"
                  autoComplete="username"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError() }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 text-red-400 text-xs">
                <IconAlert width="14" height="14" className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Btn
              type="submit"
              variant="primary"
              size="xl"
              fullWidth
              disabled={!canSubmit}
              className="mt-1"
            >
              {isLoading ? (
                <><Spinner size={18} /> Signing in…</>
              ) : (
                'Sign In'
              )}
            </Btn>
          </div>
        </form>
      </div>

      {mode === 'owner' && (
        <p className="text-center text-zinc-600 text-xs mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-amber-500 hover:text-amber-400">
            Start free trial
          </Link>
        </p>
      )}

      <p className="text-center text-zinc-600 text-[11px] mt-3">
        NexusPOS v5.0 · {fmtDate(new Date())}
      </p>
    </div>
  )
}
