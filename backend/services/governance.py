"""Governance service (unauthenticated detections)."""

from backend.db import query


def get_unauthenticated_detections(limit: int = 50) -> list[dict]:
    rows = query(
        """SELECT id, source_url, detected_agent_id, details, scan_run_at, created_at
           FROM unauthenticated_detections
           ORDER BY scan_run_at DESC
           LIMIT %s""",
        (limit,),
    )
    result = []
    for r in rows:
        d = dict(r)
        details = d.get("details") or {}
        if isinstance(details, str):
            import json
            try:
                details = json.loads(details)
            except Exception:
                details = {}
        result.append({
            "id": str(d.get("id")),
            "sourceUrl": str(d.get("source_url")),
            "detectedAgentId": str(d["detected_agent_id"]) if d.get("detected_agent_id") else None,
            "details": details,
            "scanRunAt": str(d.get("scan_run_at")),
            "createdAt": str(d.get("created_at")),
        })
    return result
