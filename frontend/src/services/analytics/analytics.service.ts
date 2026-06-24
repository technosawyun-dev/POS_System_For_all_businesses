import apiClient from '@/app/lib/axios'
import type {
  DashboardKPIs,
  SalesSummary,
  SalesTrend,
  TopProduct,
  CategorySales,
  BranchSales,
  CashierSales,
  PaymentMethodStat,
  InventoryValuation,
  LowStockItem,
  MovementReport,
  FastMovingItem,
  DeadStockItem,
  FinancialSummary,
  ProfitReport,
} from '@/shared/types'

export interface AnalyticsParams {
  branch_id?: string
  start_date?: string
  end_date?: string
}

export const analyticsService = {
  getDashboard: (params?: { branch_id?: string }) =>
    apiClient.get<DashboardKPIs>('/analytics/dashboard', { params }).then(r => r.data),

  getSalesSummary: (params?: AnalyticsParams) =>
    apiClient.get<SalesSummary>('/analytics/sales/summary', { params }).then(r => r.data),

  getSalesTrend: (params?: AnalyticsParams & { granularity?: 'daily' | 'weekly' | 'monthly' }) =>
    apiClient.get<SalesTrend>('/analytics/sales/trend', { params }).then(r => r.data),

  getTopProducts: (params?: AnalyticsParams & { limit?: number }) =>
    apiClient.get<TopProduct[]>('/analytics/sales/top-products', { params }).then(r => r.data),

  getSalesByCategory: (params?: AnalyticsParams) =>
    apiClient.get<CategorySales[]>('/analytics/sales/by-category', { params }).then(r => r.data),

  getSalesByBranch: (params?: AnalyticsParams) =>
    apiClient.get<BranchSales[]>('/analytics/sales/by-branch', { params }).then(r => r.data),

  getSalesByCashier: (params?: AnalyticsParams) =>
    apiClient.get<CashierSales[]>('/analytics/sales/by-cashier', { params }).then(r => r.data),

  getPaymentMethods: (params?: AnalyticsParams) =>
    apiClient.get<PaymentMethodStat[]>('/analytics/sales/payment-methods', { params }).then(r => r.data),

  getInventoryValuation: (params?: { branch_id?: string }) =>
    apiClient.get<InventoryValuation>('/analytics/inventory/valuation', { params }).then(r => r.data),

  getLowStock: (params?: { branch_id?: string }) =>
    apiClient.get<LowStockItem[]>('/analytics/inventory/low-stock', { params }).then(r => r.data),

  getInventoryMovements: (params?: AnalyticsParams & { movement_type?: string }) =>
    apiClient.get<MovementReport[]>('/analytics/inventory/movements', { params }).then(r => r.data),

  getFastMoving: (params?: AnalyticsParams & { limit?: number }) =>
    apiClient.get<FastMovingItem[]>('/analytics/inventory/fast-moving', { params }).then(r => r.data),

  getDeadStock: (params?: { branch_id?: string; days?: number }) =>
    apiClient.get<DeadStockItem[]>('/analytics/inventory/dead-stock', { params }).then(r => r.data),

  getFinancialSummary: (params?: AnalyticsParams) =>
    apiClient.get<FinancialSummary>('/analytics/financial/summary', { params }).then(r => r.data),

  getProfitReport: (params?: AnalyticsParams & { by?: 'product' | 'category' | 'branch' }) =>
    apiClient.get<ProfitReport>('/analytics/financial/profit', { params }).then(r => r.data),

  exportSalesRefunds: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/sales-refunds', { params, responseType: 'blob' }).then(r => r.data),

  exportOrders: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/orders', { params, responseType: 'blob' }).then(r => r.data),

  exportInventoryStocks: (params?: { branch_id?: string; format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/inventory-stocks', { params, responseType: 'blob' }).then(r => r.data),

  exportTopProducts: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/top-products', { params, responseType: 'blob' }).then(r => r.data),

  exportSalesByCashier: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/sales-by-cashier', { params, responseType: 'blob' }).then(r => r.data),

  exportSalesByCategory: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/sales-by-category', { params, responseType: 'blob' }).then(r => r.data),

  exportPaymentMethods: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/payment-methods', { params, responseType: 'blob' }).then(r => r.data),

  exportSalesTrend: (params?: AnalyticsParams & { granularity?: string; format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/sales-trend', { params, responseType: 'blob' }).then(r => r.data),

  exportProfitReport: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/profit-report', { params, responseType: 'blob' }).then(r => r.data),

  exportLowStock: (params?: { branch_id?: string; format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/low-stock', { params, responseType: 'blob' }).then(r => r.data),

  exportFastMoving: (params?: AnalyticsParams & { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/fast-moving', { params, responseType: 'blob' }).then(r => r.data),

  exportDeadStock: (params?: { branch_id?: string; days?: number; format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/dead-stock', { params, responseType: 'blob' }).then(r => r.data),

  exportStockMovements: (params?: AnalyticsParams & { movement_type?: string; format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/stock-movements', { params, responseType: 'blob' }).then(r => r.data),

  exportCustomers: (params?: { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/customers', { params, responseType: 'blob' }).then(r => r.data),

  exportPurchaseOrders: (params?: { start_date?: string; end_date?: string; format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/purchase-orders', { params, responseType: 'blob' }).then(r => r.data),

  exportGoodsReceipts: (params?: { start_date?: string; end_date?: string; format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/goods-receipts', { params, responseType: 'blob' }).then(r => r.data),

  exportSupplierPayables: (params?: { format?: 'csv' | 'xlsx' }) =>
    apiClient.get<Blob>('/analytics/export/supplier-payables', { params, responseType: 'blob' }).then(r => r.data),
}
