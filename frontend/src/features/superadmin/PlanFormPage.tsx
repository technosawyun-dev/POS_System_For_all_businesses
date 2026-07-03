import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Btn, Spinner } from '@/components/ui'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import type { PlanCreateRequest } from '@/shared/types'

const TOGGLE_FEATURES: { code: string; label: string; desc: string }[] = [
  { code: 'pos',              label: 'POS / Checkout',     desc: 'Access the point-of-sale checkout screen' },
  { code: 'inventory',        label: 'Inventory',          desc: 'Stock tracking, adjustments, and reports' },
  { code: 'analytics',        label: 'Analytics',          desc: 'Sales, inventory, and financial analytics dashboard' },
  { code: 'advanced_reports', label: 'Advanced Reports',   desc: 'Detailed financial reports and data exports' },
  { code: 'procurement',      label: 'Procurement',        desc: 'Suppliers, purchase orders, and payables' },
]

const LIMIT_FEATURES: { code: string; label: string; desc: string; placeholder: string }[] = [
  { code: 'products',  label: 'Max Products',  desc: 'Maximum number of products (SKUs) per tenant',         placeholder: 'e.g. 100' },
  { code: 'branches',  label: 'Max Branches',  desc: 'Maximum number of branches per tenant',                placeholder: 'e.g. 1' },
  { code: 'users',     label: 'Max Staff',     desc: 'Maximum number of staff/manager accounts per tenant',  placeholder: 'e.g. 5' },
  { code: 'customers', label: 'Max Customers', desc: 'Maximum number of customer records per tenant',        placeholder: 'e.g. 500' },
  { code: 'devices',   label: 'Max Devices',   desc: 'Maximum number of POS devices per tenant',            placeholder: 'e.g. 3' },
]

const FIXED_CONTACT_KEYS = ['viber', 'telegram', 'facebook', 'tiktok'] as const
type FixedContactKey = typeof FIXED_CONTACT_KEYS[number]
const FIXED_CONTACT_LABELS: Record<FixedContactKey, string> = {
  viber: 'Viber URL', telegram: 'Telegram URL', facebook: 'Facebook URL', tiktok: 'TikTok URL',
}
const FIXED_CONTACT_PLACEHOLDERS: Record<FixedContactKey, string> = {
  viber: 'viber://chat?number=+95...', telegram: 'https://t.me/yourusername',
  facebook: 'https://facebook.com/yourpage', tiktok: 'https://tiktok.com/@youraccount',
}

type EntRow = { feature_code: string; enabled: boolean; limit_value: string }
type CustomLink = { label: string; url: string }

const LEGACY_CODE_MAP: Record<string, string> = {
  max_products:  'products',
  max_branches:  'branches',
  max_users:     'users',
  max_customers: 'customers',
}

function buildDefaultEntitlements(): EntRow[] {
  return [
    ...TOGGLE_FEATURES.map(f => ({ feature_code: f.code, enabled: false, limit_value: '' })),
    ...LIMIT_FEATURES.map(f => ({ feature_code: f.code, enabled: true, limit_value: '' })),
  ]
}

function mergeEntitlements(existing: { feature_code: string; enabled: boolean; limit_value: number | null }[]): EntRow[] {
  const normalized = existing.map(e => ({
    ...e,
    feature_code: LEGACY_CODE_MAP[e.feature_code] ?? e.feature_code,
  }))
  const map = new Map(normalized.map(e => [e.feature_code, e]))
  const defaults = buildDefaultEntitlements()
  return defaults.map(d => {
    const ex = map.get(d.feature_code)
    if (!ex) return d
    return { feature_code: d.feature_code, enabled: ex.enabled, limit_value: ex.limit_value !== null ? String(ex.limit_value) : '' }
  })
}

