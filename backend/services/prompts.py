"""Prompts service (dashboard + detail by id, versions, approve/reject)."""

from datetime import datetime
from typing import Any

from backend.db import query, query_one, execute


def _serialize_row(row: dict) -> dict:
    """Convert snake_case keys to camelCase and serialize datetimes."""
    out: dict[str, Any] = {}
    for k, v in row.items():
        if v is not None and hasattr(v, "isoformat") and callable(getattr(v, "isoformat")):
            v = (v.isoformat() if hasattr(v, "isoformat") else str(v))
        parts = k.split("_")
        camel = parts[0].lower() + "".join(p.capitalize() for p in parts[1:])
        out[camel] = v
    return out


def get_prompt_stats() -> dict[str, int]:
    row = query_one(
        """SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN current_version_id IS NOT NULL THEN 1 END)::int AS active
        FROM prompts"""
    )
    if not row:
        return {"total": 0, "active": 0}
    return {"total": int(row["total"] or 0), "active": int(row["active"] or 0)}


def get_recent_prompts(limit: int = 6) -> list[dict]:
    rows = query(
        "SELECT * FROM prompts ORDER BY created_at DESC LIMIT %s",
        (limit,),
    )
    return [dict(r) for r in rows]


def get_prompt_by_id(prompt_id: str) -> dict | None:
    """Get prompt by id with versions and currentVersion (camelCase for frontend)."""
    row = query_one("SELECT * FROM prompts WHERE id = %s", (prompt_id,))
    if not row:
        return None
    versions_rows = query(
        "SELECT * FROM prompt_versions WHERE prompt_id = %s ORDER BY version DESC",
        (prompt_id,),
    )
    versions = []
    current_version = None
    for r in versions_rows:
        d = _serialize_row(dict(r))
        status = (r.get("status") or "").lower()
        d["status"] = status if status in ("draft", "proposed", "approved", "rejected", "archived") else "draft"
        versions.append(d)
        if str(r.get("id")) == str(row.get("current_version_id")):
            current_version = d
    prompt_dict = _serialize_row(dict(row))
    prompt_dict["versions"] = versions
    prompt_dict["currentVersion"] = current_version
    return prompt_dict


def get_prompt_versions(prompt_id: str) -> list[dict]:
    rows = query(
        "SELECT * FROM prompt_versions WHERE prompt_id = %s ORDER BY version DESC",
        (prompt_id,),
    )
    out = []
    for r in rows:
        d = _serialize_row(dict(r))
        status = (r.get("status") or "").lower()
        d["status"] = status if status in ("draft", "proposed", "approved", "rejected", "archived") else "draft"
        out.append(d)
    return out


def create_prompt_version(
    prompt_id: str,
    content: str,
    system_prompt: str | None = None,
    model: str | None = None,
    commit_message: str = "",
    auto_approve: bool = False,
    created_by: str | None = None,
) -> dict | None:
    """Create a new prompt version. Returns the new version dict or None if prompt not found."""
    prompt = query_one("SELECT id FROM prompts WHERE id = %s", (prompt_id,))
    if not prompt:
        return None
    next_ver_row = query_one(
        "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM prompt_versions WHERE prompt_id = %s",
        (prompt_id,),
    )
    next_version = int(next_ver_row["next_version"] or 1) if next_ver_row else 1
    status = "approved" if auto_approve else "proposed"
    import hashlib
    sha = hashlib.sha256(content.encode()).hexdigest()
    execute(
        """INSERT INTO prompt_versions (prompt_id, version, content, system_prompt, model, commit_message, created_by, submitted_by, status, sha256_hash)
         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (prompt_id, next_version, content, system_prompt or None, model or None, commit_message or "New version", created_by or "system", created_by or "system", status.capitalize(), sha),
    )
    row = query_one(
        "SELECT * FROM prompt_versions WHERE prompt_id = %s AND version = %s",
        (prompt_id, next_version),
    )
    if not row:
        return None
    d = _serialize_row(dict(row))
    d["status"] = status
    if auto_approve:
        execute(
            "UPDATE prompts SET current_version_id = (SELECT id FROM prompt_versions WHERE prompt_id = %s AND version = %s), updated_at = NOW(), updated_by = %s WHERE id = %s",
            (prompt_id, next_version, created_by or "system", prompt_id),
        )
    return d


def approve_prompt_version(prompt_id: str, version_id: str, approved_by: str | None = None) -> dict | None:
    ver = query_one("SELECT id, prompt_id, status FROM prompt_versions WHERE id = %s AND prompt_id = %s", (version_id, prompt_id))
    if not ver or str(ver.get("status")).lower() not in ("proposed", "draft"):
        return None
    execute(
        "UPDATE prompt_versions SET status = 'Approved', approved_by = %s, approved_at = NOW(), updated_at = NOW() WHERE id = %s",
        (approved_by or "system", version_id),
    )
    execute(
        "UPDATE prompts SET current_version_id = %s, updated_at = NOW(), updated_by = %s WHERE id = %s",
        (version_id, approved_by or "system", prompt_id),
    )
    row = query_one("SELECT * FROM prompt_versions WHERE id = %s", (version_id,))
    return _serialize_row(dict(row)) if row else None


def reject_prompt_version(prompt_id: str, version_id: str, rejected_by: str | None = None) -> dict | None:
    ver = query_one("SELECT id, status FROM prompt_versions WHERE id = %s AND prompt_id = %s", (version_id, prompt_id))
    if not ver:
        return None
    execute(
        "UPDATE prompt_versions SET status = 'Rejected', updated_at = NOW(), updated_by = %s WHERE id = %s",
        (rejected_by or "system", version_id),
    )
    row = query_one("SELECT * FROM prompt_versions WHERE id = %s", (version_id,))
    return _serialize_row(dict(row)) if row else None


def get_prompt_by_name(name: str) -> dict | None:
    """Get prompt by name (for pull API)."""
    row = query_one("SELECT id FROM prompts WHERE name = %s", (name.strip(),))
    if not row:
        return None
    return get_prompt_by_id(str(row["id"]))


def get_current_prompt_version(prompt_id: str) -> dict | None:
    """Get the current (approved) prompt version for a prompt (for pull API)."""
    row = query_one(
        """SELECT pv.* FROM prompt_versions pv
           JOIN prompts p ON p.current_version_id = pv.id AND p.id = %s
           WHERE pv.status = 'Approved'
           LIMIT 1""",
        (prompt_id,),
    )
    if not row:
        # Fallback: latest approved version for this prompt
        row = query_one(
            """SELECT * FROM prompt_versions WHERE prompt_id = %s AND status = 'Approved'
               ORDER BY version DESC LIMIT 1""",
            (prompt_id,),
        )
    if not row:
        return None
    return _serialize_row(dict(row))


def delete_prompt(prompt_id: str) -> bool:
    row = query_one("SELECT id FROM prompts WHERE id = %s", (prompt_id,))
    if not row:
        return False
    execute("DELETE FROM prompts WHERE id = %s", (prompt_id,))
    return True
