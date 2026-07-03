# Leaf models first (no cross-model dependencies at runtime)
from app.models.audit import AuditLog
from app.models.auth import RefreshToken
from app.models.password_reset_token import PasswordResetToken
from app.models.permission import Permission, RolePermission, UserPermission
# Then models with relationships (resolved lazily by SQLAlchemy mapper registry)
from app.models.tenant import Tenant, TenantSettings
from app.models.branch import Branch, BranchSettings
from app.models.user import User, UserBranchAssignment
from app.models.reseller import ResellerAssignment
# product, inventory, supplier
from app.models.product import (
    Brand,
    Category,
    GlobalProductCatalog,
    Product,
    ProductPriceHistory,
    ProductVariant,
    VariantAttribute,
    VariantValue,
)
from app.models.inventory import (
    BranchInventory,
    InventoryAdjustment,
    InventoryAdjustmentItem,
    InventoryTransfer,
    InventoryTransferItem,
    StockMovement,
)
from app.models.supplier import Supplier, SupplierContact
# Customers
from app.customers.models import Customer, CustomerContact, CustomerCounter, CustomerLedger, CustomerNote
# Sales Engine
from app.cashiers.models import CashierSession
from app.sales.models import BranchCounter, Cart, CartItem, Order, OrderItem
from app.payments.models import Payment, Refund, RefundItem
from app.receipts.models import Receipt
# Offline Sync
from app.devices.models import PosDevice
from app.sync.models import SyncCheckpoint, SyncOperation
# Procurement
from app.procurement.models import (
    GRCounter,
    GoodsReceipt,
    GoodsReceiptItem,
    POCounter,
    PurchaseOrder,
    PurchaseOrderItem,
    SupplierPayable,
    SupplierPayment,
)
# Subscriptions
from app.subscriptions.models import (
    PaymentProof,
    PlanEntitlement,
    SubscriptionHistory,
    SubscriptionPlan,
    TenantSubscription,
)
# Entitlement Overrides
from app.subscriptions.models import TenantEntitlementOverride
# Notifications
from app.notifications.models import Notification, NotificationPreference, NotificationRecipient

__all__ = [
    "AuditLog",
    "RefreshToken",
    "PasswordResetToken",
    "Permission",
    "RolePermission",
    "UserPermission",
    "Tenant",
    "TenantSettings",
    "Branch",
    "BranchSettings",
    "User",
    "UserBranchAssignment",
    "ResellerAssignment",
    "Category",
    "Brand",
    "GlobalProductCatalog",
    "Product",
    "ProductVariant",
    "VariantAttribute",
    "VariantValue",
    "ProductPriceHistory",
    "BranchInventory",
    "StockMovement",
    "InventoryAdjustment",
    "InventoryAdjustmentItem",
    "InventoryTransfer",
    "InventoryTransferItem",
    "Supplier",
    "SupplierContact",
    "Customer",
    "CustomerContact",
    "CustomerCounter",
    "CustomerNote",
    "CustomerLedger",
    "CashierSession",
    "BranchCounter",
    "Cart",
    "CartItem",
    "Order",
    "OrderItem",
    "Payment",
    "Refund",
    "RefundItem",
    "Receipt",
    "PosDevice",
    "SyncCheckpoint",
    "SyncOperation",
    "POCounter",
    "GRCounter",
    "PurchaseOrder",
    "PurchaseOrderItem",
    "GoodsReceipt",
    "GoodsReceiptItem",
    "SupplierPayable",
    "SupplierPayment",
    "SubscriptionPlan",
    "PlanEntitlement",
    "TenantSubscription",
    "SubscriptionHistory",
    "PaymentProof",
    "TenantEntitlementOverride",
    "Notification",
    "NotificationRecipient",
    "NotificationPreference",
]
