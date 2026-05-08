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
    SALE = "SALE"
    REFUND = "REFUND"
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
    StockMovementType.REFUND,
    StockMovementType.TRANSFER_IN,
    StockMovementType.ADJUSTMENT_INCREASE,
    StockMovementType.OPENING_STOCK,
})

# Movement types that DECREASE stock quantity
STOCK_OUTBOUND_TYPES: frozenset[str] = frozenset({
    StockMovementType.SALE,
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


class AuditAction(str, Enum):
    # Auth
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    LOGIN_FAILED = "LOGIN_FAILED"
    TOKEN_REFRESHED = "TOKEN_REFRESHED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED"

    # User management
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    USER_ACTIVATED = "USER_ACTIVATED"
    USER_DEACTIVATED = "USER_DEACTIVATED"
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

    # POS permissions (foundation for future)
    POS_ACCESS = "pos:access"
    POS_SALE_CREATE = "pos:sale:create"
    POS_SALE_VOID = "pos:sale:void"
    POS_REFUND = "pos:refund"

    # Report permissions
    REPORT_VIEW = "report:view"
    REPORT_PROFIT = "report:profit"
    REPORT_EXPORT = "report:export"

    # System permissions
    SYSTEM_ADMIN = "system:admin"
    AUDIT_VIEW = "audit:view"
    PERMISSION_MANAGE = "permission:manage"


# Default role permissions mapping
ROLE_DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    UserRole.SUPER_ADMIN: [p.value for p in Permission],  # All permissions
    UserRole.RESELLER: [
        Permission.TENANT_VIEW,
        Permission.BRANCH_VIEW,
        Permission.USER_VIEW,
        Permission.INVENTORY_VIEW,
        Permission.REPORT_VIEW,
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
        Permission.POS_ACCESS,
        Permission.POS_SALE_CREATE,
        Permission.POS_SALE_VOID,
        Permission.POS_REFUND,
        Permission.REPORT_VIEW,
        Permission.REPORT_PROFIT,
        Permission.REPORT_EXPORT,
        Permission.AUDIT_VIEW,
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
        Permission.POS_ACCESS,
        Permission.POS_SALE_CREATE,
        Permission.POS_SALE_VOID,
        Permission.POS_REFUND,
        Permission.REPORT_VIEW,
    ],
    UserRole.CASHIER: [
        Permission.POS_ACCESS,
        Permission.POS_SALE_CREATE,
        Permission.INVENTORY_VIEW,
        Permission.PRODUCT_VIEW,
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
    ],
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
