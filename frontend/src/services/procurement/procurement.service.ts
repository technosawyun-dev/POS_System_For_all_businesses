import apiClient from '@/app/lib/axios'
import type {
  PaginatedResponse,
  Supplier, SupplierSummary, SupplierContact, SupplierCreateRequest, SupplierUpdateRequest, SupplierBalance,
  PurchaseOrderSummary, PurchaseOrderDetail, PurchaseOrderCreateRequest,
  GoodsReceiptSummary, GoodsReceiptDetail, GoodsReceiptCreateRequest,
  SupplierPayableSummary, SupplierPayableDetail, SupplierPayment, SupplierPaymentCreateRequest,
} from '@/shared/types'

export const procurementService = {
  listSuppliers: (params?: { status?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<SupplierSummary>>('/suppliers', { params }).then(r => r.data),

  getSupplier: (id: string) =>
    apiClient.get<Supplier>(`/suppliers/${id}`).then(r => r.data),

  createSupplier: (payload: SupplierCreateRequest) =>
    apiClient.post<Supplier>('/suppliers', payload).then(r => r.data),

  updateSupplier: (id: string, payload: SupplierUpdateRequest) =>
    apiClient.patch<Supplier>(`/suppliers/${id}`, payload).then(r => r.data),

  deleteSupplier: (id: string) =>
    apiClient.delete(`/suppliers/${id}`).then(r => r.data),

  listSupplierContacts: (supplierId: string) =>
    apiClient.get<SupplierContact[]>(`/suppliers/${supplierId}/contacts`).then(r => r.data),

  addSupplierContact: (supplierId: string, payload: { name: string; email?: string; phone?: string; position?: string; is_primary?: boolean }) =>
    apiClient.post<SupplierContact>(`/suppliers/${supplierId}/contacts`, payload).then(r => r.data),

  updateSupplierContact: (supplierId: string, contactId: string, payload: { name?: string; email?: string; phone?: string; position?: string; is_primary?: boolean }) =>
    apiClient.patch<SupplierContact>(`/suppliers/${supplierId}/contacts/${contactId}`, payload).then(r => r.data),

  deleteSupplierContact: (supplierId: string, contactId: string) =>
    apiClient.delete(`/suppliers/${supplierId}/contacts/${contactId}`).then(r => r.data),

  getSupplierBalance: (supplierId: string) =>
    apiClient.get<SupplierBalance>(`/procurement/suppliers/${supplierId}/balance`).then(r => r.data),

  listOrders: (params?: {
    branch_id?: string; supplier_id?: string; status?: string
    page?: number; page_size?: number
  }) =>
    apiClient.get<PaginatedResponse<PurchaseOrderSummary>>('/procurement/purchase-orders', { params }).then(r => r.data),

  getOrder: (id: string) =>
    apiClient.get<PurchaseOrderDetail>(`/procurement/purchase-orders/${id}`).then(r => r.data),

  updateOrder: (id: string, payload: Partial<PurchaseOrderCreateRequest>) =>
    apiClient.patch<PurchaseOrderDetail>(`/procurement/purchase-orders/${id}`, payload).then(r => r.data),

  createOrder: (payload: PurchaseOrderCreateRequest) =>
    apiClient.post<PurchaseOrderDetail>('/procurement/purchase-orders', payload).then(r => r.data),

  submitOrder: (id: string) =>
    apiClient.post<PurchaseOrderDetail>(`/procurement/purchase-orders/${id}/submit`).then(r => r.data),

  approveOrder: (id: string) =>
    apiClient.post<PurchaseOrderDetail>(`/procurement/purchase-orders/${id}/approve`).then(r => r.data),

  cancelOrder: (id: string, reason: string) =>
    apiClient.post<PurchaseOrderDetail>(`/procurement/purchase-orders/${id}/cancel`, { reason }).then(r => r.data),

  listReceipts: (params?: {
    purchase_order_id?: string; branch_id?: string
    page?: number; page_size?: number
  }) =>
    apiClient.get<PaginatedResponse<GoodsReceiptSummary>>('/procurement/receipts', { params }).then(r => r.data),

  getReceipt: (id: string) =>
    apiClient.get<GoodsReceiptDetail>(`/procurement/receipts/${id}`).then(r => r.data),

  createReceipt: (payload: GoodsReceiptCreateRequest) =>
    apiClient.post<GoodsReceiptDetail>('/procurement/receipts', payload).then(r => r.data),

  listPayables: (params?: { supplier_id?: string; status?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<SupplierPayableSummary>>('/procurement/payables', { params }).then(r => r.data),

  getPayable: (id: string) =>
    apiClient.get<SupplierPayableDetail>(`/procurement/payables/${id}`).then(r => r.data),

  recordPayment: (payableId: string, payload: SupplierPaymentCreateRequest) =>
    apiClient.post<SupplierPayment>(`/procurement/payables/${payableId}/payments`, payload).then(r => r.data),
}
