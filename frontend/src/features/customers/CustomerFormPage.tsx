import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Btn, Spinner, SectionHeader } from '@/components/ui'
import { customersService } from '@/services/customers/customers.service'
import type { ReactNode } from 'react'

const schema = z.object({
  name:      z.string().min(1, 'Name is required'),
  phone:     z.string().min(6, 'Phone must be at least 6 characters'),
  email:     z.string().email('Invalid email address').or(z.literal('')).optional(),
  address:   z.string(),
  notes:     z.string(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export default function CustomerFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.get(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', phone: '', email: '', address: '', notes: '', is_active: true,
    },
  })

  useEffect(() => {
    if (existing) {
      reset({
        name:      existing.name,
        phone:     existing.phone,
        email:     existing.email ?? '',
        address:   existing.address ?? '',
        notes:     existing.notes ?? '',
        is_active: existing.is_active,
      })
    }
  }, [existing, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => customersService.create({
      name:    data.name,
      phone:   data.phone,
      email:   data.email || undefined,
      address: data.address || undefined,
      notes:   data.notes || undefined,
    }),
    onSuccess: (customer) => {
      toast.success('Customer created')
      qc.invalidateQueries({ queryKey: ['customers'] })
      navigate(`/app/customers/${customer.id}`)
    },
    onError: () => toast.error('Failed to create customer'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => customersService.update(id!, {
      name:      data.name,
      phone:     data.phone,
      email:     data.email || undefined,
      address:   data.address || undefined,
      notes:     data.notes || undefined,
      is_active: data.is_active,
    }),
    onSuccess: () => {
      toast.success('Customer updated')
      qc.invalidateQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      navigate(`/app/customers/${id}`)
    },
    onError: () => toast.error('Failed to update customer'),
  })

  function onSubmit(data: FormValues) {
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending

  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title={isEdit ? 'Edit Customer' : 'New Customer'}
        subtitle={isEdit ? existing?.name : 'Add a new customer to your records'}
      />

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">
          <FormField label="Full Name" error={errors.name?.message} required>
            <input
              {...register('name')}
              placeholder="Customer full name"
              className={inputCls(!!errors.name)}
            />
          </FormField>

          <FormField label="Phone" error={errors.phone?.message} required>
            <input
              {...register('phone')}
              placeholder="+1 555 000 0000"
              className={inputCls(!!errors.phone)}
            />
          </FormField>

          <FormField label="Email" error={errors.email?.message}>
            <input
              {...register('email')}
              type="email"
              placeholder="customer@example.com"
              className={inputCls(!!errors.email)}
            />
          </FormField>

          <FormField label="Address">
            <textarea
              {...register('address')}
              placeholder="Street address, city…"
              rows={2}
              className={cn(inputCls(false), 'resize-none')}
            />
          </FormField>

          <FormField label="Internal Notes">
            <textarea
              {...register('notes')}
              placeholder="Notes about this customer…"
              rows={3}
              className={cn(inputCls(false), 'resize-none')}
            />
          </FormField>

          {isEdit && (
            <div className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                id="is_active"
                {...register('is_active')}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <label htmlFor="is_active" className="text-sm text-zinc-300 cursor-pointer">
                Active customer
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Btn
              type="button"
              variant="secondary"
              onClick={() => navigate(isEdit ? `/app/customers/${id}` : '/app/customers')}
            >
              Cancel
            </Btn>
            <Btn type="submit" disabled={pending} fullWidth>
              {pending ? <Spinner size={16} /> : isEdit ? 'Save Changes' : 'Create Customer'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function inputCls(err: boolean) {
  return cn(
    'w-full bg-zinc-900 border rounded-xl text-zinc-100 placeholder-zinc-600 text-sm',
    'focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all duration-150 py-2.5 px-3',
    err ? 'border-red-500 focus:border-red-500' : 'border-zinc-700 focus:border-amber-500',
  )
}

function FormField({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
