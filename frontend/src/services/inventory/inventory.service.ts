import apiClient from '@/app/lib/axios'
import type {
  InventoryItem,
  InventoryAdjustmentRequest,
  InventoryAdjustmentDetail,
  InventoryTransfer,
  PaginatedResponse,
} from '@/shared/types'

export interface BranchInventoryParams {
  product_id?: string
  low_stock?: boolean
  out_of_stock?: boolean
  page?: number
  page_size?: number
}

export interface OpeningStockRequest {
  branch_id: string
  items: Array<{ product_id: string; variant_id?: string; quantity: string; cost_price?: string }>
  notes?: string
}

export interface TransferCreateRequest {
  from_branch_id: string
  to_branch_id: string
  items: Array<{ product_id: string; variant_id?: string; quantity_requested: string }>
  notes?: string
}

export const inventoryService = {
  getBranchInventory: (branchId: string, params?: BranchInventoryParams) =>
    apiClient.get<PaginatedResponse<InventoryItem>>(`/inventory/branches/${branchId}`, { params }).then(r => r.data),

  getBranchMovements: (branchId: string, params?: { product_id?: string; page?: number; page_size?: number }) =>
    apiClient.get(`/inventory/branches/${branchId}/movements`, { params }).then(r => r.data),

  getBranchValuation: (branchId: string) =>
    apiClient.get(`/inventory/branches/${branchId}/valuation`).then(r => r.data),

  createAdjustment: (payload: InventoryAdjustmentRequest) =>
    apiClient.post('/inventory/adjustments', payload).then(r => r.data),

  listAdjustments: (params?: { branch_id?: string; page?: number }) =>
    apiClient.get('/inventory/adjustments', { params }).then(r => r.data),

  getAdjustment: (adjustmentId: string) =>
    apiClient.get<InventoryAdjustmentDetail>(`/inventory/adjustments/${adjustmentId}`).then(r => r.data),

  setOpeningStock: (payload: OpeningStockRequest) =>
    apiClient.post('/inventory/opening-stock', payload).then(r => r.data),

  listTransfers: (params?: { branch_id?: string; status?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<InventoryTransfer>>('/inventory/transfers', { params }).then(r => r.data),

  getTransfer: (transferId: string) =>
    apiClient.get<InventoryTransfer>(`/inventory/transfers/${transferId}`).then(r => r.data),

  createTransfer: (payload: TransferCreateRequest) =>
    apiClient.post('/inventory/transfers', payload).then(r => r.data),

  setReorderLevels: (branchId: string, productId: string, payload: { reorder_point: number; reorder_quantity: number }) =>
    apiClient.patch(`/inventory/branches/${branchId}/products/${productId}/reorder`, payload).then(r => r.data),

  approveTransfer: (transferId: string) =>
    apiClient.post(`/inventory/transfers/${transferId}/approve`).then(r => r.data),

  executeTransfer: (transferId: string) =>
    apiClient.post(`/inventory/transfers/${transferId}/execute`).then(r => r.data),

  cancelTransfer: (transferId: string) =>
    apiClient.post(`/inventory/transfers/${transferId}/cancel`).then(r => r.data),
}
