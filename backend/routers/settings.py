"""Settings router (GET, PATCH).

SECURITY: Settings keys are validated against a whitelist to prevent arbitrary configuration injection.
"""

import logging
import re

from fastapi import APIRouter, HTTPException, Depends

from backend.write_auth import require_write_allowed
from backend.db import query, query_one, execute
from backend.schemas.common import ApiResponse

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)

# Whitelist of allowed settings keys (add new keys here as needed)
ALLOWED_SETTINGS_KEYS = {
    # UI settings
    "theme",
    "sidebar_collapsed",
    "default_org",
    "items_per_page",
    # Governance settings
    "approval_required",
    "auto_archive_days",
    "retention_days",
    # Display settings
    "date_format",
    "timezone",
    # Feature flags
    "enable_a2a",
    "enable_mcp",
    "enable_audit_log",
}

# Pattern for valid settings keys: alphanumeric, underscores, hyphens only
VALID_KEY_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$")


def _validate_settings_key(key: str) -> bool:
    """Validate a settings key against whitelist and format rules."""
    if not key or not isinstance(key, str):
        return False
    # Check format first
    if not VALID_KEY_PATTERN.match(key):
        return False
    # Check whitelist (or allow if custom settings are enabled)
    return key in ALLOWED_SETTINGS_KEYS or key.startswith("custom_")


@router.get("", response_model=ApiResponse)
def get_settings():
    rows = query("SELECT key, value FROM settings")
    data = {str(r["key"]): str(r["value"]) for r in rows}
    return ApiResponse(success=True, data=data)


@router.patch("", response_model=ApiResponse)
def patch_settings(body: dict, _email: str = Depends(require_write_allowed)):
    invalid_keys = []
    valid_updates = {}

    for key, value in (body or {}).items():
        if not key:
            continue
        if not _validate_settings_key(key):
            invalid_keys.append(key)
            continue
        valid_updates[key] = str(value)

    if invalid_keys:
        logger.warning(f"Invalid settings keys rejected: {invalid_keys}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid settings keys: {', '.join(invalid_keys)}. Allowed keys: {', '.join(sorted(ALLOWED_SETTINGS_KEYS))} or custom_* prefix.",
        )

    for key, value in valid_updates.items():
        execute(
            "INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key, value),
        )

    rows = query("SELECT key, value FROM settings")
    data = {str(r["key"]): str(r["value"]) for r in rows}
    return ApiResponse(success=True, data=data)
