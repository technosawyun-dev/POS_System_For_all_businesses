import apiClient from '@/app/lib/axios'
import type {
  InventoryItem,
  InventoryAdjustmentRequest,
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
  items: Array<{ product_id: string; variant_id?: string; quantity: string }>
  notes?: string
}

export const inventoryService = {
  getBranchInventory: (branchId: string, params?: BranchInventoryParams) =>
    apiClient.get<PaginatedResponse<InventoryItem>>(`/inventory/branches/${branchId}`, { params }).then(r => r.data),

  getBranchMovements: (branchId: string, params?: { page?: number; page_size?: number }) =>
    apiClient.get(`/inventory/branches/${branchId}/movements`, { params }).then(r => r.data),

  getBranchValuation: (branchId: string) =>
    apiClient.get(`/inventory/branches/${branchId}/valuation`).then(r => r.data),

  createAdjustment: (payload: InventoryAdjustmentRequest) =>
    apiClient.post('/inventory/adjustments', payload).then(r => r.data),

  listAdjustments: (params?: { branch_id?: string; page?: number }) =>
    apiClient.get('/inventory/adjustments', { params }).then(r => r.data),

  setOpeningStock: (payload: OpeningStockRequest) =>
    apiClient.post('/inventory/opening-stock', payload).then(r => r.data),

  createTransfer: (payload: TransferCreateRequest) =>
    apiClient.post('/inventory/transfers', payload).then(r => r.data),

  approveTransfer: (transferId: string) =>
    apiClient.patch(`/inventory/transfers/${transferId}/approve`).then(r => r.data),

  executeTransfer: (transferId: string) =>
    apiClient.post(`/inventory/transfers/${transferId}/execute`).then(r => r.data),

  cancelTransfer: (transferId: string) =>
    apiClient.post(`/inventory/transfers/${transferId}/cancel`).then(r => r.data),
}
