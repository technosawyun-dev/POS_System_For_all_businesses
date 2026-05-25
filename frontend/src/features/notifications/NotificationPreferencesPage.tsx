import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn, extractApiMsg } from '@/lib/utils'
import { Spinner, SectionHeader } from '@/components/ui'
import { notificationsService } from '@/services/notifications/notifications.service'
import type { NotificationPreference } from '@/shared/types'


function Toggle({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
        checked ? 'bg-amber-500' : 'bg-zinc-700',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-[22px]' : 'translate-x-0.5',
      )} />
    </button>
  )
}


function PrefRow({
  icon,
  label,
  description,
  checked,
  onChange,
  saving,
}: {
  icon: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  saving: boolean
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-4">
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 leading-snug">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      {saving ? (
        <div className="w-11 flex items-center justify-center flex-shrink-0">
          <Spinner size={14} />
        </div>
      ) : (
        <Toggle checked={checked} onChange={onChange} />
      )}
    </div>
  )
}


type PrefKey = keyof Pick<NotificationPreference,
  'email_enabled' | 'inventory_enabled' | 'procurement_enabled' |
  'customer_enabled' | 'subscription_enabled' | 'security_enabled'
>

const PREF_ROWS: { key: PrefKey; icon: string; label: string; description: string }[] = [
  {
    key: 'email_enabled',
    icon: '📧',
    label: 'Email Notifications',
    description: 'Receive notifications via email in addition to in-app alerts',
  },
  {
    key: 'inventory_enabled',
    icon: '📦',
    label: 'Inventory Alerts',
    description: 'Low stock warnings and reorder level notifications',
  },
  {
    key: 'procurement_enabled',
    icon: '🛒',
    label: 'Procurement Alerts',
    description: 'Purchase order approvals, goods receipts, and overdue payables',
  },
  {
    key: 'customer_enabled',
    icon: '👥',
    label: 'Customer Alerts',
    description: 'High outstanding customer balances and credit limit warnings',
  },
  {
    key: 'subscription_enabled',
    icon: '💳',
    label: 'Subscription Alerts',
    description: 'Trial expiry, subscription renewal reminders, and billing updates',
  },
  {
    key: 'security_enabled',
    icon: '🔐',
    label: 'Security Alerts',
    description: 'Suspicious login attempts and security-related system events',
  },
]

export default function NotificationPreferencesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null)
  const [localPrefs, setLocalPrefs] = useState<Partial<Record<PrefKey, boolean>>>({})

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: notificationsService.getPreferences,
  })

  useEffect(() => {
    if (prefs) {
      setLocalPrefs({
        email_enabled:        prefs.email_enabled,
        inventory_enabled:    prefs.inventory_enabled,
        procurement_enabled:  prefs.procurement_enabled,
        customer_enabled:     prefs.customer_enabled,
        subscription_enabled: prefs.subscription_enabled,
        security_enabled:     prefs.security_enabled,
      })
    }
  }, [prefs])

  const mutation = useMutation({
    mutationFn: (payload: Partial<Record<PrefKey, boolean>>) =>
      notificationsService.updatePreferences(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] })
      setSavingKey(null)
    },
    onError: (err, _, context) => {
      toast.error(extractApiMsg(err) ?? 'Failed to save preference')
      // revert optimistic update
      if (context && prefs) {
        setLocalPrefs({
          email_enabled:        prefs.email_enabled,
          inventory_enabled:    prefs.inventory_enabled,
          procurement_enabled:  prefs.procurement_enabled,
          customer_enabled:     prefs.customer_enabled,
          subscription_enabled: prefs.subscription_enabled,
          security_enabled:     prefs.security_enabled,
        })
      }
      setSavingKey(null)
    },
  })

  function handleToggle(key: PrefKey, value: boolean) {
    setLocalPrefs(prev => ({ ...prev, [key]: value }))
    setSavingKey(key)
    mutation.mutate({ [key]: value })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 flex-shrink-0">
        <button
          onClick={() => navigate('/app/notifications')}
          className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Notification Preferences</h2>
          <p className="text-xs text-zinc-500">Changes save automatically</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner size={28} />
            </div>
          ) : !prefs ? (
            <p className="text-zinc-500 text-sm text-center py-10">Failed to load preferences</p>
          ) : (
            <>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
                {PREF_ROWS.map(row => (
                  <PrefRow
                    key={row.key}
                    icon={row.icon}
                    label={row.label}
                    description={row.description}
                    checked={localPrefs[row.key] ?? false}
                    onChange={v => handleToggle(row.key, v)}
                    saving={savingKey === row.key && mutation.isPending}
                  />
                ))}
              </div>

              <p className="text-xs text-zinc-600 text-center">
                Preferences apply to all branches. Email delivery requires a configured mail provider.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
