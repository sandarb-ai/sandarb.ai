"""Contexts service (dashboard + detail by id, revisions, approve/reject, update, delete)."""

import json
from typing import Any

from backend.db import query, query_one, execute


def _serialize_row(row: dict) -> dict:
    """Convert snake_case keys to camelCase and serialize datetimes."""
    out: dict[str, Any] = {}
    for k, v in row.items():
        if v is not None and hasattr(v, "isoformat") and callable(getattr(v, "isoformat")):
            v = v.isoformat()
        parts = k.split("_")
        camel = parts[0].lower() + "".join(p.capitalize() for p in parts[1:])
        out[camel] = v
    return out


def _parse_json_field(v: Any, default: Any = None) -> Any:
    if v is None:
        return default
    if isinstance(v, (list, dict)):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return default
    return default


def get_context_count() -> dict[str, int]:
    total_row = query_one("SELECT COUNT(*)::int AS count FROM contexts")
    active_row = query_one("SELECT COUNT(*)::int AS count FROM contexts WHERE is_active = true")
    return {
        "total": int(total_row["count"] or 0) if total_row else 0,
        "active": int(active_row["count"] or 0) if active_row else 0,
    }


def get_context_count_by_tag(tag: str) -> int:
    row = query_one(
        "SELECT COUNT(*)::int AS count FROM contexts WHERE tags::jsonb @> %s::jsonb",
        (json.dumps([tag]),),
    )
    return int(row["count"] or 0) if row else 0


def get_recent_activity(limit: int = 10) -> list[dict]:
    rows = query(
        "SELECT id, type, resource_type, resource_id, resource_name, created_at FROM activity_log ORDER BY created_at DESC LIMIT %s",
        (limit,),
    )
    return [dict(r) for r in rows]


def get_context_by_name(name: str) -> dict | None:
    """Get context by name with content (for inject API)."""
    row = query_one("SELECT id FROM contexts WHERE name = %s", (name.strip(),))
    if not row:
        return None
    return get_context_by_id(str(row["id"]))


def serialize_context_list_row(row: dict) -> dict:
    """Convert a raw context row to camelCase for list API (no content)."""
    ctx = _serialize_row(dict(row))
    if ctx.get("lobTag"):
        ctx["lineOfBusiness"] = str(ctx["lobTag"]).lower().replace("-", "_").replace(" ", "_")
    if ctx.get("dataClassification"):
        ctx["dataClassification"] = str(ctx["dataClassification"]).lower()
    ctx["regulatoryHooks"] = _parse_json_field(row.get("regulatory_hooks"), [])
    ctx["tags"] = _parse_json_field(row.get("tags"), [])
    return ctx


def get_context_by_id(context_id: str) -> dict | None:
    """Get context by id with content from active version (camelCase for frontend)."""
    row = query_one("SELECT * FROM contexts WHERE id = %s", (context_id,))
    if not row:
        return None
    # Content lives in context_versions; use active version or latest
    ver = query_one(
        "SELECT content FROM context_versions WHERE context_id = %s AND is_active = true ORDER BY created_at DESC LIMIT 1",
        (context_id,),
    )
    if not ver:
        ver = query_one(
            "SELECT content FROM context_versions WHERE context_id = %s ORDER BY created_at DESC LIMIT 1",
            (context_id,),
        )
    content = _parse_json_field(ver["content"], {}) if ver and ver.get("content") is not None else {}
    ctx = _serialize_row(dict(row))
    ctx["content"] = content
    # Normalize enums to lowercase for frontend
    if ctx.get("lobTag"):
        ctx["lineOfBusiness"] = str(ctx["lobTag"]).lower().replace("-", "_").replace(" ", "_")
    if ctx.get("dataClassification"):
        ctx["dataClassification"] = str(ctx["dataClassification"]).lower()
    ctx["regulatoryHooks"] = _parse_json_field(row.get("regulatory_hooks"), [])
    return ctx


def get_latest_approved_version_id(context_id: str) -> str | None:
    """Return the id of the latest approved/active context version (for audit)."""
    row = query_one(
        "SELECT id FROM context_versions WHERE context_id = %s AND (is_active = true OR status = 'Approved') ORDER BY approved_at DESC NULLS LAST, created_at DESC LIMIT 1",
        (context_id,),
    )
    return str(row["id"]) if row and row.get("id") else None


