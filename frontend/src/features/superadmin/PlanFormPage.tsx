import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Btn, Spinner } from '@/components/ui'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import type { PlanCreateRequest } from '@/shared/types'

type EntitlementRow = { feature_code: string; enabled: boolean; limit_value: string }

const KNOWN_FEATURES = [
  'sales', 'inventory', 'customers', 'analytics', 'procurement',
  'notifications', 'sync', 'users', 'branches', 'products', 'devices',
]

const DEFAULT_ENTITLEMENTS: EntitlementRow[] = KNOWN_FEATURES.map(f => ({
  feature_code: f, enabled: true, limit_value: '',
}))

export default function PlanFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const [form, setForm] = useState({
    name: '', code: '', description: '', billing_cycle: 'MONTHLY',
    price: '', currency: 'USD', trial_days: '0', sort_order: '0', is_active: true,
  })
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>(DEFAULT_ENTITLEMENTS)
  const [customFeature, setCustomFeature] = useState('')

  const { data: existingPlan, isLoading: planLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => subscriptionsService.getPlan(id!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existingPlan) {
      setForm({
        name:          existingPlan.name,
        code:          existingPlan.code,
        description:   existingPlan.description ?? '',
        billing_cycle: existingPlan.billing_cycle,
        price:         existingPlan.price,
        currency:      existingPlan.currency,
        trial_days:    String(existingPlan.trial_days),
        sort_order:    String(existingPlan.sort_order),
        is_active:     existingPlan.is_active,
      })
      if (existingPlan.entitlements.length > 0) {
        setEntitlements(existingPlan.entitlements.map(e => ({
          feature_code: e.feature_code,
          enabled: e.enabled,
          limit_value: e.limit_value !== null ? String(e.limit_value) : '',
        })))
      }
    }
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
    const payload: PlanCreateRequest = {
      name:          form.name,
      code:          form.code,
      description:   form.description || undefined,
      billing_cycle: form.billing_cycle,
      price:         form.price,
      currency:      form.currency,
      trial_days:    Number(form.trial_days),
      sort_order:    Number(form.sort_order),
      is_active:     form.is_active,
      entitlements:  entitlements
        .filter(e => e.feature_code.trim())
        .map(e => ({
          feature_code: e.feature_code,
          enabled: e.enabled,
          limit_value: e.limit_value ? Number(e.limit_value) : null,
        })),
    }
    if (isEdit) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  function addCustomFeature() {
    const code = customFeature.trim().toLowerCase().replace(/\s+/g, '_')
    if (!code || entitlements.some(e => e.feature_code === code)) return
    setEntitlements(prev => [...prev, { feature_code: code, enabled: true, limit_value: '' }])
    setCustomFeature('')
  }

  function removeEntitlement(code: string) {
    setEntitlements(prev => prev.filter(e => e.feature_code !== code))
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isEdit && planLoading) {
    return <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
  }

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
        <button onClick={() => navigate('/super-admin/plans')} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-base font-semibold text-zinc-100">{isEdit ? 'Edit Plan' : 'New Plan'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-5">
          {/* Basic info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Plan Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Starter" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Code *</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className={inputCls} placeholder="starter" disabled={isEdit} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputCls} placeholder="For small businesses..." />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Price *</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className={inputCls} placeholder="29.99" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                <input value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Billing Cycle</label>
                <select value={form.billing_cycle} onChange={e => setForm(p => ({ ...p, billing_cycle: e.target.value }))} className={inputCls}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Trial Days</label>
                <input type="number" min="0" value={form.trial_days} onChange={e => setForm(p => ({ ...p, trial_days: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-zinc-300 cursor-pointer select-none">Active</label>
              </div>
            </div>
          </div>

          {/* Entitlements */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-100">Features & Limits</h3>
            <p className="text-xs text-zinc-500">Enable features and optionally set usage limits. Leave limit blank for unlimited.</p>

            <div className="space-y-2">
              {entitlements.map((e, i) => (
                <div key={e.feature_code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={e.enabled}
                    onChange={ev => setEntitlements(prev => prev.map((r, j) => j === i ? { ...r, enabled: ev.target.checked } : r))}
                    className="rounded flex-shrink-0"
                  />
                  <span className="text-sm text-zinc-300 w-32 flex-shrink-0 capitalize">{e.feature_code.replace(/_/g, ' ')}</span>
                  <input
                    type="number"
                    value={e.limit_value}
                    onChange={ev => setEntitlements(prev => prev.map((r, j) => j === i ? { ...r, limit_value: ev.target.value } : r))}
                    placeholder="unlimited"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                  {!KNOWN_FEATURES.includes(e.feature_code) && (
                    <button onClick={() => removeEntitlement(e.feature_code)} className="text-zinc-600 hover:text-red-400 flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                value={customFeature}
                onChange={e => setCustomFeature(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomFeature()}
                placeholder="Add custom feature code…"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <Btn variant="secondary" size="sm" onClick={addCustomFeature}>Add</Btn>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Btn variant="secondary" size="sm" onClick={() => navigate('/super-admin/plans')}>Cancel</Btn>
            <Btn onClick={handleSubmit} disabled={isPending || !form.name || !form.code || !form.price}>
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
