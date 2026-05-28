import apiClient from '@/app/lib/axios'
import type { Brand, BrandCreateRequest, BrandUpdateRequest, PaginatedResponse } from '@/shared/types'

export const brandsService = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<Brand>>('/brands', { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<Brand>(`/brands/${id}`).then(r => r.data),

  create: (payload: BrandCreateRequest) =>
    apiClient.post<Brand>('/brands', payload).then(r => r.data),

  update: (id: string, payload: BrandUpdateRequest) =>
    apiClient.patch<Brand>(`/brands/${id}`, payload).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/brands/${id}`).then(r => r.data),
}