def get_context_revisions(context_id: str) -> list[dict]:
    rows = query(
        "SELECT * FROM context_versions WHERE context_id = %s ORDER BY created_at DESC",
        (context_id,),
    )
    out = []
    for r in rows:
        d = _serialize_row(dict(r))
        status = (r.get("status") or "").lower()
        d["status"] = "proposed" if status == "pending" else ("approved" if status == "approved" else "rejected")
        d["contextId"] = str(r["context_id"])
        out.append(d)
    return out


def update_context(
    context_id: str,
    description: str | None = None,
    content: dict | None = None,
    is_active: bool | None = None,
    line_of_business: str | None = None,
    data_classification: str | None = None,
    regulatory_hooks: list | None = None,
    updated_by: str | None = None,
) -> dict | None:
    row = query_one("SELECT id FROM contexts WHERE id = %s", (context_id,))
    if not row:
        return None
    updates = []
    params = []
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    if is_active is not None:
        updates.append("is_active = %s")
        params.append(is_active)
    if line_of_business is not None:
        updates.append("lob_tag = %s")
        params.append(line_of_business)
    if data_classification is not None:
        updates.append("data_classification = %s")
        params.append(data_classification)
    if regulatory_hooks is not None:
        updates.append("regulatory_hooks = %s")
        params.append(json.dumps(regulatory_hooks) if isinstance(regulatory_hooks, list) else regulatory_hooks)
    if updated_by is not None:
        updates.append("updated_by = %s")
        params.append(updated_by)
    if updates:
        updates.append("updated_at = NOW()")
        params.append(context_id)
        execute("UPDATE contexts SET " + ", ".join(updates) + " WHERE id = %s", tuple(params))
    if content is not None:
        # Create new context_version with the new content (or update active?)
        active = query_one("SELECT id FROM context_versions WHERE context_id = %s AND is_active = true LIMIT 1", (context_id,))
        import hashlib
        content_json = json.dumps(content) if isinstance(content, dict) else "{}"
        sha = hashlib.sha256(content_json.encode()).hexdigest()
        next_label = "v1.0.0"
        max_ver = query_one(
            "SELECT version_label FROM context_versions WHERE context_id = %s ORDER BY created_at DESC LIMIT 1",
            (context_id,),
        )
        if max_ver and max_ver.get("version_label"):
            try:
                pre = str(max_ver["version_label"])
                if pre.startswith("v") and "." in pre:
                    parts = pre[1:].split(".")
                    n = int(parts[0]) * 1000 + int(parts[1]) * 10 + (int(parts[2]) if len(parts) > 2 else 0) + 1
                    next_label = f"v{n // 1000}.{(n % 1000) // 10}.{n % 10}"
            except Exception:
                pass
        if active:
            execute("UPDATE context_versions SET is_active = false WHERE context_id = %s", (context_id,))
        execute(
            """INSERT INTO context_versions (context_id, version_label, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message)
             VALUES (%s, %s, %s::jsonb, %s, %s, %s, 'Approved', true, %s)""",
            (context_id, next_label, content_json, sha, updated_by or "system", updated_by or "system", "Update"),
        )
    return get_context_by_id(context_id)


def approve_context_revision(context_id: str, revision_id: str, approved_by: str | None = None) -> dict | None:
    rev = query_one("SELECT id, status FROM context_versions WHERE id = %s AND context_id = %s", (revision_id, context_id))
    if not rev or str(rev.get("status")).lower() not in ("pending", "proposed"):
        return None
    execute(
        "UPDATE context_versions SET status = 'Approved', approved_by = %s, approved_at = NOW(), is_active = true WHERE id = %s",
        (approved_by or "system", revision_id),
    )
    execute("UPDATE context_versions SET is_active = false WHERE context_id = %s AND id != %s", (context_id, revision_id))
    row = query_one("SELECT * FROM context_versions WHERE id = %s", (revision_id,))
    return _serialize_row(dict(row)) if row else None


def reject_context_revision(context_id: str, revision_id: str, rejected_by: str | None = None) -> dict | None:
    rev = query_one("SELECT id FROM context_versions WHERE id = %s AND context_id = %s", (revision_id, context_id))
    if not rev:
        return None
    execute(
        "UPDATE context_versions SET status = 'Rejected', updated_at = NOW(), updated_by = %s WHERE id = %s",
        (rejected_by or "system", revision_id),
    )
    row = query_one("SELECT * FROM context_versions WHERE id = %s", (revision_id,))
    return _serialize_row(dict(row)) if row else None


def delete_context(context_id: str) -> bool:
    row = query_one("SELECT id FROM contexts WHERE id = %s", (context_id,))
    if not row:
        return False
    execute("DELETE FROM contexts WHERE id = %s", (context_id,))
    return True
