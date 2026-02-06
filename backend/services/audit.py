"""Audit service (blocked injections, lineage, A2A log)."""

import json
from backend.db import query, execute


def log_inject_success(
    agent_id: str,
    trace_id: str,
    context_id: str,
    context_name: str,
    version_id: str | None = None,
    intent: str | None = None,
    governance_hash: str | None = None,
    rendered: bool = False,
) -> None:
    """Record successful context delivery for lineage.

    Args:
        governance_hash: The SHA-256 governance hash of the context template (for rendered contexts).
        rendered: Whether the context was rendered with Jinja2 template variables.
    """
    meta = {"action_type": "INJECT_SUCCESS", "contextName": context_name, "context_id": context_id}
    if intent:
        meta["intent"] = intent
    if governance_hash:
        meta["governance_hash"] = governance_hash
        meta["hash_type"] = "sha256"
    if rendered:
        meta["rendered"] = True
    execute(
        """INSERT INTO sandarb_access_logs (agent_id, trace_id, context_id, version_id, metadata)
           VALUES (%s, %s, %s, %s, %s::jsonb)""",
        (agent_id, trace_id, context_id, version_id, json.dumps(meta)),
    )


def log_inject_denied(
    agent_id: str,
    trace_id: str,
    context_id: str,
    context_name: str,
    reason: str,
) -> None:
    """Record blocked injection for governance."""
    meta = {
        "action_type": "INJECT_DENIED",
        "contextName": context_name,
        "context_id": context_id,
        "reason": reason,
        "traceId": trace_id,
    }
    execute(
        """INSERT INTO sandarb_access_logs (agent_id, trace_id, context_id, metadata)
           VALUES (%s, %s, %s, %s::jsonb)""",
        (agent_id, trace_id, context_id, json.dumps(meta)),
    )


def log_prompt_usage(
    agent_id: str,
    trace_id: str,
    prompt_id: str,
    prompt_version_id: str,
    prompt_name: str,
    intent: str | None = None,
) -> None:
    """Record prompt pull for lineage."""
    meta = {"action_type": "PROMPT_USED", "promptName": prompt_name, "prompt_id": prompt_id}
    if intent:
        meta["intent"] = intent
    execute(
        """INSERT INTO sandarb_access_logs (agent_id, trace_id, prompt_id, prompt_version_id, metadata)
           VALUES (%s, %s, %s, %s, %s::jsonb)""",
        (agent_id, trace_id, prompt_id, prompt_version_id, json.dumps(meta)),
    )


def log_prompt_denied(agent_id: str, trace_id: str, prompt_name: str, reason: str) -> None:
    """Record blocked prompt pull."""
    meta = {"action_type": "PROMPT_DENIED", "promptName": prompt_name, "reason": reason, "traceId": trace_id}
    execute(
        """INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata)
           VALUES (%s, %s, %s::jsonb)""",
        (agent_id, trace_id, json.dumps(meta)),
    )


def log_activity(agent_id: str, trace_id: str, inputs: dict, outputs: dict) -> None:
    """Record SDK activity (inputs/outputs) in sandarb_access_logs for audit."""
    meta = {"action_type": "SDK_ACTIVITY", "inputs": inputs, "outputs": outputs}
    execute(
        """INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata)
           VALUES (%s, %s, %s::jsonb)""",
        (agent_id, trace_id, json.dumps(meta)),
    )


def get_blocked_injections(limit: int = 50, offset: int = 0) -> list[dict]:
    rows = query(
        """SELECT log_id AS id, accessed_at AS created_at,
           metadata->>'context_id' AS resource_id,
           metadata->>'contextName' AS resource_name,
           agent_id AS created_by,
           metadata AS details
           FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_DENIED'
           ORDER BY accessed_at DESC
           LIMIT %s OFFSET %s""",
        (limit, offset),
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
            "resourceId": str(d["resource_id"]) if d.get("resource_id") else None,
            "resourceName": (d.get("resource_name") or details.get("contextName") or ""),
            "createdBy": str(d["created_by"]) if d.get("created_by") else None,
            "details": {"reason": details.get("reason"), "agentId": d.get("created_by"), "traceId": details.get("traceId")},
            "createdAt": str(d.get("created_at")),
        })
    return result


