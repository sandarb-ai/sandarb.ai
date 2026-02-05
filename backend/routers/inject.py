"""Inject API: serve context to agents by name/id. Access gated by agent–context linking."""

import json
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import Response

from backend.db import query_one
from backend.schemas.common import ApiResponse
from backend.services.contexts import get_context_by_id, get_context_by_name, get_latest_approved_version_id
from backend.services.agents import get_agent_by_identifier
from backend.services.agent_links import is_context_linked_to_agent
from backend.services.audit import log_inject_success, log_inject_denied

router = APIRouter(tags=["inject"])
PREVIEW_AGENT_ID = "sandarb-context-preview"


def _get_audit_ids(request: Request, agent_id: str | None = None, trace_id: str | None = None) -> tuple[str | None, str | None]:
    agent = request.headers.get("x-sandarb-agent-id") or request.headers.get("X-Sandarb-Agent-ID") or agent_id
    trace = request.headers.get("x-sandarb-trace-id") or request.headers.get("X-Sandarb-Trace-ID") or trace_id
    return (agent.strip() if agent else None, trace.strip() if trace else None)


def _format_content(content: dict, fmt: str) -> str:
    if fmt == "json":
        return json.dumps(content, indent=2)
    if fmt == "yaml":
        try:
            import yaml
            return yaml.dump(content, default_flow_style=False, allow_unicode=True)
        except Exception:
            return json.dumps(content)
    return json.dumps(content)


@router.get("/inject")
def get_inject(
    request: Request,
    name: str | None = Query(None, description="Context name"),
    id: str | None = Query(None, alias="id", description="Context UUID"),
    format: str = Query("json", description="json, yaml, or text"),
    agentId: str | None = Query(None),
    traceId: str | None = Query(None),
):
    """Get context for injection. Requires X-Sandarb-Agent-ID and X-Sandarb-Trace-ID. Context is returned only if linked to the calling agent (agent_contexts)."""
    agent_id_header, trace_id_header = _get_audit_ids(request, agentId, traceId)
    if not agent_id_header or not trace_id_header:
        raise HTTPException(
            status_code=400,
            detail="Auditable injection requires X-Sandarb-Agent-ID and X-Sandarb-Trace-ID (headers or query agentId/traceId).",
        )
    if format not in ("json", "yaml", "text"):
        raise HTTPException(status_code=400, detail="Invalid format. Use json, yaml, or text.")

    if id:
        context = get_context_by_id(id)
    elif name:
        context = get_context_by_name(name)
    else:
        raise HTTPException(status_code=400, detail="Either id or name parameter is required.")

    if not context:
        raise HTTPException(status_code=404, detail="Context not found.")
    if not context.get("isActive", True):
        raise HTTPException(status_code=403, detail="Context is inactive.")

    # Preview mode: skip registration and link check for UI "Test API"
    is_preview = agent_id_header == PREVIEW_AGENT_ID
    if not is_preview:
        agent = get_agent_by_identifier(agent_id_header)
        if not agent:
            log_inject_denied(
                agent_id_header,
                trace_id_header,
                context["id"],
                context.get("name", ""),
                "Agent not registered with Sandarb. Only registered agents may pull context.",
            )
            raise HTTPException(
                status_code=403,
                detail="Agent not registered with Sandarb. Register this agent to pull context.",
            )
        agent_dict = agent.model_dump() if hasattr(agent, "model_dump") else dict(agent)
        # Enforce agent–context linking: only linked contexts are served
        if not is_context_linked_to_agent(agent_dict["id"], context["id"]):
            log_inject_denied(
                agent_id_header,
                trace_id_header,
                context["id"],
                context.get("name", ""),
                "Context is not linked to this agent. Link the context to the agent in the Registry to allow access.",
            )
            raise HTTPException(
                status_code=403,
                detail="Context is not linked to this agent. Link the context to the agent in the Registry to allow access.",
            )

    version_id = None
    if not is_preview:
        version_id = get_latest_approved_version_id(context["id"])
        log_inject_success(
            agent_id_header,
            trace_id_header,
            context["id"],
            context.get("name", ""),
            version_id=version_id,
        )

    content = context.get("content") or {}
    # Optional variable substitution could be added here (vars query param)
    body = _format_content(content, format)
    media_type = "application/json" if format == "json" else "text/yaml" if format == "yaml" else "text/plain"
    resp_headers = {
        "X-Context-Name": context.get("name", ""),
        "X-Context-ID": context["id"],
        "X-Sandarb-Trace-ID": trace_id_header,
    }
    if not is_preview and version_id:
        resp_headers["X-Context-Version-ID"] = version_id
    return Response(content=body, media_type=media_type, headers=resp_headers)
