"""Inject API: serve context to agents by name/id. Access gated by API key + agent–context linking."""

import json
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import Response

from backend.auth import require_api_key_and_agent
from backend.services.contexts import get_context_by_id, get_context_by_name, get_latest_approved_version_id
from backend.services.agents import get_agent_by_identifier
from backend.services.agent_links import is_context_linked_to_agent
from backend.services.audit import log_inject_success, log_inject_denied

router = APIRouter(tags=["inject"])
PREVIEW_AGENT_ID = "sandarb-context-preview"


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


def _get_audit_ids(request: Request, agent_id: str | None = None, trace_id: str | None = None) -> tuple[str | None, str | None]:
    agent = request.headers.get("x-sandarb-agent-id") or request.headers.get("X-Sandarb-Agent-ID") or request.query_params.get("agentId") or agent_id
    trace = request.headers.get("x-sandarb-trace-id") or request.headers.get("X-Sandarb-Trace-ID") or request.query_params.get("traceId") or trace_id
    return (agent.strip() if agent else None, trace.strip() if trace else None)


@router.get("/inject")
def get_inject(
    request: Request,
    name: str | None = Query(None, description="Context name"),
    id: str | None = Query(None, alias="id", description="Context UUID"),
    format: str = Query("json", description="json, yaml, or text"),
    agentId: str | None = Query(None),
    traceId: str | None = Query(None),
):
    """Get context for injection. Requires API key (Bearer or X-API-Key) and X-Sandarb-Agent-ID / X-Sandarb-Trace-ID. Agent ID must match the key's linked agent (no header trust). Context is returned only if linked to that agent."""
    agent_id_header, trace_id_header = _get_audit_ids(request, agentId, traceId)
    _account, agent_id_header, trace_id_header = require_api_key_and_agent(
        request, agent_id_header, trace_id_header, allow_preview_for_client_id="sandarb-ui"
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

    # Preview mode: only allowed by require_api_key_and_agent when dev or sandarb-ui key
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
