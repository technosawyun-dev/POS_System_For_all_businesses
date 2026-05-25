import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { tenantService } from '@/services/tenant/tenant.service'
import { Btn, Spinner } from '@/components/ui'
import { extractApiMsg } from '@/lib/utils'

const schema = z.object({
  tax_enabled:    z.boolean(),
  tax_rate:       z.string().refine(v => !v || (parseFloat(v) >= 0 && parseFloat(v) <= 100), 'Must be 0–100'),
  tax_inclusive:  z.boolean(),
  tax_name:       z.string().max(50),
})
type FormValues = z.infer<typeof schema>

function inputCls(err = false) {
  return `w-full bg-zinc-950 border rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all py-2.5 px-3 ${err ? 'border-red-500' : 'border-zinc-700 focus:border-amber-500'}`
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-amber-500' : 'bg-zinc-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function TaxSettingsPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const tenantId = user?.tenant_id

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => tenantService.getTenantSettings(tenantId!),
    enabled: !!tenantId,
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty, isSubmitting, errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tax_enabled: false, tax_rate: '', tax_inclusive: false, tax_name: 'Tax' },
  })

  useEffect(() => {
    if (settings) {
      const ex = settings.extra_settings as Record<string, unknown>
      reset({
        tax_enabled:   settings.tax_rate != null && settings.tax_rate > 0,
        tax_rate:      settings.tax_rate != null ? String(settings.tax_rate) : '',
        tax_inclusive: settings.tax_inclusive,
        tax_name:      (ex.tax_name as string) ?? 'Tax',
      })
    }
  }, [settings, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      tenantService.updateTenantSettings(tenantId!, {
        tax_rate:      values.tax_enabled && values.tax_rate ? parseFloat(values.tax_rate) : 0,
        tax_inclusive: values.tax_inclusive,
        extra_settings: { tax_name: values.tax_name || 'Tax' },
      }),
    onSuccess: () => {
      toast.success('Tax settings saved')
      qc.invalidateQueries({ queryKey: ['tenant-settings', tenantId] })
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to save'),
  })

  const taxEnabled  = watch('tax_enabled')
  const taxRate     = watch('tax_rate')
  const taxName     = watch('tax_name') || 'Tax'
  const taxInclusive = watch('tax_inclusive')

  if (!tenantId) return null
  if (isLoading) return <div className="flex items-center justify-center h-40"><Spinner size={28} /></div>

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="max-w-lg space-y-5">

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-100">Enable Tax</p>
              <p className="text-xs text-zinc-500 mt-0.5">Apply tax to all sales transactions</p>
            </div>
            <Toggle checked={taxEnabled} onChange={v => setValue('tax_enabled', v, { shouldDirty: true })} />
          </div>

          {taxEnabled && (
            <>
              <div className="border-t border-zinc-800 pt-4 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tax Name</label>
                  <input
                    {...register('tax_name')}
                    placeholder="e.g. GST, VAT, Sales Tax"
                    className={inputCls()}
                  />
                  <p className="text-xs text-zinc-600">Label shown on receipts and invoices.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tax Rate (%)</label>
                  <div className="relative">
                    <input
                      {...register('tax_rate')}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 5"
                      className={`${inputCls(!!errors.tax_rate)} pr-8`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                  </div>
                  {errors.tax_rate && <p className="text-xs text-red-400">{errors.tax_rate.message}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Tax Inclusive Pricing</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Prices already include tax (e.g. $10.00 includes 10% tax)</p>
                  </div>
                  <Toggle checked={taxInclusive} onChange={v => setValue('tax_inclusive', v, { shouldDirty: true })} />
                </div>
              </div>

              {taxRate && (
                <div className="bg-zinc-800/50 rounded-xl p-3 text-xs space-y-1">
                  <p className="text-zinc-400 font-medium">Example</p>
                  <p className="text-zinc-300">
                    Item price: $100.00 →{' '}
                    {taxInclusive
                      ? `${taxName} included: $${(100 * parseFloat(taxRate) / (100 + parseFloat(taxRate))).toFixed(2)}`
                      : `+ ${taxName} ${taxRate}%: $${(100 * parseFloat(taxRate) / 100).toFixed(2)} = $${(100 + 100 * parseFloat(taxRate) / 100).toFixed(2)} total`
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <Btn type="submit" disabled={!isDirty || isSubmitting || mutation.isPending}>
          {mutation.isPending ? <Spinner size={16} /> : 'Save Tax Settings'}
        </Btn>
      </form>
    </div>
  )
}
