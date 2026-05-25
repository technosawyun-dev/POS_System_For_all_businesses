import { useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fmtDateTime } from '@/lib/utils'
import { Btn, Spinner } from '@/components/ui'
import { notificationsService } from '@/services/notifications/notifications.service'
import { NotificationTypeBadge, NotificationPriorityBadge } from './notificationHelpers'
import type { Notification } from '@/shared/types'

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()

  const stateNotification = location.state?.notification as Notification | undefined

  const { data: fetchedNotification, isLoading } = useQuery({
    queryKey: ['notification', id],
    queryFn: async () => {
      const res = await notificationsService.list({ page_size: 100 })
      return res.items.find(n => n.id === id) ?? null
    },
    enabled: !stateNotification,
  })

  const notification = stateNotification ?? fetchedNotification
  const loading = !stateNotification && isLoading

  const markReadMutation = useMutation({
    mutationFn: () => notificationsService.markRead(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  useEffect(() => {
    if (notification && !notification.is_read) {
      markReadMutation.mutate()
    }
  // only run when the notification id first resolves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={28} />
      </div>
    )
  }

  if (!notification) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-zinc-400 text-sm">Notification not found</p>
        <Btn variant="secondary" size="sm" onClick={() => navigate('/app/notifications')}>
          Back to Notifications
        </Btn>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 flex-shrink-0">
        <button
          onClick={() => navigate('/app/notifications')}
          className="text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="text-base font-semibold text-zinc-100 flex-1 truncate min-w-0">{notification.title}</h2>
        {notification.is_read && (
          <span className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0">
            Read
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <NotificationTypeBadge type={notification.type} />
            <NotificationPriorityBadge priority={notification.priority} />
          </div>

          {/* Message card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-zinc-100 font-semibold text-base mb-3 leading-snug">
              {notification.title}
            </h3>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
              {notification.message}
            </p>
          </div>

          {/* Metadata */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Received</span>
              <span className="text-zinc-300 text-xs">{fmtDateTime(notification.created_at)}</span>
            </div>
            {notification.read_at && (
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Read at</span>
                <span className="text-zinc-300 text-xs">{fmtDateTime(notification.read_at)}</span>
              </div>
            )}
            {notification.expires_at && (
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Expires</span>
                <span className="text-zinc-300 text-xs">{fmtDateTime(notification.expires_at)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Type</span>
              <span className="text-zinc-300">{notification.type}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Priority</span>
              <span className="text-zinc-300">{notification.priority}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
