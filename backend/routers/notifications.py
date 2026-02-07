"""Notifications router — infrastructure health feed.

Endpoints:
  GET /notifications/health  → run all infra health checks, return feed items
"""

import logging

from fastapi import APIRouter

from backend.schemas.common import ApiResponse
from backend.services.infra_health import run_all_checks

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.get("/health", response_model=ApiResponse)
def health_feed():
    """Run all infrastructure health checks and return results as notification items."""
    results = run_all_checks()

    # Compute summary counts
    healthy = sum(1 for r in results if r["status"] == "healthy")
    unhealthy = sum(1 for r in results if r["status"] == "unhealthy")
    not_configured = sum(1 for r in results if r["status"] in ("not_configured", "disabled"))
    info = sum(1 for r in results if r["status"] in ("info", "unknown"))

    overall = "healthy" if unhealthy == 0 else "degraded" if unhealthy <= 2 else "unhealthy"

    return ApiResponse(success=True, data={
        "overall": overall,
        "summary": {
            "healthy": healthy,
            "unhealthy": unhealthy,
            "not_configured": not_configured,
            "info": info,
            "total": len(results),
        },
        "items": results,
    })
