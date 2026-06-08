// Auth & Users

export type UserRole =
  | 'SUPER_ADMIN'
  | 'RESELLER'
  | 'BUSINESS_OWNER'
  | 'MANAGER'
  | 'INVENTORY_STAFF'
  | 'CASHIER'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  initials: string
  tenantId?: string
  branchId?: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginCredentials {
  email: string
  password: string
}
// Products & Categories


export interface Category {
  id: string
  name: string
  color: string
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  unit: string
  taxRate: number
  barcode: string
  color: string
  promoDiscountPct: number  // 0 = no active promo; >0 = auto line-discount %
  promoLabel: string        // e.g. "10% off" or "500 Kyats off"
}
// Cart


export interface CartItem extends Product {
  qty: number
  lineDiscount: number // percentage 0–100
}

export interface Cart {
  items: CartItem[]
  discount: number // order-level percentage 0–100
  note: string
}

export interface CartTotals {
  itemSubtotal: number
  orderDiscAmt: number
  tax: number
  total: number
  itemCount: number
  taxEnabled: boolean
  taxName: string
  taxInclusive: boolean
  taxRate: number  // 0–100
}
// Session


export interface Session {
  id: string
  openingBalance: number
  startTime: Date
  status: 'open' | 'closed'
  cashier: User
  endTime?: Date
}
// Sales & Payments


export type PaymentMethod = 'cash' | 'card' | 'split'
export type SaleStatus = 'completed' | 'refunded' | 'voided'

// Card/digital sub-methods — values match backend PaymentMethod enum
export type CardSubMethod = 'CARD' | 'KPAY' | 'WAVEPAY' | 'AYA_PAY' | 'CB_PAY' | 'BANK_TRANSFER'

export interface SaleItem {
  id: string
  name: string
  sku: string
  price: number
  qty: number
  taxRate: number
}

export interface SplitPayment {
  method: 'cash' | CardSubMethod
  amount: number
  notes?: string
}

export interface Sale {
  id: string
  date: Date
  cashier: User
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: PaymentMethod
  amountTendered?: number
  change?: number
  splitPayments?: SplitPayment[]
  status: SaleStatus
  note?: string
}

export interface CompleteSalePayload {
  subtotal: number
  discount: number
  tax: number
  total: number
  amountTendered: number
  change: number
}
// Sync & Offline


export type SyncOperationType =
  | 'SALE_CREATE'
  | 'INVENTORY_UPDATE'
  | 'PRODUCT_UPDATE'
  | 'PAYMENT_PROCESS'

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'done'

export interface SyncOperation {
  id: string
  type: SyncOperationType
  payload?: unknown
  status: 'pending' | 'failed'
  createdAt: Date
  retries: number
}
// Checkout flow


export type CheckoutStep = 'cart' | 'payment' | 'processing' | 'receipt'
// App screen routing


export type AppScreen =
  | 'login'
  | 'session-open'
  | 'session-close'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'sales'
  | 'sync'
// Toast


export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  message: string
  type: ToastType
}
// RBAC


export type RBACSection = 'pos' | 'products' | 'inventory' | 'sales' | 'sync'
// API response wrappers


export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  results: T[]
  count: number
  next?: string
  previous?: string
}

export interface ApiError {
  message: string
  detail?: string
  code?: string
}
