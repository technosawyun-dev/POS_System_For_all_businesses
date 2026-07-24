import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { useTenantStore } from '@/store/tenant.store'
import { useSessionStore } from '@/store/session.store'
import { sessionService } from '@/services/sales/sales.service'
import { ROLE_LABELS, ROLE_BADGE_STYLES } from '@/shared/constants/rbac'
import { fmtDate, fmt, extractApiMsg, fmtDateTime } from '@/lib/utils'
import { Btn, Spinner } from '@/components/ui/index'
import { IconCash, IconAlert } from '@/components/icons'
import type { CashierSession } from '@/shared/types'
import { useLocaleStore } from '@/i18n/localeStore'

const QUICK_FLOATS = [50000, 100000, 150000, 200000, 300000]

export default function SessionOpenScreen() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { selectedBranch } = useTenantStore()
  const { setActiveSession } = useSessionStore()
  const t = useLocaleStore(s => s.t)

  const [balance, setBalance] = useState('200.00')
  const [loading, setLoading] = useState(false)
  const [existingSession, setExistingSession] = useState<CashierSession | null>(null)

  if (!user) return null

  const roleStyle  = ROLE_BADGE_STYLES[user.role]
  const numBalance = parseFloat(balance) || 0
  const initials   = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`

  async function handleOpen() {
    if (!selectedBranch) {
      toast.error(t('auth.session_open.select_branch_error'))
      return
    }
    setLoading(true)
    try {
      const session = await sessionService.open({
        branch_id: selectedBranch.id,
        opening_balance: numBalance.toFixed(2),
      })
      setActiveSession(session)
      toast.success(t('auth.session_open.success'))
      navigate('/app/pos')
    } catch (err: unknown) {
      const msg = extractApiMsg(err) ?? t('auth.session_open.failed')

      // Extract existing session ID from error message and offer resume/close
      const match = msg.match(/Close session ([0-9a-f-]{36})/i)
      if (match) {
        try {
          const session = await sessionService.get(match[1])
          setActiveSession(session)
          setExistingSession(session)
        } catch {
          toast.error(msg)
        }
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // Existing session detected
  if (existingSession) {
    return (
      <div
        className="min-h-full flex items-center justify-center p-4 relative overflow-hidden"
        style={{ backgroundColor: '#09090B' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(217,119,6,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(217,119,6,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-4">
              <IconAlert width="28" height="28" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100">{t('auth.session_open.already_open')}</h1>
            <p className="text-zinc-500 text-sm mt-1">{t('auth.session_open.already_open_desc')}</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Session info */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-zinc-500">{t('auth.session_open.session_id')}</span>
                <span className="font-mono text-xs text-amber-400">{existingSession.id.slice(0, 8)}…</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-zinc-500">{t('auth.session_open.opened_at')}</span>
                <span className="text-xs text-zinc-300">{fmtDateTime(existingSession.opened_at)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-zinc-500">{t('auth.session_open.opening_balance')}</span>
                <span className="font-mono text-xs text-zinc-200">{fmt(parseFloat(existingSession.opening_balance))}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              {t('auth.session_open.continue_or_close')}
            </p>

            <div className="flex flex-col gap-3">
              <Btn
                variant="primary"
                size="xl"
                fullWidth
                onClick={() => navigate('/app/pos')}
              >
                <IconCash width="18" height="18" />
                {t('auth.session_open.resume_session')}
              </Btn>
              <Btn
                variant="danger"
                size="lg"
                fullWidth
                onClick={() => navigate('/app/session-close')}
              >
                {t('auth.session_open.close_this_session')}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Normal open session screen
  return (
    <div
      className="min-h-full flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: '#09090B' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(217,119,6,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(217,119,6,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-4">
            <IconCash width="28" height="28" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">{t('auth.session_open.title')}</h1>
          <p className="text-zinc-500 text-sm mt-1">{t('auth.session_open.subtitle')}</p>
        </div>

        {/* Branch warning */}
        {!selectedBranch && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-950 border border-amber-800 text-amber-400 text-xs mb-4">
            <IconAlert width="14" height="14" className="flex-shrink-0" />
            <span>{t('auth.session_open.no_branch_warning')}</span>
          </div>
        )}

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
          {/* User info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border flex-shrink-0"
              style={{ background: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-100 text-sm font-semibold leading-tight">{user.full_name}</p>
              <p className="text-zinc-500 text-xs leading-tight">{ROLE_LABELS[user.role]}</p>
            </div>
            {selectedBranch && (
              <div className="text-right flex-shrink-0">
                <p className="text-amber-400 text-xs font-medium">{selectedBranch.name}</p>
                <p className="text-zinc-500 text-[10px]">{fmtDate(new Date())}</p>
              </div>
            )}
          </div>

          {/* Opening balance */}
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-2">
              {t('auth.session_open.opening_balance')}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-amber-500 text-lg font-bold pointer-events-none">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-100 text-right font-mono text-2xl font-bold
                  focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all
                  pl-10 pr-4 py-4"
              />
            </div>
          </div>

          {/* Quick float buttons */}
          <div>
            <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider font-medium">{t('auth.session_open.quick_float')}</p>
            <div className="flex gap-2">
              {QUICK_FLOATS.map(amount => {
                const active = numBalance === amount
                return (
                  <button
                    key={amount}
                    onClick={() => setBalance(amount.toFixed(2))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 border ${
                      active
                        ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-900/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100'
                    }`}
                  >
                    {fmt(amount)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Open session */}
          <Btn
            variant="primary"
            size="xl"
            fullWidth
            onClick={handleOpen}
            disabled={loading || !selectedBranch}
          >
            {loading ? (
              <><Spinner size={18} /> {t('auth.session_open.opening')}</>
            ) : (
              <><IconCash width="18" height="18" /> {t('auth.session_open.open_session_btn')}</>
            )}
          </Btn>
        </div>

      </div>
    </div>
  )
}
