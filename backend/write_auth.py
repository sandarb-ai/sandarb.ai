"""
Write authorization for UI endpoints: only allowed emails can POST/PUT/PATCH/DELETE.
Expects Authorization: Bearer <jwt> where JWT is signed with JWT_SECRET and contains {"email": "..."}.
"""

import jwt
from fastapi import Request, HTTPException, Depends

from backend.config import settings


def get_bearer_token(request: Request) -> str | None:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:].strip() or None
    return None


def _allowed_emails_set() -> set[str]:
    raw = (getattr(settings, "write_allowed_emails", None) or "").strip()
    if not raw:
        return set()
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def require_write_allowed(request: Request) -> str:
    """
    Dependency for write endpoints: require valid JWT with email in WRITE_ALLOWED_EMAILS.
    Returns the allowed email. Raises 403 if no token, invalid token, or email not allowed.
    """
    token = get_bearer_token(request)
    if not token:
        raise HTTPException(
            status_code=403,
            detail="Write access requires authentication. Sign in with an allowed email and use the session token.",
        )
    allowed = _allowed_emails_set()
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Write access is disabled (no WRITE_ALLOWED_EMAILS configured).",
        )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "email"]},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired session. Sign in again.",
        )
    email = (payload.get("email") or "").strip().lower()
    if not email or email not in allowed:
        raise HTTPException(
            status_code=403,
            detail="Your email is not allowed to perform writes.",
        )
    return email


def require_write_allowed_optional(request: Request) -> str | None:
    """
    Optional write auth: if no token or invalid, returns None; if valid and allowed, returns email.
    Use when you want to allow reads without auth but still enforce write auth.
    """
    token = get_bearer_token(request)
    if not token:
        return None
    allowed = _allowed_emails_set()
    if not allowed:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "email"]},
        )
    except jwt.InvalidTokenError:
        return None
    email = (payload.get("email") or "").strip().lower()
    if email and email in allowed:
        return email
    return None
