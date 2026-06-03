
export type UserRole =
  | 'SUPER_ADMIN'
  | 'RESELLER'
  | 'BUSINESS_OWNER'
  | 'MANAGER'
  | 'CASHIER'
  | 'INVENTORY_STAFF'


export interface LoginRequest {
  email?: string
  phone?: string
  business_code?: string
  identifier?: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface LogoutRequest {
  refresh_token: string | null
}


export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  phone: string | null
  role: UserRole
  status: string
  tenant_id: string | null
  primary_branch_id: string | null
  last_login_at: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}


export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

export interface SuccessResponse {
  success: boolean
  message: string
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}


export type ProductType = 'SIMPLE' | 'VARIABLE' | 'SERVICE' | 'DIGITAL' | 'BUNDLE'

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  barcode: string | null
  name: string
  attributes: Record<string, string>
  price_override: string | null
  cost_override: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  tenant_id: string
  sku: string
  name: string
  description: string | null
  product_type: ProductType
  category_id: string | null
  brand_id: string | null
  unit_id: string | null
  barcode: string | null
  cost_price: string
  selling_price: string
  tax_rate: string
  reorder_point: number
  is_active: boolean
  image_url: string | null
  variants: ProductVariant[]
  discount_type: string | null
  discount_value: string | null
  discount_start_at: string | null
  discount_end_at: string | null
  created_at: string
  updated_at: string
}

export interface ProductCreateRequest {
  sku: string
  name: string
  description?: string
  product_type: ProductType
  category_id?: string
  brand_id?: string
  unit_id?: string
  barcode?: string
  cost_price: string
  selling_price: string
  tax_rate?: string
  reorder_point?: number
}

export interface ProductUpdateRequest extends Partial<ProductCreateRequest> {
  is_active?: boolean
}


export interface InventoryItem {
  id: string
  tenant_id: string
  branch_id: string
  product_id: string
  variant_id: string | null
  quantity_on_hand: string
  quantity_reserved: string
  quantity_available: string
  quantity_sold?: string
  reorder_point: number | null
  last_counted_at: string | null
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  tenant_id: string
  branch_id: string
  product_id: string
  variant_id: string | null
  movement_type: string
  quantity: string
  previous_quantity: string
  new_quantity: string
  reference_type: string | null
  reference_id: string | null
  unit_cost: string | null
  reason: string | null
  notes: string | null
  actor_user_id: string
  actor_name?: string | null
  created_at: string
  updated_at: string
}

export interface InventoryAdjustmentRequest {
  branch_id: string
  adjustment_type: string
  items: Array<{ product_id: string; variant_id?: string; quantity_change: number }>
  reason?: string
  notes?: string
}


export interface CashierSession {
  id: string
  tenant_id: string
  branch_id: string
  cashier_user_id: string
  opening_balance: string
  closing_balance: string | null
  expected_balance: string | null
  actual_balance: string | null
  discrepancy_amount: string | null
  status: 'OPEN' | 'CLOSED'
  opened_at: string
  closed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OpenSessionRequest {
  branch_id: string
  opening_balance: string
  notes?: string
}

export interface CloseSessionRequest {
  actual_balance: string
  notes?: string
}


export interface CartItemRequest {
  product_id: string
  variant_id?: string
  quantity: string
  unit_price: string
  discount_amount?: string
  tax_rate?: string
  notes?: string
}

export interface CartCreateRequest {
  branch_id: string
  cashier_session_id?: string
  customer_id?: string
  notes?: string
}

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  variant_id: string | null
  quantity: string
  unit_price: string
  discount_amount: string
  tax_rate: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CartTotals {
  subtotal: string
  discount_amount: string
  tax_amount: string
  total_amount: string
  item_count: number
}

export interface Cart {
  id: string
  tenant_id: string
  branch_id: string
  cashier_session_id: string | null
  customer_id: string | null
  notes: string | null
  expires_at: string | null
  items: CartItem[]
  totals: CartTotals | null
  created_at: string
  updated_at: string
}


export interface CheckoutItemRequest {
  product_id: string
  variant_id?: string
  quantity: string
  unit_price: string
  discount_amount?: string
  tax_rate?: string
  notes?: string
}

export interface CheckoutPaymentRequest {
  payment_method: string
  amount: string
  reference_number?: string
  notes?: string
}

export interface CheckoutRequest {
  cashier_session_id: string
  items: CheckoutItemRequest[]
  payments: CheckoutPaymentRequest[]
  customer_id?: string
  discount_amount?: string
  notes?: string
}


export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id: string | null
  product_name: string
  variant_name: string | null
  sku: string | null
  quantity: string
  unit_price: string
  discount_amount: string
  tax_rate: string
  subtotal: string
  total: string
}

