from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.v1.routes import auth, branches, tenants, users, resellers, reseller_portal, audit
from app.api.v1.routes import products, categories, brands, inventory, suppliers
from app.api.v1.routes import public as public_routes
from app.customers.routes import router as customer_router
from app.cashiers.routes import router as cashier_router
from app.sales.routes import router as sales_router
from app.payments.routes import router as payment_router
from app.receipts.routes import router as receipt_router
from app.devices.routes import router as device_router
from app.sync.routes import router as sync_router
from app.analytics.routes import router as analytics_router
from app.procurement.routes import router as procurement_router
from app.subscriptions.routes import router as subscriptions_router
from app.subscriptions.admin_routes import router as subscriptions_admin_router
from app.subscriptions.gates import require_feature, require_subscription_active
from app.notifications.routes import router as notifications_router

api_router = APIRouter()

# Reusable subscription gate (SUPER_ADMIN bypasses automatically)
_sub_gate = [Depends(require_subscription_active())]

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(branches.router, prefix="/tenants/{tenant_id}/branches", tags=["Branches"])
api_router.include_router(resellers.router, prefix="/resellers", tags=["Resellers"])
api_router.include_router(reseller_portal.router, prefix="/resellers", tags=["Reseller Portal"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])

# Products, Inventory, Suppliers: subscription-gated
api_router.include_router(products.router, prefix="/products", tags=["Products"], dependencies=_sub_gate)
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"], dependencies=_sub_gate)
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"], dependencies=_sub_gate)
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"], dependencies=_sub_gate)
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"], dependencies=_sub_gate)

# Customers: subscription-gated
api_router.include_router(customer_router, prefix="/customers", tags=["Customers"], dependencies=_sub_gate)

# Sales Engine: subscription-gated
api_router.include_router(cashier_router, prefix="/cashier-sessions", tags=["Cashier Sessions"], dependencies=_sub_gate)
api_router.include_router(sales_router, prefix="/sales", tags=["Sales"], dependencies=_sub_gate)
api_router.include_router(payment_router, prefix="/payments", tags=["Payments & Refunds"], dependencies=_sub_gate)
api_router.include_router(receipt_router, prefix="/receipts", tags=["Receipts"], dependencies=_sub_gate)

# Offline Sync (not gated: offline devices must sync even when expired)
api_router.include_router(device_router, prefix="/devices", tags=["Devices"])
api_router.include_router(sync_router, prefix="/sync", tags=["Sync"])

# Analytics & Reports (feature-gated)
api_router.include_router(
    analytics_router,
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_feature("analytics"))],
)

# Procurement & Supplier Payables (feature-gated)
api_router.include_router(
    procurement_router,
    prefix="/procurement",
    tags=["Procurement"],
    dependencies=[Depends(require_feature("procurement"))],
)

# Subscriptions & Billing
api_router.include_router(subscriptions_router, prefix="/subscriptions", tags=["Subscriptions"])

# Subscription Admin & Enforcement
api_router.include_router(
    subscriptions_admin_router,
    prefix="/subscriptions/admin",
    tags=["Subscription Admin"],
)

# Notifications
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])

# Public endpoints (no authentication required)
api_router.include_router(public_routes.router, prefix="/public", tags=["Public"])

# Referral / Commission / Reseller Wallet
from app.reseller_finance.routes.reseller_routes import router as reseller_finance_router
from app.reseller_finance.routes.admin_routes import router as reseller_finance_admin_router

api_router.include_router(
    reseller_finance_router,
    prefix="/reseller",
    tags=["Reseller Finance"],
)
api_router.include_router(
    reseller_finance_admin_router,
    prefix="/admin/reseller-finance",
    tags=["Reseller Finance Admin"],
)
