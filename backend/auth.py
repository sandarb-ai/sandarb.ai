"""
API key authentication for SDK endpoints (inject, prompts/pull, audit/activity).
Resolves Authorization: Bearer <key> or X-API-Key: <key> to a service_account.
Agent identity is taken from the validated service account, not from headers alone.
"""

import os
from datetime import datetime, timezone
from typing import Any

import bcrypt
from fastapi import Request, HTTPException

from backend.db import query
from backend.config import settings


class ApiKeyExpiredError(Exception):
    """Raised when a valid API key has expired."""
    pass


def get_api_key_from_request(request: Request) -> str | None:
    """Extract API key from Authorization: Bearer <key> or X-API-Key header."""
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:].strip() or None
    return request.headers.get("X-API-Key") or request.headers.get("x-api-key") or None


def verify_api_key(api_key: str) -> dict[str, Any] | None:
    """
    Verify API key against service_accounts (bcrypt check).
    Returns service account row (id, client_id, agent_id) if valid, else None.
    Raises ApiKeyExpiredError if the key matches but has expired.
    """
    if not api_key or not api_key.strip():
        return None
    rows = query(
        "SELECT id, client_id, secret_hash, agent_id, expires_at FROM service_accounts"
    )
    for row in rows:
        secret_hash = row.get("secret_hash")
        if not secret_hash:
            continue
        try:
            if bcrypt.checkpw(api_key.strip().encode("utf-8"), secret_hash.encode("utf-8")):
                # Check expiration (NULL = never expires)
                expires_at = row.get("expires_at")
                if expires_at is not None:
                    if isinstance(expires_at, str):
                        expires_at = datetime.fromisoformat(expires_at)
                    if expires_at.tzinfo is None:
                        expires_at = expires_at.replace(tzinfo=timezone.utc)
                    if datetime.now(timezone.utc) > expires_at:
                        raise ApiKeyExpiredError("API key has expired.")
                return {
                    "id": str(row["id"]),
                    "client_id": row["client_id"],
                    "agent_id": row["agent_id"],
                }
        except ApiKeyExpiredError:
            raise
        except Exception:
            continue
    return None


def require_api_key_and_agent(
    request: Request,
    agent_id_header: str | None,
    trace_id_header: str | None,
    allow_preview_for_client_id: str = "sandarb-ui",
) -> tuple[dict[str, Any], str, str]:
    """
    Require valid API key; resolve agent_id from service account (no header trust).
    Preview agent_id (sandarb-context-preview / sandarb-prompt-preview) is only allowed when:
    - SANDARB_DEV=true, or
    - Authenticated with allow_preview_for_client_id (e.g. sandarb-ui) and header agent is preview.
    Returns (service_account, agent_id_to_use, trace_id).
    Raises HTTPException 401 if no/invalid key, 403 if agent_id header does not match.
    """
    api_key = get_api_key_from_request(request)
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Use Authorization: Bearer <api_key> or X-API-Key header.",
        )
    try:
        account = verify_api_key(api_key)
    except ApiKeyExpiredError:
        raise HTTPException(status_code=401, detail="API key has expired. Please generate a new key.")
    if not account:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key.",
        )
    if not agent_id_header or not trace_id_header:
        raise HTTPException(
            status_code=400,
            detail="X-Sandarb-Agent-ID and X-Sandarb-Trace-ID (or agentId/traceId query) are required.",
        )
    agent_id_header = agent_id_header.strip()
    trace_id_header = trace_id_header.strip()
    account_agent_id = (account.get("agent_id") or "").strip()

    dev_mode = (
        getattr(settings, "dev_mode", False)
        or os.environ.get("SANDARB_DEV", "").lower() in ("true", "1", "yes")
    )

    # Preview bypass: only when dev_mode or when authenticated as sandarb-ui and header is preview
    is_preview_header = agent_id_header in (
        "sandarb-context-preview",
        "sandarb-prompt-preview",
    )
    if is_preview_header:
        if dev_mode or account["client_id"] == allow_preview_for_client_id:
            return account, agent_id_header, trace_id_header
        raise HTTPException(
            status_code=403,
            detail="Preview agent ID is only allowed in dev mode or when using the sandarb-ui API key.",
        )

    # Normal: header agent_id must match the service account's agent_id (no impersonation)
    if agent_id_header != account_agent_id:
        raise HTTPException(
            status_code=403,
            detail="X-Sandarb-Agent-ID must match the agent linked to your API key. Cannot act on behalf of another agent.",
        )
    return account, agent_id_header, trace_id_header
