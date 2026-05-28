import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { timeAgo, extractApiMsg } from '@/lib/utils'
import { Badge, Btn, Spinner } from '@/components/ui'
import { notificationsService } from '@/services/notifications/notifications.service'
import type { Notification } from '@/shared/types'

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'danger',
  HIGH:     'warning',
  NORMAL:   'info',
  LOW:      'default',
}

export default function ResellerNotificationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [readFilter, setReadFilter] = useState<boolean | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['reseller-notifications', { read: readFilter, page }],
    queryFn: () => notificationsService.list({ read: readFilter, page, page_size: 20 }),
    staleTime: 30 * 1000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    placeholderData: prev => prev,
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller-notifications'] })
      toast.success('All notifications marked as read')
    },
    onError: (err) => toast.error(extractApiMsg(err) ?? 'Failed'),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reseller-notifications'] }),
  })

  const notifications = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Notifications</h1>
          <p className="text-zinc-500 text-sm mt-1">{total} notification{total !== 1 ? 's' : ''}</p>
        </div>
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending}
        >
          Mark all read
        </Btn>
      </div>

      {/* Read/Unread filter */}
      <div className="flex gap-2 mb-6">
        {[
          { label: 'All', value: undefined as boolean | undefined },
          { label: 'Unread', value: false },
          { label: 'Read', value: true },
        ].map(f => (
          <button
            key={String(f.label)}
            onClick={() => { setReadFilter(f.value); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              readFilter === f.value
                ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Spinner size={28} />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">No notifications found.</div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.is_read) markReadMutation.mutate(n.id)
                navigate(`/reseller/notifications/${n.id}`, { state: { notification: n } })
              }}
              className={`bg-zinc-900 border rounded-2xl px-5 py-4 cursor-pointer transition-all hover:border-orange-500/30 ${
                n.is_read ? 'border-zinc-800' : 'border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                    )}
                    <p className={`text-sm font-medium truncate ${n.is_read ? 'text-zinc-300' : 'text-zinc-100'}`}>
                      {n.title}
                    </p>
                  </div>
                  <p className="text-zinc-500 text-xs line-clamp-2">{n.message}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Badge
                    variant={PRIORITY_VARIANT[n.priority] ?? 'default'}
                    size="xs"
                  >
                    {n.priority}
                  </Badge>
                  <span className="text-zinc-600 text-xs">{timeAgo(n.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs text-zinc-500">{total} total</span>
          <div className="flex items-center gap-2">
            <Btn variant="ghost" size="xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
            <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
            <Btn variant="ghost" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
