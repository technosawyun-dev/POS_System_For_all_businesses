from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import ORJSONResponse

from sqlalchemy import select

from app.api.deps import (
    CurrentUser,
    DbSession,
    RequestId,
    require_reseller_only,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.reseller_finance.schemas.referral import (
    PaginatedReferralCodes,
    PaginatedTenantReferrals,
    ReferralCodeCreateRequest,
    ReferralCodeResponse,
    ReferralCodeUpdateRequest,
    ReferralLinkResponse,
    ReferralStatsResponse,
    TenantReferralResponse,
)
from app.reseller_finance.schemas.wallet import (
    PaginatedTransactions,
    WalletResponse,
    WalletTransactionResponse,
)
from app.reseller_finance.schemas.payout import (
    PaginatedPayoutRequests,
    PayoutRequestCreate,
    PayoutRequestResponse,
)
from app.reseller_finance.services.wallet_service import WalletService
from app.reseller_finance.services.referral_service import ReferralService
from app.reseller_finance.services.payout_service import PayoutService

router = APIRouter(default_response_class=ORJSONResponse)


# Wallet


@router.get(
    "/wallet",
    response_model=WalletResponse,
    summary="Get my reseller wallet",
)
async def get_my_wallet(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
) -> WalletResponse:
    svc = WalletService(db)
    wallet = await svc.get_or_create_wallet(current_user.id)
    return WalletResponse.model_validate(wallet)


@router.get(
    "/wallet/transactions",
    response_model=PaginatedTransactions,
    summary="List my wallet transactions",
)
async def list_my_wallet_transactions(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    transaction_type: str | None = Query(default=None, description="Filter by transaction type"),
) -> PaginatedTransactions:
    svc = WalletService(db)
    wallet = await svc.get_or_create_wallet(current_user.id)
    # Delegate to repository via the wallet's id
    items, total = await svc.wallet_repo.get_transactions(
        wallet_id=wallet.id,
        page=page,
        page_size=page_size,
        tx_type_filter=transaction_type,
    )
    return PaginatedResponse.create(
        items=[WalletTransactionResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# Referral codes


@router.get(
    "/referral-codes",
    response_model=PaginatedReferralCodes,
    summary="List my referral codes",
)
async def list_my_referral_codes(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedReferralCodes:
    svc = ReferralService(db)
    # Use the repository directly for paginated listing
    all_codes = await svc.referral_repo.get_by_reseller(current_user.id)
    total = len(all_codes)
    start = (page - 1) * page_size
    page_items = all_codes[start : start + page_size]
    return PaginatedResponse.create(
        items=[ReferralCodeResponse.model_validate(c) for c in page_items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/referral-codes",
    response_model=ReferralCodeResponse,
    status_code=201,
    summary="Create a referral code",
)
async def create_referral_code(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    request_id: RequestId,
    data: ReferralCodeCreateRequest,
) -> ReferralCodeResponse:
    svc = ReferralService(db)
    code = await svc.create_referral_code(
        reseller_id=current_user.id,
        code=data.code,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return ReferralCodeResponse.model_validate(code)


@router.patch(
    "/referral-codes/{code_id}",
    response_model=ReferralCodeResponse,
    summary="Enable or disable a referral code",
)
async def update_referral_code(
    code_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    request_id: RequestId,
    data: ReferralCodeUpdateRequest,
) -> ReferralCodeResponse:
    svc = ReferralService(db)
    if data.is_active:
        code = await svc.activate_code(
            code_id=code_id,
            reseller_id=current_user.id,
            actor_id=current_user.id,
        )
    else:
        code = await svc.deactivate_code(
            code_id=code_id,
            reseller_id=current_user.id,
            actor_id=current_user.id,
        )
    return ReferralCodeResponse.model_validate(code)


@router.get(
    "/referral-codes/{code_id}/link",
    response_model=ReferralLinkResponse,
    summary="Get the shareable referral link for a code",
)
async def get_referral_link(
    code_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
) -> ReferralLinkResponse:
    svc = ReferralService(db)
    return await svc.get_referral_link(
        code_id=code_id,
        reseller_id=current_user.id,
    )


# Referrals (tenants acquired via referral codes)


@router.get(
    "/referrals",
    response_model=PaginatedTenantReferrals,
    summary="List tenants referred by me",
)
async def list_my_referrals(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedTenantReferrals:
    svc = ReferralService(db)
    items, total = await svc.referral_repo.get_referrals_by_reseller(
        reseller_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    tenant_names: dict = {}
    if items:
        rows = (await db.execute(
            select(Tenant.id, Tenant.name).where(Tenant.id.in_([r.tenant_id for r in items]))
        )).all()
        tenant_names = {row.id: row.name for row in rows}
    return PaginatedResponse.create(
        items=[
            TenantReferralResponse.model_validate(r).model_copy(
                update={"tenant_name": tenant_names.get(r.tenant_id)}
            )
            for r in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/referrals/stats",
    response_model=ReferralStatsResponse,
    summary="Get my referral conversion statistics",
)
async def get_my_referral_stats(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
) -> ReferralStatsResponse:
    svc = ReferralService(db)
    data = await svc.get_reseller_referral_stats(reseller_id=current_user.id)
    return ReferralStatsResponse(**data)


# Payout requests


@router.post(
    "/payouts",
    response_model=PayoutRequestResponse,
    status_code=201,
    summary="Request a payout from my wallet",
)
async def request_payout(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    request_id: RequestId,
    data: PayoutRequestCreate,
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.create_payout_request(
        reseller_id=current_user.id,
        amount=data.amount,
        reason=data.reason,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return PayoutRequestResponse.model_validate(payout)


@router.get(
    "/payouts",
    response_model=PaginatedPayoutRequests,
    summary="List my payout requests",
)
async def list_my_payouts(
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    status: str | None = Query(default=None, description="Filter by payout status"),
) -> PaginatedPayoutRequests:
    svc = PayoutService(db)
    items, total = await svc.list_payout_requests(
        reseller_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status,
    )
    return PaginatedResponse.create(
        items=[PayoutRequestResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/payouts/{payout_id}",
    response_model=PayoutRequestResponse,
    summary="Get a specific payout request",
)
async def get_my_payout(
    payout_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.get_payout_request(
        payout_id=payout_id,
        reseller_id=current_user.id,
    )
    return PayoutRequestResponse.model_validate(payout)


@router.delete(
    "/payouts/{payout_id}",
    response_model=SuccessResponse,
    summary="Cancel a PENDING payout request",
)
async def cancel_my_payout(
    payout_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_reseller_only)],
    request_id: RequestId,
) -> SuccessResponse:
    svc = PayoutService(db)
    await svc.cancel_payout_request(
        payout_id=payout_id,
        reseller_id=current_user.id,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return SuccessResponse(message="Payout request cancelled successfully.")
