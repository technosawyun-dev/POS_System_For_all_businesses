import apiClient from '@/app/lib/axios'
import type { AuditLog, PaginatedResponse } from '@/shared/types'

export const auditService = {
  listLogs: (params?: {
    page?: number
    page_size?: number
    action?: string
    date_from?: string
    date_to?: string
    tenant_id?: string
  }) =>
    apiClient
      .get<PaginatedResponse<AuditLog>>('/audit/logs', { params })
      .then(r => r.data),
}
