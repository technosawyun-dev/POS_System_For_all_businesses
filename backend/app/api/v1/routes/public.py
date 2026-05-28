from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DbSession
from app.subscriptions.schemas import PublicPlanResponse
from app.subscriptions.services import PlanService

router = APIRouter()


@router.get(
    "/plans",
    response_model=list[PublicPlanResponse],
    summary="List publicly visible subscription plans (no auth required)",
)
async def list_public_plans(db: DbSession) -> list[PublicPlanResponse]:
    svc = PlanService(db)
    plans = await svc.list_public_plans()
    return [PublicPlanResponse.model_validate(p) for p in plans]
