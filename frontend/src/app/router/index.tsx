import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { canAccess } from '@/shared/constants/rbac'

import RoleGuard from '@/shared/components/guards/RoleGuard'
import AuthLayout from '@/shared/layouts/AuthLayout'
import DashboardLayout from '@/shared/layouts/DashboardLayout'
import POSLayout from '@/shared/layouts/POSLayout'
import PlaceholderPage from '@/shared/components/PlaceholderPage'
import UnauthorizedPage from '@/shared/components/UnauthorizedPage'
import NotFoundPage from '@/shared/components/NotFoundPage'
import SettingsGapPage from '@/features/settings/SettingsGapPage'
import { Spinner } from '@/components/ui'

import LoginPage from '@/modules/auth/LoginPage'
import RegisterPage from '@/modules/auth/RegisterPage'
const PricingPage      = lazy(() => import('@/modules/public/PricingPage'))
const OnboardingWizard = lazy(() => import('@/features/onboarding/OnboardingWizard'))
const TrialExpiredPage = lazy(() => import('@/features/subscription/TrialExpiredPage'))

const POSScreen              = lazy(() => import('@/features/pos/POSScreen'))
const ProductsScreen         = lazy(() => import('@/features/products/ProductsScreen'))
const BrandsPage             = lazy(() => import('@/features/products/BrandsPage'))
const CategoriesPage         = lazy(() => import('@/features/products/CategoriesPage'))
const InventoryScreen        = lazy(() => import('@/features/inventory/InventoryScreen'))
const SalesScreen            = lazy(() => import('@/features/sales/SalesScreen'))
const SyncScreen             = lazy(() => import('@/features/sync/SyncScreen'))
const SessionOpenScreen      = lazy(() => import('@/features/auth/SessionOpenScreen'))
const SessionCloseScreen     = lazy(() => import('@/features/auth/SessionCloseScreen'))
const CustomersScreen        = lazy(() => import('@/features/customers/CustomersScreen'))
const CustomerFormPage       = lazy(() => import('@/features/customers/CustomerFormPage'))
const CustomerLayout         = lazy(() => import('@/features/customers/CustomerLayout'))
const CustomerDetailPage     = lazy(() => import('@/features/customers/CustomerDetailPage'))
const CustomerLedgerPage     = lazy(() => import('@/features/customers/CustomerLedgerPage'))
const CustomerPaymentsPage   = lazy(() => import('@/features/customers/CustomerPaymentsPage'))
const CustomerStatementPage  = lazy(() => import('@/features/customers/CustomerStatementPage'))
const AnalyticsLayout           = lazy(() => import('@/features/analytics/AnalyticsLayout'))
const AnalyticsDashboardPage    = lazy(() => import('@/features/analytics/AnalyticsDashboardPage'))
const SalesAnalyticsPage        = lazy(() => import('@/features/analytics/SalesAnalyticsPage'))
const InventoryAnalyticsPage    = lazy(() => import('@/features/analytics/InventoryAnalyticsPage'))
const CustomerAnalyticsPage     = lazy(() => import('@/features/analytics/CustomerAnalyticsPage'))
const FinancialAnalyticsPage    = lazy(() => import('@/features/analytics/FinancialAnalyticsPage'))
const StaffAnalyticsPage        = lazy(() => import('@/features/analytics/StaffAnalyticsPage'))
const ProcurementLayout         = lazy(() => import('@/features/procurement/ProcurementLayout'))
const ProcurementDashboardPage  = lazy(() => import('@/features/procurement/ProcurementDashboardPage'))
const SuppliersPage             = lazy(() => import('@/features/procurement/SuppliersPage'))
const SupplierFormPage          = lazy(() => import('@/features/procurement/SupplierFormPage'))
const SupplierDetailPage        = lazy(() => import('@/features/procurement/SupplierDetailPage'))
const PurchaseOrdersPage        = lazy(() => import('@/features/procurement/PurchaseOrdersPage'))
const PurchaseOrderCreatePage   = lazy(() => import('@/features/procurement/PurchaseOrderCreatePage'))
const PurchaseOrderDetailPage   = lazy(() => import('@/features/procurement/PurchaseOrderDetailPage'))
const GoodsReceiptsPage         = lazy(() => import('@/features/procurement/GoodsReceiptsPage'))
const GoodsReceiptDetailPage    = lazy(() => import('@/features/procurement/GoodsReceiptDetailPage'))
const SupplierPayablesPage      = lazy(() => import('@/features/procurement/SupplierPayablesPage'))
const SupplierPaymentsPage      = lazy(() => import('@/features/procurement/SupplierPaymentsPage'))
const NotificationsPage         = lazy(() => import('@/features/notifications/NotificationsPage'))
const NotificationDetailPage    = lazy(() => import('@/features/notifications/NotificationDetailPage'))
const NotificationPreferencesPage = lazy(() => import('@/features/notifications/NotificationPreferencesPage'))

