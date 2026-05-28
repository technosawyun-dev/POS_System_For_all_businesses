import apiClient from '@/app/lib/axios'
import type { Customer, CustomerContact, CreateCustomerRequest, PaginatedResponse, LedgerEntry, CustomerStatement } from '@/shared/types'

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {
  is_active?: boolean
}

export interface RecordPaymentRequest {
  amount: string
  note?: string
  reference_type?: string
  reference_id?: string
}

export interface AdjustBalanceRequest {
  amount: string
  note?: string
  reference_type?: string
  reference_id?: string
}

export interface AddNoteRequest {
  note: string
}

export const customersService = {
  list: (params?: { search?: string; is_active?: boolean; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Customer>>('/customers', { params }).then(r => r.data),

  search: (query: string) =>
    apiClient.get<Customer[]>('/customers/search', { params: { q: query } }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<Customer>(`/customers/${id}`).then(r => r.data),

  create: (payload: CreateCustomerRequest) =>
    apiClient.post<Customer>('/customers', payload).then(r => r.data),

  update: (id: string, payload: UpdateCustomerRequest) =>
    apiClient.patch<Customer>(`/customers/${id}`, payload).then(r => r.data),

  addNote: (id: string, payload: AddNoteRequest) =>
    apiClient.post(`/customers/${id}/notes`, payload).then(r => r.data),

  recordPayment: (id: string, payload: RecordPaymentRequest) =>
    apiClient.post(`/customers/${id}/payments`, payload).then(r => r.data),

  adjustBalance: (id: string, payload: AdjustBalanceRequest) =>
    apiClient.post(`/customers/${id}/adjustments`, payload).then(r => r.data),

  getLedger: (id: string, params?: { page?: number }) =>
    apiClient.get<PaginatedResponse<LedgerEntry>>(`/customers/${id}/ledger`, { params }).then(r => r.data),

  getStatement: (id: string) =>
    apiClient.get<CustomerStatement>(`/customers/${id}/statement`).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/customers/${id}`).then(r => r.data),

  addContact: (id: string, payload: { contact_name: string; contact_phone: string; contact_relationship?: string }) =>
    apiClient.post<CustomerContact>(`/customers/${id}/contacts`, payload).then(r => r.data),
}
