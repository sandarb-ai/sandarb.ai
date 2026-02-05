"""Agent–Context and Agent–Prompt links: governance serves prompt/context by linking to the calling agent."""

from backend.db import query_one, execute, query


def is_context_linked_to_agent(agent_uuid: str, context_id: str) -> bool:
    """True if this agent is allowed to pull this context (link exists in agent_contexts)."""
    row = query_one(
        "SELECT 1 FROM agent_contexts WHERE agent_id = %s AND context_id = %s",
        (agent_uuid, context_id),
    )
    return row is not None


def is_prompt_linked_to_agent(agent_uuid: str, prompt_id: str) -> bool:
    """True if this agent is allowed to pull this prompt (link exists in agent_prompts)."""
    row = query_one(
        "SELECT 1 FROM agent_prompts WHERE agent_id = %s AND prompt_id = %s",
        (agent_uuid, prompt_id),
    )
    return row is not None


def list_context_ids_for_agent(agent_uuid: str) -> list[str]:
    """Context IDs linked to this agent."""
    rows = query(
        "SELECT context_id FROM agent_contexts WHERE agent_id = %s ORDER BY created_at",
        (agent_uuid,),
    )
    return [str(r["context_id"]) for r in rows]


def list_contexts_for_agent(agent_uuid: str) -> list[dict]:
    """Contexts linked to this agent (id, name)."""
    rows = query(
        """SELECT c.id, c.name FROM contexts c
           JOIN agent_contexts ac ON ac.context_id = c.id
           WHERE ac.agent_id = %s ORDER BY c.name""",
        (agent_uuid,),
    )
    return [{"id": str(r["id"]), "name": r["name"]} for r in rows]


def list_prompt_ids_for_agent(agent_uuid: str) -> list[str]:
    """Prompt IDs linked to this agent."""
    rows = query(
        "SELECT prompt_id FROM agent_prompts WHERE agent_id = %s ORDER BY created_at",
        (agent_uuid,),
    )
    return [str(r["prompt_id"]) for r in rows]


def list_prompts_for_agent(agent_uuid: str) -> list[dict]:
    """Prompts linked to this agent (id, name)."""
    rows = query(
        """SELECT p.id, p.name FROM prompts p
           JOIN agent_prompts ap ON ap.prompt_id = p.id
           WHERE ap.agent_id = %s ORDER BY p.name""",
        (agent_uuid,),
    )
    return [{"id": str(r["id"]), "name": r["name"]} for r in rows]


def list_agents_for_prompt(prompt_id: str) -> list[dict]:
    """Agents linked to this prompt (id, name)."""
    rows = query(
        """SELECT a.id, a.name FROM agents a
           JOIN agent_prompts ap ON ap.agent_id = a.id
           WHERE ap.prompt_id = %s ORDER BY a.name""",
        (prompt_id,),
    )
    return [{"id": str(r["id"]), "name": r["name"]} for r in rows]


def list_agents_for_context(context_id: str) -> list[dict]:
    """Agents linked to this context (id, name)."""
    rows = query(
        """SELECT a.id, a.name FROM agents a
           JOIN agent_contexts ac ON ac.agent_id = a.id
           WHERE ac.context_id = %s ORDER BY a.name""",
        (context_id,),
    )
    return [{"id": str(r["id"]), "name": r["name"]} for r in rows]


def list_agents_for_prompt(prompt_id: str) -> list[dict]:
    """Agents linked to this prompt (id, name, agentId for display)."""
    rows = query(
        """SELECT a.id, a.name, a.agent_id
           FROM agents a
           INNER JOIN agent_prompts ap ON ap.agent_id = a.id
           WHERE ap.prompt_id = %s
           ORDER BY a.name""",
        (prompt_id,),
    )
    return [
        {"id": str(r["id"]), "name": str(r["name"] or ""), "agentId": str(r["agent_id"]) if r.get("agent_id") else None}
        for r in rows
    ]


def list_agents_for_context(context_id: str) -> list[dict]:
    """Agents linked to this context (id, name, agentId for display)."""
    rows = query(
        """SELECT a.id, a.name, a.agent_id
           FROM agents a
           INNER JOIN agent_contexts ac ON ac.agent_id = a.id
           WHERE ac.context_id = %s
           ORDER BY a.name""",
        (context_id,),
    )
    return [
        {"id": str(r["id"]), "name": str(r["name"] or ""), "agentId": str(r["agent_id"]) if r.get("agent_id") else None}
        for r in rows
    ]


def link_context_to_agent(agent_uuid: str, context_id: str) -> bool:
    """Add link so this agent can pull this context. Idempotent."""
    try:
        execute(
            """INSERT INTO agent_contexts (agent_id, context_id)
               VALUES (%s, %s) ON CONFLICT (agent_id, context_id) DO NOTHING""",
            (agent_uuid, context_id),
        )
        return True
    except Exception:
        return False


def link_prompt_to_agent(agent_uuid: str, prompt_id: str) -> bool:
    """Add link so this agent can pull this prompt. Idempotent."""
    try:
        execute(
            """INSERT INTO agent_prompts (agent_id, prompt_id)
               VALUES (%s, %s) ON CONFLICT (agent_id, prompt_id) DO NOTHING""",
            (agent_uuid, prompt_id),
        )
        return True
    except Exception:
        return False


def unlink_context_from_agent(agent_uuid: str, context_id: str) -> bool:
    """Remove link."""
    execute(
        "DELETE FROM agent_contexts WHERE agent_id = %s AND context_id = %s",
        (agent_uuid, context_id),
    )
    return True


def unlink_prompt_from_agent(agent_uuid: str, prompt_id: str) -> bool:
    """Remove link."""
    execute(
        "DELETE FROM agent_prompts WHERE agent_id = %s AND prompt_id = %s",
        (agent_uuid, prompt_id),
    )
    return True