const SubscriptionLayout          = lazy(() => import('@/features/subscription/SubscriptionLayout'))
const CurrentSubscriptionPage     = lazy(() => import('@/features/subscription/CurrentSubscriptionPage'))
const BillingHistoryPage          = lazy(() => import('@/features/subscription/BillingHistoryPage'))

const SettingsLayout              = lazy(() => import('@/features/settings/SettingsLayout'))
const ProfileSettingsPage         = lazy(() => import('@/features/settings/ProfileSettingsPage'))
const BusinessSettingsPage        = lazy(() => import('@/features/settings/BusinessSettingsPage'))
const BranchesSettingsPage        = lazy(() => import('@/features/settings/BranchesSettingsPage'))
const StaffSettingsPage           = lazy(() => import('@/features/settings/StaffSettingsPage'))
const ReceiptSettingsPage         = lazy(() => import('@/features/settings/ReceiptSettingsPage'))
const TaxSettingsPage             = lazy(() => import('@/features/settings/TaxSettingsPage'))
const PreferencesSettingsPage     = lazy(() => import('@/features/settings/PreferencesSettingsPage'))
const BusinessDashboardPage = lazy(() => import('@/features/dashboard/BusinessDashboardPage'))
const StaffDashboardPage    = lazy(() => import('@/features/dashboard/StaffDashboardPage'))

const PlansPage                   = lazy(() => import('@/features/superadmin/PlansPage'))
const PlanFormPage                = lazy(() => import('@/features/superadmin/PlanFormPage'))
const PlanDetailPage              = lazy(() => import('@/features/superadmin/PlanDetailPage'))
const AdminSubscriptionsPage      = lazy(() => import('@/features/superadmin/AdminSubscriptionsPage'))
const AdminSubscriptionDetailPage = lazy(() => import('@/features/superadmin/AdminSubscriptionDetailPage'))
const OverridesPage               = lazy(() => import('@/features/superadmin/OverridesPage'))

const ResellerLayout              = lazy(() => import('@/features/reseller/ResellerLayout'))
const ResellerDashboardPage       = lazy(() => import('@/features/reseller/ResellerDashboardPage'))
const ResellerBusinessesPage      = lazy(() => import('@/features/reseller/ResellerBusinessesPage'))
const ResellerBusinessDetailPage  = lazy(() => import('@/features/reseller/ResellerBusinessDetailPage'))
const ResellerAnalyticsPage       = lazy(() => import('@/features/reseller/ResellerAnalyticsPage'))
const ResellerCustomersPage       = lazy(() => import('@/features/reseller/ResellerCustomersPage'))
const ResellerInventoryPage       = lazy(() => import('@/features/reseller/ResellerInventoryPage'))
const ResellerProcurementPage     = lazy(() => import('@/features/reseller/ResellerProcurementPage'))
const ResellerSubscriptionPage    = lazy(() => import('@/features/reseller/ResellerSubscriptionPage'))
const ResellerNotificationsPage   = lazy(() => import('@/features/reseller/ResellerNotificationsPage'))
const ResellerProfilePage         = lazy(() => import('@/features/reseller/ResellerProfilePage'))
const ResellerReferralPage        = lazy(() => import('@/features/reseller/ResellerReferralPage'))
const ResellerWalletPage          = lazy(() => import('@/features/reseller/ResellerWalletPage'))

