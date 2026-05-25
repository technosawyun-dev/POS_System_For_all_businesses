import apiClient from '@/app/lib/axios'
import type { Category, PaginatedResponse } from '@/shared/types'

export const categoriesService = {
  list: (params?: { page?: number; page_size?: number; parent_id?: string }) =>
    apiClient.get<PaginatedResponse<Category>>('/categories', { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<Category>(`/categories/${id}`).then(r => r.data),

  create: (payload: { name: string; slug?: string; description?: string }) =>
    apiClient.post<Category>('/categories', payload).then(r => r.data),

  update: (id: string, payload: Partial<{ name: string; description: string; status: string }>) =>
    apiClient.patch<Category>(`/categories/${id}`, payload).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/categories/${id}`).then(r => r.data),
}
