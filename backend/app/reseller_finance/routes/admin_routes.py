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
    require_super_admin,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.reseller_finance.schemas.referral import (
    PaginatedTenantReferrals,
    ReferralStatsResponse,
    TenantReferralResponse,
)
from app.reseller_finance.schemas.wallet import (
    ManualAdjustmentRequest,
    PaginatedTransactions,
    UpdateWalletSettingsRequest,
    WalletResponse,
    WalletTransactionResponse,
)
from app.reseller_finance.schemas.payout import (
    AdminPayoutCreate,
    PaginatedPayoutRequests,
    PayoutMarkPaidRequest,
    PayoutRequestResponse,
    PayoutReviewRequest,
)
from app.reseller_finance.schemas.campaign import (
    NoteCreateRequest,
    NoteResponse,
    ResellerFinanceOverviewResponse,
    ResellerWalletSummary,
)
from app.reseller_finance.services.wallet_service import WalletService
from app.reseller_finance.services.referral_service import ReferralService
from app.reseller_finance.services.payout_service import PayoutService
from app.reseller_finance.services.note_service import NoteService

router = APIRouter(default_response_class=ORJSONResponse)


# Overview


@router.get(
    "/overview",
    response_model=ResellerFinanceOverviewResponse,
    summary="Platform-wide reseller finance KPIs",
)
async def get_finance_overview(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> ResellerFinanceOverviewResponse:
    svc = WalletService(db)
    data = await svc.get_finance_overview()
    return ResellerFinanceOverviewResponse(**data)


# Wallets


@router.get(
    "/wallets",
    response_model=list[ResellerWalletSummary],
    summary="List all reseller wallets with summary info (paginated)",
)
async def list_wallets(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> list[ResellerWalletSummary]:
    svc = WalletService(db)
    items = await svc.list_wallet_summaries(page=page, page_size=page_size)
    return [ResellerWalletSummary.model_validate(w) for w in items]


@router.get(
    "/wallets/{reseller_id}",
    response_model=WalletResponse,
    summary="Get a specific reseller's wallet",
)
async def get_wallet(
    reseller_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> WalletResponse:
    svc = WalletService(db)
    wallet = await svc.get_or_create_wallet(reseller_id)
    return WalletResponse.model_validate(wallet)


@router.get(
    "/wallets/{reseller_id}/transactions",
    response_model=PaginatedTransactions,
    summary="List transactions for a specific reseller wallet",
)
async def list_wallet_transactions(
    reseller_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    transaction_type: str | None = Query(default=None, description="Filter by transaction type"),
) -> PaginatedTransactions:
    svc = WalletService(db)
    wallet = await svc.get_or_create_wallet(reseller_id)
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


@router.patch(
    "/wallets/{reseller_id}/settings",
    response_model=WalletResponse,
    summary="Update commission rate and minimum payout amount for a reseller",
)
async def update_wallet_settings(
    reseller_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: UpdateWalletSettingsRequest,
) -> WalletResponse:
    svc = WalletService(db)
    wallet = await svc.update_commission_rate(
        reseller_id=reseller_id,
        rate_pct=data.commission_rate_pct,
        min_payout=data.min_payout_amount,
        actor_id=current_user.id,
    )
    return WalletResponse.model_validate(wallet)


@router.post(
    "/wallets/adjustment",
    response_model=WalletTransactionResponse,
    status_code=201,
    summary="Apply a manual credit, bonus, or penalty to a reseller wallet",
)
async def manual_wallet_adjustment(
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: ManualAdjustmentRequest,
) -> WalletTransactionResponse:
    svc = WalletService(db)
    _, txn = await svc.admin_manual_adjustment(
        reseller_id=data.reseller_id,
        amount=data.amount,
        tx_type=data.transaction_type,
        notes=data.notes,
        actor_id=current_user.id,
    )
    return WalletTransactionResponse.model_validate(txn)


# Payouts (admin)


@router.get(
    "/payouts",
    response_model=PaginatedPayoutRequests,
    summary="List all payout requests across all resellers",
)
async def list_all_payouts(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    status: str | None = Query(default=None, description="Filter by payout status"),
    reseller_id: uuid.UUID | None = Query(default=None, description="Filter by reseller"),
) -> PaginatedPayoutRequests:
    svc = PayoutService(db)
    items, total = await svc.list_payout_requests(
        reseller_id=reseller_id,
        page=page,
        page_size=page_size,
        status=status,
    )
    reseller_names: dict[uuid.UUID, dict] = {}
    if items:
        rows = (await db.execute(
            select(User.id, User.first_name, User.last_name, User.email)
            .where(User.id.in_([p.reseller_id for p in items]))
        )).all()
        reseller_names = {
            row.id: {"name": f"{row.first_name} {row.last_name}".strip(), "email": row.email}
            for row in rows
        }
    return PaginatedResponse.create(
        items=[
            PayoutRequestResponse.model_validate(p).model_copy(update={
                "reseller_name": reseller_names.get(p.reseller_id, {}).get("name"),
                "reseller_email": reseller_names.get(p.reseller_id, {}).get("email"),
            })
            for p in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/payouts",
    response_model=PayoutRequestResponse,
    status_code=201,
    summary="Admin-initiated payout for a reseller",
)
async def admin_create_payout(
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: AdminPayoutCreate,
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.admin_create_payout(
        reseller_id=data.reseller_id,
        amount=data.amount,
        reason=data.reason,
        actor_id=current_user.id,
        request_id=request_id,
    )
    reseller = (await db.execute(
        select(User.first_name, User.last_name, User.email).where(User.id == data.reseller_id)
    )).first()
    return PayoutRequestResponse.model_validate(payout).model_copy(update={
        "reseller_name": f"{reseller.first_name} {reseller.last_name}".strip() if reseller else None,
        "reseller_email": reseller.email if reseller else None,
    })


@router.get(
    "/payouts/{payout_id}",
    response_model=PayoutRequestResponse,
    summary="Get a specific payout request",
)
async def get_payout(
    payout_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.get_payout_request(payout_id=payout_id)
    return PayoutRequestResponse.model_validate(payout)


@router.post(
    "/payouts/{payout_id}/review",
    response_model=PayoutRequestResponse,
    summary="Move a payout from PENDING to UNDER_REVIEW",
)
async def review_payout(
    payout_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.transition_payout(
        payout_id=payout_id,
        target_status="UNDER_REVIEW",
        actor_id=current_user.id,
        request_id=request_id,
    )
    return PayoutRequestResponse.model_validate(payout)


@router.post(
    "/payouts/{payout_id}/approve",
    response_model=PayoutRequestResponse,
    summary="Approve a payout (UNDER_REVIEW → APPROVED)",
)
async def approve_payout(
    payout_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.transition_payout(
        payout_id=payout_id,
        target_status="APPROVED",
        actor_id=current_user.id,
        request_id=request_id,
    )
    return PayoutRequestResponse.model_validate(payout)


@router.post(
    "/payouts/{payout_id}/reject",
    response_model=PayoutRequestResponse,
    summary="Reject a payout request with optional review notes",
)
async def reject_payout(
    payout_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: PayoutReviewRequest,
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.transition_payout(
        payout_id=payout_id,
        target_status="REJECTED",
        actor_id=current_user.id,
        request_id=request_id,
        notes=data.notes,
    )
    return PayoutRequestResponse.model_validate(payout)


@router.post(
    "/payouts/{payout_id}/paid",
    response_model=PayoutRequestResponse,
    summary="Mark an approved payout as disbursed",
)
async def mark_payout_paid(
    payout_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: PayoutMarkPaidRequest,
) -> PayoutRequestResponse:
    svc = PayoutService(db)
    payout = await svc.mark_payout_paid(
        payout_id=payout_id,
        payout_method=data.payout_method,
        payout_reference=data.payout_reference,
        payout_notes=data.payout_notes,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return PayoutRequestResponse.model_validate(payout)


# Referrals (admin)


@router.get(
    "/referrals",
    response_model=PaginatedTenantReferrals,
    summary="List all tenant referrals across all resellers",
)
async def list_all_referrals(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    reseller_id: uuid.UUID | None = Query(default=None, description="Filter by reseller"),
) -> PaginatedTenantReferrals:
    svc = ReferralService(db)
    items, total = await svc.list_all_tenant_referrals(
        reseller_id=reseller_id,
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
    "/referrals/stats/{reseller_id}",
    response_model=ReferralStatsResponse,
    summary="Get referral statistics for a specific reseller",
)
async def get_reseller_referral_stats(
    reseller_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> ReferralStatsResponse:
    svc = ReferralService(db)
    data = await svc.get_reseller_referral_stats(reseller_id=reseller_id)
    return ReferralStatsResponse(**data)


# Commissions


@router.get(
    "/commissions",
    response_model=PaginatedTransactions,
    summary="List commission transactions across all resellers",
)
async def list_commissions(
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    reseller_id: uuid.UUID | None = Query(default=None, description="Filter by reseller"),
) -> PaginatedTransactions:
    svc = WalletService(db)
    items, total = await svc.list_commission_transactions(
        reseller_id=reseller_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[WalletTransactionResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# Reseller notes


@router.get(
    "/notes/{reseller_id}",
    response_model=list[NoteResponse],
    summary="List internal admin notes for a reseller",
)
async def list_reseller_notes(
    reseller_id: uuid.UUID,
    db: DbSession,
    _: Annotated[User, Depends(require_super_admin)],
) -> list[NoteResponse]:
    svc = NoteService(db)
    notes = await svc.list_notes(reseller_id=reseller_id)
    return [NoteResponse.model_validate(n) for n in notes]


@router.post(
    "/notes/{reseller_id}",
    response_model=NoteResponse,
    status_code=201,
    summary="Add an internal note to a reseller's profile",
)
async def add_reseller_note(
    reseller_id: uuid.UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_super_admin)],
    request_id: RequestId,
    data: NoteCreateRequest,
) -> NoteResponse:
    svc = NoteService(db)
    note = await svc.create_note(
        reseller_id=reseller_id,
        note=data.note,
        actor_id=current_user.id,
        request_id=request_id,
    )
    return NoteResponse.model_validate(note)
