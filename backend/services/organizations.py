"""Organizations service (port of lib/organizations + organizations-pg)."""

import uuid
from datetime import datetime

from backend.db import query, query_one, execute
from backend.schemas.organizations import Organization, OrganizationCreate, OrganizationUpdate
from backend.services.contexts import get_context_count_by_tag


def _row_to_org(row: dict) -> Organization:
    return Organization(
        id=str(row["id"]),
        name=str(row["name"]),
        slug=str(row["slug"]),
        description=str(row["description"]) if row.get("description") else None,
        parent_id=str(row["parent_id"]) if row.get("parent_id") else None,
        is_root=bool(row.get("is_root")),
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at") or row["created_at"]),
    )


def get_root_organization() -> Organization | None:
    row = query_one(
        "SELECT * FROM organizations WHERE is_root = true OR slug = 'root' LIMIT 1"
    )
    return _row_to_org(dict(row)) if row else None


def get_organization_by_id(org_id: str) -> Organization | None:
    row = query_one("SELECT * FROM organizations WHERE id = %s", (org_id,))
    return _row_to_org(dict(row)) if row else None


def get_organization_by_slug(slug: str) -> Organization | None:
    row = query_one("SELECT * FROM organizations WHERE slug = %s", (slug,))
    return _row_to_org(dict(row)) if row else None


def get_all_organizations() -> list[Organization]:
    rows = query("SELECT * FROM organizations ORDER BY is_root DESC, name ASC")
    return [_row_to_org(dict(r)) for r in rows]


def get_child_organizations(parent_id: str) -> list[Organization]:
    rows = query("SELECT * FROM organizations WHERE parent_id = %s ORDER BY name ASC", (parent_id,))
    return [_row_to_org(dict(r)) for r in rows]


def get_organizations_tree() -> list[dict]:
    all_orgs = get_all_organizations()
    root = [o for o in all_orgs if o.is_root]
    by_parent: dict[str, list[Organization]] = {}
    for o in all_orgs:
        if not o.is_root and o.parent_id:
            by_parent.setdefault(o.parent_id, []).append(o)
    def build(org: Organization) -> dict:
        return {
            **org.model_dump(by_alias=True),
            "children": [build(c) for c in by_parent.get(org.id, [])],
        }
    return [build(o) for o in root]


def create_organization(input: OrganizationCreate) -> Organization:
    uid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    slug = input.slug or (input.name.lower().replace(" ", "-").replace(" ", "-")[:50])
    execute(
        """INSERT INTO organizations (id, name, slug, description, parent_id, is_root, created_at, updated_at)
         VALUES (%s, %s, %s, %s, %s, false, %s, %s)""",
        (uid, input.name, slug, input.description, input.parent_id, now, now),
    )
    out = get_organization_by_id(uid)
    if not out:
        raise RuntimeError("Organization create failed")
    return out


def update_organization(org_id: str, input: OrganizationUpdate) -> Organization | None:
    existing = get_organization_by_id(org_id)
    if not existing:
        return None
    updates, params = [], []
    if input.name is not None:
        updates.append("name = %s")
        params.append(input.name)
    if input.slug is not None:
        updates.append("slug = %s")
        params.append(input.slug)
    if input.description is not None:
        updates.append("description = %s")
        params.append(input.description)
    if input.parent_id is not None:
        updates.append("parent_id = %s")
        params.append(input.parent_id)
    if not updates:
        return existing
    updates.append("updated_at = %s")
    params.append(datetime.utcnow().isoformat() + "Z")
    params.append(org_id)
    execute("UPDATE organizations SET " + ", ".join(updates) + " WHERE id = %s", tuple(params))
    return get_organization_by_id(org_id)


def delete_organization(org_id: str) -> bool:
    if not get_organization_by_id(org_id):
        return False
    execute("DELETE FROM organizations WHERE id = %s", (org_id,))
    return True


def get_recent_organizations_with_counts(limit: int = 6) -> list[dict]:
    from backend.services.agents import get_agent_count
    orgs = get_all_organizations()
    non_root = sorted(
        [o for o in orgs if not o.is_root],
        key=lambda o: o.created_at,
        reverse=True,
    )[:limit]
    result = []
    for o in non_root:
        result.append({
            **o.model_dump(by_alias=True),
            "agentCount": get_agent_count(o.id),
            "contextCount": get_context_count_by_tag(o.slug),
        })
    return result
