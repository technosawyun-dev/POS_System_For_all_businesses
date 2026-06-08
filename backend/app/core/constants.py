from __future__ import annotations

from enum import Enum


class ProductType(str, Enum):
    SIMPLE = "SIMPLE"
    VARIABLE = "VARIABLE"
    SERVICE = "SERVICE"
    DIGITAL = "DIGITAL"
    BUNDLE = "BUNDLE"


class StockMovementType(str, Enum):
    PURCHASE = "PURCHASE"
    PURCHASE_RECEIPT = "PURCHASE_RECEIPT"
    SALE = "SALE"
    REFUND = "REFUND"
    REPLACEMENT = "REPLACEMENT"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    DAMAGE = "DAMAGE"
    ADJUSTMENT_INCREASE = "ADJUSTMENT_INCREASE"
    ADJUSTMENT_DECREASE = "ADJUSTMENT_DECREASE"
    RETURN_TO_SUPPLIER = "RETURN_TO_SUPPLIER"
    OPENING_STOCK = "OPENING_STOCK"


# Movement types that INCREASE stock quantity
STOCK_INBOUND_TYPES: frozenset[str] = frozenset({
    StockMovementType.PURCHASE,
    StockMovementType.PURCHASE_RECEIPT,
    StockMovementType.REFUND,
    StockMovementType.TRANSFER_IN,
    StockMovementType.ADJUSTMENT_INCREASE,
    StockMovementType.OPENING_STOCK,
})

# Movement types that DECREASE stock quantity
STOCK_OUTBOUND_TYPES: frozenset[str] = frozenset({
    StockMovementType.SALE,
    StockMovementType.REPLACEMENT,
    StockMovementType.TRANSFER_OUT,
    StockMovementType.DAMAGE,
    StockMovementType.ADJUSTMENT_DECREASE,
    StockMovementType.RETURN_TO_SUPPLIER,
})


class InventoryAdjustmentType(str, Enum):
    DAMAGE = "DAMAGE"
    EXPIRED = "EXPIRED"
    LOST = "LOST"
    FOUND = "FOUND"
    MANUAL_CORRECTION = "MANUAL_CORRECTION"
    SYSTEM_CORRECTION = "SYSTEM_CORRECTION"


class AdjustmentStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TransferStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    IN_TRANSIT = "IN_TRANSIT"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class SupplierStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    BLACKLISTED = "BLACKLISTED"


class PurchaseOrderStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class GoodsReceiptStatus(str, Enum):
    RECEIVED = "RECEIVED"
    VOIDED = "VOIDED"


class SupplierPayableStatus(str, Enum):
    OPEN = "OPEN"
    PARTIAL = "PARTIAL"
    PAID = "PAID"


class SupplierPaymentStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    VOIDED = "VOIDED"


class NotificationType(str, Enum):
    SYSTEM = "SYSTEM"
    INVENTORY = "INVENTORY"
    PROCUREMENT = "PROCUREMENT"
    CUSTOMER = "CUSTOMER"
    SUBSCRIPTION = "SUBSCRIPTION"
    SECURITY = "SECURITY"


class NotificationPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class NotificationChannel(str, Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"


class BillingCycle(str, Enum):
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class SubscriptionStatus(str, Enum):
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"
    CANCELLED = "CANCELLED"


class SubscriptionChangeType(str, Enum):
    TRIAL_STARTED = "TRIAL_STARTED"
    ACTIVATED = "ACTIVATED"
    RENEWED = "RENEWED"
    UPGRADED = "UPGRADED"
    DOWNGRADED = "DOWNGRADED"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"
    CANCELLED = "CANCELLED"
    EXTENDED = "EXTENDED"
    PLAN_CHANGED = "PLAN_CHANGED"
    RENEWAL_REQUESTED = "RENEWAL_REQUESTED"
    UPGRADE_REQUESTED = "UPGRADE_REQUESTED"
    DOWNGRADE_REQUESTED = "DOWNGRADE_REQUESTED"


class PaymentProofStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ProofActionType(str, Enum):
    INITIAL_ACTIVATION = "INITIAL_ACTIVATION"
    RENEWAL = "RENEWAL"
    UPGRADE = "UPGRADE"
    DOWNGRADE = "DOWNGRADE"


class CustomerGender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class CustomerLedgerEntryType(str, Enum):
    SALE_DEBT = "SALE_DEBT"        # Customer bought on credit — balance increases
    PAYMENT = "PAYMENT"            # Customer pays off debt — balance decreases
    REFUND_CREDIT = "REFUND_CREDIT"  # Store credits customer — balance decreases
    ADJUSTMENT = "ADJUSTMENT"      # Manual correction (signed amount)


class PriceType(str, Enum):
    COST = "COST"
    SELLING = "SELLING"


class CategoryStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    RESELLER = "RESELLER"
    BUSINESS_OWNER = "BUSINESS_OWNER"
    MANAGER = "MANAGER"
    CASHIER = "CASHIER"
    INVENTORY_STAFF = "INVENTORY_STAFF"


class TenantStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    TRIAL = "TRIAL"
    PENDING = "PENDING"


class BranchStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    CLOSED = "CLOSED"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"


class OrderStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    VOIDED = "VOIDED"
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"
    REFUNDED = "REFUNDED"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentMethod(str, Enum):
    CASH = "CASH"
    CARD = "CARD"
    KPAY = "KPAY"
    WAVEPAY = "WAVEPAY"
    AYA_PAY = "AYA_PAY"
    CB_PAY = "CB_PAY"
    BANK_TRANSFER = "BANK_TRANSFER"
    MOBILE_PAYMENT = "MOBILE_PAYMENT"
    STORE_CREDIT = "STORE_CREDIT"


class CashierSessionStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    RECONCILED = "RECONCILED"


class RefundReason(str, Enum):
    DAMAGED = "DAMAGED"
    CUSTOMER_RETURN = "CUSTOMER_RETURN"
    CASHIER_ERROR = "CASHIER_ERROR"
    DUPLICATE_TRANSACTION = "DUPLICATE_TRANSACTION"
    FRAUD_SUSPECTED = "FRAUD_SUSPECTED"
    OTHER = "OTHER"


class RefundType(str, Enum):
    FULL = "FULL"
    PARTIAL = "PARTIAL"
    CASH = "CASH"
    REPLACEMENT = "REPLACEMENT"


class DiscountType(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED = "FIXED"


class DevicePlatform(str, Enum):
    ANDROID = "ANDROID"
    IOS = "IOS"
    WINDOWS = "WINDOWS"
    WEB = "WEB"
    TABLET = "TABLET"


class SyncOperationType(str, Enum):
    SALE_CREATED = "SALE_CREATED"
    REFUND_CREATED = "REFUND_CREATED"
    INVENTORY_ADJUSTED = "INVENTORY_ADJUSTED"
    TRANSFER_EXECUTED = "TRANSFER_EXECUTED"
    PAYMENT_CREATED = "PAYMENT_CREATED"
    ORDER_VOIDED = "ORDER_VOIDED"


class SyncOperationStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SyncEntityType(str, Enum):
    PRODUCTS = "products"
    VARIANTS = "variants"
    INVENTORY = "inventory"
    CATEGORIES = "categories"
    BRANCHES = "branches"
    SETTINGS = "settings"
    PRICES = "prices"


class AuditAction(str, Enum):
    # Auth
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    LOGIN_FAILED = "LOGIN_FAILED"
    TOKEN_REFRESHED = "TOKEN_REFRESHED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED"
    PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED"

    # User management
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    USER_ACTIVATED = "USER_ACTIVATED"
    USER_DEACTIVATED = "USER_DEACTIVATED"
    USER_SUSPENDED = "USER_SUSPENDED"
    USER_ROLE_CHANGED = "USER_ROLE_CHANGED"
    USER_BRANCH_ASSIGNED = "USER_BRANCH_ASSIGNED"

    # Tenant management
    TENANT_CREATED = "TENANT_CREATED"
    TENANT_UPDATED = "TENANT_UPDATED"
    TENANT_SUSPENDED = "TENANT_SUSPENDED"
    TENANT_ACTIVATED = "TENANT_ACTIVATED"
    TENANT_DELETED = "TENANT_DELETED"

    # Branch management
    BRANCH_CREATED = "BRANCH_CREATED"
    BRANCH_UPDATED = "BRANCH_UPDATED"
    BRANCH_DEACTIVATED = "BRANCH_DEACTIVATED"

    # Permission management
    PERMISSION_GRANTED = "PERMISSION_GRANTED"
    PERMISSION_REVOKED = "PERMISSION_REVOKED"
    ROLE_ASSIGNED = "ROLE_ASSIGNED"

    # Reseller management
    RESELLER_ASSIGNED = "RESELLER_ASSIGNED"
    RESELLER_ACCESS_REVOKED = "RESELLER_ACCESS_REVOKED"
    RESELLER_ASSIGNMENT_UPDATED = "RESELLER_ASSIGNMENT_UPDATED"
    RESELLER_PERMISSIONS_CHANGED = "RESELLER_PERMISSIONS_CHANGED"
    RESELLER_BRANCH_VISIBILITY_CHANGED = "RESELLER_BRANCH_VISIBILITY_CHANGED"
    RESELLER_ACCESS_DENIED = "RESELLER_ACCESS_DENIED"

    # Product management
    PRODUCT_CREATED = "PRODUCT_CREATED"
    PRODUCT_UPDATED = "PRODUCT_UPDATED"
    PRODUCT_DELETED = "PRODUCT_DELETED"
    PRODUCT_PRICE_CHANGED = "PRODUCT_PRICE_CHANGED"
    PRODUCT_BARCODE_CHANGED = "PRODUCT_BARCODE_CHANGED"
    VARIANT_CREATED = "VARIANT_CREATED"
    VARIANT_UPDATED = "VARIANT_UPDATED"
    VARIANT_DELETED = "VARIANT_DELETED"
    CATEGORY_CREATED = "CATEGORY_CREATED"
    CATEGORY_UPDATED = "CATEGORY_UPDATED"
    CATEGORY_DELETED = "CATEGORY_DELETED"
    BRAND_CREATED = "BRAND_CREATED"
    BRAND_UPDATED = "BRAND_UPDATED"
    BRAND_DELETED = "BRAND_DELETED"

    # Inventory management
    STOCK_MOVEMENT_CREATED = "STOCK_MOVEMENT_CREATED"
    INVENTORY_ADJUSTED = "INVENTORY_ADJUSTED"
    INVENTORY_TRANSFER_CREATED = "INVENTORY_TRANSFER_CREATED"
    INVENTORY_TRANSFER_APPROVED = "INVENTORY_TRANSFER_APPROVED"
    INVENTORY_TRANSFER_COMPLETED = "INVENTORY_TRANSFER_COMPLETED"
    INVENTORY_TRANSFER_CANCELLED = "INVENTORY_TRANSFER_CANCELLED"
    OPENING_STOCK_SET = "OPENING_STOCK_SET"

    # Supplier management
    SUPPLIER_CREATED = "SUPPLIER_CREATED"
    SUPPLIER_UPDATED = "SUPPLIER_UPDATED"
    SUPPLIER_DELETED = "SUPPLIER_DELETED"

    # Customer management
    CUSTOMER_CREATED = "CUSTOMER_CREATED"
    CUSTOMER_UPDATED = "CUSTOMER_UPDATED"
    CUSTOMER_DELETED = "CUSTOMER_DELETED"
    CUSTOMER_PAYMENT_RECORDED = "CUSTOMER_PAYMENT_RECORDED"
    CUSTOMER_BALANCE_ADJUSTED = "CUSTOMER_BALANCE_ADJUSTED"
    CUSTOMER_CONTACT_ADDED = "CUSTOMER_CONTACT_ADDED"
    CUSTOMER_NOTE_ADDED = "CUSTOMER_NOTE_ADDED"

    # Sales / Orders
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_COMPLETED = "ORDER_COMPLETED"
    ORDER_VOIDED = "ORDER_VOIDED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    ORDER_REFUNDED = "ORDER_REFUNDED"

    # Payments
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    PAYMENT_FAILED = "PAYMENT_FAILED"

    # Refunds
    REFUND_CREATED = "REFUND_CREATED"
    REFUND_PROCESSED = "REFUND_PROCESSED"

    # Cashier sessions
    CASHIER_SESSION_OPENED = "CASHIER_SESSION_OPENED"
    CASHIER_SESSION_CLOSED = "CASHIER_SESSION_CLOSED"
    CASHIER_SESSION_RECONCILED = "CASHIER_SESSION_RECONCILED"

    # Receipts
    RECEIPT_GENERATED = "RECEIPT_GENERATED"
    RECEIPT_VOIDED = "RECEIPT_VOIDED"

    # Discounts
    DISCOUNT_APPLIED = "DISCOUNT_APPLIED"

    # Devices
    DEVICE_REGISTERED = "DEVICE_REGISTERED"
    DEVICE_UPDATED = "DEVICE_UPDATED"
    DEVICE_DEACTIVATED = "DEVICE_DEACTIVATED"

    # Sync
    SYNC_PUSH_COMPLETED = "SYNC_PUSH_COMPLETED"
    SYNC_OPERATION_REPLAYED = "SYNC_OPERATION_REPLAYED"
    SYNC_OPERATION_FAILED = "SYNC_OPERATION_FAILED"

    # Analytics
    DASHBOARD_VIEWED = "DASHBOARD_VIEWED"
    SALES_REPORT_VIEWED = "SALES_REPORT_VIEWED"
    INVENTORY_REPORT_VIEWED = "INVENTORY_REPORT_VIEWED"
    FINANCIAL_REPORT_VIEWED = "FINANCIAL_REPORT_VIEWED"

    # Procurement
    PURCHASE_ORDER_CREATED = "PURCHASE_ORDER_CREATED"
    PURCHASE_ORDER_SUBMITTED = "PURCHASE_ORDER_SUBMITTED"
    PURCHASE_ORDER_APPROVED = "PURCHASE_ORDER_APPROVED"
    PURCHASE_ORDER_CANCELLED = "PURCHASE_ORDER_CANCELLED"
    GOODS_RECEIPT_CREATED = "GOODS_RECEIPT_CREATED"
    SUPPLIER_PAYMENT_RECORDED = "SUPPLIER_PAYMENT_RECORDED"
    PAYABLE_CREATED = "PAYABLE_CREATED"

    # Subscriptions
    SUBSCRIPTION_CREATED = "SUBSCRIPTION_CREATED"
    SUBSCRIPTION_ACTIVATED = "SUBSCRIPTION_ACTIVATED"
    SUBSCRIPTION_RENEWED = "SUBSCRIPTION_RENEWED"
    SUBSCRIPTION_UPGRADED = "SUBSCRIPTION_UPGRADED"
    SUBSCRIPTION_DOWNGRADED = "SUBSCRIPTION_DOWNGRADED"
    SUBSCRIPTION_CANCELLED = "SUBSCRIPTION_CANCELLED"
    SUBSCRIPTION_SUSPENDED = "SUBSCRIPTION_SUSPENDED"
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED"
    PAYMENT_PROOF_SUBMITTED = "PAYMENT_PROOF_SUBMITTED"
    PAYMENT_PROOF_APPROVED = "PAYMENT_PROOF_APPROVED"
    PAYMENT_PROOF_REJECTED = "PAYMENT_PROOF_REJECTED"
    PLAN_CREATED = "PLAN_CREATED"
    PLAN_UPDATED = "PLAN_UPDATED"

    # Subscriptions
    ENTITLEMENT_OVERRIDE_CREATED = "ENTITLEMENT_OVERRIDE_CREATED"
    ENTITLEMENT_OVERRIDE_UPDATED = "ENTITLEMENT_OVERRIDE_UPDATED"
    ENTITLEMENT_OVERRIDE_REMOVED = "ENTITLEMENT_OVERRIDE_REMOVED"
    SUBSCRIPTION_EXTENDED = "SUBSCRIPTION_EXTENDED"
    PLAN_CHANGED = "PLAN_CHANGED"
    FEATURE_GATE_BLOCKED = "FEATURE_GATE_BLOCKED"
    LIMIT_EXCEEDED = "LIMIT_EXCEEDED"

    # Notifications
    NOTIFICATION_CREATED = "NOTIFICATION_CREATED"
    NOTIFICATION_READ = "NOTIFICATION_READ"
    NOTIFICATION_READ_ALL = "NOTIFICATION_READ_ALL"
    NOTIFICATION_PREFERENCE_UPDATED = "NOTIFICATION_PREFERENCE_UPDATED"
    EVENT_PUBLISHED = "EVENT_PUBLISHED"
    EMAIL_NOTIFICATION_QUEUED = "EMAIL_NOTIFICATION_QUEUED"

    # Referral / Commission / Wallet
    REFERRAL_CODE_CREATED = "REFERRAL_CODE_CREATED"
    REFERRAL_CODE_DEACTIVATED = "REFERRAL_CODE_DEACTIVATED"
    TENANT_REFERRAL_CREATED = "TENANT_REFERRAL_CREATED"
    TENANT_REFERRAL_LOCKED = "TENANT_REFERRAL_LOCKED"
    COMMISSION_EARNED = "COMMISSION_EARNED"
    COMMISSION_REVERSED = "COMMISSION_REVERSED"
    WALLET_MANUAL_ADJUSTMENT = "WALLET_MANUAL_ADJUSTMENT"
    WALLET_SETTINGS_UPDATED = "WALLET_SETTINGS_UPDATED"
    PAYOUT_REQUESTED = "PAYOUT_REQUESTED"
    PAYOUT_UNDER_REVIEW = "PAYOUT_UNDER_REVIEW"
    PAYOUT_APPROVED = "PAYOUT_APPROVED"
    PAYOUT_REJECTED = "PAYOUT_REJECTED"
    PAYOUT_COMPLETED = "PAYOUT_COMPLETED"
    PAYOUT_CANCELLED = "PAYOUT_CANCELLED"
    RESELLER_NOTE_ADDED = "RESELLER_NOTE_ADDED"


class PermissionScope(str, Enum):
    GLOBAL = "GLOBAL"
    TENANT = "TENANT"
    BRANCH = "BRANCH"


class EntityType(str, Enum):
    USER = "USER"
    TENANT = "TENANT"
    BRANCH = "BRANCH"
    PERMISSION = "PERMISSION"
    ROLE = "ROLE"
    RESELLER_ASSIGNMENT = "RESELLER_ASSIGNMENT"
    AUTH_SESSION = "AUTH_SESSION"
    PRODUCT = "PRODUCT"
    PRODUCT_VARIANT = "PRODUCT_VARIANT"
    CATEGORY = "CATEGORY"
    BRAND = "BRAND"
    STOCK_MOVEMENT = "STOCK_MOVEMENT"
    INVENTORY_ADJUSTMENT = "INVENTORY_ADJUSTMENT"
    INVENTORY_TRANSFER = "INVENTORY_TRANSFER"
    SUPPLIER = "SUPPLIER"
    # Customers
    CUSTOMER = "CUSTOMER"
    CUSTOMER_CONTACT = "CUSTOMER_CONTACT"
    CUSTOMER_NOTE = "CUSTOMER_NOTE"
    CUSTOMER_LEDGER = "CUSTOMER_LEDGER"
    ORDER = "ORDER"
    ORDER_ITEM = "ORDER_ITEM"
    PAYMENT = "PAYMENT"
    REFUND = "REFUND"
    CASHIER_SESSION = "CASHIER_SESSION"
    RECEIPT = "RECEIPT"
    CART = "CART"
    DEVICE = "DEVICE"
    SYNC_OPERATION = "SYNC_OPERATION"
    SYNC_CHECKPOINT = "SYNC_CHECKPOINT"
    # Analytics
    ANALYTICS_REPORT = "ANALYTICS_REPORT"
    # Procurement
    PURCHASE_ORDER = "PURCHASE_ORDER"
    PURCHASE_ORDER_ITEM = "PURCHASE_ORDER_ITEM"
    GOODS_RECEIPT = "GOODS_RECEIPT"
    SUPPLIER_PAYABLE = "SUPPLIER_PAYABLE"
    SUPPLIER_PAYMENT = "SUPPLIER_PAYMENT"
    # Subscriptions
    SUBSCRIPTION_PLAN = "SUBSCRIPTION_PLAN"
    TENANT_SUBSCRIPTION = "TENANT_SUBSCRIPTION"
    SUBSCRIPTION_HISTORY = "SUBSCRIPTION_HISTORY"
    PAYMENT_PROOF = "PAYMENT_PROOF"
    # Entitlement Overrides
    ENTITLEMENT_OVERRIDE = "ENTITLEMENT_OVERRIDE"
    # Notifications
    NOTIFICATION = "NOTIFICATION"
    NOTIFICATION_PREFERENCE = "NOTIFICATION_PREFERENCE"
    # Referral / Commission / Wallet
    REFERRAL_CODE = "REFERRAL_CODE"
    TENANT_REFERRAL = "TENANT_REFERRAL"
    RESELLER_WALLET = "RESELLER_WALLET"
    WALLET_TRANSACTION = "WALLET_TRANSACTION"
    PAYOUT_REQUEST = "PAYOUT_REQUEST"
    RESELLER_NOTE = "RESELLER_NOTE"


class WalletTransactionType(str, Enum):
    COMMISSION_EARNED = "COMMISSION_EARNED"
    COMMISSION_REVERSAL = "COMMISSION_REVERSAL"
    PAYOUT_LOCKED = "PAYOUT_LOCKED"
    PAYOUT_APPROVED = "PAYOUT_APPROVED"
    PAYOUT_REJECTED = "PAYOUT_REJECTED"
    PAYOUT_COMPLETED = "PAYOUT_COMPLETED"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    BONUS = "BONUS"
    PENALTY = "PENALTY"


class PayoutStatus(str, Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


# Permission codes
class Permission(str, Enum):
    # User permissions
    USER_VIEW = "user:view"
    USER_CREATE = "user:create"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    USER_MANAGE_ROLES = "user:manage_roles"

    # Tenant permissions
    TENANT_VIEW = "tenant:view"
    TENANT_CREATE = "tenant:create"
    TENANT_UPDATE = "tenant:update"
    TENANT_DELETE = "tenant:delete"
    TENANT_MANAGE = "tenant:manage"

    # Branch permissions
    BRANCH_VIEW = "branch:view"
    BRANCH_CREATE = "branch:create"
    BRANCH_UPDATE = "branch:update"
    BRANCH_DELETE = "branch:delete"
    BRANCH_MANAGE = "branch:manage"

    # Product permissions
    PRODUCT_VIEW = "product:view"
    PRODUCT_CREATE = "product:create"
    PRODUCT_UPDATE = "product:update"
    PRODUCT_DELETE = "product:delete"

    # Category / Brand permissions
    CATEGORY_MANAGE = "category:manage"
    BRAND_MANAGE = "brand:manage"

    # Inventory permissions
    INVENTORY_VIEW = "inventory:view"
    INVENTORY_CREATE = "inventory:create"
    INVENTORY_UPDATE = "inventory:update"
    INVENTORY_DELETE = "inventory:delete"
    INVENTORY_ADJUST = "inventory:adjust"
    INVENTORY_TRANSFER = "inventory:transfer"
    INVENTORY_MOVEMENT_VIEW = "inventory:movement:view"

    # Supplier permissions
    SUPPLIER_VIEW = "supplier:view"
    SUPPLIER_MANAGE = "supplier:manage"

    # Customer permissions
    CUSTOMER_VIEW = "customer:view"
    CUSTOMER_CREATE = "customer:create"
    CUSTOMER_UPDATE = "customer:update"
    CUSTOMER_DELETE = "customer:delete"
    CUSTOMER_PAYMENT = "customer:payment"
    CUSTOMER_ADJUST = "customer:adjust"

    # POS / Sales permissions
    POS_ACCESS = "pos:access"
    POS_SALE_CREATE = "pos:sale:create"
    POS_SALE_VOID = "pos:sale:void"
    POS_REFUND = "pos:refund"
    SALES_VIEW = "sales:view"
    SALES_CREATE = "sales:create"
    SALES_VOID = "sales:void"
    SALES_REFUND = "sales:refund"
    PAYMENTS_MANAGE = "payments:manage"
    CASHIER_OPEN_SESSION = "cashier:open_session"
    CASHIER_CLOSE_SESSION = "cashier:close_session"
    RECEIPTS_VIEW = "receipts:view"

    # Device permissions
    DEVICE_VIEW = "device:view"
    DEVICE_MANAGE = "device:manage"

    # Sync permissions
    SYNC_PUSH = "sync:push"
    SYNC_PULL = "sync:pull"

    # Report permissions
    REPORT_VIEW = "report:view"
    REPORT_PROFIT = "report:profit"
    REPORT_EXPORT = "report:export"

    # Analytics permissions
    ANALYTICS_DASHBOARD = "analytics:dashboard:view"
    ANALYTICS_SALES = "analytics:sales:view"
    ANALYTICS_INVENTORY = "analytics:inventory:view"
    ANALYTICS_FINANCIAL = "analytics:financial:view"

    # Procurement permissions
    PROCUREMENT_VIEW = "procurement:view"
    PROCUREMENT_CREATE = "procurement:create"
    PROCUREMENT_APPROVE = "procurement:approve"
    PROCUREMENT_RECEIVE = "procurement:receive"
    PROCUREMENT_PAYABLES = "procurement:payables"
    PROCUREMENT_PAYMENTS = "procurement:payments"

    # Subscription permissions
    SUBSCRIPTION_VIEW = "subscriptions:view"
    SUBSCRIPTION_MANAGE = "subscriptions:manage"
    SUBSCRIPTION_PLANS_MANAGE = "subscriptions:plans:manage"
    SUBSCRIPTION_APPROVE_PAYMENT = "subscriptions:approve_payment"

    # Subscription admin permissions
    SUBSCRIPTION_OVERRIDE = "subscriptions:override"
    SUBSCRIPTION_EXTEND = "subscriptions:extend"
    SUBSCRIPTION_VIEW_ALL = "subscriptions:view_all"
    SUBSCRIPTION_CHANGE_PLAN = "subscriptions:change_plan"

    # Notification permissions
    NOTIFICATION_VIEW = "notifications:view"
    NOTIFICATION_MANAGE = "notifications:manage"
    NOTIFICATION_PREFERENCES = "notifications:preferences"

    # System permissions
    SYSTEM_ADMIN = "system:admin"
    AUDIT_VIEW = "audit:view"
    PERMISSION_MANAGE = "permission:manage"


# Default role permissions mapping
ROLE_DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    UserRole.SUPER_ADMIN: [p.value for p in Permission],  # All permissions
    UserRole.RESELLER: [
        # Tenant / Branch (read-only)
        Permission.TENANT_VIEW,
        Permission.BRANCH_VIEW,
        # Staff visibility / management
        Permission.USER_VIEW,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        # Inventory
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_ADJUST,
        Permission.INVENTORY_TRANSFER,
        Permission.INVENTORY_MOVEMENT_VIEW,
        # Customers
        Permission.CUSTOMER_VIEW,
        Permission.CUSTOMER_PAYMENT,
        # Sales (read-only)
        Permission.SALES_VIEW,
        # Procurement
        Permission.PROCUREMENT_VIEW,
        Permission.PROCUREMENT_CREATE,
        Permission.PROCUREMENT_APPROVE,
        Permission.PROCUREMENT_RECEIVE,
        Permission.PROCUREMENT_PAYABLES,
        # Subscription (read-only)
        Permission.SUBSCRIPTION_VIEW,
        # Reports / Analytics
        Permission.REPORT_VIEW,
        Permission.REPORT_PROFIT,
        Permission.REPORT_EXPORT,
        Permission.ANALYTICS_DASHBOARD,
        Permission.ANALYTICS_SALES,
        Permission.ANALYTICS_INVENTORY,
        Permission.ANALYTICS_FINANCIAL,
        # Notifications
        Permission.NOTIFICATION_VIEW,
    ],
    UserRole.BUSINESS_OWNER: [
        Permission.USER_VIEW,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.USER_MANAGE_ROLES,
        Permission.TENANT_VIEW,
        Permission.TENANT_UPDATE,
        Permission.BRANCH_VIEW,
        Permission.BRANCH_CREATE,
        Permission.BRANCH_UPDATE,
        Permission.BRANCH_DELETE,
        Permission.BRANCH_MANAGE,
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_DELETE,
        Permission.CATEGORY_MANAGE,
        Permission.BRAND_MANAGE,
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_CREATE,
        Permission.INVENTORY_UPDATE,
        Permission.INVENTORY_DELETE,
        Permission.INVENTORY_ADJUST,
        Permission.INVENTORY_TRANSFER,
        Permission.INVENTORY_MOVEMENT_VIEW,
        Permission.SUPPLIER_VIEW,
        Permission.SUPPLIER_MANAGE,
        Permission.CUSTOMER_VIEW,
        Permission.CUSTOMER_CREATE,
        Permission.CUSTOMER_UPDATE,
        Permission.CUSTOMER_DELETE,
        Permission.CUSTOMER_PAYMENT,
        Permission.CUSTOMER_ADJUST,
        Permission.POS_ACCESS,
        Permission.POS_SALE_CREATE,
        Permission.POS_SALE_VOID,
        Permission.POS_REFUND,
        Permission.SALES_VIEW,
        Permission.SALES_CREATE,
        Permission.SALES_VOID,
        Permission.SALES_REFUND,
        Permission.PAYMENTS_MANAGE,
        Permission.CASHIER_OPEN_SESSION,
        Permission.CASHIER_CLOSE_SESSION,
        Permission.RECEIPTS_VIEW,
        Permission.REPORT_VIEW,
        Permission.REPORT_PROFIT,
        Permission.REPORT_EXPORT,
        Permission.ANALYTICS_DASHBOARD,
        Permission.ANALYTICS_SALES,
        Permission.ANALYTICS_INVENTORY,
        Permission.ANALYTICS_FINANCIAL,
        Permission.PROCUREMENT_VIEW,
        Permission.PROCUREMENT_CREATE,
        Permission.PROCUREMENT_APPROVE,
        Permission.PROCUREMENT_RECEIVE,
        Permission.PROCUREMENT_PAYABLES,
        Permission.PROCUREMENT_PAYMENTS,
        Permission.SUBSCRIPTION_VIEW,
        Permission.SUBSCRIPTION_MANAGE,
        Permission.AUDIT_VIEW,
        Permission.DEVICE_VIEW,
        Permission.DEVICE_MANAGE,
        Permission.SYNC_PUSH,
        Permission.SYNC_PULL,
        Permission.NOTIFICATION_VIEW,
        Permission.NOTIFICATION_PREFERENCES,
    ],
    UserRole.MANAGER: [
        Permission.USER_VIEW,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.BRANCH_VIEW,
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.CATEGORY_MANAGE,
        Permission.BRAND_MANAGE,
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_CREATE,
        Permission.INVENTORY_UPDATE,
        Permission.INVENTORY_ADJUST,
        Permission.INVENTORY_TRANSFER,
        Permission.INVENTORY_MOVEMENT_VIEW,
        Permission.SUPPLIER_VIEW,
        Permission.CUSTOMER_VIEW,
        Permission.CUSTOMER_CREATE,
        Permission.CUSTOMER_UPDATE,
        Permission.CUSTOMER_DELETE,
        Permission.CUSTOMER_PAYMENT,
        Permission.CUSTOMER_ADJUST,
        Permission.POS_ACCESS,
        Permission.POS_SALE_CREATE,
        Permission.POS_SALE_VOID,
        Permission.POS_REFUND,
        Permission.SALES_VIEW,
        Permission.SALES_CREATE,
        Permission.SALES_VOID,
        Permission.SALES_REFUND,
        Permission.PAYMENTS_MANAGE,
        Permission.CASHIER_OPEN_SESSION,
        Permission.CASHIER_CLOSE_SESSION,
        Permission.RECEIPTS_VIEW,
        Permission.REPORT_VIEW,
        Permission.ANALYTICS_DASHBOARD,
        Permission.ANALYTICS_SALES,
        Permission.ANALYTICS_INVENTORY,
        Permission.ANALYTICS_FINANCIAL,
        Permission.PROCUREMENT_VIEW,
        Permission.PROCUREMENT_CREATE,
        Permission.PROCUREMENT_APPROVE,
        Permission.PROCUREMENT_RECEIVE,
        Permission.PROCUREMENT_PAYABLES,
        Permission.PROCUREMENT_PAYMENTS,
        Permission.SUBSCRIPTION_VIEW,
        Permission.DEVICE_VIEW,
        Permission.DEVICE_MANAGE,
        Permission.SYNC_PUSH,
        Permission.SYNC_PULL,
        Permission.NOTIFICATION_VIEW,
        Permission.NOTIFICATION_PREFERENCES,
    ],
    UserRole.CASHIER: [
        Permission.POS_ACCESS,
        Permission.POS_SALE_CREATE,
        Permission.SALES_VIEW,
        Permission.SALES_CREATE,
        Permission.PAYMENTS_MANAGE,
        Permission.CASHIER_OPEN_SESSION,
        Permission.CASHIER_CLOSE_SESSION,
        Permission.RECEIPTS_VIEW,
        Permission.INVENTORY_VIEW,
        Permission.PRODUCT_VIEW,
        Permission.CUSTOMER_VIEW,
        Permission.CUSTOMER_CREATE,
        Permission.CUSTOMER_UPDATE,
        Permission.CUSTOMER_PAYMENT,
        Permission.ANALYTICS_DASHBOARD,
        Permission.PROCUREMENT_VIEW,
        Permission.DEVICE_VIEW,
        Permission.SYNC_PUSH,
        Permission.SYNC_PULL,
        Permission.NOTIFICATION_VIEW,
        Permission.NOTIFICATION_PREFERENCES,
    ],
    UserRole.INVENTORY_STAFF: [
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_CREATE,
        Permission.INVENTORY_UPDATE,
        Permission.INVENTORY_ADJUST,
        Permission.INVENTORY_MOVEMENT_VIEW,
        Permission.SUPPLIER_VIEW,
        Permission.PROCUREMENT_VIEW,
        Permission.PROCUREMENT_RECEIVE,
        Permission.NOTIFICATION_VIEW,
        Permission.NOTIFICATION_PREFERENCES,
    ],
}

# Maps F9 portal permission names → Permission codes stored in restricted_permissions.
# A reseller has the permission when its code is NOT in assignment.restricted_permissions.
RESELLER_PERMISSION_MAP: dict[str, str] = {
    "view_revenue":             Permission.ANALYTICS_SALES.value,
    "view_profit":              Permission.REPORT_PROFIT.value,
    "view_analytics":           Permission.ANALYTICS_DASHBOARD.value,
    "view_inventory":           Permission.INVENTORY_VIEW.value,
    "adjust_inventory":         Permission.INVENTORY_ADJUST.value,
    "transfer_inventory":       Permission.INVENTORY_TRANSFER.value,
    "view_customers":           Permission.CUSTOMER_VIEW.value,
    "view_customer_debt":       Permission.CUSTOMER_VIEW.value,
    "record_customer_payment":  Permission.CUSTOMER_PAYMENT.value,
    "view_procurement":         Permission.PROCUREMENT_VIEW.value,
    "create_purchase_order":    Permission.PROCUREMENT_CREATE.value,
    "approve_purchase_order":   Permission.PROCUREMENT_APPROVE.value,
    "view_subscription_status": Permission.SUBSCRIPTION_VIEW.value,
    "view_staff":               Permission.USER_VIEW.value,
    "manage_staff":             Permission.USER_CREATE.value,
    "export_data":              Permission.REPORT_EXPORT.value,
    "view_branch_reports":      Permission.REPORT_VIEW.value,
}

# API versioning
API_V1_PREFIX = "/api/v1"

# Pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Token types
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

# Header names
HEADER_X_REQUEST_ID = "X-Request-ID"
HEADER_X_TENANT_ID = "X-Tenant-ID"
HEADER_X_CORRELATION_ID = "X-Correlation-ID"
