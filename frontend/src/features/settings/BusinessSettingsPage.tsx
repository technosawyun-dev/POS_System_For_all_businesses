import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiMsg } from '@/lib/utils'
import { Btn, Spinner } from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'
import { useLocaleStore } from '@/i18n/localeStore'
import { usePreferencesStore } from '@/store/preferences.store'
import { tenantService } from '@/services/tenant/tenant.service'
import type { TenantUpdateRequest } from '@/shared/types'
import { TIMEZONES, CURRENCIES } from '@/shared/constants/localization'

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English' },
  { value: 'my-MM', label: 'မြန်မာဘာသာ' },
]

export default function BusinessSettingsPage() {
  const user = useAuthStore(s => s.user)
  const t = useLocaleStore(s => s.t)
  const { timeFormat, setTimeFormat } = usePreferencesStore()
  const qc = useQueryClient()
  const tenantId = user?.tenant_id
  const canEdit = user?.role === 'BUSINESS_OWNER' || user?.role === 'SUPER_ADMIN'

  const [form, setForm] = useState<TenantUpdateRequest>({})
  const [isEditing, setIsEditing] = useState(false)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenant(tenantId!),
    enabled: !!tenantId,
  })

  function resetFormFromTenant() {
    if (!tenant) return
    setForm({
      name:     tenant.name,
      email:    tenant.email ?? '',
      phone:    tenant.phone ?? '',
      address:  tenant.address ?? '',
      country:  tenant.country ?? '',
      city:     tenant.city ?? '',
      timezone: tenant.timezone,
      currency: tenant.currency,
      locale:   tenant.locale,
    })
  }

  useEffect(() => {
    resetFormFromTenant()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  const mutation = useMutation({
    mutationFn: (payload: TenantUpdateRequest) => tenantService.updateTenant(tenantId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] })
      toast.success(t('settings.business_settings_saved'))
      setIsEditing(false)
    },
    onError: err => toast.error(extractApiMsg(err) ?? t('settings.save_failed')),
  })

  function handleSave() {
    // Email/phone are never editable through this form — never send them,
    // regardless of what's sitting in local state, so a stale/tampered value
    // can't silently overwrite the business's contact info.
    const { email: _email, phone: _phone, ...payload } = form
    mutation.mutate(payload)
  }

  function handleCancel() {
    resetFormFromTenant()
    setIsEditing(false)
  }

  function set(field: keyof TenantUpdateRequest) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  // Editable fields are locked until "Edit" is clicked; email/phone stay
  // permanently locked (see settings.email_locked_hint below).
  const fieldsDisabled = !canEdit || !isEditing

  const inputCls = (disabled: boolean) =>
    `w-full bg-zinc-800 border ${disabled ? 'border-zinc-800 text-zinc-500 cursor-not-allowed' : 'border-zinc-700 text-zinc-100'} rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500`

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-sm">{t('settings.no_tenant')}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl space-y-6">
        {/* Business Information */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">{t('settings.business_info')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.business_name')}</label>
              <input disabled={fieldsDisabled} value={form.name ?? ''} onChange={set('name')} className={inputCls(fieldsDisabled)} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {t('settings.email')} <span className="text-zinc-600">· {t('settings.email_locked_hint')}</span>
              </label>
              <input type="email" disabled value={form.email ?? ''} className={inputCls(true)} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {t('settings.phone')} <span className="text-zinc-600">· {t('settings.phone_locked_hint')}</span>
              </label>
              <input type="tel" inputMode="tel" autoComplete="tel" disabled value={form.phone ?? ''} className={inputCls(true)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.address')}</label>
              <textarea
                disabled={fieldsDisabled}
                value={form.address ?? ''}
                onChange={set('address')}
                rows={2}
                className={inputCls(fieldsDisabled) + ' resize-none'}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.city')}</label>
              <input disabled={fieldsDisabled} value={form.city ?? ''} onChange={set('city')} className={inputCls(fieldsDisabled)} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.country')}</label>
              <input disabled={fieldsDisabled} value={form.country ?? ''} onChange={set('country')} className={inputCls(fieldsDisabled)} />
            </div>
          </div>
        </div>

        {/* Language & Currency */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">{t('settings.lang_currency')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.timezone')}</label>
              <select disabled={fieldsDisabled} value={form.timezone ?? ''} onChange={set('timezone')} className={inputCls(fieldsDisabled)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.currency')}</label>
              <select disabled={fieldsDisabled} value={form.currency ?? ''} onChange={set('currency')} className={inputCls(fieldsDisabled)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c === 'MMK' ? `${t('currency.mmk')} (MMK)` : c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.language')}</label>
              <select disabled={fieldsDisabled} value={form.locale ?? ''} onChange={set('locale')} className={inputCls(fieldsDisabled)}>
                {LANGUAGE_OPTIONS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">{t('settings.time_format')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTimeFormat('12h')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    timeFormat === '12h'
                      ? 'bg-amber-500 border-amber-400 text-black'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {t('settings.time_12h')}
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFormat('24h')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    timeFormat === '24h'
                      ? 'bg-amber-500 border-amber-400 text-black'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {t('settings.time_24h')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Login Code */}
        {tenant?.business_code && (
          <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">{t('settings.staff_code')}</h3>
                <p className="text-xs text-zinc-500">{t('settings.staff_code_desc')}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tenant.business_code!)
                  import('sonner').then(m => m.toast.success(t('settings.business_code_copied')))
                }}
                className="text-xs text-amber-400 hover:text-amber-300 flex-shrink-0 border border-amber-500/30 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/10 transition-colors"
              >
                {t('common.copy')}
              </button>
            </div>
            <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-amber-400 tracking-[0.25em]">
                {tenant.business_code}
              </span>
              <span className="text-xs text-zinc-600">{t('settings.staff_code_chars')}</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-2">{t('settings.staff_code_hint')}</p>
          </div>
        )}

        {/* Account Info (read-only) */}
        {tenant && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">{t('settings.account_info')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">{t('settings.slug')}</p>
                <p className="text-zinc-300 font-mono text-xs">{tenant.slug}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">{t('settings.status')}</p>
                <p className="text-zinc-300">{tenant.status}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">{t('settings.plan')}</p>
                <p className="text-zinc-300">{tenant.subscription_plan}</p>
              </div>
            </div>
          </div>
        )}

        {canEdit && !isEditing && (
          <div className="flex justify-end">
            <Btn onClick={() => setIsEditing(true)}>{t('common.edit')}</Btn>
          </div>
        )}

        {canEdit && isEditing && (
          <div className="flex justify-end gap-3">
            <Btn variant="secondary" onClick={handleCancel} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Btn>
            <Btn onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? t('settings.saving') : t('settings.save_changes')}
            </Btn>
          </div>
        )}

        {!canEdit && (
          <p className="text-xs text-zinc-600 text-center">{t('common.read_only')}</p>
        )}
      </div>
    </div>
  )
}
