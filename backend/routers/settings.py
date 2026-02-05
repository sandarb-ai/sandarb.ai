"""Settings router (GET, PATCH)."""

from fastapi import APIRouter, HTTPException

from backend.db import query, query_one, execute
from backend.schemas.common import ApiResponse

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=ApiResponse)
def get_settings():
    rows = query("SELECT key, value FROM settings")
    data = {str(r["key"]): str(r["value"]) for r in rows}
    return ApiResponse(success=True, data=data)


@router.patch("", response_model=ApiResponse)
def patch_settings(body: dict):
    for key, value in (body or {}).items():
        if not key:
            continue
        execute(
            "INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key, str(value)),
        )
    rows = query("SELECT key, value FROM settings")
    data = {str(r["key"]): str(r["value"]) for r in rows}
    return ApiResponse(success=True, data=data)
