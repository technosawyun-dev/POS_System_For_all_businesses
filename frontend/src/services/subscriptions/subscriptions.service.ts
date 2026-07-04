import axios from 'axios'
import apiClient from '@/app/lib/axios'
import type {
  Plan, PlanCreateRequest, PlanUpdateRequest,
  Subscription, SubscriptionHistory,
  PaymentProof, PaymentProofCreateRequest,
  SubscriptionOverview, EffectiveEntitlement,
  TenantEntitlementOverride,
  PaginatedResponse,
  PublicPlan,
  TrialStatus,
  SubscriptionPaymentMethod,
} from '@/shared/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const subscriptionsService = {
  listPlans: (params?: { page?: number; page_size?: number; include_inactive?: boolean }) =>
    apiClient.get<PaginatedResponse<Plan>>('/subscriptions/plans', { params }).then(r => r.data),

  getPlan: (id: string) =>
    apiClient.get<Plan>(`/subscriptions/plans/${id}`).then(r => r.data),

  createPlan: (payload: PlanCreateRequest) =>
    apiClient.post<Plan>('/subscriptions/plans', payload).then(r => r.data),

  updatePlan: (id: string, payload: PlanUpdateRequest) =>
    apiClient.patch<Plan>(`/subscriptions/plans/${id}`, payload).then(r => r.data),

  getMySubscription: () =>
    apiClient.get<Subscription>('/subscriptions/me').then(r => r.data),

  getHistory: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<SubscriptionHistory>>('/subscriptions/history', { params }).then(r => r.data),

  downgrade: (plan_id: string) =>
    apiClient.post<{ message: string }>('/subscriptions/downgrade', { plan_id }).then(r => r.data),

  cancelPendingDowngrade: () =>
    apiClient.post<{ message: string }>('/subscriptions/downgrade/cancel').then(r => r.data),

  cancel: () =>
    apiClient.post<Subscription>('/subscriptions/cancel').then(r => r.data),

  listPaymentProofs: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<PaymentProof>>('/subscriptions/payment-proofs', { params }).then(r => r.data),

  submitPaymentProof: (payload: PaymentProofCreateRequest) =>
    apiClient.post<PaymentProof>('/subscriptions/payment-proofs', payload).then(r => r.data),

  uploadProofFile: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post<{ url: string }>(
      '/subscriptions/payment-proofs/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.url
  },

  adminGetOverview: () =>
    apiClient.get<SubscriptionOverview>('/subscriptions/admin/overview').then(r => r.data),

  adminListSubscriptions: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Subscription>>('/subscriptions/admin/tenants', { params }).then(r => r.data),

  adminGetTenantSubscription: (tenantId: string) =>
    apiClient.get<Subscription>(`/subscriptions/admin/tenants/${tenantId}`).then(r => r.data),

  adminActivate: (plan_id: string, extension_days = 30) =>
    apiClient.post<Subscription>('/subscriptions/activate', { plan_id, extension_days }).then(r => r.data),

  adminExtend: (tenantId: string, days: number, reason?: string) =>
    apiClient.post<Subscription>(`/subscriptions/admin/tenants/${tenantId}/extend`, { days, reason }).then(r => r.data),

  adminChangePlan: (tenantId: string, plan_id: string, reason?: string) =>
    apiClient.post<Subscription>(`/subscriptions/admin/tenants/${tenantId}/change-plan`, { plan_id, reason }).then(r => r.data),

  adminCancel: (tenantId: string) =>
    apiClient.post<Subscription>(`/subscriptions/admin/tenants/${tenantId}/cancel`).then(r => r.data),

  adminReactivate: (tenantId: string, extension_days = 30) =>
    apiClient.post<Subscription>(`/subscriptions/admin/tenants/${tenantId}/reactivate`, null, { params: { extension_days } }).then(r => r.data),

  adminSuspend: (tenantId: string) =>
    apiClient.post<Subscription>(`/subscriptions/admin/tenants/${tenantId}/suspend`).then(r => r.data),

  adminExpire: (tenantId: string) =>
    apiClient.post<Subscription>(`/subscriptions/admin/tenants/${tenantId}/expire`).then(r => r.data),

  adminListProofs: (params?: { page?: number; page_size?: number; status?: string; tenant_id?: string }) =>
    apiClient.get<PaginatedResponse<PaymentProof>>('/subscriptions/admin/payment-proofs', { params }).then(r => r.data),

  adminRepairStatuses: () =>
    apiClient.post<{ fixed: number; message: string }>('/subscriptions/admin/repair-statuses').then(r => r.data),

  adminApproveProof: (proofId: string, review_notes?: string) =>
    apiClient.post<PaymentProof>(`/subscriptions/payment-proofs/${proofId}/approve`, { review_notes }).then(r => r.data),

  adminRejectProof: (proofId: string, review_notes?: string) =>
    apiClient.post<PaymentProof>(`/subscriptions/payment-proofs/${proofId}/reject`, { review_notes }).then(r => r.data),

  adminGetSubscriptionHistory: (tenantId: string, params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<SubscriptionHistory>>(`/subscriptions/admin/tenants/${tenantId}/history`, { params }).then(r => r.data),

  adminGetEntitlements: (tenantId: string) =>
    apiClient.get<EffectiveEntitlement[]>(`/subscriptions/admin/tenants/${tenantId}/entitlements`).then(r => r.data),

  adminListOverrides: (tenantId: string) =>
    apiClient.get<TenantEntitlementOverride[]>(`/subscriptions/admin/tenants/${tenantId}/overrides`).then(r => r.data),

  adminCreateOverride: (tenantId: string, payload: {
    feature_code: string; enabled?: boolean | null; limit_value?: number | null
    reason?: string; expires_at?: string
  }) =>
    apiClient.post<TenantEntitlementOverride>(`/subscriptions/admin/tenants/${tenantId}/overrides`, payload).then(r => r.data),

  adminUpdateOverride: (overrideId: string, payload: {
    enabled?: boolean | null; limit_value?: number | null; reason?: string; expires_at?: string
  }) =>
    apiClient.patch<TenantEntitlementOverride>(`/subscriptions/admin/overrides/${overrideId}`, payload).then(r => r.data),

  adminDeleteOverride: (overrideId: string) =>
    apiClient.delete(`/subscriptions/admin/overrides/${overrideId}`),

  getPublicPlans: () =>
    axios.get<PublicPlan[]>(`${BASE_URL}/public/plans`).then(r => r.data),

  getTrialStatus: () =>
    apiClient.get<TrialStatus>('/subscriptions/status').then(r => r.data),

  getMyEntitlements: () =>
    apiClient.get<EffectiveEntitlement[]>('/subscriptions/entitlements').then(r => r.data),

  getPlatformPaymentMethods: () =>
    apiClient.get<{ payment_methods: SubscriptionPaymentMethod[] }>('/subscriptions/platform/payment-methods').then(r => r.data.payment_methods),

  adminSetPlatformPaymentMethods: (methods: SubscriptionPaymentMethod[]) =>
    apiClient.put<{ payment_methods: SubscriptionPaymentMethod[] }>('/subscriptions/admin/platform/payment-methods', { payment_methods: methods }).then(r => r.data.payment_methods),

  adminUploadPaymentMethodIcon: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post<{ icon_url: string }>('/subscriptions/admin/platform/payment-method-icon', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.icon_url)
  },
}
