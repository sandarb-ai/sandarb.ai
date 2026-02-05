"""Governance router (blocked-injections, intersection, unauthenticated-agents)."""

from fastapi import APIRouter

from backend.schemas.common import ApiResponse
from backend.services.governance import get_unauthenticated_detections
from backend.services.audit import get_blocked_injections, get_governance_intersection_log

router = APIRouter(prefix="/governance", tags=["governance"])


@router.get("/blocked-injections", response_model=ApiResponse)
def blocked_injections(limit: int = 50):
    data = get_blocked_injections(limit)
    return ApiResponse(success=True, data=data)


@router.get("/intersection", response_model=ApiResponse)
def intersection(limit: int = 100):
    data = get_governance_intersection_log(limit)
    return ApiResponse(success=True, data=data)


@router.get("/unauthenticated-agents", response_model=ApiResponse)
def unauthenticated_agents(limit: int = 50):
    data = get_unauthenticated_detections(limit)
    return ApiResponse(success=True, data=data)
