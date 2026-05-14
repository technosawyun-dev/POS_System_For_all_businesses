from __future__ import annotations

from typing import TypeVar

from app.schemas.common import PaginatedResponse

T = TypeVar("T")


def paginate(
    items: list[T],
    total: int,
    page: int,
    page_size: int,
) -> PaginatedResponse[T]:
    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
