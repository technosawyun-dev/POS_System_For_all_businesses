from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Category, session)

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        parent_id: uuid.UUID | None = None,
    ) -> tuple[list[Category], int]:
        filters = [Category.tenant_id == tenant_id, Category.is_deleted.is_(False)]
        if parent_id is not None:
            filters.append(Category.parent_id == parent_id)
        else:
            filters.append(Category.parent_id.is_(None))
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def slug_exists(
        self,
        tenant_id: uuid.UUID,
        slug: str,
        parent_id: uuid.UUID | None = None,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        stmt = select(Category.id).where(
            Category.tenant_id == tenant_id,
            Category.slug == slug,
            Category.is_deleted.is_(False),
        )
        if parent_id is not None:
            stmt = stmt.where(Category.parent_id == parent_id)
        else:
            stmt = stmt.where(Category.parent_id.is_(None))
        if exclude_id:
            stmt = stmt.where(Category.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def soft_delete(self, category: Category) -> None:
        category.is_deleted = True
        await self.session.flush()

    async def get_active_by_id_and_tenant(
        self, category_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Category | None:
        stmt = select(Category).where(
            Category.id == category_id,
            Category.tenant_id == tenant_id,
            Category.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_name(
        self, tenant_id: uuid.UUID, name: str
    ) -> Category | None:
        """Case-insensitive lookup among top-level categories, for catalog auto-linking."""
        stmt = select(Category).where(
            Category.tenant_id == tenant_id,
            func.lower(Category.name) == name.strip().lower(),
            Category.parent_id.is_(None),
            Category.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class BrandRepository(BaseRepository[Brand]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Brand, session)

    async def get_by_tenant(
        self, tenant_id: uuid.UUID, offset: int = 0, limit: int = 20
    ) -> tuple[list[Brand], int]:
        filters = [Brand.tenant_id == tenant_id, Brand.is_deleted.is_(False)]
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def slug_exists(
        self, tenant_id: uuid.UUID, slug: str, exclude_id: uuid.UUID | None = None
    ) -> bool:
        stmt = select(Brand.id).where(
            Brand.tenant_id == tenant_id,
            Brand.slug == slug,
            Brand.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(Brand.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def soft_delete(self, brand: Brand) -> None:
        brand.is_deleted = True
        await self.session.flush()

    async def get_active_by_id_and_tenant(
        self, brand_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Brand | None:
        stmt = select(Brand).where(
            Brand.id == brand_id,
            Brand.tenant_id == tenant_id,
            Brand.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_name(self, tenant_id: uuid.UUID, name: str) -> Brand | None:
        """Case-insensitive lookup, for catalog auto-linking."""
        stmt = select(Brand).where(
            Brand.tenant_id == tenant_id,
            func.lower(Brand.name) == name.strip().lower(),
            Brand.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class ProductRepository(BaseRepository[Product]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Product, session)

    async def get_by_tenant(
        self,
        tenant_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        category_id: uuid.UUID | None = None,
        brand_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> tuple[list[Product], int]:
        filters = [Product.tenant_id == tenant_id, Product.is_deleted.is_(False)]
        if category_id:
            filters.append(Product.category_id == category_id)
        if brand_id:
            filters.append(Product.brand_id == brand_id)
        if is_active is not None:
            filters.append(Product.is_active == is_active)
        if search:
            filters.append(
                or_(
                    Product.name.ilike(f"%{search}%"),
                    Product.barcode.ilike(f"%{search}%"),
                    Product.sku.ilike(f"%{search}%"),
                )
            )
        return await self.get_all(offset=offset, limit=limit, filters=filters)

    async def get_with_variants(self, product_id: uuid.UUID) -> Product | None:
        stmt = (
            select(Product)
            .where(Product.id == product_id, Product.is_deleted.is_(False))
            .options(
                selectinload(Product.variants).selectinload(ProductVariant.attribute_values),
                selectinload(Product.variant_attributes).selectinload(VariantAttribute.values),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_by_id_and_tenant(
        self, product_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> Product | None:
        stmt = select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant_id,
            Product.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_barcode(
        self, tenant_id: uuid.UUID, barcode: str
    ) -> Product | None:
        stmt = select(Product).where(
            Product.tenant_id == tenant_id,
            Product.barcode == barcode,
            Product.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_sku(
        self, tenant_id: uuid.UUID, sku: str
    ) -> Product | None:
        stmt = select(Product).where(
            Product.tenant_id == tenant_id,
            Product.sku == sku,
            Product.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def sku_exists(
        self, tenant_id: uuid.UUID, sku: str, exclude_id: uuid.UUID | None = None
    ) -> bool:
        stmt = select(Product.id).where(
            Product.tenant_id == tenant_id,
            Product.sku == sku,
            Product.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(Product.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def barcode_exists(
        self,
        tenant_id: uuid.UUID,
        barcode: str,
        exclude_product_id: uuid.UUID | None = None,
        exclude_variant_id: uuid.UUID | None = None,
    ) -> bool:
        """Check barcode uniqueness across both products and variants."""
        p_stmt = select(Product.id).where(
            Product.tenant_id == tenant_id,
            Product.barcode == barcode,
            Product.is_deleted.is_(False),
        )
        if exclude_product_id:
            p_stmt = p_stmt.where(Product.id != exclude_product_id)
        p_result = await self.session.execute(p_stmt)
        if p_result.scalar_one_or_none():
            return True

        v_stmt = select(ProductVariant.id).where(
            ProductVariant.tenant_id == tenant_id,
            ProductVariant.barcode == barcode,
            ProductVariant.is_deleted.is_(False),
        )
        if exclude_variant_id:
            v_stmt = v_stmt.where(ProductVariant.id != exclude_variant_id)
        v_result = await self.session.execute(v_stmt)
        return v_result.scalar_one_or_none() is not None

    async def slug_exists(
        self, tenant_id: uuid.UUID, slug: str, exclude_id: uuid.UUID | None = None
    ) -> bool:
        stmt = select(Product.id).where(
            Product.tenant_id == tenant_id,
            Product.slug == slug,
            Product.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(Product.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def soft_delete(self, product: Product) -> None:
        product.is_deleted = True
        product.is_active = False
        await self.session.flush()

    async def increment_sync_version(self, product: Product) -> None:
        product.sync_version += 1
        await self.session.flush()


class ProductVariantRepository(BaseRepository[ProductVariant]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ProductVariant, session)

    async def sku_exists(
        self,
        tenant_id: uuid.UUID,
        sku: str,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        stmt = select(ProductVariant.id).where(
            ProductVariant.tenant_id == tenant_id,
            ProductVariant.sku == sku,
            ProductVariant.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(ProductVariant.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def get_active_by_id_and_product(
        self, variant_id: uuid.UUID, product_id: uuid.UUID
    ) -> ProductVariant | None:
        stmt = select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
            ProductVariant.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_product(
        self, product_id: uuid.UUID, include_deleted: bool = False
    ) -> list[ProductVariant]:
        stmt = select(ProductVariant).where(ProductVariant.product_id == product_id)
        if not include_deleted:
            stmt = stmt.where(ProductVariant.is_deleted.is_(False))
        stmt = stmt.order_by(ProductVariant.sort_order)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_barcode(
        self, tenant_id: uuid.UUID, barcode: str
    ) -> ProductVariant | None:
        stmt = select(ProductVariant).where(
            ProductVariant.tenant_id == tenant_id,
            ProductVariant.barcode == barcode,
            ProductVariant.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def soft_delete(self, variant: ProductVariant) -> None:
        variant.is_deleted = True
        variant.is_active = False
        await self.session.flush()

    async def create_with_values(
        self,
        product_id: uuid.UUID,
        tenant_id: uuid.UUID,
        name: str,
        sku: str | None,
        barcode: str | None,
        cost_price: object,
        selling_price: object,
        sort_order: int,
        attribute_values: list[dict],
    ) -> ProductVariant:
        variant = ProductVariant(
            product_id=product_id,
            tenant_id=tenant_id,
            name=name,
            sku=sku,
            barcode=barcode,
            cost_price=cost_price,
            selling_price=selling_price,
            sort_order=sort_order,
        )
        self.session.add(variant)
        await self.session.flush()
        await self.session.refresh(variant)

        for av in attribute_values:
            attr_stmt = select(VariantAttribute).where(
                VariantAttribute.product_id == product_id,
                VariantAttribute.name == av["attribute_name"],
            )
            attr_result = await self.session.execute(attr_stmt)
            attr = attr_result.scalar_one_or_none()
            if not attr:
                attr = VariantAttribute(
                    product_id=product_id,
                    tenant_id=tenant_id,
                    name=av["attribute_name"],
                )
                self.session.add(attr)
                await self.session.flush()
                await self.session.refresh(attr)

            vv = VariantValue(
                attribute_id=attr.id,
                variant_id=variant.id,
                value=av["value"],
            )
            self.session.add(vv)

        await self.session.flush()
        # Eagerly load attribute_values so Pydantic can serialize without lazy-load
        loaded_stmt = (
            select(ProductVariant)
            .where(ProductVariant.id == variant.id)
            .options(selectinload(ProductVariant.attribute_values))
        )
        result = await self.session.execute(loaded_stmt)
        loaded_variant = result.scalar_one()
        return loaded_variant


class GlobalProductCatalogRepository(BaseRepository[GlobalProductCatalog]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(GlobalProductCatalog, session)

    async def get_by_barcode(self, barcode: str) -> GlobalProductCatalog | None:
        stmt = select(GlobalProductCatalog).where(GlobalProductCatalog.barcode == barcode)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self,
        barcode: str,
        name: str,
        description: str | None,
        category_name: str | None,
        brand_name: str | None,
        tenant_id: uuid.UUID,
    ) -> GlobalProductCatalog:
        """Create or overwrite the catalog entry for this barcode (last write wins)."""
        existing = await self.get_by_barcode(barcode)
        if existing:
            existing.name = name
            existing.description = description
            existing.category_name = category_name
            existing.brand_name = brand_name
            existing.updated_by_tenant_id = tenant_id
            await self.session.flush()
            return existing

        # Guard against two tenants racing to create the first entry for the same
        # new barcode: a SAVEPOINT keeps the failed insert from poisoning the
        # caller's outer transaction, so we can fall back to an update.
        try:
            async with self.session.begin_nested():
                entry = GlobalProductCatalog(
                    barcode=barcode,
                    name=name,
                    description=description,
                    category_name=category_name,
                    brand_name=brand_name,
                    created_by_tenant_id=tenant_id,
                    updated_by_tenant_id=tenant_id,
                )
                self.session.add(entry)
                await self.session.flush()
            return entry
        except IntegrityError:
            existing = await self.get_by_barcode(barcode)
            if not existing:
                raise
            existing.name = name
            existing.description = description
            existing.category_name = category_name
            existing.brand_name = brand_name
            existing.updated_by_tenant_id = tenant_id
            await self.session.flush()
            return existing


class ProductPriceHistoryRepository(BaseRepository[ProductPriceHistory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ProductPriceHistory, session)

    async def get_by_product(
        self,
        product_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[ProductPriceHistory], int]:
        filters = [ProductPriceHistory.product_id == product_id]
        return await self.get_all(
            offset=offset, limit=limit, filters=filters,
            order_by=ProductPriceHistory.created_at.desc()
        )