const SuperAdminDashboardPage     = lazy(() => import('@/features/superadmin/SuperAdminDashboardPage'))
const BusinessesPage              = lazy(() => import('@/features/superadmin/BusinessesPage'))
const BusinessDetailPage          = lazy(() => import('@/features/superadmin/BusinessDetailPage'))
const AdminUsersPage              = lazy(() => import('@/features/superadmin/AdminUsersPage'))
const AdminUserDetailPage         = lazy(() => import('@/features/superadmin/AdminUserDetailPage'))
const ResellersPage               = lazy(() => import('@/features/superadmin/ResellersPage'))
const ResellerDetailPage          = lazy(() => import('@/features/superadmin/ResellerDetailPage'))
const PlatformAnalyticsPage       = lazy(() => import('@/features/superadmin/PlatformAnalyticsPage'))
const AuditLogsPage               = lazy(() => import('@/features/superadmin/AuditLogsPage'))
const DevicesPage                 = lazy(() => import('@/features/superadmin/DevicesPage'))
const PlatformNotificationsPage   = lazy(() => import('@/features/superadmin/PlatformNotificationsPage'))
const ResellerFinancePage         = lazy(() => import('@/features/superadmin/ResellerFinancePage'))

function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Spinner size={32} />
    </div>
  )
}

function S(Component: React.ComponentType) {
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  )
}

// Guard wrapper that also renders an Outlet — used as parent element for nested routes
function GuardedOutlet({ allowedRoles }: { allowedRoles: Parameters<typeof RoleGuard>[0]['allowedRoles'] }) {
  return (
    <RoleGuard allowedRoles={allowedRoles}>
      <Outlet />
    </RoleGuard>
  )
}

// Role-aware app dashboard: owner/manager → BusinessDashboard, staff → StaffDashboard
function AppDashboard() {
  const user = useAuthStore(s => s.user)
  if (!user) return null
  const staffRoles = ['CASHIER', 'INVENTORY_STAFF'] as const
  const isStaff = (staffRoles as readonly string[]).includes(user.role)
  return isStaff ? S(StaffDashboardPage) : S(BusinessDashboardPage)
}

