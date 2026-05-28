import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useResellerStore } from '@/store/reseller.store'
import { resellersService } from '@/services/resellers/resellers.service'
import type { ResellerPermissions } from '@/shared/types'

const DEFAULT_PERMISSIONS: ResellerPermissions = {
  view_revenue: false,
  view_profit: false,
  view_analytics: false,
  view_inventory: false,
  adjust_inventory: false,
  transfer_inventory: false,
  view_customers: false,
  view_customer_debt: false,
  record_customer_payment: false,
  view_procurement: false,
  create_purchase_order: false,
  approve_purchase_order: false,
  view_subscription_status: false,
  view_staff: false,
  manage_staff: false,
  export_data: false,
  view_branch_reports: false,
}

interface ResellerPermissionContextValue {
  permissions: ResellerPermissions
  isLoading: boolean
  // Named helpers
  canViewRevenue: () => boolean
  canViewProfit: () => boolean
  canViewAnalytics: () => boolean
  canViewInventory: () => boolean
  canAdjustInventory: () => boolean
  canTransferInventory: () => boolean
  canViewCustomers: () => boolean
  canViewCustomerDebt: () => boolean
  canRecordCustomerPayments: () => boolean
  canViewProcurement: () => boolean
  canCreatePO: () => boolean
  canApprovePO: () => boolean
  canViewSubscription: () => boolean
  canViewStaff: () => boolean
  canManageStaff: () => boolean
  canExport: () => boolean
  canViewBranchReports: () => boolean
}

const ResellerPermissionContext = createContext<ResellerPermissionContextValue | null>(null)

export function ResellerPermissionProvider({ children }: { children: ReactNode }) {
  const selectedTenantId = useResellerStore(s => s.selectedTenantId)

  const { data, isLoading } = useQuery({
    queryKey: ['reseller-permissions', selectedTenantId],
    queryFn: () => resellersService.getMyPermissions(selectedTenantId!),
    enabled: !!selectedTenantId,
    staleTime: 2 * 60 * 1000,
  })

  const permissions: ResellerPermissions = data?.permissions ?? DEFAULT_PERMISSIONS

  const value: ResellerPermissionContextValue = {
    permissions,
    isLoading,
    canViewRevenue:            () => permissions.view_revenue,
    canViewProfit:             () => permissions.view_profit,
    canViewAnalytics:          () => permissions.view_analytics,
    canViewInventory:          () => permissions.view_inventory,
    canAdjustInventory:        () => permissions.adjust_inventory,
    canTransferInventory:      () => permissions.transfer_inventory,
    canViewCustomers:          () => permissions.view_customers,
    canViewCustomerDebt:       () => permissions.view_customer_debt,
    canRecordCustomerPayments: () => permissions.record_customer_payment,
    canViewProcurement:        () => permissions.view_procurement,
    canCreatePO:               () => permissions.create_purchase_order,
    canApprovePO:              () => permissions.approve_purchase_order,
    canViewSubscription:       () => permissions.view_subscription_status,
    canViewStaff:              () => permissions.view_staff,
    canManageStaff:            () => permissions.manage_staff,
    canExport:                 () => permissions.export_data,
    canViewBranchReports:      () => permissions.view_branch_reports,
  }

  return (
    <ResellerPermissionContext.Provider value={value}>
      {children}
    </ResellerPermissionContext.Provider>
  )
}

export function useResellerPermissions(): ResellerPermissionContextValue {
  const ctx = useContext(ResellerPermissionContext)
  if (!ctx) throw new Error('useResellerPermissions must be used inside ResellerPermissionProvider')
  return ctx
}
