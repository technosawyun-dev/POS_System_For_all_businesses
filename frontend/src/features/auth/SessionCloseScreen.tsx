import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { useSessionStore } from '@/store/session.store'
import { sessionService, checkoutService } from '@/services/sales/sales.service'
import { ROLE_LABELS, ROLE_BADGE_STYLES } from '@/shared/constants/rbac'
import { fmt, fmtDateTime, extractApiMsg } from '@/lib/utils'
import { Btn, Divider, Spinner } from '@/components/ui/index'
import { IconLogout, IconCash, IconCard, IconAlert } from '@/components/icons'

export default function SessionCloseScreen() {
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const { user, logout } = useAuthStore()
  const { activeSession, clearSession } = useSessionStore()

  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes]           = useState('')
  const [loading, setLoading]       = useState(false)

  // Fetch orders for this session to compute revenue
  const { data: ordersData } = useQuery({
    queryKey: ['session-orders', activeSession?.id],
    queryFn: () => checkoutService.listOrders({ page_size: 200 }),
    enabled: !!activeSession,
  })

  if (!activeSession || !user) {
    return (
      <div className="min-h-full flex items-center justify-center bg-zinc-950">
        <p className="text-zinc-500 text-sm">No active session.</p>
      </div>
    )
  }

  const roleStyle = ROLE_BADGE_STYLES[user.role]
  const initials  = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`

  const sessionOrders = (ordersData?.items ?? []).filter(
    o => o.cashier_session_id === activeSession?.id && o.order_status !== 'VOIDED',
  )

  const totalRevenue  = sessionOrders.reduce((s, o) => s + parseFloat(o.total_amount),  0)
  const openingBal    = parseFloat(activeSession.opening_balance)
  const expectedCash  = openingBal  // simplified: opening + cash portion

  const actual      = parseFloat(actualCash) || 0
  const discrepancy = actualCash !== '' ? actual - expectedCash : null

  function discColor() {
    if (discrepancy === null) return 'bg-zinc-900 border-zinc-800 text-zinc-400'
    if (Math.abs(discrepancy) < 0.01) return 'bg-green-950 border-green-800 text-green-400'
    if (discrepancy < 0) return 'bg-red-950 border-red-800 text-red-400'
    return 'bg-amber-950 border-amber-800 text-amber-400'
  }

  function discLabel() {
    if (discrepancy === null) return 'Enter actual cash to see discrepancy'
    if (Math.abs(discrepancy) < 0.01) return 'Cash balanced — no discrepancy'
    if (discrepancy < 0) return `Short by ${fmt(Math.abs(discrepancy))}`
    return `Over by ${fmt(discrepancy)}`
  }

  async function handleClose() {
    if (!actualCash) {
      toast.error('Please enter the actual cash in drawer.')
      return
    }
    setLoading(true)
    try {
      await sessionService.close(activeSession!.id, {
        actual_balance: actual.toFixed(2),
        notes: notes || undefined,
      })
      clearSession()
      qc.clear()
      toast.success('Session closed successfully')
      await logout()
      navigate('/login')
    } catch (err: unknown) {
      const msg = extractApiMsg(err) ?? 'Failed to close session'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-zinc-950 flex items-start justify-center p-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-950 border border-red-800 text-red-400 mb-4">
            <IconLogout width="26" height="26" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Close Session</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="font-mono text-amber-400 text-sm">{activeSession.id.slice(0, 8)}…</span>
            <span className="text-zinc-600 text-xs">·</span>
            <span className="text-zinc-500 text-xs">Started {fmtDateTime(activeSession.opened_at)}</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Cashier strip */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border flex-shrink-0"
              style={{ background: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
            >
              {initials}
            </div>
            <div>
              <p className="text-zinc-100 text-sm font-semibold leading-tight">{user.full_name}</p>
              <p className="text-zinc-500 text-xs">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Orders</p>
                <p className="text-2xl font-bold font-mono text-zinc-100">{sessionOrders.length}</p>
              </div>
              <div className="rounded-xl border border-amber-800/40 bg-amber-500/5 p-3 text-center">
                <p className="text-xs text-amber-600 uppercase tracking-wider mb-1">Revenue</p>
                <p className="text-xl font-bold font-mono text-amber-400">{fmt(totalRevenue)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Opening</p>
                <p className="text-xl font-bold font-mono text-zinc-100">{fmt(openingBal)}</p>
              </div>
            </div>

            <Divider />

            {/* Cash reconciliation */}
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Cash Reconciliation</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <IconCash width="15" height="15" className="text-zinc-600" />
                    Opening Float
                  </div>
                  <span className="font-mono text-zinc-200 text-sm">{fmt(openingBal)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium">
                    <IconCard width="15" height="15" className="text-zinc-500" />
                    Expected in Drawer
                  </div>
                  <span className="font-mono text-zinc-100 text-sm font-semibold">{fmt(expectedCash)}</span>
                </div>
              </div>
            </div>

            {/* Actual cash input */}
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-2">
                Actual Cash in Drawer
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-amber-500 text-base font-bold pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={actualCash}
                  onChange={e => setActualCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-100 text-right font-mono text-xl font-bold
                    focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all
                    pl-10 pr-4 py-3"
                />
              </div>
            </div>

            {/* Discrepancy */}
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${discColor()}`}>
              <IconAlert width="15" height="15" className="flex-shrink-0" />
              <span>{discLabel()}</span>
              {discrepancy !== null && Math.abs(discrepancy) >= 0.01 && (
                <span className="ml-auto font-mono font-bold">{fmt(Math.abs(discrepancy))}</span>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-2">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any notes for this session close…"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-100 text-sm
                  focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all
                  px-4 py-3 resize-none placeholder-zinc-600"
              />
            </div>

            <Divider />

            {/* Actions */}
            <div className="flex gap-3">
              <Btn
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => navigate('/app/pos')}
                disabled={loading}
              >
                Cancel
              </Btn>
              <Btn
                variant="danger"
                size="lg"
                className="flex-1"
                onClick={handleClose}
                disabled={loading || !actualCash}
              >
                {loading ? (
                  <><Spinner size={16} /> Closing…</>
                ) : (
                  <><IconLogout width="16" height="16" /> Close Session</>
                )}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

