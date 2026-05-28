import apiClient from '@/app/lib/axios'
import type { Receipt } from '@/shared/types'

export interface ReceiptListResponse {
  items: Receipt[]
  total: number
  page: number
  page_size: number
}

export const receiptsService = {
  list: (params?: { branch_id?: string; page?: number; page_size?: number }) =>
    apiClient.get<ReceiptListResponse>('/receipts', { params }).then(r => r.data),

  getById: (receiptId: string) =>
    apiClient.get<Receipt>(`/receipts/${receiptId}`).then(r => r.data),

  getByNumber: (receiptNumber: string) =>
    apiClient.get<Receipt>(`/receipts/number/${receiptNumber}`).then(r => r.data),

  getByOrderId: (orderId: string) =>
    apiClient.get<Receipt>(`/receipts/order/${orderId}`).then(r => r.data),
}