export default function PlanFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const [form, setForm] = useState({
    name: '', code: '', description: '', billing_cycle: 'MONTHLY',
    price: '', currency: 'MMK', trial_days: '14', sort_order: '0', is_active: true,
    is_referral_plan: false, is_custom: false,
  })
  const [fixedLinks, setFixedLinks] = useState<Record<FixedContactKey, string>>({ viber: '', telegram: '', facebook: '', tiktok: '' })
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([])
  const [entitlements, setEntitlements] = useState<EntRow[]>(buildDefaultEntitlements)

  const { data: existingPlan, isLoading: planLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => subscriptionsService.getPlan(id!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!existingPlan) return
    setForm({
      name:             existingPlan.name,
      code:             existingPlan.code,
      description:      existingPlan.description ?? '',
      billing_cycle:    existingPlan.billing_cycle,
      price:            existingPlan.price,
      currency:         existingPlan.currency,
      trial_days:       String(existingPlan.trial_days),
      sort_order:       String(existingPlan.sort_order),
      is_active:        existingPlan.is_active,
      is_referral_plan: existingPlan.is_referral_plan,
      is_custom:        existingPlan.is_custom ?? false,
    })
    const cl = existingPlan.contact_links
    setFixedLinks({
      viber:    cl?.viber    ?? '',
      telegram: cl?.telegram ?? '',
      facebook: cl?.facebook ?? '',
      tiktok:   cl?.tiktok   ?? '',
    })
    setCustomLinks(cl?.custom ?? [])
    setEntitlements(mergeEntitlements(existingPlan.entitlements))
  }, [existingPlan])

  const createMutation = useMutation({
    mutationFn: (payload: PlanCreateRequest) => subscriptionsService.createPlan(payload),
    onSuccess: plan => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success('Plan created')
      navigate(`/super-admin/plans/${plan.id}`)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to create plan'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: PlanCreateRequest) => subscriptionsService.updatePlan(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['plan', id] })
      toast.success('Plan updated')
      navigate(`/super-admin/plans/${id}`)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update plan'),
  })

  function handleSubmit() {
    const hasAnyFixed = FIXED_CONTACT_KEYS.some(k => fixedLinks[k].trim())
    const hasCustom = customLinks.some(l => l.label.trim() || l.url.trim())
    const contact_links = (form.is_custom && (hasAnyFixed || hasCustom)) ? {
      viber:    fixedLinks.viber.trim()    || null,
      telegram: fixedLinks.telegram.trim() || null,
      facebook: fixedLinks.facebook.trim() || null,
      tiktok:   fixedLinks.tiktok.trim()   || null,
      custom:   customLinks.filter(l => l.label.trim() && l.url.trim()),
    } : null

    const payload: PlanCreateRequest = {
      name:             form.name.trim(),
      code:             form.code.trim(),
      description:      form.description.trim() || undefined,
      billing_cycle:    form.billing_cycle,
      price:            form.price,
      currency:         form.currency,
      trial_days:       Number(form.trial_days),
      sort_order:       Number(form.sort_order),
      is_active:        form.is_active,
      is_referral_plan: form.is_referral_plan,
      is_custom:        form.is_custom,
      contact_links,
      entitlements: entitlements.map(e => ({
        feature_code: e.feature_code,
        enabled: e.enabled,
        limit_value: e.limit_value.trim() ? Number(e.limit_value) : null,
      })),
    }
    if (isEdit) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  function setEnt(code: string, patch: Partial<EntRow>) {
    setEntitlements(prev => prev.map(e => e.feature_code === code ? { ...e, ...patch } : e))
  }

  function addCustomLink() {
    setCustomLinks(prev => [...prev, { label: '', url: '' }])
  }

  function updateCustomLink(idx: number, patch: Partial<CustomLink>) {
    setCustomLinks(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  function removeCustomLink(idx: number) {
    setCustomLinks(prev => prev.filter((_, i) => i !== idx))
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit = form.name.trim() && form.code.trim() && form.price && !isPending

  if (isEdit && planLoading) {
    return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  }

  const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'
  const inpSm = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
        <button
          onClick={() => navigate(isEdit ? `/super-admin/plans/${id}` : '/super-admin/plans')}
          aria-label="Go back"
          className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-base font-semibold text-zinc-100">{isEdit ? `Edit — ${existingPlan?.name ?? '…'}` : 'New Plan'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-5">

          {/* Plan Details */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Plan Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="Starter" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Code *{isEdit && <span className="ml-1 text-zinc-600 font-normal normal-case">(read-only)</span>}
                </label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className={inp} placeholder="starter" disabled={isEdit} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inp} placeholder="For small businesses…" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Price *</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className={inp} placeholder="29000" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={inp}>
                  <option value="MMK">Kyats</option>
                  <option value="USD">USD</option>
                  <option value="THB">THB</option>
                  <option value="SGD">SGD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Billing Cycle</label>
                <select value={form.billing_cycle} onChange={e => setForm(p => ({ ...p, billing_cycle: e.target.value }))} className={inp}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Trial Days</label>
                <input type="number" min="0" value={form.trial_days} onChange={e => setForm(p => ({ ...p, trial_days: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Sort Order <span className="text-zinc-600 font-normal normal-case">(lower = first)</span></label>
                <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} className={inp} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="is_active" checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                <label htmlFor="is_active" className="text-sm text-zinc-300 cursor-pointer select-none">Active (visible to subscribers)</label>
              </div>
              <div className="flex items-start gap-2 pt-1">
                <input type="checkbox" id="is_referral" checked={form.is_referral_plan}
                  onChange={e => setForm(p => ({ ...p, is_referral_plan: e.target.checked }))} className="rounded mt-0.5" />
                <div>
                  <label htmlFor="is_referral" className="text-sm text-zinc-300 cursor-pointer select-none">Referral Plan</label>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Users who register with a reseller promo code are placed on this plan. Only one plan should have this flag.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1">
                <input type="checkbox" id="is_custom" checked={form.is_custom}
                  onChange={e => setForm(p => ({ ...p, is_custom: e.target.checked }))} className="rounded mt-0.5" />
                <div>
                  <label htmlFor="is_custom" className="text-sm text-zinc-300 cursor-pointer select-none">Custom Plan</label>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Shows a "Contact Us" card instead of a subscribe button. Used for enterprise or custom pricing arrangements.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Links — only for custom plans */}
          {form.is_custom && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Contact Links</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Social / messaging links shown on the custom plan card. Leave blank to hide.</p>
              </div>

              {FIXED_CONTACT_KEYS.map(key => (
                <div key={key}>
                  <label className="block text-xs text-zinc-400 mb-1">{FIXED_CONTACT_LABELS[key]}</label>
                  <input
                    value={fixedLinks[key]}
                    onChange={e => setFixedLinks(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={FIXED_CONTACT_PLACEHOLDERS[key]}
                    className={inp}
                  />
                </div>
              ))}

              {customLinks.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Additional Links</p>
                  {customLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-[0_0_35%]">
                        <input
                          value={link.label}
                          onChange={e => updateCustomLink(idx, { label: e.target.value })}
                          placeholder="Label (e.g. WhatsApp)"
                          className={inpSm}
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          value={link.url}
                          onChange={e => updateCustomLink(idx, { url: e.target.value })}
                          placeholder="https://…"
                          className={inpSm}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomLink(idx)}
                        aria-label="Remove contact link"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-950/50 transition-colors flex-shrink-0 mt-0.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addCustomLink}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add another contact link
              </button>
            </div>
          )}

          {/* Feature Access */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-800">
              <p className="text-sm font-semibold text-zinc-100">Feature Access</p>
              <p className="text-xs text-zinc-500 mt-0.5">Enable or disable entire sections of the app for this plan.</p>
            </div>
            <div className="divide-y divide-zinc-800">
              {TOGGLE_FEATURES.map(f => {
                const row = entitlements.find(e => e.feature_code === f.code)!
                return (
                  <label key={f.code} className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                    <div className="flex-shrink-0">
                      <div
                        onClick={() => setEnt(f.code, { enabled: !row.enabled })}
                        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${row.enabled ? 'bg-amber-500' : 'bg-zinc-700'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${row.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => setEnt(f.code, { enabled: !row.enabled })}>
                      <p className={`text-sm font-medium ${row.enabled ? 'text-zinc-100' : 'text-zinc-500'}`}>{f.label}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{f.desc}</p>
                    </div>
                    <span className={`text-xs font-semibold flex-shrink-0 ${row.enabled ? 'text-green-400' : 'text-zinc-600'}`}>
                      {row.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Usage Limits */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-800">
              <p className="text-sm font-semibold text-zinc-100">Usage Limits</p>
              <p className="text-xs text-zinc-500 mt-0.5">Leave blank for unlimited. These are hard caps enforced by the backend.</p>
            </div>
            <div className="divide-y divide-zinc-800">
              {LIMIT_FEATURES.map(f => {
                const row = entitlements.find(e => e.feature_code === f.code)!
                return (
                  <div key={f.code} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100">{f.label}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{f.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.limit_value}
                        onChange={e => setEnt(f.code, { limit_value: e.target.value })}
                        placeholder={f.placeholder}
                        className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 text-right focus:outline-none focus:border-amber-500"
                      />
                      {!row.limit_value && (
                        <span className="text-xs text-zinc-600 w-16">Unlimited</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-2 pb-4">
            <Btn variant="secondary" size="sm" onClick={() => navigate(isEdit ? `/super-admin/plans/${id}` : '/super-admin/plans')}>
              Cancel
            </Btn>
            <Btn onClick={handleSubmit} disabled={!canSubmit}>
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
            </Btn>
          </div>

        </div>
      </div>
    </div>
  )
}
