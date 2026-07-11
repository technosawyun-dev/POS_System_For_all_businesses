import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { useLocaleStore } from '@/i18n/localeStore'
import { tenantService } from '@/services/tenant/tenant.service'
import { Btn, Spinner } from '@/components/ui'
import { extractApiMsg } from '@/lib/utils'

const schema = z.object({
  auto_print_receipt:      z.boolean(),
  default_payment_method:  z.string(),
})
type FormValues = z.infer<typeof schema>

function inputCls() {
  return 'w-full bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 focus:border-amber-500 transition-all py-2.5 px-3'
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${checked ? 'bg-amber-500' : 'bg-zinc-700'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

export default function PreferencesSettingsPage() {
  const user = useAuthStore(s => s.user)
  const t = useLocaleStore(s => s.t)
  const qc = useQueryClient()
  const tenantId = user?.tenant_id

  const PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: 'CASH', label: t('settings.preferences.payment_cash') },
    { value: 'CARD', label: t('settings.preferences.payment_card') },
  ]

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => tenantService.getTenantSettings(tenantId!),
    enabled: !!tenantId,
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      auto_print_receipt:     false,
      default_payment_method: 'CASH',
    },
  })

  useEffect(() => {
    if (settings) {
      const ex = settings.extra_settings as Record<string, unknown>
      reset({
        auto_print_receipt:     (ex.auto_print_receipt as boolean)    ?? false,
        default_payment_method: (ex.default_payment_method as string) ?? 'CASH',
      })
    }
  }, [settings, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      tenantService.updateTenantSettings(tenantId!, {
        extra_settings: {
          auto_print_receipt:     values.auto_print_receipt,
          default_payment_method: values.default_payment_method,
        },
      }),
    onSuccess: () => {
      toast.success(t('settings.preferences.save_success'))
      qc.invalidateQueries({ queryKey: ['tenant-settings', tenantId] })
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? t('settings.preferences.save_error')),
  })

  if (!tenantId) return null
  if (isLoading) return <div className="flex items-center justify-center h-40"><Spinner size={28} /></div>

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="max-w-lg space-y-5">

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4 divide-y divide-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100 pb-2">{t('settings.preferences.pos_behaviour')}</h3>
          <div className="pt-3">
            <Toggle
              checked={watch('auto_print_receipt')}
              onChange={v => setValue('auto_print_receipt', v, { shouldDirty: true })}
              label={t('settings.preferences.auto_print_label')}
              description={t('settings.preferences.auto_print_desc')}
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">{t('settings.preferences.defaults')}</h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.preferences.default_payment_method')}</label>
            <select {...register('default_payment_method')} className={inputCls()}>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-600">{t('settings.preferences.default_payment_desc')}</p>
          </div>
        </div>

        <Btn type="submit" disabled={!isDirty || isSubmitting || mutation.isPending}>
          {mutation.isPending ? <Spinner size={16} /> : t('settings.preferences.save_btn')}
        </Btn>
      </form>
    </div>
  )
}
