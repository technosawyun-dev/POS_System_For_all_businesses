import apiClient from '@/app/lib/axios'
import type { SyncPushRequest, SyncPushResponse } from '@/shared/types'

export interface SyncPullParams {
  device_id: string
  entity_types?: string[]
  since_at?: string
  page_size?: number
}

export const syncService = {
  push: (payload: SyncPushRequest) =>
    apiClient.post<SyncPushResponse>('/sync/push', payload).then(r => r.data),

  pull: (params: SyncPullParams) =>
    apiClient.get('/sync/pull', { params }).then(r => r.data),

  listOperations: (params?: { page?: number; status?: string }) =>
    apiClient.get('/sync/operations', { params }).then(r => r.data),

  getOperation: (operationId: string) =>
    apiClient.get(`/sync/operations/${operationId}`).then(r => r.data),
}