def get_lineage(limit: int = 50, offset: int = 0) -> list[dict]:
    rows = query(
        """SELECT log_id AS id, agent_id, trace_id, metadata->>'context_id' AS context_id, version_id, accessed_at, metadata
           FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_SUCCESS'
           ORDER BY accessed_at DESC
           LIMIT %s OFFSET %s""",
        (limit, offset),
    )
    result = []
    for r in rows:
        d = dict(r)
        meta = d.get("metadata") or {}
        if isinstance(meta, str):
            import json
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        result.append({
            "id": str(d.get("id")),
            "type": "context_delivered",
            "resourceType": "context",
            "resourceId": str(d["context_id"]) if d.get("context_id") else None,
            "resourceName": meta.get("contextName") or "",
            "sourceAgent": str(d["agent_id"]) if d.get("agent_id") else None,
            "details": {"intent": meta.get("intent"), "sourceAgent": meta.get("sourceAgent")},
            "createdAt": str(d.get("accessed_at")),
        })
    return result


def get_a2a_log(limit: int = 200, offset: int = 0) -> list[dict]:
    rows = query(
        """SELECT log_id AS id, agent_id, trace_id, accessed_at,
           context_id, version_id, prompt_id, prompt_version_id,
           metadata->>'action_type' AS action_type,
           metadata->>'contextName' AS context_name,
           metadata->>'promptName' AS prompt_name,
           metadata->>'reason' AS reason,
           metadata->>'intent' AS intent,
           metadata->>'method' AS method,
           metadata->>'inputSummary' AS input_summary,
           metadata->>'resultSummary' AS result_summary,
           metadata->>'error' AS error
           FROM sandarb_access_logs
           WHERE metadata->>'action_type' IN ('INJECT_SUCCESS', 'INJECT_DENIED', 'PROMPT_USED', 'INFERENCE_EVENT', 'A2A_CALL')
           ORDER BY accessed_at DESC
           LIMIT %s OFFSET %s""",
        (limit, offset),
    )
    out = []
    for r in rows:
        d = dict(r)
        out.append({
            "id": str(d.get("id")),
            "agentId": str(d["agent_id"]) if d.get("agent_id") else None,
            "traceId": str(d["trace_id"]) if d.get("trace_id") else None,
            "accessedAt": str(d.get("accessed_at")),
            "actionType": d.get("action_type") or "INJECT_SUCCESS",
            "contextName": d.get("context_name"),
            "promptName": d.get("prompt_name"),
            "reason": d.get("reason"),
            "intent": d.get("intent"),
            "method": d.get("method"),
            "inputSummary": d.get("input_summary"),
            "resultSummary": d.get("result_summary"),
            "error": d.get("error"),
        })
    return out


def get_governance_intersection_log(limit: int = 100) -> list[dict]:
    rows = query(
        """SELECT log_id AS id, agent_id, trace_id, accessed_at, metadata
           FROM sandarb_access_logs
           WHERE metadata->>'action_type' IN ('INJECT_SUCCESS', 'INFERENCE_EVENT')
           ORDER BY accessed_at DESC
           LIMIT %s""",
        (limit,),
    )
    result = []
    for r in rows:
        d = dict(r)
        meta = d.get("metadata") or {}
        if isinstance(meta, str):
            import json
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        result.append({
            "id": str(d.get("id")),
            "agentId": str(d["agent_id"]) if d.get("agent_id") else None,
            "traceId": str(d["trace_id"]) if d.get("trace_id") else None,
            "accessedAt": str(d.get("accessed_at")),
            "contextName": meta.get("contextName"),
            "promptName": meta.get("promptName"),
        })
    return result
