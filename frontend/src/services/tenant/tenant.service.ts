import apiClient from '@/app/lib/axios'
import type {
  Branch,
  Tenant,
  TenantSettings,
  TenantSettingsUpdateRequest,
  TenantUpdateRequest,
  TenantCreateRequest,
  TenantStatusUpdateRequest,
  PaginatedResponse,
  SuccessResponse,
} from '@/shared/types'

export interface BranchCreatePayload {
  name: string
  code: string
  address?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  timezone?: string
  currency?: string
  is_main_branch?: boolean
}

export const tenantService = {
  getBranches: (tenantId: string, params?: { page?: number; page_size?: number }) =>
    apiClient
      .get<PaginatedResponse<Branch>>(`/tenants/${tenantId}/branches`, { params })
      .then(r => r.data),

  getTenant: (tenantId: string) =>
    apiClient.get<Tenant>(`/tenants/${tenantId}`).then(r => r.data),

  updateTenant: (tenantId: string, payload: TenantUpdateRequest) =>
    apiClient.patch<Tenant>(`/tenants/${tenantId}`, payload).then(r => r.data),

  updateTenantStatus: (tenantId: string, payload: TenantStatusUpdateRequest) =>
    apiClient.patch<Tenant>(`/tenants/${tenantId}/status`, payload).then(r => r.data),

  createTenant: (payload: TenantCreateRequest) =>
    apiClient.post<Tenant>('/tenants', payload).then(r => r.data),

  deleteTenant: (tenantId: string) =>
    apiClient.delete<SuccessResponse>(`/tenants/${tenantId}`).then(r => r.data),

  listTenants: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Tenant>>('/tenants', { params }).then(r => r.data),

  createBranch: (tenantId: string, payload: BranchCreatePayload) =>
    apiClient.post<Branch>(`/tenants/${tenantId}/branches`, payload).then(r => r.data),

  updateBranch: (tenantId: string, branchId: string, payload: Partial<{
    name: string; address: string | null; city: string | null
    phone: string | null; timezone: string; currency: string
  }>) =>
    apiClient.patch<Branch>(`/tenants/${tenantId}/branches/${branchId}`, payload).then(r => r.data),

  updateBranchStatus: (tenantId: string, branchId: string, status: string) =>
    apiClient.patch<Branch>(`/tenants/${tenantId}/branches/${branchId}/status`, { status }).then(r => r.data),

  getTenantSettings: (tenantId: string) =>
    apiClient.get<TenantSettings>(`/tenants/${tenantId}/settings`).then(r => r.data),

  updateTenantSettings: (tenantId: string, payload: TenantSettingsUpdateRequest) =>
    apiClient.patch<TenantSettings>(`/tenants/${tenantId}/settings`, payload).then(r => r.data),
}
