import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn, timeAgo, extractApiMsg } from '@/lib/utils'
import { Btn, Empty, Spinner, SectionHeader } from '@/components/ui'
import { IconChevLeft, IconChevRight } from '@/components/icons'
import { notificationsService } from '@/services/notifications/notifications.service'
import { NotificationTypeBadge, NotificationPriorityBadge } from './notificationHelpers'
import type { Notification } from '@/shared/types'

const PAGE_SIZE = 20

const READ_FILTERS = [
  { label: 'All',    value: undefined as boolean | undefined },
  { label: 'Unread', value: false                            },
  { label: 'Read',   value: true                             },
]

const TYPE_FILTERS = [
  { label: 'All',          value: undefined as string | undefined },
  { label: 'System',       value: 'SYSTEM'                        },
  { label: 'Inventory',    value: 'INVENTORY'                     },
  { label: 'Procurement',  value: 'PROCUREMENT'                   },
  { label: 'Customer',     value: 'CUSTOMER'                      },
  { label: 'Subscription', value: 'SUBSCRIPTION'                  },
  { label: 'Security',     value: 'SECURITY'                      },
]

export default function NotificationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [readFilter, setReadFilter] = useState<boolean | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [page, setPage]             = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list', { read: readFilter, type: typeFilter, page }],
    queryFn: () => notificationsService.list({ read: readFilter, type: typeFilter, page, page_size: PAGE_SIZE }),
    placeholderData: prev => prev,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed to mark all read'),
  })

  const notifications = data?.items ?? []
  const total         = data?.total ?? 0
  const totalPages    = data?.total_pages ?? 1

  function handleReadTabChange(value: boolean | undefined) {
    setReadFilter(value)
    setPage(1)
  }

  function handleTypeChange(value: string | undefined) {
    setTypeFilter(value)
    setPage(1)
  }

  function handleRowClick(n: Notification) {
    navigate(`/app/notifications/${n.id}`, { state: { notification: n } })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionHeader
        title="Notifications"
        subtitle={total > 0 ? `${total} notification${total !== 1 ? 's' : ''}` : 'No notifications'}
        action={
          <div className="flex gap-2">
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/notifications/preferences')}
            >
              Preferences
            </Btn>
            <Btn
              variant="secondary"
              size="sm"
              disabled={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              {markAllMutation.isPending ? <Spinner size={14} /> : 'Mark All Read'}
            </Btn>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Read / Unread tabs */}
        <div className="flex gap-1">
          {READ_FILTERS.map(f => (
            <button
              key={String(f.value)}
              onClick={() => handleReadTabChange(f.value)}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-medium transition-colors border',
                readFilter === f.value
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={String(f.value)}
              onClick={() => handleTypeChange(f.value)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                typeFilter === f.value
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Spinner size={28} /></div>
          ) : notifications.length === 0 ? (
            <Empty
              icon={<span className="text-5xl">🔔</span>}
              title="No notifications"
              subtitle={readFilter === false ? 'You\'re all caught up' : 'Nothing to show for the selected filters'}
            />
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleRowClick(n)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-zinc-800/50 transition-colors',
                    !n.is_read && 'bg-zinc-800/20',
                  )}
                >
                  {/* Unread indicator dot */}
                  <div className="flex-shrink-0 w-2 pt-2">
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium leading-snug mb-0.5',
                      n.is_read ? 'text-zinc-400' : 'text-zinc-100',
                    )}>
                      {n.title}
                    </p>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <NotificationTypeBadge type={n.type} />
                      <NotificationPriorityBadge priority={n.priority} />
                      <span className="text-xs text-zinc-600">{timeAgo(n.created_at)}</span>
                    </div>
                  </div>

                  <span className="text-zinc-700 text-sm flex-shrink-0 self-center">›</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Page {page} of {totalPages} · {total} total</span>
            <div className="flex gap-1">
              <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page">
                <IconChevLeft width="12" height="12" />
              </Btn>
              <Btn variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next page">
                <IconChevRight width="12" height="12" />
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
