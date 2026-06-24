import apiClient from '@/app/lib/axios'
import type { Customer, CustomerContact, CreateCustomerRequest, PaginatedResponse, LedgerEntry, CustomerStatement } from '@/shared/types'

export interface UpdateCustomerRequest extends Omit<Partial<CreateCustomerRequest>, 'notes'> {
  is_active?: boolean
  notes?: string | null
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
    apiClient.get<PaginatedResponse<Customer>>('/customers/search', { params: { q: query } }).then(r => r.data.items ?? []),

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
    apiClient.get<unknown>(`/customers/${id}/ledger`, { params }).then(r => {
      // Backend returns a plain array (not paginated). Map backend field names to frontend shape.
      const raw: Record<string, unknown>[] = Array.isArray(r.data) ? r.data as Record<string, unknown>[] : []
      const items: LedgerEntry[] = raw.map(e => {
        const entryType = String(e.entry_type ?? '')
        const isDebt = entryType === 'SALE_DEBT'
        const isCredit = entryType === 'PAYMENT' || entryType === 'REFUND_CREDIT'
        const amount = String(e.amount ?? '0')
        return {
          id: String(e.id ?? ''),
          type: (isDebt ? 'SALE' : entryType === 'REFUND_CREDIT' ? 'CREDIT_NOTE' : entryType) as LedgerEntry['type'],
          date: String(e.created_at ?? ''),
          description: e.note ? String(e.note) : undefined,
          reference: e.reference_id ? String(e.reference_id) : undefined,
          debit:   isDebt    ? amount : undefined,
          credit:  isCredit  ? amount : undefined,
          balance: String(e.balance_after ?? '0'),
        }
      })
      return { items, total: items.length, total_pages: 1, page: 1, page_size: items.length } as PaginatedResponse<LedgerEntry>
    }),

  getStatement: (id: string) =>
    apiClient.get<unknown>(`/customers/${id}/statement`).then(r => {
      // Backend field names differ from the frontend CustomerStatement type — remap here.
      const d = r.data as Record<string, unknown>
      const rawEntries: Record<string, unknown>[] = Array.isArray(d.ledger_entries) ? d.ledger_entries as Record<string, unknown>[] : []
      const entries: LedgerEntry[] = rawEntries.map(e => {
        const entryType = String(e.entry_type ?? '')
        const isDebt = entryType === 'SALE_DEBT'
        const isCredit = entryType === 'PAYMENT' || entryType === 'REFUND_CREDIT'
        const amount = String(e.amount ?? '0')
        return {
          id: String(e.id ?? ''),
          type: (isDebt ? 'SALE' : entryType === 'REFUND_CREDIT' ? 'CREDIT_NOTE' : entryType) as LedgerEntry['type'],
          date: String(e.created_at ?? ''),
          description: e.note ? String(e.note) : undefined,
          reference: e.reference_id ? String(e.reference_id) : undefined,
          debit:   isDebt   ? amount : undefined,
          credit:  isCredit ? amount : undefined,
          balance: String(e.balance_after ?? '0'),
        }
      })
      return {
        opening_balance: String(d.opening_balance ?? '0'),
        closing_balance: String(d.current_balance ?? '0'),
        total_debits:    String(d.total_debited   ?? '0'),
        total_credits:   String(d.total_credited  ?? '0'),
        generated_at:    d.date_to ? String(d.date_to) : undefined,
        entries,
      } as CustomerStatement
    }),

  delete: (id: string) =>
    apiClient.delete(`/customers/${id}`).then(r => r.data),

  addContact: (id: string, payload: { contact_name: string; contact_phone: string; contact_relationship?: string }) =>
    apiClient.post<CustomerContact>(`/customers/${id}/contacts`, payload).then(r => r.data),
}
