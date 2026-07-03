from __future__ import annotations

import re
import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, PriceType
from app.core.exceptions import ConflictError, NotFoundError
from app.models.product import Brand, Category, GlobalProductCatalog, Product, ProductVariant
from app.repositories.product_repository import (
    BrandRepository,
    CategoryRepository,
    GlobalProductCatalogRepository,
    ProductPriceHistoryRepository,
    ProductRepository,
    ProductVariantRepository,
)
from app.schemas.product import (
    BrandCreateRequest,
    BrandUpdateRequest,
    CategoryCreateRequest,
    CategoryUpdateRequest,
    ProductCreateRequest,
    ProductUpdateRequest,
    ProductVariantCreateRequest,
    ProductVariantUpdateRequest,
)
from app.services.audit_service import AuditService


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:255]


async def _unique_slug(base: str, exists_fn) -> str:
    slug = base
    counter = 1
    while await exists_fn(slug):
        slug = f"{base}-{counter}"
        counter += 1
    return slug


class CategoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CategoryRepository(session)
        self.audit = AuditService(session)

    async def create_category(
        self,
        tenant_id: uuid.UUID,
        data: CategoryCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Category:
        base_slug = _slugify(data.name)
        slug = await _unique_slug(
            base_slug,
            lambda s: self.repo.slug_exists(tenant_id, s, data.parent_id),
        )
        category = await self.repo.create(
            tenant_id=tenant_id,
            parent_id=data.parent_id,
            name=data.name,
            slug=slug,
            description=data.description,
            sort_order=data.sort_order,
        )
        await self.audit.log(
            action=AuditAction.CATEGORY_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CATEGORY,
            entity_id=category.id,
            after_state={"name": category.name, "slug": category.slug},
            request_id=request_id,
        )
        return category

    async def get_category(
        self, category_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Category:
        category = await self.repo.get_active_by_id_and_tenant(category_id, tenant_id)
        if not category:
            raise NotFoundError("Category", category_id)
        return category

    async def list_categories(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        parent_id: uuid.UUID | None = None,
    ) -> tuple[list[Category], int]:
        offset = (page - 1) * page_size
        return await self.repo.get_by_tenant(
            tenant_id, offset=offset, limit=page_size, parent_id=parent_id
        )

    async def update_category(
        self,
        category_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: CategoryUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Category:
        category = await self.repo.get_active_by_id_and_tenant(category_id, tenant_id)
        if not category:
            raise NotFoundError("Category", category_id)

        update_data = data.model_dump(exclude_none=True)
        if "name" in update_data:
            base_slug = _slugify(update_data["name"])
            update_data["slug"] = await _unique_slug(
                base_slug,
                lambda s: self.repo.slug_exists(tenant_id, s, category.parent_id, category_id),
            )

        before = {"name": category.name}
        category = await self.repo.update(category, **update_data)
        await self.audit.log(
            action=AuditAction.CATEGORY_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CATEGORY,
            entity_id=category_id,
            before_state=before,
            after_state=update_data,
            request_id=request_id,
        )
        return category

    async def delete_category(
        self,
        category_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        category = await self.repo.get_active_by_id_and_tenant(category_id, tenant_id)
        if not category:
            raise NotFoundError("Category", category_id)
        await self.repo.soft_delete(category)
        await self.audit.log(
            action=AuditAction.CATEGORY_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.CATEGORY,
            entity_id=category_id,
            before_state={"name": category.name},
            request_id=request_id,
        )

    async def find_or_create_by_name(
        self,
        tenant_id: uuid.UUID,
        name: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Category:
        existing = await self.repo.get_by_name(tenant_id, name)
        if existing:
            return existing
        return await self.create_category(
            tenant_id, CategoryCreateRequest(name=name), actor_id, request_id
        )


class BrandService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = BrandRepository(session)
        self.audit = AuditService(session)

    async def create_brand(
        self,
        tenant_id: uuid.UUID,
        data: BrandCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Brand:
        base_slug = _slugify(data.name)
        slug = await _unique_slug(
            base_slug,
            lambda s: self.repo.slug_exists(tenant_id, s),
        )
        brand = await self.repo.create(
            tenant_id=tenant_id,
            name=data.name,
            slug=slug,
            description=data.description,
            logo_url=data.logo_url,
        )
        await self.audit.log(
            action=AuditAction.BRAND_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.BRAND,
            entity_id=brand.id,
            after_state={"name": brand.name},
            request_id=request_id,
        )
        return brand

    async def get_brand(self, brand_id: uuid.UUID, tenant_id: uuid.UUID) -> Brand:
        brand = await self.repo.get_active_by_id_and_tenant(brand_id, tenant_id)
        if not brand:
            raise NotFoundError("Brand", brand_id)
        return brand

    async def list_brands(
        self, tenant_id: uuid.UUID, page: int = 1, page_size: int = 20
    ) -> tuple[list[Brand], int]:
        offset = (page - 1) * page_size
        return await self.repo.get_by_tenant(tenant_id, offset=offset, limit=page_size)

    async def update_brand(
        self,
        brand_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: BrandUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Brand:
        brand = await self.repo.get_active_by_id_and_tenant(brand_id, tenant_id)
        if not brand:
            raise NotFoundError("Brand", brand_id)

        update_data = data.model_dump(exclude_none=True)
        if "name" in update_data:
            base_slug = _slugify(update_data["name"])
            update_data["slug"] = await _unique_slug(
                base_slug,
                lambda s: self.repo.slug_exists(tenant_id, s, brand_id),
            )

        before = {"name": brand.name}
        brand = await self.repo.update(brand, **update_data)
        await self.audit.log(
            action=AuditAction.BRAND_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.BRAND,
            entity_id=brand_id,
            before_state=before,
            after_state=update_data,
            request_id=request_id,
        )
        return brand

    async def delete_brand(
        self,
        brand_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        brand = await self.repo.get_active_by_id_and_tenant(brand_id, tenant_id)
        if not brand:
            raise NotFoundError("Brand", brand_id)
        await self.repo.soft_delete(brand)
        await self.audit.log(
            action=AuditAction.BRAND_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.BRAND,
            entity_id=brand_id,
            before_state={"name": brand.name},
            request_id=request_id,
        )

    async def find_or_create_by_name(
        self,
        tenant_id: uuid.UUID,
        name: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Brand:
        existing = await self.repo.get_by_name(tenant_id, name)
        if existing:
            return existing
        return await self.create_brand(
            tenant_id, BrandCreateRequest(name=name), actor_id, request_id
        )


class GlobalCatalogService:
    """Cross-tenant Name/Description/Category/Brand lookup and sync, keyed by barcode.

    Every other product field (price, SKU, stock, tax, etc.) stays tenant-private —
    see GlobalProductCatalog for the rationale.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.catalog_repo = GlobalProductCatalogRepository(session)
        self.category_service = CategoryService(session)
        self.brand_service = BrandService(session)

    async def lookup_by_barcode(
        self,
        tenant_id: uuid.UUID,
        barcode: str,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> dict | None:
        entry = await self.catalog_repo.get_by_barcode(barcode)
        if not entry:
            return None

        category = None
        if entry.category_name:
            category = await self.category_service.find_or_create_by_name(
                tenant_id, entry.category_name, actor_id, request_id
            )
        brand = None
        if entry.brand_name:
            brand = await self.brand_service.find_or_create_by_name(
                tenant_id, entry.brand_name, actor_id, request_id
            )

        return {
            "name": entry.name,
            "description": entry.description,
            "category_id": category.id if category else None,
            "category_name": category.name if category else entry.category_name,
            "brand_id": brand.id if brand else None,
            "brand_name": brand.name if brand else entry.brand_name,
        }

    async def sync_from_product(
        self,
        tenant_id: uuid.UUID,
        barcode: str | None,
        name: str,
        description: str | None,
        category_id: uuid.UUID | None,
        brand_id: uuid.UUID | None,
    ) -> None:
        if not barcode:
            return
        category_name = None
        if category_id:
            category = await self.category_service.repo.get_by_id(category_id)
            category_name = category.name if category else None
        brand_name = None
        if brand_id:
            brand = await self.brand_service.repo.get_by_id(brand_id)
            brand_name = brand.name if brand else None
        await self.catalog_repo.upsert(
            barcode=barcode,
            name=name,
            description=description,
            category_name=category_name,
            brand_name=brand_name,
            tenant_id=tenant_id,
        )


class ProductService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.product_repo = ProductRepository(session)
        self.variant_repo = ProductVariantRepository(session)
        self.price_history_repo = ProductPriceHistoryRepository(session)
        self.audit = AuditService(session)
        self.catalog = GlobalCatalogService(session)

    async def create_product(
        self,
        tenant_id: uuid.UUID,
        data: ProductCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Product:
        if data.sku and (
            await self.product_repo.sku_exists(tenant_id, data.sku)
            or await self.variant_repo.sku_exists(tenant_id, data.sku)
        ):
            raise ConflictError(f"SKU '{data.sku}' already exists in this tenant")

        if data.barcode and await self.product_repo.barcode_exists(tenant_id, data.barcode):
            raise ConflictError(f"Barcode '{data.barcode}' already exists in this tenant")

        base_slug = _slugify(data.name)
        slug = await _unique_slug(
            base_slug,
            lambda s: self.product_repo.slug_exists(tenant_id, s),
        )

        product = await self.product_repo.create(
            tenant_id=tenant_id,
            name=data.name,
            slug=slug,
            product_type=data.product_type,
            description=data.description,
            category_id=data.category_id,
            brand_id=data.brand_id,
            sku=data.sku,
            barcode=data.barcode,
            qr_code=data.qr_code,
            unit=data.unit,
            cost_price=data.cost_price,
            selling_price=data.selling_price,
            tax_rate=data.tax_rate,
            discount_type=data.discount_type,
            discount_value=data.discount_value,
            discount_start_at=data.discount_start_at,
            discount_end_at=data.discount_end_at,
        )

        await self._record_initial_prices(product, actor_id, tenant_id)
        await self.catalog.sync_from_product(
            tenant_id=tenant_id,
            barcode=product.barcode,
            name=product.name,
            description=product.description,
            category_id=product.category_id,
            brand_id=product.brand_id,
        )

        await self.audit.log(
            action=AuditAction.PRODUCT_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PRODUCT,
            entity_id=product.id,
            after_state={"name": product.name, "sku": product.sku, "barcode": product.barcode},
            request_id=request_id,
        )
        return product

    async def _record_initial_prices(
        self,
        product: Product,
        actor_id: uuid.UUID,
        tenant_id: uuid.UUID,
        variant_id: uuid.UUID | None = None,
    ) -> None:
        if product.cost_price is not None:
            await self.price_history_repo.create(
                product_id=product.id,
                variant_id=variant_id,
                tenant_id=tenant_id,
                price_type=PriceType.COST,
                old_price=None,
                new_price=product.cost_price,
                changed_by_id=actor_id,
            )
        if product.selling_price is not None:
            await self.price_history_repo.create(
                product_id=product.id,
                variant_id=variant_id,
                tenant_id=tenant_id,
                price_type=PriceType.SELLING,
                old_price=None,
                new_price=product.selling_price,
                changed_by_id=actor_id,
            )

    async def get_product(
        self, product_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Product:
        product = await self.product_repo.get_active_by_id_and_tenant(product_id, tenant_id)
        if not product:
            raise NotFoundError("Product", product_id)
        return product

    async def get_product_detail(
        self, product_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Product:
        product = await self.product_repo.get_with_variants(product_id)
        if not product or product.tenant_id != tenant_id:
            raise NotFoundError("Product", product_id)
        return product

    async def list_products(
        self,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        category_id: uuid.UUID | None = None,
        brand_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> tuple[list[Product], int]:
        offset = (page - 1) * page_size
        return await self.product_repo.get_by_tenant(
            tenant_id,
            offset=offset,
            limit=page_size,
            category_id=category_id,
            brand_id=brand_id,
            is_active=is_active,
            search=search,
        )

    async def update_product(
        self,
        product_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: ProductUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> Product:
        product = await self.product_repo.get_active_by_id_and_tenant(product_id, tenant_id)
        if not product:
            raise NotFoundError("Product", product_id)

        update_data = data.model_dump(exclude_none=True)
        update_data.pop("clear_discount", None)

        # When the caller explicitly clears the promotion, null out all discount fields
        if data.clear_discount:
            update_data["discount_type"] = None
            update_data["discount_value"] = None
            update_data["discount_start_at"] = None
            update_data["discount_end_at"] = None

        if "sku" in update_data and await self.product_repo.sku_exists(
            tenant_id, update_data["sku"], exclude_id=product_id
        ):
            raise ConflictError(f"SKU '{update_data['sku']}' already exists in this tenant")

        if "barcode" in update_data and await self.product_repo.barcode_exists(
            tenant_id, update_data["barcode"], exclude_product_id=product_id
        ):
            raise ConflictError(f"Barcode '{update_data['barcode']}' already exists in this tenant")

        if "name" in update_data:
            base_slug = _slugify(update_data["name"])
            update_data["slug"] = await _unique_slug(
                base_slug,
                lambda s: self.product_repo.slug_exists(tenant_id, s, product_id),
            )

        before = {
            "name": product.name,
            "cost_price": str(product.cost_price) if product.cost_price else None,
            "selling_price": str(product.selling_price) if product.selling_price else None,
            "barcode": product.barcode,
        }

        old_cost = product.cost_price
        old_selling = product.selling_price
        old_barcode = product.barcode

        product = await self.product_repo.update(product, **update_data)
        await self.product_repo.increment_sync_version(product)

        # Record price history if prices changed
        if "cost_price" in update_data and update_data["cost_price"] != old_cost:
            await self.price_history_repo.create(
                product_id=product.id,
                variant_id=None,
                tenant_id=tenant_id,
                price_type=PriceType.COST,
                old_price=old_cost,
                new_price=update_data["cost_price"],
                changed_by_id=actor_id,
            )
            await self.audit.log(
                action=AuditAction.PRODUCT_PRICE_CHANGED,
                actor_user_id=actor_id,
                tenant_id=tenant_id,
                entity_type=EntityType.PRODUCT,
                entity_id=product_id,
                before_state={"cost_price": str(old_cost) if old_cost else None},
                after_state={"cost_price": str(update_data["cost_price"])},
                request_id=request_id,
            )

        if "selling_price" in update_data and update_data["selling_price"] != old_selling:
            await self.price_history_repo.create(
                product_id=product.id,
                variant_id=None,
                tenant_id=tenant_id,
                price_type=PriceType.SELLING,
                old_price=old_selling,
                new_price=update_data["selling_price"],
                changed_by_id=actor_id,
            )
            await self.audit.log(
                action=AuditAction.PRODUCT_PRICE_CHANGED,
                actor_user_id=actor_id,
                tenant_id=tenant_id,
                entity_type=EntityType.PRODUCT,
                entity_id=product_id,
                before_state={"selling_price": str(old_selling) if old_selling else None},
                after_state={"selling_price": str(update_data["selling_price"])},
                request_id=request_id,
            )

        if "barcode" in update_data and update_data["barcode"] != old_barcode:
            await self.audit.log(
                action=AuditAction.PRODUCT_BARCODE_CHANGED,
                actor_user_id=actor_id,
                tenant_id=tenant_id,
                entity_type=EntityType.PRODUCT,
                entity_id=product_id,
                before_state={"barcode": old_barcode},
                after_state={"barcode": update_data["barcode"]},
                request_id=request_id,
            )

        await self.audit.log(
            action=AuditAction.PRODUCT_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PRODUCT,
            entity_id=product_id,
            before_state=before,
            after_state=update_data,
            request_id=request_id,
        )
        await self.session.refresh(product)

        if {"name", "description", "category_id", "brand_id", "barcode"} & update_data.keys():
            await self.catalog.sync_from_product(
                tenant_id=tenant_id,
                barcode=product.barcode,
                name=product.name,
                description=product.description,
                category_id=product.category_id,
                brand_id=product.brand_id,
            )
        return product

    async def delete_product(
        self,
        product_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        product = await self.product_repo.get_active_by_id_and_tenant(product_id, tenant_id)
        if not product:
            raise NotFoundError("Product", product_id)
        await self.product_repo.soft_delete(product)
        await self.audit.log(
            action=AuditAction.PRODUCT_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PRODUCT,
            entity_id=product_id,
            request_id=request_id,
        )

    async def get_by_barcode(
        self, tenant_id: uuid.UUID, barcode: str
    ) -> Product:
        product = await self.product_repo.get_by_barcode(tenant_id, barcode)
        if not product:
            # Also check variants
            variant = await self.variant_repo.get_by_barcode(tenant_id, barcode)
            if variant:
                product = await self.product_repo.get_active_by_id_and_tenant(
                    variant.product_id, tenant_id
                )
        if not product:
            raise NotFoundError("Product", f"barcode={barcode}")
        loaded = await self.product_repo.get_with_variants(product.id)
        return loaded if loaded else product

    async def get_by_sku(self, tenant_id: uuid.UUID, sku: str) -> Product:
        product = await self.product_repo.get_by_sku(tenant_id, sku)
        if not product:
            raise NotFoundError("Product", f"sku={sku}")
        return product

    # Variants

    async def add_variant(
        self,
        product_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: ProductVariantCreateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ProductVariant:
        product = await self.product_repo.get_active_by_id_and_tenant(product_id, tenant_id)
        if not product:
            raise NotFoundError("Product", product_id)

        if data.sku and (
            await self.product_repo.sku_exists(tenant_id, data.sku)
            or await self.variant_repo.sku_exists(tenant_id, data.sku)
        ):
            raise ConflictError(f"SKU '{data.sku}' already exists in this tenant")

        if data.barcode and await self.product_repo.barcode_exists(tenant_id, data.barcode):
            raise ConflictError(f"Barcode '{data.barcode}' already exists in this tenant")

        variant = await self.variant_repo.create_with_values(
            product_id=product_id,
            tenant_id=tenant_id,
            name=data.name,
            sku=data.sku,
            barcode=data.barcode,
            cost_price=data.cost_price,
            selling_price=data.selling_price,
            sort_order=data.sort_order,
            attribute_values=[av.model_dump() for av in data.attribute_values],
        )

        await self.audit.log(
            action=AuditAction.VARIANT_CREATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PRODUCT_VARIANT,
            entity_id=variant.id,
            after_state={"name": variant.name, "sku": variant.sku},
            request_id=request_id,
        )
        return variant

    async def update_variant(
        self,
        product_id: uuid.UUID,
        variant_id: uuid.UUID,
        tenant_id: uuid.UUID,
        data: ProductVariantUpdateRequest,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> ProductVariant:
        variant = await self.variant_repo.get_active_by_id_and_product(variant_id, product_id)
        if not variant or variant.tenant_id != tenant_id:
            raise NotFoundError("ProductVariant", variant_id)

        update_data = data.model_dump(exclude_none=True)

        if "sku" in update_data and (
            await self.product_repo.sku_exists(tenant_id, update_data["sku"])
            or await self.variant_repo.sku_exists(tenant_id, update_data["sku"], exclude_id=variant_id)
        ):
            raise ConflictError(f"SKU '{update_data['sku']}' already exists")

        if "barcode" in update_data and await self.product_repo.barcode_exists(
            tenant_id, update_data["barcode"], exclude_variant_id=variant_id
        ):
            raise ConflictError(f"Barcode '{update_data['barcode']}' already exists")

        old_cost = variant.cost_price
        old_selling = variant.selling_price
        variant = await self.variant_repo.update(variant, **update_data)

        if "cost_price" in update_data and update_data["cost_price"] != old_cost:
            await self.price_history_repo.create(
                product_id=product_id,
                variant_id=variant_id,
                tenant_id=tenant_id,
                price_type=PriceType.COST,
                old_price=old_cost,
                new_price=update_data["cost_price"],
                changed_by_id=actor_id,
            )

        if "selling_price" in update_data and update_data["selling_price"] != old_selling:
            await self.price_history_repo.create(
                product_id=product_id,
                variant_id=variant_id,
                tenant_id=tenant_id,
                price_type=PriceType.SELLING,
                old_price=old_selling,
                new_price=update_data["selling_price"],
                changed_by_id=actor_id,
            )

        await self.audit.log(
            action=AuditAction.VARIANT_UPDATED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PRODUCT_VARIANT,
            entity_id=variant_id,
            after_state=update_data,
            request_id=request_id,
        )
        return variant

    async def delete_variant(
        self,
        product_id: uuid.UUID,
        variant_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        request_id: str | None = None,
    ) -> None:
        variant = await self.variant_repo.get_active_by_id_and_product(variant_id, product_id)
        if not variant or variant.tenant_id != tenant_id:
            raise NotFoundError("ProductVariant", variant_id)
        await self.variant_repo.soft_delete(variant)
        await self.audit.log(
            action=AuditAction.VARIANT_DELETED,
            actor_user_id=actor_id,
            tenant_id=tenant_id,
            entity_type=EntityType.PRODUCT_VARIANT,
            entity_id=variant_id,
            request_id=request_id,
        )

    async def get_price_history(
        self,
        product_id: uuid.UUID,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list, int]:
        product = await self.product_repo.get_active_by_id_and_tenant(product_id, tenant_id)
        if not product:
            raise NotFoundError("Product", product_id)
        offset = (page - 1) * page_size
        return await self.price_history_repo.get_by_product(
            product_id, offset=offset, limit=page_size
        )
