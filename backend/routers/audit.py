"""Audit router (blocked-injections, lineage, agent-pulse log)."""

from fastapi import APIRouter

from backend.schemas.common import ApiResponse
from backend.services.audit import get_blocked_injections, get_lineage, get_a2a_log, get_governance_intersection_log

router = APIRouter(tags=["audit"])


@router.get("/blocked-injections", response_model=ApiResponse)
def blocked_injections(limit: int = 50):
    data = get_blocked_injections(limit)
    return ApiResponse(success=True, data=data)


@router.get("/lineage", response_model=ApiResponse)
def lineage(limit: int = 50):
    data = get_lineage(limit)
    return ApiResponse(success=True, data=data)


@router.get("/intersection", response_model=ApiResponse)
def governance_intersection(limit: int = 100):
    data = get_governance_intersection_log(limit)
    return ApiResponse(success=True, data=data)
