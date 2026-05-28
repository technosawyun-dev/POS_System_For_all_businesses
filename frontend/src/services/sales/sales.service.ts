import apiClient from '@/app/lib/axios'
import type {
  Cart,
  CartCreateRequest,
  CartItemRequest,
  CheckoutRequest,
  Order,
  VoidOrderRequest,
  RefundRequest,
  RefundRecord,
  CashierSession,
  OpenSessionRequest,
  CloseSessionRequest,
  PaginatedResponse,
} from '@/shared/types'


export const cartService = {
  create: (payload: CartCreateRequest) =>
    apiClient.post<Cart>('/sales/carts', payload).then(r => r.data),

  get: (cartId: string) =>
    apiClient.get<Cart>(`/sales/carts/${cartId}`).then(r => r.data),

  addItem: (cartId: string, payload: CartItemRequest) =>
    apiClient.post<Cart>(`/sales/carts/${cartId}/items`, payload).then(r => r.data),

  updateItem: (cartId: string, itemId: string, payload: Partial<CartItemRequest>) =>
    apiClient.patch<Cart>(`/sales/carts/${cartId}/items/${itemId}`, payload).then(r => r.data),

  removeItem: (cartId: string, itemId: string) =>
    apiClient.delete(`/sales/carts/${cartId}/items/${itemId}`).then(r => r.data),
}


export const checkoutService = {
  checkout: (payload: CheckoutRequest) =>
    apiClient.post<Order>('/sales/checkout', payload).then(r => r.data),

  listOrders: (params?: { branch_id?: string; order_status?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Order>>('/sales/orders', { params }).then(r => r.data),

  getOrder: (orderId: string) =>
    apiClient.get<Order>(`/sales/orders/${orderId}`).then(r => r.data),

  getOrderByNumber: (orderNumber: string) =>
    apiClient.get<Order>(`/sales/orders/by-number/${encodeURIComponent(orderNumber)}`).then(r => r.data),

  voidOrder: (orderId: string, payload: VoidOrderRequest) =>
    apiClient.post<Order>(`/sales/orders/${orderId}/void`, payload).then(r => r.data),
}

export const refundService = {
  create: (payload: RefundRequest) =>
    apiClient.post<RefundRecord>('/payments/refunds', payload).then(r => r.data),

  list: (params?: { order_id?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<RefundRecord>>('/payments/refunds', { params }).then(r => r.data),
}


export const sessionService = {
  open: (payload: OpenSessionRequest) =>
    apiClient.post<CashierSession>('/cashier-sessions', payload).then(r => r.data),

  close: (sessionId: string, payload: CloseSessionRequest) =>
    apiClient.post<CashierSession>(`/cashier-sessions/${sessionId}/close`, payload).then(r => r.data),

  get: (sessionId: string) =>
    apiClient.get<CashierSession>(`/cashier-sessions/${sessionId}`).then(r => r.data),

  list: (params?: { branch_id?: string; status?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<CashierSession>>('/cashier-sessions', { params }).then(r => r.data),
}
