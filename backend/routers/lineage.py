"""Lineage router (GET /api/lineage)."""

from fastapi import APIRouter

from backend.schemas.common import ApiResponse
from backend.services.audit import get_lineage

router = APIRouter(tags=["lineage"])


@router.get("/lineage", response_model=ApiResponse)
def lineage(limit: int = 50):
    data = get_lineage(limit)
    return ApiResponse(success=True, data=data)
