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

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Yangon', 'Asia/Bangkok',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
]

const CURRENCIES = ['MMK', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'SGD', 'INR', 'THB', 'AUD', 'CAD']

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'zh-CN', label: '中文 (简体)' },
  { value: 'th-TH', label: 'ภาษาไทย' },
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

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenant(tenantId!),
    enabled: !!tenantId,
  })

  useEffect(() => {
    if (tenant) {
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
  }, [tenant])

  const mutation = useMutation({
    mutationFn: (payload: TenantUpdateRequest) => tenantService.updateTenant(tenantId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] })
      toast.success('Business settings saved')
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to save'),
  })

  function set(field: keyof TenantUpdateRequest) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

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
              <input disabled={!canEdit} value={form.name ?? ''} onChange={set('name')} className={inputCls(!canEdit)} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.email')}</label>
              <input type="email" disabled={!canEdit} value={form.email ?? ''} onChange={set('email')} className={inputCls(!canEdit)} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.phone')}</label>
              <input disabled={!canEdit} value={form.phone ?? ''} onChange={set('phone')} className={inputCls(!canEdit)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.address')}</label>
              <textarea
                disabled={!canEdit}
                value={form.address ?? ''}
                onChange={set('address')}
                rows={2}
                className={inputCls(!canEdit) + ' resize-none'}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.city')}</label>
              <input disabled={!canEdit} value={form.city ?? ''} onChange={set('city')} className={inputCls(!canEdit)} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.country')}</label>
              <input disabled={!canEdit} value={form.country ?? ''} onChange={set('country')} className={inputCls(!canEdit)} />
            </div>
          </div>
        </div>

        {/* Language & Currency */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">{t('settings.lang_currency')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.timezone')}</label>
              <select disabled={!canEdit} value={form.timezone ?? ''} onChange={set('timezone')} className={inputCls(!canEdit)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.currency')}</label>
              <select disabled={!canEdit} value={form.currency ?? ''} onChange={set('currency')} className={inputCls(!canEdit)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c === 'MMK' ? `${t('currency.mmk')} (MMK)` : c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('settings.language')}</label>
              <select disabled={!canEdit} value={form.locale ?? ''} onChange={set('locale')} className={inputCls(!canEdit)}>
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
                  import('sonner').then(m => m.toast.success('Business code copied!'))
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

        {canEdit && (
          <div className="flex justify-end">
            <Btn onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
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
