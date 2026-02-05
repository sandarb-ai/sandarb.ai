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


def _lob_from_owner_team(owner_team: str | None) -> str | None:
    """Map agent owner_team to line-of-business slug for policy check."""
    if not owner_team:
        return None
    slug = owner_team.lower().replace(" ", "-")
    if slug in ("retail", "retail-banking"):
        return "retail"
    if slug in ("investment_banking", "investment-banking"):
        return "investment_banking"
    if slug in ("wealth_management", "wealth-management"):
        return "wealth_management"
    return None


def _lob_from_context_lob_tag(lob_tag: str | None) -> str | None:
    if not lob_tag:
        return None
    slug = str(lob_tag).lower().replace("-", "_").replace(" ", "_")
    if "retail" in slug:
        return "retail"
    if "investment" in slug:
        return "investment_banking"
    if "wealth" in slug:
        return "wealth_management"
    return None


def _check_lob_policy(agent: dict, context: dict) -> tuple[bool, str | None]:
    """Allow only if context LOB is unset or matches agent LOB. Returns (allowed, reason)."""
    ctx_lob = _lob_from_context_lob_tag(context.get("lobTag") or context.get("lineOfBusiness"))
    if not ctx_lob:
        return True, None
    agent_lob = _lob_from_owner_team(agent.get("owner_team"))
    if not agent_lob:
        return True, None
    if agent_lob != ctx_lob:
        return False, f"Policy violation: agent LOB ({agent_lob}) does not match context LOB ({ctx_lob})."
    return True, None


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
        allowed, reason = _check_lob_policy(agent_dict, context)
        if not allowed:
            log_inject_denied(agent_id_header, trace_id_header, context["id"], context.get("name", ""), reason or "Policy violation")
            raise HTTPException(status_code=403, detail=reason or "Policy violation: cross-LOB access not allowed.")

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
    return Response(content=body, media_type=media_type, headers={
        "X-Context-Name": context.get("name", ""),
        "X-Context-ID": context["id"],
        "X-Sandarb-Trace-ID": trace_id_header,
    })
