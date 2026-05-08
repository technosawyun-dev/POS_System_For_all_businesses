from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import auth, branches, tenants, users, resellers, audit
from app.api.v1.routes import products, categories, brands, inventory, suppliers

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
