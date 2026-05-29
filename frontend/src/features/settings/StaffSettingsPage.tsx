import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn, extractApiMsg, fmtDateTime } from '@/lib/utils'
import { Btn, Badge, Table, Th, Td, Spinner, Divider, PasswordInput } from '@/components/ui'
import { usersService } from '@/services/users/users.service'
import { tenantService } from '@/services/tenant/tenant.service'
import { useAuthStore } from '@/store/auth.store'
import type { User, UserRole } from '@/shared/types'

const STAFF_ROLES: UserRole[] = ['MANAGER', 'CASHIER', 'INVENTORY_STAFF']
const ROLE_LABELS: Record<string, string> = {
  MANAGER:         'Manager',
  CASHIER:         'Cashier',
  INVENTORY_STAFF: 'Inventory Staff',
}

function inputCls(err = false) {
  return cn(
    'w-full bg-zinc-950 border rounded-xl text-zinc-100 placeholder-zinc-600 text-sm',
    'focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all py-2.5 px-3',
    err ? 'border-red-500' : 'border-zinc-700 focus:border-amber-500',
  )
}

function FormField({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function statusVariant(status: string) {
  if (status === 'ACTIVE')    return 'success'
  if (status === 'SUSPENDED') return 'danger'
  return 'default'
}

// Create Staff Modal

const createSchema = z.object({
  first_name:        z.string().min(1, 'Required'),
  last_name:         z.string().min(1, 'Required'),
  email:             z.string().email('Invalid email').or(z.literal('')).optional(),
  password:          z.string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain a number'),
  confirm_password:  z.string().min(1, 'Required'),
  phone:             z.string().min(1, 'Phone number is required'),
  role:              z.enum(['MANAGER', 'CASHIER', 'INVENTORY_STAFF']),
  primary_branch_id: z.string().optional(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})
type CreateForm = z.infer<typeof createSchema>

function CreateStaffModal({ onClose, tenantId }: { onClose: () => void; tenantId: string }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'CASHIER' },
  })

  const { data: branchesData } = useQuery({
    queryKey: ['tenant', tenantId, 'branches'],
    queryFn: () => tenantService.getBranches(tenantId, { page_size: 100 }),
    enabled: !!tenantId,
    staleTime: 60_000,
  })
  const branches = (branchesData?.items ?? []).filter(b => b.status === 'ACTIVE')

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => {
      const email = data.email?.trim()
        || `${data.first_name.toLowerCase()}.${data.last_name.toLowerCase()}.${Date.now()}@staff.internal`
      return usersService.create({
        email,
        password:          data.password,
        first_name:        data.first_name,
        last_name:         data.last_name,
        phone:             data.phone.trim(),
        role:              data.role,
        primary_branch_id: data.primary_branch_id || undefined,
      })
    },
    onSuccess: (created) => {
      toast.success(
        `Account created. Staff logs in with Business Code + phone: ${created.phone ?? created.email}`,
        { duration: 10000 },
      )
      qc.invalidateQueries({ queryKey: ['staff-users'] })
      onClose()
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to create account'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">Add Staff Account</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name" error={errors.first_name?.message} required>
              <input {...register('first_name')} placeholder="John" className={inputCls(!!errors.first_name)} />
            </FormField>
            <FormField label="Last Name" error={errors.last_name?.message} required>
              <input {...register('last_name')} placeholder="Doe" className={inputCls(!!errors.last_name)} />
            </FormField>
          </div>
          <FormField label="Email" error={errors.email?.message}>
            <input {...register('email')} type="email" placeholder="Optional — auto-generated if blank" className={inputCls(!!errors.email)} />
          </FormField>
          <FormField label="Password" error={errors.password?.message} required>
            <PasswordInput {...register('password')} placeholder="Min 8 chars, upper, lower, digit" inputClassName={inputCls(!!errors.password)} />
          </FormField>
          <FormField label="Confirm Password" error={errors.confirm_password?.message} required>
            <PasswordInput {...register('confirm_password')} placeholder="Repeat password" inputClassName={inputCls(!!errors.confirm_password)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone" error={errors.phone?.message} required>
              <input {...register('phone')} placeholder="+1 234 567 8900" className={inputCls(!!errors.phone)} />
            </FormField>
            <FormField label="Role" required>
              <select {...register('role')} className={inputCls()}>
                {STAFF_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Assigned Branch">
            <select {...register('primary_branch_id')} className={inputCls()}>
              <option value="">— No branch assigned —</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </FormField>
          <div className="flex gap-3 pt-1">
            <Btn type="button" variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn type="submit" disabled={mutation.isPending} fullWidth>
              {mutation.isPending ? <Spinner size={16} /> : 'Create Account'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Staff Modal

const editSchema = z.object({
  first_name:        z.string().min(1, 'Required'),
  last_name:         z.string().min(1, 'Required'),
  phone:             z.string().optional(),
  role:              z.enum(['MANAGER', 'CASHIER', 'INVENTORY_STAFF']),
  primary_branch_id: z.string().optional(),
})
type EditForm = z.infer<typeof editSchema>

const resetPwSchema = z.object({
  new_password: z.string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain a number'),
  confirm_password: z.string().min(1, 'Required'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})
type ResetPwForm = z.infer<typeof resetPwSchema>

function EditStaffModal({ staff, isOwner, tenantId, onClose }: {
  staff: User
  isOwner: boolean
  tenantId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'profile' | 'password'>('profile')

  const { data: branchesData } = useQuery({
    queryKey: ['tenant', tenantId, 'branches'],
    queryFn: () => tenantService.getBranches(tenantId, { page_size: 100 }),
    enabled: !!tenantId,
    staleTime: 60_000,
  })
  const branches = (branchesData?.items ?? []).filter(b => b.status === 'ACTIVE')

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      first_name:        staff.first_name,
      last_name:         staff.last_name,
      phone:             staff.phone ?? '',
      role:              (STAFF_ROLES.includes(staff.role as UserRole) ? staff.role : 'CASHIER') as EditForm['role'],
      primary_branch_id: staff.primary_branch_id ?? '',
    },
  })

  const pwForm = useForm<ResetPwForm>({
    resolver: zodResolver(resetPwSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: EditForm) => {
      await usersService.update(staff.id, {
        first_name:        data.first_name,
        last_name:         data.last_name,
        phone:             data.phone || undefined,
        primary_branch_id: data.primary_branch_id || undefined,
      })
      if (data.role !== staff.role) {
        await usersService.updateRole(staff.id, data.role)
      }
    },
    onSuccess: () => {
      toast.success('Staff profile updated')
      qc.invalidateQueries({ queryKey: ['staff-users'] })
      onClose()
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to update'),
  })

  const resetPwMutation = useMutation({
    mutationFn: (data: ResetPwForm) => usersService.resetPassword(staff.id, data.new_password),
    onSuccess: () => {
      toast.success(`Password reset for ${staff.first_name} ${staff.last_name}`)
      pwForm.reset()
      onClose()
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to reset password'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Edit Staff</h2>
            <p className="text-xs text-zinc-500">{staff.full_name} · {ROLE_LABELS[staff.role] ?? staff.role}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">✕</button>
        </div>

        {/* Tabs */}
        {isOwner && (
          <div className="flex gap-1 px-5 pt-3">
            <button
              onClick={() => setTab('profile')}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', tab === 'profile' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800')}
            >
              Profile
            </button>
            <button
              onClick={() => setTab('password')}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', tab === 'password' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800')}
            >
              Reset Password
            </button>
          </div>
        )}

        {/* Profile tab */}
        {tab === 'profile' && (
          <form onSubmit={editForm.handleSubmit(d => updateMutation.mutate(d))} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name" error={editForm.formState.errors.first_name?.message} required>
                <input {...editForm.register('first_name')} className={inputCls(!!editForm.formState.errors.first_name)} />
              </FormField>
              <FormField label="Last Name" error={editForm.formState.errors.last_name?.message} required>
                <input {...editForm.register('last_name')} className={inputCls(!!editForm.formState.errors.last_name)} />
              </FormField>
            </div>
            <FormField label="Phone" error={editForm.formState.errors.phone?.message}>
              <input {...editForm.register('phone')} placeholder="+1 234 567 8900" className={inputCls(!!editForm.formState.errors.phone)} />
            </FormField>
            {isOwner && (
              <FormField label="Role" required>
                <select {...editForm.register('role')} className={inputCls()}>
                  {STAFF_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </FormField>
            )}
            {isOwner && (
              <FormField label="Assigned Branch">
                <select {...editForm.register('primary_branch_id')} className={inputCls()}>
                  <option value="">— No branch assigned —</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </FormField>
            )}
            <div className="flex gap-3 pt-1">
              <Btn type="button" variant="secondary" onClick={onClose}>Cancel</Btn>
              <Btn type="submit" disabled={updateMutation.isPending} fullWidth>
                {updateMutation.isPending ? <Spinner size={16} /> : 'Save Changes'}
              </Btn>
            </div>
          </form>
        )}

        {/* Reset Password tab (owner only) */}
        {tab === 'password' && isOwner && (
          <form onSubmit={pwForm.handleSubmit(d => resetPwMutation.mutate(d))} className="p-5 space-y-4">
            <div className="bg-amber-950/50 border border-amber-800/50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-400">
                You are resetting the password for <span className="font-semibold">{staff.full_name}</span>.
                They will need to use this new password to log in.
              </p>
            </div>
            <Divider />
            <FormField label="New Password" error={pwForm.formState.errors.new_password?.message} required>
              <PasswordInput
                {...pwForm.register('new_password')}
                placeholder="Min 8 chars, upper, lower, digit"
                inputClassName={inputCls(!!pwForm.formState.errors.new_password)}
              />
            </FormField>
            <FormField label="Confirm Password" error={pwForm.formState.errors.confirm_password?.message} required>
              <PasswordInput
                {...pwForm.register('confirm_password')}
                placeholder="Repeat new password"
                inputClassName={inputCls(!!pwForm.formState.errors.confirm_password)}
              />
            </FormField>
            <div className="flex gap-3 pt-1">
              <Btn type="button" variant="secondary" onClick={onClose}>Cancel</Btn>
              <Btn type="submit" variant="danger" disabled={resetPwMutation.isPending} fullWidth>
                {resetPwMutation.isPending ? <Spinner size={16} /> : 'Reset Password'}
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// Main Page

export default function StaffSettingsPage() {
  const user    = useAuthStore(s => s.user)
  const qc      = useQueryClient()
  const isOwner = user?.role === 'BUSINESS_OWNER' || user?.role === 'SUPER_ADMIN'
  const tenantId = user?.tenant_id ?? ''

  const [showCreate, setShowCreate] = useState(false)
  const [editingStaff, setEditingStaff] = useState<User | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => usersService.list({ page_size: 100 }),
  })

  const { data: branchesData } = useQuery({
    queryKey: ['tenant', tenantId, 'branches'],
    queryFn: () => tenantService.getBranches(tenantId, { page_size: 100 }),
    enabled: !!tenantId,
    staleTime: 60_000,
  })
  const branchMap = new Map(
    (branchesData?.items ?? []).map(b => [b.id, b.name]),
  )

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      usersService.updateStatus(userId, status),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['staff-users'] })
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to update'),
  })

  const staff = (data?.items ?? []).filter(
    (u: User) => STAFF_ROLES.includes(u.role as UserRole) && u.id !== user?.id,
  )

  return (
    <>
      <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Staff Accounts</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Manage cashiers, managers, and inventory staff</p>
          </div>
          {isOwner && <Btn size="sm" onClick={() => setShowCreate(true)}>+ Add Staff</Btn>}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-32"><Spinner size={24} /></div>
          ) : staff.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <span className="text-3xl">👥</span>
              <p className="text-zinc-400 text-sm">No staff accounts yet</p>
              <p className="text-zinc-600 text-xs">Add cashiers and managers to let them log in</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Branch</Th>
                  <Th>Status</Th>
                  <Th>Last Login</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {staff.map((u: User) => (
                  <tr key={u.id} className="hover:bg-zinc-800/40 transition-colors">
                    <Td>
                      <div>
                        <p className="text-sm text-zinc-100">{u.full_name}</p>
                        <p className="text-xs text-zinc-500">{u.email}</p>
                      </div>
                    </Td>
                    <Td>
                      <Badge size="xs" variant="default">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                    </Td>
                    <Td muted>
                      {u.primary_branch_id ? branchMap.get(u.primary_branch_id) ?? '—' : '—'}
                    </Td>
                    <Td>
                      <Badge size="xs" variant={statusVariant(u.status)}>{u.status}</Badge>
                    </Td>
                    <Td muted>{u.last_login_at ? fmtDateTime(u.last_login_at) : 'Never'}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Btn
                          size="xs"
                          variant="ghost"
                          onClick={() => setEditingStaff(u)}
                        >
                          Edit
                        </Btn>
                        {isOwner && (
                          u.status === 'ACTIVE' ? (
                            <Btn
                              size="xs"
                              variant="danger"
                              onClick={() => statusMutation.mutate({ userId: u.id, status: 'SUSPENDED' })}
                              disabled={statusMutation.isPending}
                            >
                              Deactivate
                            </Btn>
                          ) : (
                            <Btn
                              size="xs"
                              variant="secondary"
                              onClick={() => statusMutation.mutate({ userId: u.id, status: 'ACTIVE' })}
                              disabled={statusMutation.isPending}
                            >
                              Activate
                            </Btn>
                          )
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      {showCreate && <CreateStaffModal onClose={() => setShowCreate(false)} tenantId={tenantId} />}
      {editingStaff && (
        <EditStaffModal
          staff={editingStaff}
          isOwner={isOwner}
          tenantId={tenantId}
          onClose={() => setEditingStaff(null)}
        />
      )}
    </>
  )
}
