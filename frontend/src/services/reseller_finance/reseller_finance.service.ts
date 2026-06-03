import apiClient from '@/app/lib/axios'
import type { PaginatedResponse, CommissionRecord, Subscription, PaymentProof, PaymentProofCreateRequest } from '@/shared/types'

// Shared

export interface ReferralCodeResponse {
  id: string
  reseller_id: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TenantReferralResponse {
  id: string
  tenant_id: string
  reseller_id: string
  referral_code_id: string | null
  referral_code_snapshot: string
  referred_at: string
  locked_at: string | null
  first_paid_subscription_at: string | null
  tenant_name: string | null
  subscription_status: string | null
  subscription_expires_at: string | null
}

export interface ReferralStatsResponse {
  total_referrals: number
  active_referrals: number
  converted_referrals: number
  trial_referrals: number
  conversion_rate: number
}

export interface ReferralLinkResponse {
  code: string
  referral_url: string
}

export interface WalletResponse {
  id: string
  reseller_id: string
  currency_code: string
  available_balance: string
  locked_balance: string
  total_paid_out: string
  commission_rate_pct: string
  min_payout_amount: string
  created_at: string
  updated_at: string
}

export interface WalletTransactionResponse {
  id: string
  wallet_id: string
  transaction_type: string
  amount: string
  currency_code: string
  reference_type: string | null
  reference_id: string | null
  note: string | null
  created_at: string
}

export interface PayoutRequestResponse {
  id: string
  reseller_id: string
  reseller_name?: string
  reseller_email?: string
  wallet_id: string
  amount: string
  currency_code: string
  status: string
  reason: string | null
  payout_method: string | null
  payout_reference: string | null
  payout_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  paid_at: string | null
  requested_at: string
  created_at: string
  updated_at: string
}

export interface ResellerWalletSummary {
  reseller_id: string
  reseller_email: string
  reseller_name: string
  total_referrals: number
  available_balance: string
  locked_balance: string
  total_paid_out: string
  commission_rate_pct: string
  min_payout_amount: string
  pending_payout_count: number
  currency_code: string
  primary_code: string | null
}

export interface ResellerFinanceOverviewResponse {
  total_resellers: number
  total_wallets_value: string
  total_pending_payouts: number
  total_pending_payout_amount: string
  total_commission_earned: string
  total_commission_paid_out: string
  total_referrals: number
  converted_referrals: number
  currency_code: string
}

// Reseller-facing API

export const resellerFinanceService = {
  // Referral codes
  listMyCodes: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<ReferralCodeResponse>>('/reseller/referral-codes', { params }).then(r => r.data),

  createCode: (code?: string) =>
    apiClient.post<ReferralCodeResponse>('/reseller/referral-codes', { code }).then(r => r.data),

  deactivateCode: (codeId: string) =>
    apiClient.patch<ReferralCodeResponse>(`/reseller/referral-codes/${codeId}`, { is_active: false }).then(r => r.data),

  activateCode: (codeId: string) =>
    apiClient.patch<ReferralCodeResponse>(`/reseller/referral-codes/${codeId}`, { is_active: true }).then(r => r.data),

  deleteCode: (codeId: string) =>
    apiClient.delete(`/reseller/referral-codes/${codeId}`).then(r => r.data),

  getReferralLink: (codeId: string) =>
    apiClient.get<ReferralLinkResponse>(`/reseller/referral-codes/${codeId}/link`).then(r => r.data),

  getReferralStats: () =>
    apiClient.get<ReferralStatsResponse>('/reseller/referrals/stats').then(r => r.data),

  listMyReferrals: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<TenantReferralResponse>>('/reseller/referrals', { params }).then(r => r.data),

  // Wallet
  getMyWallet: () =>
    apiClient.get<WalletResponse>('/reseller/wallet').then(r => r.data),

  listMyTransactions: (params?: { page?: number; page_size?: number; transaction_type?: string }) =>
    apiClient.get<PaginatedResponse<WalletTransactionResponse>>('/reseller/wallet/transactions', { params }).then(r => r.data),

  // Payouts
  listMyPayouts: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<PayoutRequestResponse>>('/reseller/payouts', { params }).then(r => r.data),

  requestPayout: (payload: { amount: string; reason?: string }) =>
    apiClient.post<PayoutRequestResponse>('/reseller/payouts', payload).then(r => r.data),

  cancelPayout: (payoutId: string) =>
    apiClient.delete<PayoutRequestResponse>(`/reseller/payouts/${payoutId}`).then(r => r.data),

  // Referred-tenant subscription management
  getBusinessSubscription: (tenantId: string) =>
    apiClient.get<Subscription>(`/reseller/tenants/${tenantId}/subscription`).then(r => r.data),

  uploadBusinessProof: async (tenantId: string, file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post<{ url: string }>(
      `/reseller/tenants/${tenantId}/payment-proofs/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.url
  },

  submitBusinessProof: (tenantId: string, payload: PaymentProofCreateRequest) =>
    apiClient.post<PaymentProof>(`/reseller/tenants/${tenantId}/payment-proofs`, payload).then(r => r.data),

  getBusinessLatestProof: (tenantId: string) =>
    apiClient.get<PaymentProof | null>(`/reseller/tenants/${tenantId}/payment-proofs/latest`).then(r => r.data),

  downgradeBusinessSubscription: (tenantId: string, planId: string) =>
    apiClient.post<{ message: string }>(`/reseller/tenants/${tenantId}/downgrade`, { plan_id: planId }).then(r => r.data),
}

// Super-admin API

export const resellerFinanceAdminService = {
  // Overview
  getOverview: () =>
    apiClient.get<ResellerFinanceOverviewResponse>('/admin/reseller-finance/overview').then(r => r.data),

  // Wallets
  listWallets: () =>
    apiClient.get<ResellerWalletSummary[]>('/admin/reseller-finance/wallets').then(r => r.data),

  getWallet: (resellerId: string) =>
    apiClient.get<WalletResponse>(`/admin/reseller-finance/wallets/${resellerId}`).then(r => r.data),

  listResellerTransactions: (resellerId: string, params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<WalletTransactionResponse>>(`/admin/reseller-finance/wallets/${resellerId}/transactions`, { params }).then(r => r.data),

  updateWalletSettings: (resellerId: string, payload: { commission_rate_pct?: string; min_payout_amount?: string }) =>
    apiClient.patch<WalletResponse>(`/admin/reseller-finance/wallets/${resellerId}/settings`, payload).then(r => r.data),

  manualAdjustment: (resellerId: string, payload: { amount: string; transaction_type: string; notes: string }) =>
    apiClient.post<WalletTransactionResponse>(`/admin/reseller-finance/wallets/adjustment`, { reseller_id: resellerId, ...payload }).then(r => r.data),

  // Payouts
  listAllPayouts: (params?: { page?: number; page_size?: number; status?: string; reseller_id?: string }) =>
    apiClient.get<PaginatedResponse<PayoutRequestResponse>>('/admin/reseller-finance/payouts', { params }).then(r => r.data),

  getPayout: (payoutId: string) =>
    apiClient.get<PayoutRequestResponse>(`/admin/reseller-finance/payouts/${payoutId}`).then(r => r.data),

  createPayout: (payload: { reseller_id: string; amount: string; reason?: string }) =>
    apiClient.post<PayoutRequestResponse>('/admin/reseller-finance/payouts', payload).then(r => r.data),

  reviewPayout: (payoutId: string, payload: { action: 'approve' | 'reject'; admin_note?: string }) =>
    apiClient.post<PayoutRequestResponse>(`/admin/reseller-finance/payouts/${payoutId}/review`, payload).then(r => r.data),

  approvePayout: (payoutId: string) =>
    apiClient.post<PayoutRequestResponse>(`/admin/reseller-finance/payouts/${payoutId}/approve`).then(r => r.data),

  rejectPayout: (payoutId: string, notes?: string) =>
    apiClient.post<PayoutRequestResponse>(`/admin/reseller-finance/payouts/${payoutId}/reject`, { notes: notes ?? null }).then(r => r.data),

  markPayoutPaid: (payoutId: string, payout_notes?: string) =>
    apiClient.post<PayoutRequestResponse>(`/admin/reseller-finance/payouts/${payoutId}/paid`, { payout_notes: payout_notes ?? null }).then(r => r.data),

  // Referrals (admin)
  listAllReferrals: (params?: { page?: number; page_size?: number; reseller_id?: string }) =>
    apiClient.get<PaginatedResponse<TenantReferralResponse>>('/admin/reseller-finance/referrals', { params }).then(r => r.data),

  // Commissions
  listCommissions: (params?: { page?: number; page_size?: number; reseller_id?: string }) =>
    apiClient.get<PaginatedResponse<CommissionRecord>>('/admin/reseller-finance/commissions', { params }).then(r => r.data),

  // Notes
  listNotes: (resellerId: string) =>
    apiClient.get<{ items: Array<{ id: string; note: string; created_by: string; created_at: string }> }>(`/admin/reseller-finance/notes/${resellerId}`).then(r => r.data),

  addNote: (resellerId: string, note: string) =>
    apiClient.post(`/admin/reseller-finance/notes/${resellerId}`, { note }).then(r => r.data),
}
