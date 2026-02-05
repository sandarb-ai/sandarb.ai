"""Agents service (port of lib/agents + lib/agents-pg)."""

import json
import uuid
from typing import Any

from backend.db import query, query_one, execute, parse_json_array
from backend.schemas.agents import RegisteredAgent, RegisteredAgentCreate, RegisteredAgentUpdate
from backend.services.organizations import get_root_organization


def _row_to_agent(row: dict) -> RegisteredAgent:
    def arr(v: Any) -> list[str]:
        return parse_json_array(v)

    return RegisteredAgent(
        id=str(row["id"]),
        org_id=str(row["org_id"]),
        agent_id=str(row["agent_id"]) if row.get("agent_id") else None,
        name=str(row["name"]),
        description=str(row["description"]) if row.get("description") else None,
        a2a_url=str(row["a2a_url"]),
        agent_card=row["agent_card"] if isinstance(row.get("agent_card"), dict) else (json.loads(row["agent_card"]) if row.get("agent_card") else None),
        status=row.get("status") or "active",
        approval_status=row.get("approval_status") or "draft",
        approved_by=str(row["approved_by"]) if row.get("approved_by") else None,
        approved_at=str(row["approved_at"]) if row.get("approved_at") else None,
        submitted_by=str(row["submitted_by"]) if row.get("submitted_by") else None,
        created_by=str(row["created_by"]) if row.get("created_by") else None,
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at") or row["created_at"]),
        updated_by=str(row["updated_by"]) if row.get("updated_by") else None,
        owner_team=str(row["owner_team"]) if row.get("owner_team") else None,
        tools_used=arr(row.get("tools_used")),
        allowed_data_scopes=arr(row.get("allowed_data_scopes")),
        pii_handling=bool(row.get("pii_handling")),
        regulatory_scope=arr(row.get("regulatory_scope")),
    )


def get_all_agents(org_id: str | None = None, approval_status: str | None = None) -> list[RegisteredAgent]:
    conditions = []
    params: list[Any] = []
    if org_id:
        conditions.append("org_id = %s")
        params.append(org_id)
    if approval_status:
        conditions.append("COALESCE(approval_status, 'draft') = %s")
        params.append(approval_status)
    where = " AND ".join(conditions) if conditions else "1=1"
    sql = f"SELECT * FROM agents WHERE {where} ORDER BY updated_at DESC NULLS LAST, name ASC"
    rows = query(sql, tuple(params) if params else None)
    agents = [_row_to_agent(dict(r)) for r in rows]
    if not org_id:
        root = get_root_organization()
        if root:
            root_id = root.id
            agents = [a for a in agents if a.org_id != root_id]
    return agents


def get_agent_by_id(agent_id: str) -> RegisteredAgent | None:
    row = query_one("SELECT * FROM agents WHERE id = %s", (agent_id,))
    return _row_to_agent(dict(row)) if row else None


def get_agent_by_identifier(identifier: str) -> RegisteredAgent | None:
    """Resolve agent by external identifier (agents.agent_id). Used by inject/pull APIs."""
    row = query_one("SELECT * FROM agents WHERE agent_id = %s LIMIT 1", (identifier.strip(),))
    return _row_to_agent(dict(row)) if row else None


def get_agent_count(org_id: str | None = None) -> int:
    if org_id:
        row = query_one("SELECT COUNT(*)::int AS count FROM agents WHERE org_id = %s", (org_id,))
    else:
        row = query_one("SELECT COUNT(*)::int AS count FROM agents")
    return int(row["count"] or 0) if row else 0


def get_recent_agents(limit: int = 6) -> list[RegisteredAgent]:
    rows = query("SELECT * FROM agents ORDER BY created_at DESC LIMIT %s", (limit,))
    return [_row_to_agent(dict(r)) for r in rows]


def create_agent(input: RegisteredAgentCreate) -> RegisteredAgent:
    uid = str(uuid.uuid4())
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    agent_card_json = json.dumps(input.agent_card) if input.agent_card else None
    execute(
        """INSERT INTO agents (id, org_id, agent_id, name, description, a2a_url, agent_card, status, approval_status, created_at, updated_at, tools_used, allowed_data_scopes, regulatory_scope)
         VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', 'draft', %s, %s, %s, %s, %s)""",
        (
            uid,
            input.org_id,
            input.agent_id,
            input.name,
            input.description,
            input.a2a_url,
            agent_card_json,
            now,
            now,
            json.dumps(input.tools_used or []),
            json.dumps(input.allowed_data_scopes or []),
            json.dumps(input.regulatory_scope or []),
        ),
    )
    # Re-fetch (execute doesn't return; we need to select)
    out = get_agent_by_id(uid)
    if not out:
        raise RuntimeError("Agent create failed")
    return out


def update_agent(agent_id: str, input: RegisteredAgentUpdate) -> RegisteredAgent | None:
    existing = get_agent_by_id(agent_id)
    if not existing:
        return None
    updates = []
    params: list[Any] = []
    i = 1
    if input.name is not None:
        updates.append(f"name = %s")
        params.append(input.name)
        i += 1
    if input.description is not None:
        updates.append(f"description = %s")
        params.append(input.description)
        i += 1
    if input.a2a_url is not None:
        updates.append(f"a2a_url = %s")
        params.append(input.a2a_url)
        i += 1
    if input.status is not None:
        updates.append(f"status = %s")
        params.append(input.status)
        i += 1
    if input.approval_status is not None:
        updates.append(f"approval_status = %s")
        params.append(input.approval_status)
        i += 1
    if input.approved_by is not None:
        updates.append(f"approved_by = %s")
        params.append(input.approved_by)
        i += 1
    if input.approved_at is not None:
        updates.append(f"approved_at = %s")
        params.append(input.approved_at)
        i += 1
    if input.submitted_by is not None:
        updates.append(f"submitted_by = %s")
        params.append(input.submitted_by)
        i += 1
    if input.updated_by is not None:
        updates.append(f"updated_by = %s")
        params.append(input.updated_by)
        i += 1
    if not updates:
        return existing
    from datetime import datetime
    updates.append("updated_at = %s")
    params.append(datetime.utcnow().isoformat() + "Z")
    params.append(agent_id)
    execute("UPDATE agents SET " + ", ".join(updates) + " WHERE id = %s", tuple(params))
    return get_agent_by_id(agent_id)


def delete_agent(agent_id: str) -> bool:
    existing = get_agent_by_id(agent_id)
    if not existing:
        return False
    execute("DELETE FROM agents WHERE id = %s", (agent_id,))
    return True


def approve_agent(agent_id: str, approved_by: str | None = None) -> RegisteredAgent | None:
    agent = get_agent_by_id(agent_id)
    if not agent or agent.approval_status != "pending_approval":
        return None
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    by = (approved_by if approved_by and approved_by.startswith("@") else f"@{approved_by}") if approved_by else None
    return update_agent(
        agent_id,
        RegisteredAgentUpdate(approval_status="approved", approved_by=by, approved_at=now, updated_by=by),
    )


def reject_agent(agent_id: str, rejected_by: str | None = None) -> RegisteredAgent | None:
    agent = get_agent_by_id(agent_id)
    if not agent or agent.approval_status != "pending_approval":
        return None
    by = (rejected_by if rejected_by and rejected_by.startswith("@") else f"@{rejected_by}") if rejected_by else None
    return update_agent(
        agent_id,
        RegisteredAgentUpdate(approval_status="rejected", updated_by=by),
    )
