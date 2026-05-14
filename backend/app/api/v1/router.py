from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import auth, branches, tenants, users, resellers, audit
from app.api.v1.routes import products, categories, brands, inventory, suppliers
from app.cashiers.routes import router as cashier_router
from app.sales.routes import router as sales_router
from app.payments.routes import router as payment_router
from app.receipts.routes import router as receipt_router
from app.devices.routes import router as device_router
from app.sync.routes import router as sync_router

api_router = APIRouter()

# Phase 1
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(branches.router, prefix="/tenants/{tenant_id}/branches", tags=["Branches"])
api_router.include_router(resellers.router, prefix="/resellers", tags=["Resellers"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])

# Phase 2
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])

# Phase 3 — Sales Engine
api_router.include_router(cashier_router, prefix="/cashier-sessions", tags=["Cashier Sessions"])
api_router.include_router(sales_router, prefix="/sales", tags=["Sales"])
api_router.include_router(payment_router, prefix="/payments", tags=["Payments & Refunds"])
api_router.include_router(receipt_router, prefix="/receipts", tags=["Receipts"])

# Phase 4 — Offline Sync
api_router.include_router(device_router, prefix="/devices", tags=["Devices"])
api_router.include_router(sync_router, prefix="/sync", tags=["Sync"])
