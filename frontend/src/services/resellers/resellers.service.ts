import apiClient from '@/app/lib/axios'
import type {
  ResellerAssignment,
  ResellerAssignmentCreateRequest,
  ResellerAssignmentUpdateRequest,
  SuccessResponse,
  MyBusinessResponse,
  MyBranchResponse,
  MyPermissionsResponse,
  PaginatedResponse,
} from '@/shared/types'

export const resellersService = {
  createAssignment: (payload: ResellerAssignmentCreateRequest) =>
    apiClient.post<ResellerAssignment>('/resellers/assignments', payload).then(r => r.data),

  listAssignments: (params?: { reseller_id?: string; tenant_id?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<ResellerAssignment>>('/resellers/assignments', { params }).then(r => r.data),

  getAssignment: (assignmentId: string) =>
    apiClient.get<ResellerAssignment>(`/resellers/assignments/${assignmentId}`).then(r => r.data),

  updateAssignment: (assignmentId: string, payload: ResellerAssignmentUpdateRequest) =>
    apiClient
      .patch<ResellerAssignment>(`/resellers/assignments/${assignmentId}`, payload)
      .then(r => r.data),

  deleteAssignment: (assignmentId: string) =>
    apiClient.delete<SuccessResponse>(`/resellers/assignments/${assignmentId}`).then(r => r.data),

  getMyBusinesses: () =>
    apiClient.get<MyBusinessResponse[]>('/resellers/me/businesses').then(r => r.data),

  getMyBranches: (tenantId: string) =>
    apiClient.get<MyBranchResponse>('/resellers/me/branches', { params: { tenant_id: tenantId } }).then(r => r.data),

  getMyPermissions: (tenantId: string) =>
    apiClient.get<MyPermissionsResponse>('/resellers/me/permissions', { params: { tenant_id: tenantId } }).then(r => r.data),
}
