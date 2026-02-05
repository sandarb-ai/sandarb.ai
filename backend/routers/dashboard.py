"""Dashboard router (GET /api/dashboard)."""

from fastapi import APIRouter

from backend.schemas.common import ApiResponse
from backend.services.dashboard import get_dashboard_data

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=ApiResponse)
def dashboard():
    data = get_dashboard_data()
    return ApiResponse(success=True, data=data)
