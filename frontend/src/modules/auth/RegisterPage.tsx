import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { authService } from '@/services/auth/auth.service'
import { tokenStorage } from '@/app/lib/axios'
import { ROLE_HOME } from '@/shared/constants/rbac'
import { Btn, Input, Spinner, Divider } from '@/components/ui/index'
import { IconAlert } from '@/components/icons'

interface FormState {
  business_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  confirm_password: string
}

const INITIAL: FormState = {
  business_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const [form, setForm] = useState<FormState>(INITIAL)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setError(null)
    }
  }

  const canSubmit =
    form.business_name.trim().length >= 2 &&
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.email.includes('@') &&
    form.password.length >= 8 &&
    form.password === form.confirm_password &&
    !isLoading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const result = await authService.register({
        business_name: form.business_name.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      })
      tokenStorage.setTokens(result.access_token, result.refresh_token)
      const me = await authService.me()
      setUser(me)
      localStorage.setItem('nexuspos_onboarding_pending', '1')
      navigate('/onboarding', { replace: true })
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string }; detail?: string } }; message?: string }
      setError(
        e2.response?.data?.error?.message ??
        e2.response?.data?.detail ??
        e2.message ??
        'Registration failed. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-lg">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 shadow-2xl shadow-amber-900/50 mb-4">
          <span className="text-black font-black text-3xl">N</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">Start your free trial</h1>
        <p className="text-zinc-500 text-sm mt-1">14 days free · No credit card required</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        <form onSubmit={handleSubmit} noValidate>
          <Divider label="create your account" />

          <div className="space-y-3 mt-4">
            <Input
              label="Business Name"
              value={form.business_name}
              onChange={set('business_name')}
              placeholder="My Business Co."
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                value={form.first_name}
                onChange={set('first_name')}
                placeholder="John"
                required
              />
              <Input
                label="Last Name"
                value={form.last_name}
                onChange={set('last_name')}
                placeholder="Smith"
                required
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="john@mybusiness.com"
              autoComplete="email"
              required
            />

            <Input
              label="Phone (optional)"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+1 234 567 8900"
            />

            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Min 8 chars, uppercase, number"
              autoComplete="new-password"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={form.confirm_password}
              onChange={set('confirm_password')}
              placeholder="Repeat password"
              autoComplete="new-password"
              required
            />

            {form.password && form.confirm_password && form.password !== form.confirm_password && (
              <p className="text-red-400 text-xs">Passwords do not match</p>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 text-red-400 text-xs">
                <IconAlert width="14" height="14" className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Btn type="submit" variant="primary" size="xl" fullWidth disabled={!canSubmit} className="mt-1">
              {isLoading ? (
                <>
                  <Spinner size={18} />
                  Creating account…
                </>
              ) : (
                'Start Free Trial'
              )}
            </Btn>
          </div>
        </form>

        <p className="text-center text-zinc-600 text-xs mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-500 hover:text-amber-400">
            Sign in
          </Link>
        </p>
      </div>

      <p className="text-center text-zinc-600 text-[11px] mt-4">
        By registering, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
