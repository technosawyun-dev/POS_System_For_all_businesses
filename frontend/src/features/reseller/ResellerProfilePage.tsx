import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn, extractApiMsg, fmtDate } from '@/lib/utils'
import { newPasswordZodSchema, PASSWORDS_DO_NOT_MATCH_MESSAGE } from '@/lib/validation/password'
import { Badge, Btn, Divider, PasswordInput, Spinner } from '@/components/ui'
import { ROLE_BADGE_STYLES } from '@/shared/constants/rbac'
import { usersService } from '@/services/users/users.service'
import { authService } from '@/services/auth/auth.service'
import { useAuthStore } from '@/store/auth.store'

function inputCls(err = false) {
  return cn(
    'w-full bg-zinc-950 border rounded-xl text-zinc-100 placeholder-zinc-600 text-sm',
    'focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all py-2.5 px-3',
    err ? 'border-red-500' : 'border-zinc-700 focus:border-amber-500',
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

const profileSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name:  z.string().min(1, 'Required'),
  phone:      z.string().optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: newPasswordZodSchema,
  confirm_password: z.string().min(1, 'Required'),
}).refine(d => d.new_password === d.confirm_password, {
  message: PASSWORDS_DO_NOT_MATCH_MESSAGE,
  path: ['confirm_password'],
})
type PasswordForm = z.infer<typeof passwordSchema>

const emailSchema = z.object({
  new_email: z.string().min(1, 'Required').email('Enter a valid email address'),
  current_password: z.string().min(1, 'Required'),
})
type EmailForm = z.infer<typeof emailSchema>

export default function ResellerProfilePage() {
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const [showEmail, setShowEmail] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name:  user?.last_name  ?? '',
      phone:      user?.phone      ?? '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { new_email: '', current_password: '' },
  })

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => usersService.update(user!.id, data),
    onSuccess: () => {
      toast.success('Profile updated')
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to update profile'),
  })

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      authService.changePassword({ current_password: data.current_password, new_password: data.new_password }),
    onSuccess: () => {
      toast.success('Password changed successfully')
      passwordForm.reset()
      setShowPassword(false)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to change password'),
  })

  const emailMutation = useMutation({
    mutationFn: (data: EmailForm) => authService.requestEmailChange(data.new_email, data.current_password),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Check your new email for a confirmation link.')
      emailForm.reset()
      setShowEmail(false)
    },
    onError: err => toast.error(extractApiMsg(err) ?? 'Failed to request email change'),
  })

  if (!user) return null

  const roleStyle = ROLE_BADGE_STYLES[user.role]

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-2xl space-y-6">

      {/* Identity card */}
      <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold border flex-shrink-0"
          style={{ background: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
        >
          {user.first_name[0]}{user.last_name[0]}
        </div>
        <div>
          <p className="text-zinc-100 font-semibold text-base leading-tight">{user.full_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-zinc-500 text-xs">{user.email}</p>
            {user.email_verified_at ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400">
                ✓ Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400">
                ✗ Email Unverified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="orange" size="xs">Reseller</Badge>
            {user.last_login_at && (
              <span className="text-zinc-600 text-[11px]">Last login {fmtDate(user.last_login_at)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Edit Profile</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Update your name and phone number</p>
        </div>
        <form
          onSubmit={profileForm.handleSubmit(d => profileMutation.mutate(d))}
          className="p-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name" error={profileForm.formState.errors.first_name?.message}>
              <input
                {...profileForm.register('first_name')}
                className={inputCls(!!profileForm.formState.errors.first_name)}
              />
            </FormField>
            <FormField label="Last Name" error={profileForm.formState.errors.last_name?.message}>
              <input
                {...profileForm.register('last_name')}
                className={inputCls(!!profileForm.formState.errors.last_name)}
              />
            </FormField>
          </div>
          <FormField label="Phone" error={profileForm.formState.errors.phone?.message}>
            <input
              {...profileForm.register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. +95 9 123 456 789"
              className={inputCls(!!profileForm.formState.errors.phone)}
            />
          </FormField>
          <div className="flex justify-end pt-1">
            <Btn type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? <><Spinner size={14} /> Saving…</> : 'Save Changes'}
            </Btn>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 text-left hover:bg-zinc-800/40 transition-colors"
          onClick={() => setShowPassword(p => !p)}
        >
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Change Password</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Update your login password</p>
          </div>
          <span className="text-zinc-500 text-sm">{showPassword ? '▲' : '▼'}</span>
        </button>

        {showPassword && (
          <form
            onSubmit={passwordForm.handleSubmit(d => passwordMutation.mutate(d))}
            className="p-5 space-y-4"
          >
            <FormField label="Current Password" error={passwordForm.formState.errors.current_password?.message}>
              <PasswordInput
                {...passwordForm.register('current_password')}
                placeholder="Enter current password"
                inputClassName={inputCls(!!passwordForm.formState.errors.current_password)}
              />
            </FormField>
            <Divider />
            <FormField label="New Password" error={passwordForm.formState.errors.new_password?.message}>
              <PasswordInput
                {...passwordForm.register('new_password')}
                placeholder="Min 8 chars, upper, lower, digit"
                inputClassName={inputCls(!!passwordForm.formState.errors.new_password)}
              />
            </FormField>
            <FormField label="Confirm New Password" error={passwordForm.formState.errors.confirm_password?.message}>
              <PasswordInput
                {...passwordForm.register('confirm_password')}
                placeholder="Repeat new password"
                inputClassName={inputCls(!!passwordForm.formState.errors.confirm_password)}
              />
            </FormField>
            <div className="flex gap-3 justify-end pt-1">
              <Btn type="button" variant="secondary" onClick={() => { setShowPassword(false); passwordForm.reset() }}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? <><Spinner size={14} /> Changing…</> : 'Change Password'}
              </Btn>
            </div>
          </form>
        )}
      </div>

      {/* Change Email */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 text-left hover:bg-zinc-800/40 transition-colors"
          onClick={() => setShowEmail(p => !p)}
        >
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Change Email</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Update the email address used to sign in</p>
          </div>
          <span className="text-zinc-500 text-sm">{showEmail ? '▲' : '▼'}</span>
        </button>

        {showEmail && (
          <form
            onSubmit={emailForm.handleSubmit(d => emailMutation.mutate(d))}
            className="p-5 space-y-4"
          >
            <p className="text-xs text-zinc-500 -mt-1">
              We'll send a confirmation link to the new address — your email won't change until
              you click it. Current: <span className="text-zinc-300">{user.email}</span>
            </p>
            <FormField label="New Email" error={emailForm.formState.errors.new_email?.message}>
              <input
                {...emailForm.register('new_email')}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={inputCls(!!emailForm.formState.errors.new_email)}
              />
            </FormField>
            <Divider />
            <FormField label="Current Password" error={emailForm.formState.errors.current_password?.message}>
              <PasswordInput
                {...emailForm.register('current_password')}
                placeholder="Confirm it's you"
                inputClassName={inputCls(!!emailForm.formState.errors.current_password)}
              />
            </FormField>
            <div className="flex gap-3 justify-end pt-1">
              <Btn type="button" variant="secondary" onClick={() => { setShowEmail(false); emailForm.reset() }}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={emailMutation.isPending}>
                {emailMutation.isPending ? <><Spinner size={14} /> Sending…</> : 'Send Confirmation'}
              </Btn>
            </div>
          </form>
        )}
      </div>

    </div>
  )
}
