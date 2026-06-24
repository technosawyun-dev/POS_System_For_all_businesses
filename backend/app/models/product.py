from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CategoryStatus, PriceType, ProductType
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.inventory import BranchInventory, StockMovement
    from app.models.supplier import Supplier


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", "parent_id", name="uq_categories_tenant_slug_parent"),
        Index("ix_categories_tenant_id", "tenant_id"),
        Index("ix_categories_parent_id", "parent_id"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=CategoryStatus.ACTIVE
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    parent: Mapped[Category | None] = relationship("Category", remote_side="Category.id", back_populates="children")
    children: Mapped[list[Category]] = relationship("Category", back_populates="parent")
    products: Mapped[list[Product]] = relationship("Product", back_populates="category")

    def __repr__(self) -> str:
        return f"<Category id={self.id} name={self.name}>"


class Brand(Base):
    __tablename__ = "brands"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_brands_tenant_slug"),
        Index("ix_brands_tenant_id", "tenant_id"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    products: Mapped[list[Product]] = relationship("Product", back_populates="brand")

    def __repr__(self) -> str:
        return f"<Brand id={self.id} name={self.name}>"


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_tenant_id", "tenant_id"),
        Index("ix_products_category_id", "category_id"),
        Index("ix_products_brand_id", "brand_id"),
        # Partial unique indexes — allow NULL without conflict
        Index(
            "uq_products_tenant_sku",
            "tenant_id", "sku",
            unique=True,
            postgresql_where="sku IS NOT NULL AND is_deleted = false",
        ),
        Index(
            "uq_products_tenant_barcode",
            "tenant_id", "barcode",
            unique=True,
            postgresql_where="barcode IS NOT NULL AND is_deleted = false",
        ),
        Index("ix_products_barcode", "barcode"),
        Index("ix_products_sku", "sku"),
        Index("ix_products_product_type", "product_type"),
        Index("ix_products_is_active", "is_active"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("brands.id", ondelete="SET NULL"),
        nullable=True,
    )

    product_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default=ProductType.SIMPLE, index=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qr_code: Mapped[str | None] = mapped_column(String(255), nullable=True)

    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="pcs")

    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    selling_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Promotion / time-limited discount
    discount_type: Mapped[str | None] = mapped_column(String(20), nullable=True)   # 'PERCENTAGE' | 'AMOUNT'
    discount_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    discount_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    discount_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Optimistic locking token for offline sync preparation
    sync_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    category: Mapped[Category | None] = relationship("Category", back_populates="products")
    brand: Mapped[Brand | None] = relationship("Brand", back_populates="products")
    variants: Mapped[list[ProductVariant]] = relationship(
        "ProductVariant", back_populates="product", cascade="all, delete-orphan"
    )
    variant_attributes: Mapped[list[VariantAttribute]] = relationship(
        "VariantAttribute", back_populates="product", cascade="all, delete-orphan"
    )
    price_history: Mapped[list[ProductPriceHistory]] = relationship(
        "ProductPriceHistory", back_populates="product", cascade="all, delete-orphan"
    )
    branch_inventory: Mapped[list[BranchInventory]] = relationship(
        "BranchInventory", back_populates="product"
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name} sku={self.sku}>"


class ProductVariant(Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        Index("ix_product_variants_product_id", "product_id"),
        Index("ix_product_variants_tenant_id", "tenant_id"),
        Index(
            "uq_variants_tenant_sku",
            "tenant_id", "sku",
            unique=True,
            postgresql_where="sku IS NOT NULL AND is_deleted = false",
        ),
        Index(
            "uq_variants_tenant_barcode",
            "tenant_id", "barcode",
            unique=True,
            postgresql_where="barcode IS NOT NULL AND is_deleted = false",
        ),
        Index("ix_product_variants_barcode", "barcode"),
        Index("ix_product_variants_sku", "sku"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    selling_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    product: Mapped[Product] = relationship("Product", back_populates="variants")
    attribute_values: Mapped[list[VariantValue]] = relationship(
        "VariantValue", back_populates="variant", cascade="all, delete-orphan"
    )
    branch_inventory: Mapped[list[BranchInventory]] = relationship(
        "BranchInventory", back_populates="variant"
    )

    def __repr__(self) -> str:
        return f"<ProductVariant id={self.id} name={self.name}>"


class VariantAttribute(Base):
    __tablename__ = "variant_attributes"
    __table_args__ = (
        Index("ix_variant_attributes_product_id", "product_id"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    product: Mapped[Product] = relationship("Product", back_populates="variant_attributes")
    values: Mapped[list[VariantValue]] = relationship(
        "VariantValue", back_populates="attribute", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<VariantAttribute id={self.id} name={self.name}>"


class VariantValue(Base):
    __tablename__ = "variant_values"
    __table_args__ = (
        Index("ix_variant_values_attribute_id", "attribute_id"),
        Index("ix_variant_values_variant_id", "variant_id"),
    )

    attribute_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("variant_attributes.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=False,
    )
    value: Mapped[str] = mapped_column(String(100), nullable=False)

    attribute: Mapped[VariantAttribute] = relationship("VariantAttribute", back_populates="values")
    variant: Mapped[ProductVariant] = relationship("ProductVariant", back_populates="attribute_values")

    def __repr__(self) -> str:
        return f"<VariantValue attribute={self.attribute_id} value={self.value}>"


class ProductPriceHistory(Base):
    __tablename__ = "product_price_history"
    __table_args__ = (
        Index("ix_price_history_product_id", "product_id"),
        Index("ix_price_history_tenant_id", "tenant_id"),
        Index("ix_price_history_created_at", "created_at"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    price_type: Mapped[str] = mapped_column(String(20), nullable=False)
    old_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    new_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    changed_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    product: Mapped[Product] = relationship("Product", back_populates="price_history")

    def __repr__(self) -> str:
        return f"<ProductPriceHistory product={self.product_id} type={self.price_type}>"
