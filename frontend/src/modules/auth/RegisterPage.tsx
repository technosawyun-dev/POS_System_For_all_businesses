import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { authService } from '@/services/auth/auth.service'
import { subscriptionsService } from '@/services/subscriptions/subscriptions.service'
import { tokenStorage } from '@/app/lib/axios'
import { ROLE_HOME } from '@/shared/constants/rbac'
import { Btn, Input, PasswordInput, Spinner, Divider } from '@/components/ui/index'
import { IconAlert } from '@/components/icons'
import { PASSWORD_REQUIREMENTS, isPasswordValid, PASSWORDS_DO_NOT_MATCH_MESSAGE } from '@/lib/validation/password'
import { useLocaleStore } from '@/i18n/localeStore'

interface FormState {
  business_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  confirm_password: string
  referral_code: string
}

const INITIAL: FormState = {
  business_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
  referral_code: '',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [searchParams] = useSearchParams()
  const t = useLocaleStore(s => s.t)

  // Reseller promo links deep-link here as /register?ref=CODE — prefill the
  // promo code field so following the link actually applies it, matching the
  // reseller portal's generated referral_url format.
  const [form, setForm] = useState<FormState>(() => ({
    ...INITIAL,
    referral_code: (searchParams.get('ref') ?? '').toUpperCase(),
  }))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Real trial length — was hardcoded and drifted out of sync with the
  // actual plan; no auth required since this page is shown logged-out.
  const { data: trialPlan } = useQuery({
    queryKey: ['public', 'trial-plan'],
    queryFn: subscriptionsService.getPublicTrialPlan,
    staleTime: 5 * 60 * 1000,
  })

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setError(null)
    }
  }

  const passwordValid = isPasswordValid(form.password)

  const canSubmit =
    form.business_name.trim().length >= 2 &&
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.email.includes('@') &&
    passwordValid &&
    form.password === form.confirm_password &&
    !isLoading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      setError(PASSWORDS_DO_NOT_MATCH_MESSAGE)
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
        referral_code: form.referral_code.trim().toUpperCase() || undefined,
      })
      tokenStorage.setAccess(result.access_token)
      const me = await authService.me()
      setUser(me)
      localStorage.setItem('sawyunpos_onboarding_pending', '1')
      navigate('/onboarding', { replace: true })
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string; details?: { errors?: { field: string; message: string }[] } }; detail?: string } }; message?: string }
      const apiError = e2.response?.data?.error
      const fieldErrors = apiError?.details?.errors
      const specificMsg = fieldErrors?.length
        ? fieldErrors[0].message.replace(/^Value error,\s*/i, '')
        : undefined
      setError(
        specificMsg ??
        (apiError?.message !== 'Request validation failed' ? apiError?.message : undefined) ??
        e2.response?.data?.detail ??
        e2.message ??
        t('auth.registration_failed')
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-lg">
      <div className="text-center mb-8">
        <img src="/logo-icon.png" alt="SawYunPos" className="inline-block w-16 h-16 rounded-2xl shadow-2xl shadow-blue-900/50 mb-4" />
        <h1 className="text-2xl font-bold text-zinc-100">{t('auth.start_trial_heading')}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {trialPlan ? `${trialPlan.trial_days} ${t('auth.days_free')}` : t('auth.free_trial')} · {t('auth.no_credit_card')}
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        <form onSubmit={handleSubmit} noValidate>
          <Divider label={t('auth.create_account_divider')} />

          <div className="space-y-3 mt-4">
            <Input
              label={t('auth.business_name')}
              value={form.business_name}
              onChange={set('business_name')}
              placeholder={t('auth.business_name_placeholder')}
              required
            />

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <Input
                label={t('auth.first_name')}
                value={form.first_name}
                onChange={set('first_name')}
                placeholder="John"
                required
              />
              <Input
                label={t('auth.last_name')}
                value={form.last_name}
                onChange={set('last_name')}
                placeholder="Smith"
                required
              />
            </div>

            <Input
              label={t('settings.email')}
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="john@mybusiness.com"
              autoComplete="email"
              required
            />

            <Input
              label={t('auth.phone_optional')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+1 234 567 8900"
            />

            <div>
              <Input
                label={t('auth.promo_code_optional')}
                type="text"
                value={form.referral_code}
                onChange={e => {
                  setForm(prev => ({ ...prev, referral_code: e.target.value.toUpperCase() }))
                  setError(null)
                }}
                placeholder={t('auth.promo_code_placeholder')}
                autoComplete="off"
              />
              <p className="text-[11px] text-zinc-500 mt-1">{t('auth.promo_code_hint')}</p>
            </div>

            <div>
              <PasswordInput
                label={t('auth.password')}
                value={form.password}
                onChange={set('password')}
                placeholder={t('auth.password_requirements_placeholder')}
                autoComplete="new-password"
                required
              />
              {form.password.length > 0 && !passwordValid && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {PASSWORD_REQUIREMENTS.map(r => (
                    <span key={r.label} className={`text-[11px] ${r.test(form.password) ? 'text-green-500' : 'text-zinc-500'}`}>
                      {r.test(form.password) ? '✓' : '·'} {r.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <PasswordInput
              label={t('auth.confirm_password')}
              value={form.confirm_password}
              onChange={set('confirm_password')}
              placeholder={t('auth.repeat_password_placeholder')}
              autoComplete="new-password"
              required
            />

            {form.password && form.confirm_password && form.password !== form.confirm_password && (
              <p className="text-red-400 text-xs">{PASSWORDS_DO_NOT_MATCH_MESSAGE}</p>
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
                  {t('auth.creating_account')}
                </>
              ) : (
                t('auth.start_free_trial')
              )}
            </Btn>
          </div>
        </form>

        <p className="text-center text-zinc-600 text-xs mt-4">
          {t('auth.already_have_account')}{' '}
          <Link to="/login" className="text-amber-500 hover:text-amber-400">
            {t('auth.sign_in')}
          </Link>
        </p>
      </div>

      <p className="text-center text-zinc-600 text-[11px] mt-4">
        {t('auth.terms_agreement_prefix')}{' '}
        <a
          href="https://www.sawyuntech.com/legal/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 font-medium underline underline-offset-2 hover:text-amber-300 transition-colors drop-shadow-[0_0_6px_rgba(251,191,36,0.65)]"
        >
          {t('auth.terms_of_service')}
        </a>
        {', '}
        <a
          href="https://www.sawyuntech.com/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 font-medium underline underline-offset-2 hover:text-amber-300 transition-colors drop-shadow-[0_0_6px_rgba(251,191,36,0.65)]"
        >
          {t('auth.privacy_policy')}
        </a>
        {' '}{t('auth.terms_agreement_and')}{' '}
        <a
          href="https://www.sawyuntech.com/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 font-medium underline underline-offset-2 hover:text-amber-300 transition-colors drop-shadow-[0_0_6px_rgba(251,191,36,0.65)]"
        >
          {t('auth.cookie_use')}
        </a>
        .
      </p>
    </div>
  )
}
