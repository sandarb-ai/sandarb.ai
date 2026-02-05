"""Agent pulse log (A2A call log)."""

from fastapi import APIRouter

from backend.schemas.common import ApiResponse
from backend.services.audit import get_a2a_log

router = APIRouter(prefix="/agent-pulse", tags=["agent-pulse"])


@router.get("/log", response_model=ApiResponse)
def a2a_log(limit: int = 200):
    data = get_a2a_log(limit)
    return ApiResponse(success=True, data=data)
