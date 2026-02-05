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
    """Convert a raw context row to camelCase for list API (no content). Includes active version and organization."""
    row_copy = dict(row)
    current_version_id = row_copy.pop("current_version_id", None)
    active_version = row_copy.pop("active_version", None)
    version_approved_by = row_copy.pop("version_approved_by", None)
    version_approved_at = row_copy.pop("version_approved_at", None)
    org_id = row_copy.get("org_id")
    org_name = row_copy.pop("org_name", None)
    org_slug = row_copy.pop("org_slug", None)

    ctx = _serialize_row(row_copy)
    ctx["orgId"] = str(org_id) if org_id is not None else None
    if org_id is not None and org_name is not None:
        ctx["organization"] = {"id": str(org_id), "name": org_name, "slug": org_slug or ""}
    else:
        ctx["organization"] = None
    if ctx.get("dataClassification"):
        ctx["dataClassification"] = str(ctx["dataClassification"]).lower()
    ctx["regulatoryHooks"] = _parse_json_field(row_copy.get("regulatory_hooks"), [])
    ctx["tags"] = _parse_json_field(row_copy.get("tags"), [])

    if current_version_id is not None:
        ctx["currentVersionId"] = str(current_version_id)
        ctx["currentVersion"] = {"version": int(active_version)} if active_version is not None else None
        ctx["approvedBy"] = str(version_approved_by) if version_approved_by is not None else None
        ctx["approvedAt"] = version_approved_at.isoformat() if version_approved_at is not None and hasattr(version_approved_at, "isoformat") else (str(version_approved_at) if version_approved_at else None)
    else:
        ctx["currentVersionId"] = None
        ctx["currentVersion"] = None
        ctx["approvedBy"] = None
        ctx["approvedAt"] = None
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
    org_id = row.get("org_id")
    ctx["orgId"] = str(org_id) if org_id is not None else None
    if org_id is not None:
        org_row = query_one("SELECT id, name, slug FROM organizations WHERE id = %s", (org_id,))
        if org_row:
            ctx["organization"] = {"id": str(org_row["id"]), "name": org_row["name"], "slug": org_row["slug"]}
        else:
            ctx["organization"] = None
    else:
        ctx["organization"] = None
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
    org_id: str | None = None,
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
    if org_id is not None:
        updates.append("org_id = %s")
        params.append(org_id)
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
        # Get next version number (integer starting from 1)
        next_version = 1
        max_ver = query_one(
            "SELECT COALESCE(MAX(version), 0) as max_version FROM context_versions WHERE context_id = %s",
            (context_id,),
        )
        if max_ver and max_ver.get("max_version"):
            next_version = int(max_ver["max_version"]) + 1
        if active:
            execute("UPDATE context_versions SET is_active = false WHERE context_id = %s", (context_id,))
        execute(
            """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message)
             VALUES (%s, %s, %s::jsonb, %s, %s, %s, 'Approved', true, %s)""",
            (context_id, next_version, content_json, sha, updated_by or "system", updated_by or "system", "Update"),
        )
    return get_context_by_id(context_id)


def create_context_revision(
    context_id: str,
    content: dict,
    commit_message: str = "Update",
    auto_approve: bool = False,
    created_by: str | None = None,
) -> dict | None:
    """Create a new context revision. If auto_approve, mark it approved and active immediately."""
    row = query_one("SELECT id FROM contexts WHERE id = %s", (context_id,))
    if not row:
        return None
    
    import hashlib
    content_json = json.dumps(content) if isinstance(content, dict) else "{}"
    sha = hashlib.sha256(content_json.encode()).hexdigest()
    
    # Get next version number
    next_version = 1
    max_ver = query_one(
        "SELECT COALESCE(MAX(version), 0) as max_version FROM context_versions WHERE context_id = %s",
        (context_id,),
    )
    if max_ver and max_ver.get("max_version"):
        next_version = int(max_ver["max_version"]) + 1
    
    status = "Approved" if auto_approve else "Pending"
    is_active = auto_approve
    
    if auto_approve:
        # Deactivate previous versions
        execute("UPDATE context_versions SET is_active = false WHERE context_id = %s", (context_id,))
    
    if auto_approve:
        execute(
            """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message, approved_by, approved_at)
             VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, NOW())""",
            (
                context_id,
                next_version,
                content_json,
                sha,
                created_by or "system",
                created_by or "system",
                status,
                is_active,
                commit_message,
                created_by or "system",
            ),
        )
    else:
        execute(
            """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message)
             VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s)""",
            (
                context_id,
                next_version,
                content_json,
                sha,
                created_by or "system",
                created_by or "system",
                status,
                is_active,
                commit_message,
            ),
        )
    
    # Return the created revision
    rev = query_one(
        "SELECT * FROM context_versions WHERE context_id = %s ORDER BY created_at DESC LIMIT 1",
        (context_id,),
    )
    if rev:
        d = _serialize_row(dict(rev))
        d["status"] = "approved" if auto_approve else "proposed"
        return d
    return None


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


def create_context(
    name: str,
    description: str | None = None,
    content: dict | None = None,
    tags: list | None = None,
    org_id: str | None = None,
    data_classification: str | None = None,
    regulatory_hooks: list | None = None,
    created_by: str | None = None,
) -> dict | None:
    """Create a new context with an initial approved version."""
    existing = query_one("SELECT id FROM contexts WHERE name = %s", (name.strip(),))
    if existing:
        return None
    owner_team = "default"
    if org_id:
        org_row = query_one("SELECT slug FROM organizations WHERE id = %s", (org_id,))
        if org_row:
            owner_team = org_row["slug"] or "default"
    tags_json = json.dumps(tags if tags else [])
    reg_hooks_json = json.dumps(regulatory_hooks if regulatory_hooks else [])
    data_class = data_classification or "Internal"
    execute(
        """INSERT INTO contexts (name, description, org_id, data_classification, owner_team, tags, regulatory_hooks, created_by)
         VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)""",
        (name.strip(), description or None, org_id, data_class, owner_team, tags_json, reg_hooks_json, created_by or None),
    )
    row = query_one("SELECT id FROM contexts WHERE name = %s", (name.strip(),))
    if not row:
        return None
    context_id = str(row["id"])
    # Create initial context version with content
    import hashlib
    content_dict = content if isinstance(content, dict) else {}
    content_json = json.dumps(content_dict)
    sha = hashlib.sha256(content_json.encode()).hexdigest()
    created = created_by or "system"
    execute(
        """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message, approved_by, approved_at)
         VALUES (%s, 1, %s::jsonb, %s, %s, %s, 'Approved', true, 'Initial version', %s, NOW())""",
        (context_id, content_json, sha, created, created, created),
    )
    return get_context_by_id(context_id)


def delete_context(context_id: str) -> bool:
    row = query_one("SELECT id FROM contexts WHERE id = %s", (context_id,))
    if not row:
        return False
    execute("DELETE FROM contexts WHERE id = %s", (context_id,))
    return True
