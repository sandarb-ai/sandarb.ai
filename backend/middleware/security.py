"""
Security middleware: rate limiting, security headers, and error handling.
"""

import logging
import os
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Rate Limiting
# -----------------------------------------------------------------------------

def _get_rate_limit_key(request: Request) -> str:
    """Get rate limit key from API key header or IP address."""
    api_key = request.headers.get("X-API-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if api_key:
        # Rate limit by API key (first 16 chars for privacy in logs)
        return f"api_key:{api_key[:16]}"
    return get_remote_address(request)


# Default rate limits (can be overridden via env)
DEFAULT_RATE_LIMIT = os.environ.get("RATE_LIMIT_DEFAULT", "100/minute")
SEED_RATE_LIMIT = os.environ.get("RATE_LIMIT_SEED", "5/hour")
AUTH_RATE_LIMIT = os.environ.get("RATE_LIMIT_AUTH", "20/minute")

limiter = Limiter(key_func=_get_rate_limit_key, default_limits=[DEFAULT_RATE_LIMIT])


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Custom handler for rate limit exceeded errors."""
    logger.warning(f"Rate limit exceeded for {_get_rate_limit_key(request)}: {request.url.path}")
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": "Rate limit exceeded. Please slow down your requests.",
            "retry_after": exc.detail,
        },
    )


def setup_rate_limiting(app: FastAPI) -> None:
    """Configure rate limiting for the FastAPI app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


# -----------------------------------------------------------------------------
# Security Headers Middleware
# -----------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy - don't leak full URLs
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy - restrict browser features
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Content Security Policy (allow API responses, restrict scripts)
        # Note: This is a permissive policy for an API; tighten for HTML responses
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'"

        return response


# -----------------------------------------------------------------------------
# Error Sanitization Middleware
# -----------------------------------------------------------------------------

class ErrorSanitizationMiddleware(BaseHTTPMiddleware):
    """Sanitize error responses to prevent information leakage."""

    # Patterns that indicate sensitive information
    SENSITIVE_PATTERNS = [
        "password",
        "secret",
        "token",
        "key",
        "credential",
        "connection",
        "psycopg2",
        "postgresql",
        "database",
        "sql",
        "traceback",
        "file",
        "path",
        "/usr/",
        "/home/",
        "/app/",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            # Log the full error server-side
            logger.exception(f"Unhandled exception on {request.method} {request.url.path}")

            # Return sanitized error to client
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": "An internal error occurred. Please try again later.",
                },
            )

    @classmethod
    def sanitize_error_message(cls, message: str) -> str:
        """Remove sensitive information from error messages."""
        message_lower = message.lower()
        for pattern in cls.SENSITIVE_PATTERNS:
            if pattern in message_lower:
                return "An error occurred while processing your request."
        return message


def setup_security_middleware(app: FastAPI) -> None:
    """Configure all security middleware for the FastAPI app."""
    # Order matters: error sanitization should be outermost
    app.add_middleware(ErrorSanitizationMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    setup_rate_limiting(app)
