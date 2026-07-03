from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_validator

from app.core.constants import CategoryStatus, PriceType, ProductType
from app.schemas.common import BaseSchema, TimestampedSchema


# Category 

class CategoryCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None
    description: str | None = None
    sort_order: int = Field(default=0, ge=0)


class CategoryUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None
    description: str | None = None
    status: CategoryStatus | None = None
    sort_order: int | None = Field(default=None, ge=0)


class CategoryResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    slug: str
    description: str | None
    status: str
    sort_order: int
    is_deleted: bool


# Brand

class BrandCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    logo_url: str | None = None


class BrandUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    logo_url: str | None = None
    is_active: bool | None = None


class BrandResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    name: str
    slug: str
    description: str | None
    logo_url: str | None
    is_active: bool
    is_deleted: bool


# Variant Attributes

class VariantAttributeCreate(BaseSchema):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = Field(default=0, ge=0)


class VariantValueCreate(BaseSchema):
    attribute_name: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=100)


# Product Variant

class ProductVariantCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=100)
    cost_price: Decimal | None = Field(default=None, ge=0)
    selling_price: Decimal | None = Field(default=None, ge=0)
    sort_order: int = Field(default=0, ge=0)
    attribute_values: list[VariantValueCreate] = Field(default_factory=list)


class ProductVariantUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=100)
    cost_price: Decimal | None = Field(default=None, ge=0)
    selling_price: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class VariantValueResponse(BaseSchema):
    id: uuid.UUID
    attribute_id: uuid.UUID
    variant_id: uuid.UUID
    value: str


class ProductVariantResponse(TimestampedSchema):
    product_id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    sku: str | None
    barcode: str | None
    cost_price: Decimal | None
    selling_price: Decimal | None
    is_active: bool
    is_deleted: bool
    sort_order: int
    attribute_values: list[VariantValueResponse] = Field(default_factory=list)


# Product

class ProductCreateRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=255)
    product_type: ProductType = ProductType.SIMPLE
    description: str | None = None
    category_id: uuid.UUID
    brand_id: uuid.UUID | None = None
    sku: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=100)
    qr_code: str | None = Field(default=None, max_length=255)
    unit: str = Field(default="pcs", max_length=50)
    cost_price: Decimal | None = Field(default=None, ge=0)
    selling_price: Decimal | None = Field(default=None, ge=0)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    discount_type: str | None = None
    discount_value: Decimal | None = Field(default=None, ge=0)
    discount_start_at: datetime | None = None
    discount_end_at: datetime | None = None


class ProductUpdateRequest(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category_id: uuid.UUID | None = None
    brand_id: uuid.UUID | None = None
    sku: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=100)
    qr_code: str | None = Field(default=None, max_length=255)
    unit: str | None = Field(default=None, max_length=50)
    cost_price: Decimal | None = Field(default=None, ge=0)
    selling_price: Decimal | None = Field(default=None, ge=0)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None
    discount_type: str | None = None
    discount_value: Decimal | None = Field(default=None, ge=0)
    discount_start_at: datetime | None = None
    discount_end_at: datetime | None = None
    clear_discount: bool = False


class ProductResponse(TimestampedSchema):
    tenant_id: uuid.UUID
    category_id: uuid.UUID | None
    brand_id: uuid.UUID | None
    product_type: str
    name: str
    slug: str
    description: str | None
    sku: str | None
    barcode: str | None
    qr_code: str | None
    unit: str
    cost_price: Decimal | None
    selling_price: Decimal | None
    tax_rate: Decimal
    is_active: bool
    is_deleted: bool
    sync_version: int
    discount_type: str | None = None
    discount_value: Decimal | None = None
    discount_start_at: datetime | None = None
    discount_end_at: datetime | None = None


class ProductDetailResponse(ProductResponse):
    variants: list[ProductVariantResponse] = Field(default_factory=list)


# Global catalog (cross-tenant autofill by barcode)

class CatalogLookupResponse(BaseSchema):
    found: bool
    name: str | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    brand_id: uuid.UUID | None = None
    brand_name: str | None = None


# Price History

class PriceHistoryResponse(TimestampedSchema):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None
    tenant_id: uuid.UUID
    price_type: str
    old_price: Decimal | None
    new_price: Decimal
    changed_by_id: uuid.UUID
