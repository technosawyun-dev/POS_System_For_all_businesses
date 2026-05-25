import apiClient from '@/app/lib/axios'
import type {
  User,
  UserCreateRequest,
  UserUpdateRequest,
  PaginatedResponse,
  SuccessResponse,
} from '@/shared/types'

export const usersService = {
  list: (params?: { page?: number; page_size?: number; tenant_id?: string }) =>
    apiClient.get<PaginatedResponse<User>>('/users', { params }).then(r => r.data),

  get: (userId: string) =>
    apiClient.get<User>(`/users/${userId}`).then(r => r.data),

  create: (payload: UserCreateRequest) =>
    apiClient.post<User>('/users', payload).then(r => r.data),

  update: (userId: string, payload: UserUpdateRequest) =>
    apiClient.patch<User>(`/users/${userId}`, payload).then(r => r.data),

  updateStatus: (userId: string, status: string) =>
    apiClient.patch<User>(`/users/${userId}/status`, { status }).then(r => r.data),

  updateRole: (userId: string, role: string) =>
    apiClient.patch<User>(`/users/${userId}/role`, { role }).then(r => r.data),

  resetPassword: (userId: string, newPassword: string) =>
    apiClient.post<SuccessResponse>(`/users/${userId}/reset-password`, { new_password: newPassword }).then(r => r.data),

  delete: (userId: string) =>
    apiClient.delete<SuccessResponse>(`/users/${userId}`).then(r => r.data),
}