export interface Order {
  id: string
  tenant_id: string
  branch_id: string
  cashier_session_id: string
  customer_id: string | null
  order_number: string
  order_status: string
  payment_status: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total_amount: string
  refunded_amount?: string
  notes: string | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  cashier_name?: string | null
  customer_name?: string | null
  branch_name?: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

export interface VoidOrderRequest {
  reason: string
}

export interface RefundItemRequest {
  order_item_id: string
  quantity: string
  amount: string
}

export interface RefundRequest {
  order_id: string
  reason: string
  items: RefundItemRequest[]
  notes?: string
  refund_method?: string
}

export interface RefundItemRecord {
  id: string
  refund_id: string
  order_item_id: string
  product_id: string
  variant_id: string | null
  product_name: string | null
  variant_name: string | null
  quantity: string
  amount: string
}

export interface RefundRecord {
  id: string
  order_id: string
  tenant_id: string
  refund_number: string
  reason: string
  refund_type: string
  amount: string
  notes: string | null
  processed_by: string
  processed_by_name?: string | null
  processed_at: string
  items: RefundItemRecord[]
  created_at: string
  updated_at: string
}


export interface Customer {
  id: string
  tenant_id: string
  customer_code: string
  name: string
  phone: string
  email: string | null
  address: string | null
  notes: string | null
  balance: string
  current_balance: string
  credit_limit: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateCustomerRequest {
  name: string
  phone: string
  email?: string
  address?: string
  notes?: string
}


export type LedgerEntryType = 'SALE' | 'PAYMENT' | 'ADJUSTMENT' | 'CREDIT_NOTE' | 'NOTE'

export interface LedgerEntry {
  id: string
  date?: string
  type: LedgerEntryType
  reference?: string | null
  description?: string
  debit?: string
  credit?: string
  balance: string
  created_at?: string
}

export interface CustomerStatement {
  customer?: Customer
  opening_balance?: string
  closing_balance?: string
  total_debits?: string
  total_credits?: string
  entries?: LedgerEntry[]
  generated_at?: string
}


export interface SyncOperationInput {
  operation_uuid: string
  operation_type: string
  entity_type: string
  payload: Record<string, unknown>
  operation_timestamp: string
}

export interface SyncPushRequest {
  device_id: string
  branch_id: string
  operations: SyncOperationInput[]
}

export interface SyncPushResponse {
  processed_count: number
  failed_count: number
  skipped_count: number
  results: Array<{
    operation_uuid: string
    status: string
    entity_id: string | null
    error: string | null
    replayed: boolean
  }>
  sync_timestamp: string
}


export type DevicePlatform = 'WEB' | 'ANDROID' | 'IOS' | 'WINDOWS' | 'MACOS' | 'LINUX'

export interface DeviceRegisterRequest {
  device_uuid: string
  device_name: string
  branch_id: string
  platform: DevicePlatform
  app_version?: string
}

export interface Device {
  id: string
  tenant_id: string
  branch_id: string
  device_uuid: string
  device_name: string
  platform: string
  app_version: string | null
  last_seen_at: string | null
  last_sync_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}


export interface Notification {
  id: string
  type: string
  priority: string
  title: string
  message: string
  metadata: Record<string, unknown> | null
  expires_at: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationPreference {
  id: string
  user_id: string
  email_enabled: boolean
  inventory_enabled: boolean
  procurement_enabled: boolean
  customer_enabled: boolean
  subscription_enabled: boolean
  security_enabled: boolean
  created_at: string
  updated_at: string
}


// Canonical entitlement feature codes enforced by the backend.
// Limit codes (products/branches/users/customers/devices) use limit_value.
// Toggle codes (analytics/procurement/pos/inventory/advanced_reports) are simply on/off.
export type CanonicalFeatureCode =
  | 'products'
  | 'branches'
  | 'users'
  | 'customers'
  | 'devices'
  | 'analytics'
  | 'procurement'
  | 'pos'
  | 'inventory'
  | 'advanced_reports'

export interface PlanEntitlement {
  id: string
  plan_id: string
  feature_code: string   // string (not narrowed) to gracefully handle legacy max_* codes from DB
  enabled: boolean
  limit_value: number | null
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  code: string
  description: string | null
  billing_cycle: string
  price: string
  currency: string
  trial_days: number
  is_active: boolean
  is_referral_plan: boolean
  sort_order: number
  entitlements: PlanEntitlement[]
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  tenant_id: string
  plan_id: string
  status: string
  started_at: string
  expires_at: string | null
  cancelled_at: string | null
  trial_ends_at: string | null
  auto_renew: boolean
  plan: Plan
  pending_downgrade_plan_id?: string | null
  pending_downgrade_requested_at?: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionHistory {
  id: string
  tenant_id: string
  subscription_id: string
  change_type: string
  old_plan_id: string | null
  new_plan_id: string | null
  old_status: string | null
  new_status: string | null
  note: string | null
  changed_by_user_id: string | null
  created_at: string
  updated_at: string
}

export enum ProofActionType {
  INITIAL_ACTIVATION = 'INITIAL_ACTIVATION',
  RENEWAL = 'RENEWAL',
  UPGRADE = 'UPGRADE',
  DOWNGRADE = 'DOWNGRADE',
}

export interface PaymentProof {
  id: string
  tenant_id: string
  subscription_id: string
  amount: string
  currency: string
  reference_number: string | null
  proof_file_url: string
  status: string
  action_type?: ProofActionType
  target_plan_id?: string | null
  target_plan_name?: string | null
  tenant_name?: string | null
  tenant_email?: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface TenantEntitlementOverride {
  id: string
  tenant_id: string
  feature_code: string
  enabled: boolean | null
  limit_value: number | null
  reason: string | null
  expires_at: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface EffectiveEntitlement {
  feature_code: string  // CanonicalFeatureCode (or legacy max_* before DB migration)
  enabled: boolean
  limit_value: number | null
  source: string
}

export interface SubscriptionOverview {
  total_tenants: number
  active_subscriptions: number
  trial_subscriptions: number
  expired_subscriptions: number
  suspended_subscriptions: number
  monthly_revenue: string
  total_users: number
  total_branches: number
  total_orders: number
}

export interface PlanCreateRequest {
  name: string
  code: string
  description?: string
  billing_cycle: string
  price: string
  currency?: string
  trial_days?: number
  is_active?: boolean
  is_referral_plan?: boolean
  sort_order?: number
  entitlements?: { feature_code: string; enabled: boolean; limit_value?: number | null }[]
}

export interface PlanUpdateRequest {
  name?: string
  description?: string
  billing_cycle?: string
  price?: string
  currency?: string
  trial_days?: number
  is_active?: boolean
  is_referral_plan?: boolean
  sort_order?: number
  entitlements?: { feature_code: string; enabled: boolean; limit_value?: number | null }[]
}

export interface PaymentProofCreateRequest {
  amount: string
  currency?: string
  reference_number?: string
  proof_file_url: string
  action_type?: ProofActionType
  target_plan_id?: string
}


export interface Tenant {
  id: string
  name: string
  slug: string
  business_code: string
  status: string
  email: string | null
  phone: string | null
  address: string | null
  country: string | null
  city: string | null
  timezone: string
  currency: string
  locale: string
  owner_id: string | null
  subscription_plan: string
  subscription_expires_at: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface TenantUpdateRequest {
  name?: string
  email?: string
  phone?: string
  address?: string
  country?: string
  city?: string
  timezone?: string
  currency?: string
  locale?: string
}

export interface TenantCreateRequest {
  name: string
  email: string
  phone?: string
  address?: string
  country?: string
  city?: string
  timezone?: string
  currency?: string
  locale?: string
  subscription_plan?: string
}

export interface TenantStatusUpdateRequest {
  status: string
}

export interface TenantSettings {
  tenant_id: string
  tax_rate: number | null
  tax_inclusive: boolean
  extra_settings: Record<string, unknown>
}

export interface TenantSettingsUpdateRequest {
  tax_rate?: number | null
  tax_inclusive?: boolean
  extra_settings?: Record<string, unknown>
}

export interface UserCreateRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  role: UserRole
  primary_branch_id?: string
}

export interface UserUpdateRequest {
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
  primary_branch_id?: string
}

export interface UserStatusUpdateRequest {
  status: string
}

export interface UserRoleUpdateRequest {
  role: UserRole
}


export interface ResellerAssignment {
  id: string
  reseller_id: string
  tenant_id: string
  allowed_branch_ids: string[]
  restricted_permissions: string[]
  access_starts_at: string | null
  access_expires_at: string | null
  is_active: boolean
  notes: string | null
  assigned_by_id: string | null
  created_at: string
  updated_at: string
}

export interface ResellerAssignmentCreateRequest {
  reseller_id: string
  tenant_id: string
  allowed_branch_ids?: string[]
  restricted_permissions?: string[]
  access_starts_at?: string
  access_expires_at?: string
  notes?: string
}

export interface ResellerAssignmentUpdateRequest {
  allowed_branch_ids?: string[]
  restricted_permissions?: string[]
  access_starts_at?: string
  access_expires_at?: string
  is_active?: boolean
  notes?: string
}


export interface MyBusinessResponse {
  id: string
  tenant_id: string
  allowed_branch_ids: string[]
  restricted_permissions: string[]
  access_starts_at: string | null
  access_expires_at: string | null
  is_active: boolean
  is_access_valid: boolean
  created_at: string
  updated_at: string
}

export interface MyBranchResponse {
  tenant_id: string
  branch_ids: string[]
  all_branches_allowed: boolean
}

export interface ResellerPermissions {
  view_revenue: boolean
  view_profit: boolean
  view_analytics: boolean
  view_inventory: boolean
  adjust_inventory: boolean
  transfer_inventory: boolean
  view_customers: boolean
  view_customer_debt: boolean
  record_customer_payment: boolean
  view_procurement: boolean
  create_purchase_order: boolean
  approve_purchase_order: boolean
  view_subscription_status: boolean
  view_staff: boolean
  manage_staff: boolean
  export_data: boolean
  view_branch_reports: boolean
}

export interface MyPermissionsResponse {
  tenant_id: string
  permissions: ResellerPermissions
}


export interface AuditLog {
  id: string
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  actor_role: string | null
  tenant_id: string | null
  branch_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  metadata_: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  request_id: string | null
  created_at: string
  updated_at: string
}


export interface Category {
  id: string
  tenant_id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  status: string
  sort_order: number
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface CategoryCreateRequest {
  name: string
  slug?: string
  description?: string
  parent_id?: string
  sort_order?: number
}


export interface ReceiptItem {
  product_name: string
  variant_name: string | null
  sku: string
  quantity: string
  unit_price: string
  discount_amount: string
  tax_rate: string
  total: string
}

export interface ReceiptPayment {
  method: string
  amount: string
  reference_number: string | null
}

export interface Receipt {
  id: string
  order_id: string
  tenant_id: string
  branch_id: string
  receipt_number: string
  subtotal: string
  tax_amount: string
  discount_amount: string
  total_amount: string
  amount_paid: string
  change_amount: string
  cashier_name: string
  branch_name: string
  tenant_name: string
  payment_methods: ReceiptPayment[]
  items_snapshot: ReceiptItem[]
  issued_at: string
  voided_at: string | null
  created_at: string
  updated_at: string
}


export interface Branch {
  id: string
  tenant_id: string
  name: string
  code: string
  address: string | null
  city: string | null
  country: string | null
  phone: string | null
  timezone: string
  currency: string
  is_main_branch: boolean
  is_active: boolean
  status: string
  created_at: string
  updated_at: string
}


export interface DashboardKPIs {
  sales_today: string
  sales_yesterday: string
  sales_this_week: string
  sales_this_month: string
  orders_today: number
  orders_this_month: number
  revenue_today: string
  revenue_month: string
  refund_count_month: number
  refund_amount_month: string
  total_customers: number
  new_customers_month: number
  low_stock_products: number
  inventory_value: string
  total_customer_outstanding: string
  generated_at: string
}

export interface SalesSummary {
  order_count: number
  gross_sales: string
  refund_amount: string
  net_sales: string
  average_order_value: string
  unique_customers: number
}

export interface SalesTrendItem {
  period: string
  sales: string
  orders: number
  revenue: string
}

export interface SalesTrend {
  granularity: string
  items: SalesTrendItem[]
}

export interface TopProduct {
  product_id: string
  product_name: string
  sku: string | null
  quantity_sold: string
  revenue: string
  profit_estimate: string
}

export interface CategorySales {
  category_id: string | null
  category_name: string
  quantity_sold: string
  sales: string
  profit: string
}

export interface BranchSales {
  branch_id: string
  branch_name: string
  orders: number
  sales: string
  refunds: string
  revenue: string
}

export interface CashierSales {
  cashier_id: string
  cashier_name: string
  orders: number
  sales: string
  refunds: string
  average_ticket: string
}

export interface PaymentMethodStat {
  payment_method: string
  transaction_count: number
  amount: string
  percentage: string
}

export interface InventoryValuationItem {
  product_id: string
  product_name: string
  sku: string | null
  quantity_on_hand: string
  cost_price: string
  valuation: string
}

export interface InventoryValuation {
  items: InventoryValuationItem[]
  total_valuation: string
}

export interface LowStockItem {
  product_id: string
  product_name: string
  sku: string | null
  branch_id: string
  branch_name: string
  quantity_on_hand: string
  reorder_point: string
}

export interface MovementReport {
  movement_type: string
  count: number
  total_quantity: string
}

export interface FastMovingItem {
  product_id: string
  product_name: string
  sku: string | null
  quantity_sold: string
  order_count: number
  rank: number
}

export interface DeadStockItem {
  product_id: string
  product_name: string
  sku: string | null
  quantity_on_hand: string
  last_sold_at: string | null
  days_without_sale: number
}

export interface FinancialSummary {
  gross_revenue: string
  refund_amount: string
  net_revenue: string
  cost_of_goods_sold: string
  gross_profit: string
  gross_margin_pct: string
}

export interface ProfitReportItem {
  dimension_id: string | null
  dimension_name: string
  revenue: string
  cogs: string
  profit: string
  margin_pct: string
}

export interface ProfitReport {
  by: string
  items: ProfitReportItem[]
}


export interface SupplierContact {
  id: string
  supplier_id: string
  tenant_id: string
  name: string
  email: string | null
  phone: string | null
  position: string | null
  is_primary: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  tenant_id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  website: string | null
  status: string
  notes: string | null
  is_deleted: boolean
  contacts: SupplierContact[]
  created_at: string
  updated_at: string
}

export interface SupplierSummary {
  id: string
  name: string
  code: string
  status: string
}

export interface SupplierCreateRequest {
  name: string
  code?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  website?: string
  notes?: string
}

export interface SupplierUpdateRequest {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  website?: string | null
  status?: string
  notes?: string | null
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  product_name?: string | null
  variant_id: string | null
  ordered_quantity: string
  received_quantity: string
  unit_cost: string
  line_total: string
  created_at: string
  updated_at: string
}

export interface PurchaseOrderSummary {
  id: string
  tenant_id: string
  branch_id: string
  supplier_id: string
  po_number: string
  status: string
  order_date: string
  expected_date: string | null
  subtotal: string
  discount_amount: string
  tax_amount: string
  total_amount: string
  approved_by: string | null
  approved_at: string | null
  created_by: string
  created_by_name?: string | null
  approved_by_name?: string | null
  supplier_name?: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseOrderDetail extends PurchaseOrderSummary {
  notes: string | null
  items: PurchaseOrderItem[]
  payable?: {
    id: string
    total_amount: string
    paid_amount: string
    remaining_amount: string
    status: string
  } | null
}

export interface PurchaseOrderCreateRequest {
  branch_id: string
  supplier_id: string
  order_date: string
  expected_date?: string
  notes?: string
  discount_amount?: string
  tax_amount?: string
  items: Array<{
    product_id: string
    variant_id?: string
    ordered_quantity: string
    unit_cost: string
  }>
}

export interface GoodsReceiptItem {
  id: string
  goods_receipt_id: string
  purchase_order_item_id: string
  product_name?: string | null
  received_quantity: string
  unit_cost: string
  line_total: string
  created_at: string
  updated_at: string
}

export interface GoodsReceiptSummary {
  id: string
  tenant_id: string
  branch_id: string
  purchase_order_id: string
  receipt_number: string
  receipt_date: string
  status: string
  received_by: string
  received_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface GoodsReceiptDetail extends GoodsReceiptSummary {
  notes: string | null
  items: GoodsReceiptItem[]
}

export interface GoodsReceiptCreateRequest {
  purchase_order_id: string
  branch_id: string
  receipt_date: string
  notes?: string
  items: Array<{
    purchase_order_item_id: string
    received_quantity: string
    unit_cost: string
  }>
}

export interface SupplierPayment {
  id: string
  tenant_id: string
  supplier_id: string
  supplier_payable_id: string
  payment_method: string
  reference_number: string | null
  amount: string
  payment_date: string
  status: string
  notes: string | null
  recorded_by: string
  recorded_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface SupplierPayableSummary {
  id: string
  tenant_id: string
  supplier_id: string
  purchase_order_id: string
  total_amount: string
  paid_amount: string
  remaining_amount: string
  status: string
  supplier_name?: string | null
  created_at: string
  updated_at: string
}

export interface SupplierPayableDetail extends SupplierPayableSummary {
  payments: SupplierPayment[]
}

export interface SupplierBalance {
  supplier_id: string
  tenant_id: string
  total_payable: string
  total_paid: string
  outstanding_balance: string
  open_count: number
  partial_count: number
}

export interface SupplierPaymentCreateRequest {
  payment_method: string
  reference_number?: string
  amount: string
  payment_date: string
  notes?: string
}


export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  message: string
  type: ToastType
}


export interface LegacyProduct {
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
}

export interface CartItemLegacy extends LegacyProduct {
  qty: number
  lineDiscount: number
}

export type PaymentMethod = 'cash' | 'card' | 'split'
export type SaleStatus = 'completed' | 'refunded' | 'voided'

export interface SaleItemLegacy {
  id: string
  name: string
  sku: string
  price: number
  qty: number
  taxRate: number
}

export interface SplitPaymentLegacy {
  method: 'cash' | 'card'
  amount: number
}

export interface Sale {
  id: string
  date: Date
  cashier: User
  items: SaleItemLegacy[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: PaymentMethod
  amountTendered?: number
  change?: number
  splitPayments?: SplitPaymentLegacy[]
  status: SaleStatus
  note?: string
}

export type CheckoutStep = 'cart' | 'payment' | 'processing' | 'receipt'

export type SyncOperationType = 'SALE_CREATE' | 'INVENTORY_UPDATE' | 'PRODUCT_UPDATE' | 'PAYMENT_PROCESS'

export interface SyncOperation {
  id: string
  type: SyncOperationType
  payload?: unknown
  status: 'pending' | 'failed'
  createdAt: Date
  retries: number
}


export interface RegisterRequest {
  business_name: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  password: string
  referral_code?: string
}

export interface RegistrationResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user_id: string
  tenant_id: string
  onboarding_required: boolean
}

export interface PublicPlan {
  id: string
  name: string
  code: string
  description: string | null
  billing_cycle: string
  price: string
  currency: string
  trial_days: number
  sort_order: number
  entitlements: Array<{ feature_code: string; enabled: boolean; limit_value: number | null }>
}

export interface TrialStatus {
  status: string
  plan_name: string
  plan_code: string
  started_at: string
  expires_at: string
  days_remaining: number
  is_expired: boolean
  usage: Record<string, { used: number; limit: number | null }>
}

export interface Brand {
  id: string
  tenant_id: string
  name: string
  slug: string
  description: string | null
  website: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface BrandCreateRequest {
  name: string
  slug?: string
  description?: string
  website?: string
}

export interface BrandUpdateRequest {
  name?: string
  description?: string
  website?: string
}

export interface CustomerContact {
  id: string
  customer_id: string
  contact_name: string
  contact_phone: string
  contact_relationship: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface InventoryTransfer {
  id: string
  tenant_id: string
  from_branch_id: string
  to_branch_id: string
  status: string
  notes: string | null
  requested_by_id: string | null
  approved_by_id: string | null
  executed_by_id: string | null
  items: Array<{
    product_id: string
    variant_id: string | null
    quantity: string
    product_name?: string
  }>
  created_at: string
  updated_at: string
}

export interface InventoryAdjustmentDetail {
  id: string
  tenant_id: string
  branch_id: string
  adjustment_type: string
  reason: string | null
  notes: string | null
  items: Array<{
    product_id: string
    variant_id: string | null
    quantity_change: string
    product_name?: string
  }>
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export interface CommissionRecord {
  id: string
  reseller_id: string
  tenant_id: string
  commission_type: string
  amount: string
  currency_code: string
  status: string
  reference_id: string | null
  note: string | null
  created_at: string
}
