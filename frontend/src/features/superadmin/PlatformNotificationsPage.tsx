import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fmtDate } from '@/lib/utils'
import { Badge, Btn, Spinner, Empty } from '@/components/ui'
import { notificationsService } from '@/services/notifications/notifications.service'
import { useState } from 'react'

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'danger',
  HIGH:     'warning',
  MEDIUM:   'info',
  LOW:      'default',
}

export default function PlatformNotificationsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list', page],
    queryFn: () => notificationsService.list({ page, page_size: 25 }),
  })

  const readAllMutation = useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'list'] })
    },
  })

  const items = data?.items ?? []
  const unread = items.filter(n => !n.is_read).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Platform Notifications</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{unread > 0 ? `${unread} unread` : 'All read'}</p>
        </div>
        {unread > 0 && (
          <Btn
            variant="secondary"
            size="sm"
            disabled={readAllMutation.isPending}
            onClick={() => readAllMutation.mutate()}
          >
            Mark all read
          </Btn>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : items.length === 0 ? (
          <Empty title="No notifications" />
        ) : (
          <div className="max-w-3xl space-y-2">
            {items.map(notification => (
              <div
                key={notification.id}
                className={`bg-zinc-900 border rounded-xl px-4 py-3.5 transition-colors ${
                  notification.is_read ? 'border-zinc-800' : 'border-zinc-600'
                }`}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!notification.is_read && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      )}
                      <p className="text-sm font-medium text-zinc-100">{notification.title}</p>
                      <Badge variant={PRIORITY_VARIANT[notification.priority] ?? 'default'} size="xs">
                        {notification.priority}
                      </Badge>
                      <Badge variant="default" size="xs">{notification.type}</Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{notification.message}</p>
                    <p className="text-xs text-zinc-600 mt-1">{fmtDate(notification.created_at)}</p>
                  </div>
                  {!notification.is_read && (
                    <Btn
                      variant="secondary"
                      size="xs"
                      disabled={markReadMutation.isPending}
                      onClick={() => markReadMutation.mutate(notification.id)}
                    >
                      Mark read
                    </Btn>
                  )}
                </div>
              </div>
            ))}

            {(data?.total_pages ?? 0) > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Btn variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
                <span className="text-xs text-zinc-500 self-center">{page} / {data?.total_pages}</span>
                <Btn variant="secondary" size="xs" disabled={!data?.has_next} onClick={() => setPage(p => p + 1)}>Next</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
