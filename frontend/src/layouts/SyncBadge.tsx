import { lazy, Suspense, useState } from 'react'
import { useUIStore } from '@/store/ui.store'
import { IconWifi, IconWifiOff, IconAlert } from '@/components/icons'
import { useLocaleStore } from '@/i18n/localeStore'

const SyncIssuesModal = lazy(() => import('./SyncIssuesModal'))

export default function SyncBadge() {
  const isOnline = useUIStore(s => s.isOnline)
  const pendingSyncCount = useUIStore(s => s.pendingSyncCount)
  const failedSyncCount = useUIStore(s => s.failedSyncCount)
  const [showIssues, setShowIssues] = useState(false)
  const t = useLocaleStore(s => s.t)

  return (
    <div className="inline-flex items-center gap-2">
      {isOnline ? (
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-950 border border-green-800 text-green-400"
          title={t('sync.online')}
          aria-label={t('sync.online')}
        >
          <IconWifi width="14" height="14" />
        </span>
      ) : (
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-950 border border-red-800 text-red-400"
          title={t('sync.offline_status')}
          aria-label={t('sync.offline_status')}
        >
          <IconWifiOff width="14" height="14" />
        </span>
      )}

      {pendingSyncCount > 0 && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950 border border-amber-800 text-amber-400 text-xs font-medium">
          <span>{t('sync.syncing')} {pendingSyncCount}…</span>
        </span>
      )}

      {failedSyncCount > 0 && (
        <button
          onClick={() => setShowIssues(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950 border border-red-800 text-red-400 text-xs font-medium hover:bg-red-900 transition-colors"
        >
          <IconAlert width="13" height="13" />
          <span>{failedSyncCount} {failedSyncCount > 1 ? t('sync.issues_plural') : t('sync.issue_singular')}</span>
        </button>
      )}

      {showIssues && (
        <Suspense fallback={null}>
          <SyncIssuesModal onClose={() => setShowIssues(false)} />
        </Suspense>
      )}
    </div>
  )
}
