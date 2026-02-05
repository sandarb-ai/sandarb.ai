"""Health check router (GET /health)."""

from fastapi import APIRouter, HTTPException

from backend.schemas.common import ApiResponse
from backend.services.health import get_context_count, get_template_count

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    """Health check: DB connectivity and counts."""
    try:
        ctx = get_context_count()
        template_count = get_template_count()
        return {
            "status": "healthy",
            "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "version": "0.1.0",
            "database": {
                "status": "connected",
                "contexts": ctx["total"],
                "templates": template_count,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
                "error": "Database connection failed",
                "message": str(e),
            },
        )
