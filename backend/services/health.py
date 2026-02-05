"""Health: context and template counts (same DB as Next.js)."""

from backend.db import query_one


def get_context_count() -> dict[str, int]:
    """Return total and active context counts."""
    row = query_one(
        "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM contexts"
    )
    if not row:
        return {"total": 0, "active": 0}
    return {"total": int(row["total"] or 0), "active": int(row["active"] or 0)}


def get_template_count() -> int:
    """Return template count."""
    row = query_one("SELECT COUNT(*)::int AS count FROM templates")
    return int(row["count"] or 0) if row else 0
