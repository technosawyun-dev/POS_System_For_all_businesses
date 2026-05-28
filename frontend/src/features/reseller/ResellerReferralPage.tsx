import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { resellerFinanceService, type ReferralCodeResponse } from '@/services/reseller_finance/reseller_finance.service'

// Helpers

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// Primary Promo Code Card

function PrimaryCodeCard({ codes }: { codes: ReferralCodeResponse[] }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [showLink, setShowLink] = useState(false)

  const activeCode = codes.find(c => c.is_active) ?? codes[0] ?? null

  const { data: linkData } = useQuery({
    queryKey: ['reseller', 'referral-link', activeCode?.id],
    queryFn: () => resellerFinanceService.getReferralLink(activeCode!.id),
    enabled: showLink && !!activeCode,
  })

  const createMutation = useMutation({
    mutationFn: (code: string) => resellerFinanceService.createCode(code || undefined),
    onSuccess: async (created) => {
      if (activeCode) {
        await resellerFinanceService.deactivateCode(activeCode.id)
      }
      qc.invalidateQueries({ queryKey: ['reseller', 'referral-codes'] })
      toast.success(`Promo code updated to ${created.code}`)
      setEditing(false)
      setNewCode('')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update code'),
  })

  const createFirstMutation = useMutation({
    mutationFn: () => resellerFinanceService.createCode(undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller', 'referral-codes'] })
      toast.success('Promo code created')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to create code'),
  })

  if (!activeCode) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
        <div className="text-4xl">🔗</div>
        <div>
          <p className="text-zinc-300 font-semibold">No promo code yet</p>
          <p className="text-zinc-500 text-sm mt-1">Generate a promo code to start referring businesses.</p>
        </div>
        <Btn size="sm" onClick={() => createFirstMutation.mutate()} loading={createFirstMutation.isPending}>
          Generate Promo Code
        </Btn>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Your Promo Code</h2>
        <Badge variant={activeCode.is_active ? 'success' : 'warning'} size="xs">
          {activeCode.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">New code (letters & digits only)</label>
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. MYNEWCODE"
              maxLength={20}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-zinc-100 tracking-widest focus:outline-none focus:border-orange-500 uppercase"
            />
            <p className="text-[11px] text-zinc-600 mt-1">Min 4 characters. This will deactivate your current code.</p>
          </div>
          <div className="flex gap-2">
            <Btn
              size="sm"
              disabled={newCode.length < 4 || createMutation.isPending}
              onClick={() => createMutation.mutate(newCode)}
            >
              {createMutation.isPending ? 'Saving…' : 'Save Code'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setNewCode('') }}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono text-4xl font-black text-orange-400 tracking-widest">{activeCode.code}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <CopyButton text={activeCode.code} />
            <button
              onClick={() => setShowLink(v => !v)}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
            >
              {showLink ? 'Hide link' : 'Get link'}
            </button>
            <button
              onClick={() => { setEditing(true); setNewCode(activeCode.code) }}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {showLink && linkData && (
        <div className="bg-zinc-800 rounded-xl px-3 py-2.5 flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-mono truncate flex-1">{linkData.referral_url}</span>
          <CopyButton text={linkData.referral_url} />
        </div>
      )}

      <p className="text-[11px] text-zinc-600">
        Share this code or link with businesses. Anyone who registers with it will be counted as your referral.
      </p>
    </div>
  )
}

// Main Page

export default function ResellerReferralPage() {
  const { data: codesData, isLoading: codesLoading } = useQuery({
    queryKey: ['reseller', 'referral-codes'],
    queryFn: () => resellerFinanceService.listMyCodes({ page_size: 100 }),
    staleTime: 60_000,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['reseller', 'referral-stats'],
    queryFn: resellerFinanceService.getReferralStats,
    staleTime: 60_000,
  })

  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ['reseller', 'referrals', 1],
    queryFn: () => resellerFinanceService.listMyReferrals({ page: 1, page_size: 50 }),
    staleTime: 60_000,
  })

  const codes = codesData?.items ?? []

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Referrals</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your promo code and track referred businesses.</p>
      </div>

      {/* Promo code card */}
      {codesLoading ? (
        <div className="flex justify-center py-8"><Spinner size={24} /></div>
      ) : (
        <PrimaryCodeCard codes={codes} />
      )}

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Performance</h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse">
                <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
                <div className="h-7 w-16 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Referrals', value: stats?.total_referrals ?? 0 },
              { label: 'Converted', value: stats?.converted_referrals ?? 0, sub: 'Paying customers' },
              { label: 'In Trial', value: stats?.trial_referrals ?? 0 },
              { label: 'Conversion Rate', value: `${stats?.conversion_rate ?? 0}%` },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-zinc-100 tabular-nums">{s.value}</p>
                {s.sub && <p className="text-xs text-zinc-600 mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referred businesses */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Referred Businesses {referrals?.total ? `(${referrals.total})` : ''}
        </h2>
        {referralsLoading ? (
          <div className="flex justify-center py-6"><Spinner size={20} /></div>
        ) : !referrals?.items.length ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-600 text-sm">
            No businesses referred yet. Share your promo code to get started.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Business</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">Code Used</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.items.map(r => (
                  <tr key={r.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-zinc-200 text-sm font-medium">
                        {r.tenant_name ?? `Business ${r.tenant_id.slice(0, 8)}…`}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-mono text-amber-400 text-xs tracking-wider bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
                        {r.referral_code_snapshot}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">
                      {new Date(r.referred_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={r.locked_at ? 'success' : 'warning'} size="xs">
                        {r.locked_at ? 'Converted' : 'Trial'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
