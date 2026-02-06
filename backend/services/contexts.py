"""Contexts service (dashboard + detail by id, revisions, approve/reject, update, delete).

Supports Jinja2-templated contexts for dynamic rendering at injection time.
Context templates use ``{{ variable }}`` Jinja2 syntax.  At runtime, the agent
passes variables via ``context_variables`` and Sandarb renders the template,
returning the fully resolved content along with governance metadata (hash,
version, classification, owner).

Hash generation: The SHA-256 governance hash is derived from the **context name +
raw Jinja2 template** of the active version (NOT the rendered output).  This
ensures a stable, version-specific fingerprint that doesn't change across
invocations with different runtime variables.
"""

import hashlib
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
            # For Jinja2 templated contexts (and other non-JSON strings),
            # return the raw string instead of the default.  This ensures
            # template content like "# Refund Policy for {{ region }}..."
            # is preserved and displayed correctly.
            return v
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
    """Get context by name with content (for inject API). SRN-aware:
    tries the name as-is, then with 'context.' stripped, then with 'context.' prepended."""
    val = name.strip()
    row = query_one("SELECT id FROM contexts WHERE name = %s", (val,))
    if not row and val.startswith("context."):
        row = query_one("SELECT id FROM contexts WHERE name = %s", (val[len("context."):],))
    if not row and not val.startswith("context."):
        row = query_one("SELECT id FROM contexts WHERE name = %s", (f"context.{val}",))
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
        content_json = json.dumps(content) if isinstance(content, (dict, str, list)) else '""'
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
    ai_instructions: str | None = None,
) -> dict | None:
    """Create a new context revision. If auto_approve, mark it approved and active immediately."""
    row = query_one("SELECT id FROM contexts WHERE id = %s", (context_id,))
    if not row:
        return None
    
    import hashlib
    content_json = json.dumps(content) if isinstance(content, (dict, str, list)) else '""'
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
            """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message, approved_by, approved_at, ai_instructions)
             VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, NOW(), %s)""",
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
                ai_instructions,
            ),
        )
    else:
        execute(
            """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message, ai_instructions)
             VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s)""",
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
                ai_instructions,
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
    content_json = json.dumps(content) if isinstance(content, (dict, str, list)) else '""'
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


# ---------------------------------------------------------------------------
# Jinja2 Templated Context Rendering & Governance Hash
# ---------------------------------------------------------------------------


def compute_governance_hash(context_name: str, template_content: str) -> str:
    """Compute a stable SHA-256 governance hash from the context name + raw Jinja2 template.

    The hash is deterministic for a given (name, template) pair and does NOT
    depend on runtime variables passed during rendering.  This makes the hash
    a version-level fingerprint suitable for audit and compliance checks.

    Args:
        context_name: The Sandarb Resource Name or plain name of the context.
        template_content: The raw Jinja2 template string (before rendering).

    Returns:
        A lowercase hex SHA-256 digest.
    """
    payload = f"{context_name}:{template_content}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def render_template_content(template_content: str, variables: dict[str, Any]) -> str:
    """Render a Jinja2 template string with the provided variables.

    Uses ``SandboxedEnvironment`` with ``autoescape=True`` to prevent
    template injection attacks (e.g. a malicious variable value containing
    Jinja2 directives).

    Args:
        template_content: The raw Jinja2 template string (e.g.
            ``"Refund Policy for {{ region }}\\nCurrency: {{ currency }}"``)
        variables: Dictionary of variable names to values.

    Returns:
        The fully rendered string with all ``{{ ... }}`` placeholders resolved.

    Raises:
        jinja2.TemplateSyntaxError: If the template has invalid Jinja2 syntax.
        jinja2.UndefinedError: If a required variable is missing from *variables*.
    """
    from jinja2.sandbox import SandboxedEnvironment

    env = SandboxedEnvironment(autoescape=True)
    template = env.from_string(template_content)
    return template.render(**variables)


def _is_snake_case(name: str) -> bool:
    """Check if a variable name is lowercase snake_case.

    Valid: ``region``, ``risk_tier``, ``max_txn_per_hour``
    Invalid: ``riskTier``, ``MaxAmount``, ``risk-tier``
    """
    import re
    return bool(re.fullmatch(r"[a-z][a-z0-9]*(_[a-z0-9]+)*", name))


def validate_jinja2_template(template_content: str) -> dict:
    """Validate Jinja2 template syntax and extract referenced variables.

    Uses ``SandboxedEnvironment`` (same sandbox as rendering) to parse the
    template.  On success, walks the AST to find all undeclared variable
    names referenced in the template.

    **Naming convention enforcement:** All top-level template variables must
    use ``lowercase_snake_case`` (e.g. ``region``, ``risk_tier``).  Variables
    that violate this convention are returned in ``variable_warnings`` so the
    editor can surface inline warnings.

    Returns:
        dict with keys:
            - valid (bool): Whether the template compiles without errors.
            - error (str | None): Error message if invalid.
            - line (int | None): Line number of the error (1-based) if invalid.
            - variables (list[str]): Sorted list of detected template variable names.
            - variable_warnings (list[dict]): Variables that violate snake_case.
              Each entry: ``{"name": str, "suggestion": str}``.
    """
    from jinja2.sandbox import SandboxedEnvironment
    from jinja2 import TemplateSyntaxError, meta

    env = SandboxedEnvironment(autoescape=True)

    try:
        ast = env.parse(template_content)
        variables = sorted(meta.find_undeclared_variables(ast))

        # Enforce lowercase snake_case for all top-level variables
        variable_warnings: list[dict[str, str]] = []
        for var in variables:
            if not _is_snake_case(var):
                # Suggest a snake_case version
                import re
                # Convert camelCase / PascalCase → snake_case
                suggestion = re.sub(r"([A-Z])", r"_\1", var).lower().lstrip("_")
                # Replace hyphens with underscores
                suggestion = suggestion.replace("-", "_")
                # Collapse multiple underscores
                suggestion = re.sub(r"_+", "_", suggestion)
                variable_warnings.append({"name": var, "suggestion": suggestion})

        return {
            "valid": True,
            "error": None,
            "line": None,
            "variables": variables,
            "variable_warnings": variable_warnings,
        }
    except TemplateSyntaxError as e:
        return {
            "valid": False,
            "error": e.message if e.message else str(e),
            "line": e.lineno,
            "variables": [],
            "variable_warnings": [],
        }


def get_rendered_context(
    context_name: str,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Fetch a context by name, render its Jinja2 template, and return governance metadata.

    This is the primary entry point for the Inject API when ``context_variables``
    are provided.

    Args:
        context_name: The context name (plain or SRN like ``context.eu-refund-policy``).
        variables: Optional dict of template variables to render into the context.

    Returns:
        A dict with keys:
            - ``context_id``: The context UUID.
            - ``context_name``: The context name.
            - ``version_id``: The active version UUID.
            - ``version``: The integer version number.
            - ``content``: The rendered string (or raw content if no variables).
            - ``metadata``: Governance metadata dict with ``classification``,
              ``owner``, ``hash``, ``hash_type``.

        Returns ``None`` if the context or an approved version is not found.
    """
    # get_context_by_name is SRN-aware — pass the name as-is
    ctx = get_context_by_name(context_name)
    if not ctx:
        return None

    context_id = ctx["id"]

    # Get the active version with raw template content
    ver = query_one(
        "SELECT id, version, content, sha256_hash FROM context_versions "
        "WHERE context_id = %s AND is_active = true ORDER BY created_at DESC LIMIT 1",
        (context_id,),
    )
    if not ver:
        ver = query_one(
            "SELECT id, version, content, sha256_hash FROM context_versions "
            "WHERE context_id = %s AND status = 'Approved' ORDER BY approved_at DESC NULLS LAST, created_at DESC LIMIT 1",
            (context_id,),
        )
    if not ver:
        return None

    raw_content = ver.get("content")
    # content is stored as JSONB — could be a dict or a string
    if isinstance(raw_content, dict):
        # If stored as a dict, serialize to string for template rendering
        template_str = json.dumps(raw_content, indent=2)
    elif isinstance(raw_content, str):
        try:
            parsed = json.loads(raw_content)
            template_str = json.dumps(parsed, indent=2) if isinstance(parsed, dict) else raw_content
        except (json.JSONDecodeError, TypeError):
            template_str = raw_content
    else:
        template_str = str(raw_content) if raw_content else ""

    # Compute governance hash from context name + raw template (stable across invocations)
    governance_hash = compute_governance_hash(plain_name, template_str)

    # Render with variables if provided
    if variables:
        rendered = render_template_content(template_str, variables)
    else:
        rendered = template_str

    # Get full context metadata for governance proof (org, classification, regulatory hooks)
    ctx_row = query_one(
        "SELECT c.data_classification, c.owner_team, c.org_id, c.regulatory_hooks, "
        "o.name AS org_name, o.slug AS org_slug "
        "FROM contexts c LEFT JOIN organizations o ON c.org_id = o.id "
        "WHERE c.id = %s",
        (context_id,),
    )
    classification = (ctx_row.get("data_classification") or "Internal") if ctx_row else "Internal"
    owner = (ctx_row.get("owner_team") or "") if ctx_row else ""
    org_id = str(ctx_row["org_id"]) if ctx_row and ctx_row.get("org_id") else None
    org_name = ctx_row.get("org_name") if ctx_row else None
    org_slug = ctx_row.get("org_slug") if ctx_row else None
    regulatory_hooks_raw = ctx_row.get("regulatory_hooks") if ctx_row else None
    regulatory_hooks = _parse_json_field(regulatory_hooks_raw, [])

    return {
        "context_id": context_id,
        "context_name": plain_name,
        "version_id": str(ver["id"]),
        "version": int(ver.get("version", 1)),
        "content": rendered,
        "metadata": {
            "classification": classification,
            "owner": owner,
            "hash": governance_hash,
            "hash_type": "sha256",
            "org_id": org_id,
            "org_name": org_name,
            "org_slug": org_slug,
            "regulatory_hooks": regulatory_hooks,
        },
    }
