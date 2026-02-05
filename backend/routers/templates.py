"""Templates router (GET list)."""

from fastapi import APIRouter

from backend.db import query
from backend.schemas.common import ApiResponse

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=ApiResponse)
def list_templates():
    rows = query("SELECT * FROM templates ORDER BY name ASC")
    data = [dict(r) for r in rows]
    return ApiResponse(success=True, data=data)
