from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.sales.models import Cart, CartItem
from app.sales.repositories import CartRepository


class CartService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.cart_repo = CartRepository(session)

    async def create_cart(
        self,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID,
        cashier_session_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Cart:
        cart = Cart(
            tenant_id=tenant_id,
            branch_id=branch_id,
            cashier_session_id=cashier_session_id,
            customer_id=customer_id,
            notes=notes,
        )
        self.session.add(cart)
        await self.session.flush()
        await self.session.refresh(cart)
        return await self.cart_repo.get_with_items(cart.id)

    async def add_item(
        self,
        cart_id: uuid.UUID,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        quantity: Decimal,
        unit_price: Decimal,
        variant_id: uuid.UUID | None = None,
        discount_amount: Decimal = Decimal("0"),
        tax_rate: Decimal = Decimal("0"),
        notes: str | None = None,
    ) -> Cart:
        cart = await self.cart_repo.get_with_items(cart_id)
        if not cart or cart.tenant_id != tenant_id:
            raise NotFoundError("Cart", cart_id)
        if quantity <= Decimal("0"):
            raise ValidationError("Cart item quantity must be positive")

        item = CartItem(
            cart_id=cart_id,
            product_id=product_id,
            variant_id=variant_id,
            quantity=quantity,
            unit_price=unit_price,
            discount_amount=discount_amount,
            tax_rate=tax_rate,
            notes=notes,
        )
        self.session.add(item)
        await self.session.flush()
        return await self.cart_repo.get_with_items(cart_id)

    async def remove_item(
        self,
        cart_id: uuid.UUID,
        item_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Cart:
        cart = await self.cart_repo.get_with_items(cart_id)
        if not cart or cart.tenant_id != tenant_id:
            raise NotFoundError("Cart", cart_id)

        item = next((i for i in cart.items if i.id == item_id), None)
        if not item:
            raise NotFoundError("CartItem", item_id)

        await self.session.delete(item)
        await self.session.flush()
        return await self.cart_repo.get_with_items(cart_id)

    async def update_item(
        self,
        cart_id: uuid.UUID,
        item_id: uuid.UUID,
        tenant_id: uuid.UUID,
        quantity: Decimal | None = None,
        unit_price: Decimal | None = None,
        discount_amount: Decimal | None = None,
        tax_rate: Decimal | None = None,
    ) -> Cart:
        cart = await self.cart_repo.get_with_items(cart_id)
        if not cart or cart.tenant_id != tenant_id:
            raise NotFoundError("Cart", cart_id)

        item = next((i for i in cart.items if i.id == item_id), None)
        if not item:
            raise NotFoundError("CartItem", item_id)

        if quantity is not None:
            if quantity <= Decimal("0"):
                raise ValidationError("Cart item quantity must be positive")
            item.quantity = quantity
        if unit_price is not None:
            item.unit_price = unit_price
        if discount_amount is not None:
            item.discount_amount = discount_amount
        if tax_rate is not None:
            item.tax_rate = tax_rate

        await self.session.flush()
        return await self.cart_repo.get_with_items(cart_id)

    async def clear_cart(self, cart_id: uuid.UUID, tenant_id: uuid.UUID) -> Cart:
        cart = await self.cart_repo.get_with_items(cart_id)
        if not cart or cart.tenant_id != tenant_id:
            raise NotFoundError("Cart", cart_id)
        for item in list(cart.items):
            await self.session.delete(item)
        await self.session.flush()
        return await self.cart_repo.get_with_items(cart_id)

    async def get_cart(self, cart_id: uuid.UUID, tenant_id: uuid.UUID) -> Cart:
        cart = await self.cart_repo.get_with_items(cart_id)
        if not cart or cart.tenant_id != tenant_id:
            raise NotFoundError("Cart", cart_id)
        return cart

    async def delete_cart(self, cart_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        cart = await self.cart_repo.get_with_items(cart_id)
        if not cart or cart.tenant_id != tenant_id:
            raise NotFoundError("Cart", cart_id)
        await self.session.delete(cart)
        await self.session.flush()

    def preview_totals(self, cart: Cart) -> dict:
        subtotal = Decimal("0")
        tax_amount = Decimal("0")
        discount_amount = Decimal("0")

        for item in cart.items:
            item_sub = item.unit_price * item.quantity
            subtotal += item_sub
            discount_amount += item.discount_amount
            tax_amount += (item_sub - item.discount_amount) * item.tax_rate

        total = subtotal - discount_amount + tax_amount
        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "tax_amount": tax_amount,
            "total_amount": max(total, Decimal("0")),
            "item_count": len(cart.items),
        }
