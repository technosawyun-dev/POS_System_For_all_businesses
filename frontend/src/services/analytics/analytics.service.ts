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
}
