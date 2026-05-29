import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Btn, Spinner, SectionHeader } from '@/components/ui'
import { procurementService } from '@/services/procurement/procurement.service'
import { extractApiMsg } from '@/lib/utils'
import { inputCls, FormField } from './procurementHelpers'

const schema = z.object({
  name:    z.string().min(1, 'Name is required'),
  email:   z.string().email('Invalid email').or(z.literal('')),
  phone:   z.string(),
  address: z.string(),
  city:    z.string(),
  country: z.string(),
  website: z.string(),
  notes:   z.string(),
})

type FormValues = z.infer<typeof schema>

export default function SupplierFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => procurementService.getSupplier(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', address: '', city: '', country: '', website: '', notes: '' },
  })

  useEffect(() => {
    if (existing) {
      reset({
        name:    existing.name,
        email:   existing.email ?? '',
        phone:   existing.phone ?? '',
        address: existing.address ?? '',
        city:    existing.city ?? '',
        country: existing.country ?? '',
        website: existing.website ?? '',
        notes:   existing.notes ?? '',
      })
    }
  }, [existing, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => procurementService.createSupplier({
      name:    data.name,
      email:   data.email || undefined,
      phone:   data.phone || undefined,
      address: data.address || undefined,
      city:    data.city || undefined,
      country: data.country || undefined,
      website: data.website || undefined,
      notes:   data.notes || undefined,
    }),
    onSuccess: (supplier) => {
      toast.success('Supplier created')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      navigate(`/app/procurement/suppliers/${supplier.id}`)
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to create supplier'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => procurementService.updateSupplier(id!, {
      name:    data.name,
      email:   data.email || null,
      phone:   data.phone || null,
      address: data.address || null,
      city:    data.city || null,
      country: data.country || null,
      website: data.website || null,
      notes:   data.notes || null,
    }),
    onSuccess: () => {
      toast.success('Supplier updated')
      qc.invalidateQueries({ queryKey: ['supplier', id] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      navigate(`/app/procurement/suppliers/${id}`)
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to update supplier'),
  })

  function onSubmit(data: FormValues) {
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending

  if (isEdit && loadingExisting) {
    return <div className="flex items-center justify-center h-40"><Spinner size={32} /></div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title={isEdit ? 'Edit Supplier' : 'New Supplier'}
        subtitle={isEdit ? existing?.name : 'Add a supplier to your procurement network'}
      />

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">
          <FormField label="Supplier Name" error={errors.name?.message} required>
            <input {...register('name')} placeholder="Acme Corp" className={inputCls(!!errors.name)} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} placeholder="+1 555 000 0000" className={inputCls(!!errors.phone)} />
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              <input {...register('email')} type="email" placeholder="contact@supplier.com" className={inputCls(!!errors.email)} />
            </FormField>
          </div>

          <FormField label="Address">
            <textarea {...register('address')} placeholder="Street address" rows={2} className={`${inputCls(false)} resize-none`} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="City">
              <input {...register('city')} placeholder="City" className={inputCls(false)} />
            </FormField>
            <FormField label="Country">
              <input {...register('country')} placeholder="Country" className={inputCls(false)} />
            </FormField>
          </div>

          <FormField label="Website">
            <input {...register('website')} placeholder="https://supplier.com" className={inputCls(false)} />
          </FormField>

          <FormField label="Notes">
            <textarea {...register('notes')} placeholder="Internal notes…" rows={3} className={`${inputCls(false)} resize-none`} />
          </FormField>

          <div className="flex gap-3 pt-2">
            <Btn
              type="button"
              variant="secondary"
              onClick={() => navigate(isEdit ? `/app/procurement/suppliers/${id}` : '/app/procurement/suppliers')}
            >
              Cancel
            </Btn>
            <Btn type="submit" disabled={pending} fullWidth>
              {pending ? <Spinner size={16} /> : isEdit ? 'Save Changes' : 'Create Supplier'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
