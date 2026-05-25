import apiClient from '@/app/lib/axios'
import type { Device, DeviceRegisterRequest, PaginatedResponse } from '@/shared/types'

export const devicesService = {
  register: (payload: DeviceRegisterRequest) =>
    apiClient.post<Device>('/devices', payload).then(r => r.data),

  list: (params?: { tenant_id?: string; branch_id?: string; is_active?: boolean; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Device>>('/devices', { params }).then(r => r.data),

  get: (deviceId: string) =>
    apiClient.get<Device>(`/devices/${deviceId}`).then(r => r.data),

  update: (deviceId: string, payload: { device_name?: string; app_version?: string }) =>
    apiClient.patch<Device>(`/devices/${deviceId}`, payload).then(r => r.data),

  deactivate: (deviceId: string) =>
    apiClient.post(`/devices/${deviceId}/deactivate`).then(r => r.data),

  heartbeat: (deviceId: string) =>
    apiClient.post(`/devices/${deviceId}/heartbeat`).then(r => r.data),
}
