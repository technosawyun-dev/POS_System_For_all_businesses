# Leaf models first (no cross-model dependencies at runtime)
from app.models.audit import AuditLog
from app.models.auth import RefreshToken
from app.models.permission import Permission, RolePermission, UserPermission
# Then models with relationships (resolved lazily by SQLAlchemy mapper registry)
from app.models.tenant import Tenant, TenantSettings
from app.models.branch import Branch, BranchSettings
from app.models.user import User, UserBranchAssignment
from app.models.reseller import ResellerAssignment
# Phase 2 — product, inventory, supplier
from app.models.product import (
    Brand,
    Category,
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
# Phase 3 — Sales Engine
from app.cashiers.models import CashierSession
from app.sales.models import BranchCounter, Cart, CartItem, Order, OrderItem
from app.payments.models import Payment, Refund, RefundItem
from app.receipts.models import Receipt
# Phase 4 — Offline Sync
from app.devices.models import PosDevice
from app.sync.models import SyncCheckpoint, SyncOperation

__all__ = [
    "AuditLog",
    "RefreshToken",
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
    # Phase 2
    "Category",
    "Brand",
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
    # Phase 3
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
    # Phase 4
    "PosDevice",
    "SyncCheckpoint",
    "SyncOperation",
]
