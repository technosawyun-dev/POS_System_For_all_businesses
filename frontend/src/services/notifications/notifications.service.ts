import apiClient from '@/app/lib/axios'
import type { Notification, NotificationPreference, PaginatedResponse } from '@/shared/types'

export const notificationsService = {
  list: (params?: {
    read?: boolean
    type?: string
    priority?: string
    page?: number
    page_size?: number
  }) =>
    apiClient.get<PaginatedResponse<Notification>>('/notifications', { params }).then(r => r.data),

  getUnreadCount: () =>
    apiClient.get<{ unread_count: number }>('/notifications/unread-count').then(r => r.data),

  markRead: (id: string) =>
    apiClient.post<{ message: string }>(`/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    apiClient.post<{ message: string }>('/notifications/read-all').then(r => r.data),

  getPreferences: () =>
    apiClient.get<NotificationPreference>('/notifications/preferences').then(r => r.data),

  updatePreferences: (data: Partial<Pick<NotificationPreference,
    'email_enabled' | 'inventory_enabled' | 'procurement_enabled' |
    'customer_enabled' | 'subscription_enabled' | 'security_enabled'
  >>) =>
    apiClient.patch<NotificationPreference>('/notifications/preferences', data).then(r => r.data),
}