// Per-route section guard — redirects to /unauthorized if role lacks access to the section
function SectionGuard({ section, children }: { section: string; children: ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (user && !canAccess(user.role, section)) {
    return <Navigate to="/unauthorized" replace />
  }
  return <>{children}</>
}

export const router = createBrowserRouter([
  // Root redirect
  { path: '/', element: <Navigate to="/login" replace /> },

  { path: '/pricing', element: <Suspense fallback={<Loading />}><PricingPage /></Suspense> },

  {
    path: '/login',
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },

  {
    path: '/register',
    element: (
      <AuthLayout>
        <RegisterPage />
      </AuthLayout>
    ),
  },

  {
    path: '/onboarding',
    element: <Suspense fallback={<Loading />}><OnboardingWizard /></Suspense>,
  },

  {
    path: '/trial-expired',
    element: <Suspense fallback={<Loading />}><TrialExpiredPage /></Suspense>,
  },

  {
    path: '/app',
    element: (
      <GuardedOutlet allowedRoles={['BUSINESS_OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF']} />
    ),
    children: [
      {
        // The DashboardLayout renders <Outlet /> — all /app/* children show inside it
        element: <DashboardLayout navGroup="app" />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          {
            path: 'pos',
            element: (
              <SectionGuard section="pos">
                <POSLayout>
                  {S(POSScreen)}
                </POSLayout>
              </SectionGuard>
            ),
          },
          { path: 'session-open',    element: S(SessionOpenScreen) },
          { path: 'session-close',   element: S(SessionCloseScreen) },
          { path: 'profile',         element: S(ProfileSettingsPage) },
          { path: 'products',        element: <SectionGuard section="products">{S(ProductsScreen)}</SectionGuard> },
          { path: 'brands',          element: <SectionGuard section="products">{S(BrandsPage)}</SectionGuard> },
          { path: 'categories',      element: <SectionGuard section="products">{S(CategoriesPage)}</SectionGuard> },
          { path: 'inventory',       element: <SectionGuard section="inventory">{S(InventoryScreen)}</SectionGuard> },
          { path: 'sales',           element: <SectionGuard section="sales">{S(SalesScreen)}</SectionGuard> },
          { path: 'sync',            element: <SectionGuard section="sync">{S(SyncScreen)}</SectionGuard> },
          {
            path: 'customers',
            element: <SectionGuard section="customers"><Outlet /></SectionGuard>,
            children: [
              { index: true, element: S(CustomersScreen) },
              { path: 'new', element: S(CustomerFormPage) },
              {
                path: ':id',
                element: S(CustomerLayout),
                children: [
                  { index: true,           element: S(CustomerDetailPage)    },
                  { path: 'edit',          element: S(CustomerFormPage)      },
                  { path: 'ledger',        element: S(CustomerLedgerPage)    },
                  { path: 'payments',      element: S(CustomerPaymentsPage)  },
                  { path: 'statements',    element: S(CustomerStatementPage) },
                ],
              },
            ],
          },
          {
            path: 'procurement',
            element: <SectionGuard section="procurement"><Outlet /></SectionGuard>,
            children: [
              { index: true, element: <Navigate to="/app/procurement/dashboard" replace /> },
              {
                element: S(ProcurementLayout),
                children: [
                  { path: 'dashboard',       element: S(ProcurementDashboardPage)  },
                  { path: 'suppliers',       element: S(SuppliersPage)             },
                  { path: 'purchase-orders', element: S(PurchaseOrdersPage)        },
                  { path: 'receipts',        element: S(GoodsReceiptsPage)         },
                  { path: 'payables',        element: S(SupplierPayablesPage)      },
                  { path: 'payments',        element: S(SupplierPaymentsPage)      },
                  { path: 'suppliers/new',              element: S(SupplierFormPage)          },
                  { path: 'suppliers/:id',              element: S(SupplierDetailPage)        },
                  { path: 'suppliers/:id/edit',         element: S(SupplierFormPage)          },
                  { path: 'purchase-orders/new',        element: S(PurchaseOrderCreatePage)   },
                  { path: 'purchase-orders/:id',        element: S(PurchaseOrderDetailPage)   },
                  { path: 'receipts/:id',               element: S(GoodsReceiptDetailPage)    },
                ],
              },
            ],
          },
          {
            path: 'analytics',
            element: <SectionGuard section="analytics"><Outlet /></SectionGuard>,
            children: [
              { index: true, element: <Navigate to="/app/analytics/dashboard" replace /> },
              {
                element: S(AnalyticsLayout),
                children: [
                  { path: 'dashboard', element: S(AnalyticsDashboardPage) },
                  { path: 'sales',     element: S(SalesAnalyticsPage)     },
                  { path: 'inventory', element: S(InventoryAnalyticsPage) },
                  { path: 'customers', element: S(CustomerAnalyticsPage)  },
                  { path: 'financial', element: S(FinancialAnalyticsPage) },
                  { path: 'staff',     element: S(StaffAnalyticsPage)     },
                ],
              },
            ],
          },
          {
            path: 'notifications',
            element: <SectionGuard section="notifications"><Outlet /></SectionGuard>,
            children: [
              { index: true,             element: S(NotificationsPage)           },
              { path: 'preferences',     element: S(NotificationPreferencesPage) },
              { path: ':id',             element: S(NotificationDetailPage)      },
            ],
          },
          {
            path: 'subscription',
            element: <SectionGuard section="subscription"><Outlet /></SectionGuard>,
            children: [
              { index: true, element: <Navigate to="/app/subscription/current" replace /> },
              {
                element: S(SubscriptionLayout),
                children: [
                  { path: 'current', element: S(CurrentSubscriptionPage) },
                  { path: 'usage',   element: <Navigate to="/app/subscription/current" replace /> },
                  { path: 'billing', element: S(BillingHistoryPage)       },
                ],
              },
            ],
          },
          {
            path: 'settings',
            element: <SectionGuard section="settings"><Outlet /></SectionGuard>,
            children: [
              { index: true, element: <Navigate to="/app/settings/business" replace /> },
              {
                element: S(SettingsLayout),
                children: [
                  { path: 'business',     element: S(BusinessSettingsPage)    },
                  { path: 'branches',     element: S(BranchesSettingsPage)    },
                  { path: 'staff',        element: S(StaffSettingsPage)        },
                  { path: 'receipt',      element: S(ReceiptSettingsPage)      },
                  { path: 'tax',          element: S(TaxSettingsPage)          },
                  { path: 'preferences',  element: S(PreferencesSettingsPage)  },
                ],
              },
            ],
          },
          { path: 'dashboard',       element: <AppDashboard /> },
        ],
      },
    ],
  },

  {
    path: '/super-admin',
    element: <GuardedOutlet allowedRoles={['SUPER_ADMIN']} />,
    children: [
      {
        element: <DashboardLayout navGroup="super-admin" />,
        children: [
          { index: true, element: <Navigate to="/super-admin/dashboard" replace /> },
          { path: 'dashboard', element: S(SuperAdminDashboardPage) },
          {
            path: 'businesses',
            children: [
              { index: true, element: S(BusinessesPage) },
              { path: ':id',  element: S(BusinessDetailPage) },
            ],
          },
          {
            path: 'users',
            children: [
              { index: true, element: <Navigate to="/super-admin/businesses?tab=users" replace /> },
              { path: ':id',  element: S(AdminUserDetailPage) },
            ],
          },
          {
            path: 'resellers',
            children: [
              { index: true, element: S(ResellersPage) },
              { path: ':id',  element: S(ResellerDetailPage) },
            ],
          },
          { path: 'middlemen', element: <Navigate to="/super-admin/resellers" replace /> },
          { path: 'subscriptions',  element: <Navigate to="/super-admin/businesses" replace /> },
          { path: 'subscriptions/:tenantId', element: <Navigate to="/super-admin/businesses" replace /> },
          {
            path: 'plans',
            children: [
              { index: true,      element: S(PlansPage)      },
              { path: 'new',      element: S(PlanFormPage)   },
              { path: ':id',      element: S(PlanDetailPage) },
              { path: ':id/edit', element: S(PlanFormPage)   },
            ],
          },
          { path: 'overrides',    element: <Navigate to="/super-admin/businesses" replace /> },
          { path: 'entitlements', element: <Navigate to="/super-admin/businesses" replace /> },
          { path: 'analytics',    element: <Navigate to="/super-admin/dashboard" replace /> },
          { path: 'devices',      element: <Navigate to="/super-admin/businesses" replace /> },
          { path: 'notifications',  element: S(PlatformNotificationsPage) },
          { path: 'audit-logs',     element: S(AuditLogsPage)             },
          { path: 'reseller-finance', element: S(ResellerFinancePage)     },
          { path: 'audit',          element: <Navigate to="/super-admin/audit-logs" replace /> },
        ],
      },
    ],
  },

  {
    path: '/reseller',
    element: <GuardedOutlet allowedRoles={['RESELLER']} />,
    children: [
      {
        element: (
          <Suspense fallback={<Loading />}>
            <ResellerLayout />
          </Suspense>
        ),
        children: [
          { index: true,               element: <Navigate to="/reseller/dashboard" replace /> },
          { path: 'dashboard',         element: S(ResellerDashboardPage)      },
          { path: 'businesses',        element: S(ResellerBusinessesPage)     },
          { path: 'businesses/:id',    element: S(ResellerBusinessDetailPage) },
          { path: 'analytics',         element: S(ResellerAnalyticsPage)      },
          { path: 'customers',         element: S(ResellerCustomersPage)      },
          { path: 'inventory',         element: S(ResellerInventoryPage)      },
          { path: 'procurement',       element: S(ResellerProcurementPage)    },
          { path: 'subscriptions',     element: S(ResellerSubscriptionPage)   },
          {
            path: 'notifications',
            children: [
              { index: true, element: S(ResellerNotificationsPage) },
              { path: ':id', element: S(NotificationDetailPage)    },
            ],
          },
          { path: 'profile',           element: S(ResellerProfilePage)        },
          { path: 'referrals',         element: S(ResellerReferralPage)       },
          { path: 'wallet',            element: S(ResellerWalletPage)         },
        ],
      },
    ],
  },

  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*',             element: <NotFoundPage /> },
])
