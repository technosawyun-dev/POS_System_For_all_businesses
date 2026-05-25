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
  receipt_header: z.string().max(200),
  receipt_footer: z.string().max(200),
  show_tax_on_receipt: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function inputCls() {
  return 'w-full bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 focus:border-amber-500 transition-all py-2.5 px-3'
}

export default function ReceiptSettingsPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const tenantId = user?.tenant_id

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => tenantService.getTenantSettings(tenantId!),
    enabled: !!tenantId,
  })

  const { register, handleSubmit, reset, watch, formState: { isDirty, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { receipt_header: '', receipt_footer: '', show_tax_on_receipt: true },
  })

  useEffect(() => {
    if (settings) {
      const ex = settings.extra_settings as Record<string, unknown>
      reset({
        receipt_header:     (ex.receipt_header as string)  ?? '',
        receipt_footer:     (ex.receipt_footer as string)  ?? '',
        show_tax_on_receipt: (ex.show_tax_on_receipt as boolean) ?? true,
      })
    }
  }, [settings, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      tenantService.updateTenantSettings(tenantId!, {
        extra_settings: {
          receipt_header:     values.receipt_header || null,
          receipt_footer:     values.receipt_footer || null,
          show_tax_on_receipt: values.show_tax_on_receipt,
        },
      }),
    onSuccess: () => {
      toast.success('Receipt settings saved')
      qc.invalidateQueries({ queryKey: ['tenant-settings', tenantId] })
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to save'),
  })

  const showTax = watch('show_tax_on_receipt')

  if (!tenantId) return null
  if (isLoading) return <div className="flex items-center justify-center h-40"><Spinner size={28} /></div>

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="max-w-lg space-y-5">

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">Receipt Content</h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Header Text</label>
            <input
              {...register('receipt_header')}
              placeholder="e.g. Welcome to NexusPOS!"
              className={inputCls()}
            />
            <p className="text-xs text-zinc-600">Shown at the top of every printed receipt.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Footer Text</label>
            <textarea
              {...register('receipt_footer')}
              rows={2}
              placeholder="e.g. Thank you for shopping with us!"
              className={`${inputCls()} resize-none`}
            />
            <p className="text-xs text-zinc-600">Shown at the bottom of every printed receipt.</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-100">Show Tax on Receipt</p>
              <p className="text-xs text-zinc-500 mt-0.5">Print the tax line on customer receipts</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('show-tax-toggle') as HTMLInputElement
                el.click()
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showTax ? 'bg-amber-500' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showTax ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <input id="show-tax-toggle" type="checkbox" {...register('show_tax_on_receipt')} className="sr-only" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-zinc-100">Preview</h3>
          <div className="bg-white rounded-lg p-3 font-mono text-xs text-zinc-900 space-y-1 text-center">
            {watch('receipt_header') && <p className="font-bold">{watch('receipt_header')}</p>}
            <p className="text-zinc-400 text-[10px]">─────────────────</p>
            <p>Item 1 .............. $10.00</p>
            <p>Item 2 ............... $5.00</p>
            {showTax && <p>Tax (5%) ............. $0.75</p>}
            <p className="font-bold">Total ............... $15.75</p>
            <p className="text-zinc-400 text-[10px]">─────────────────</p>
            {watch('receipt_footer') && <p className="text-zinc-600">{watch('receipt_footer')}</p>}
          </div>
        </div>

        <Btn type="submit" disabled={!isDirty || isSubmitting || mutation.isPending}>
          {mutation.isPending ? <Spinner size={16} /> : 'Save Receipt Settings'}
        </Btn>
      </form>
    </div>
  )
}
