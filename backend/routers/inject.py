"""Inject API: serve context to agents by name/id. Access gated by API key + agent–context linking.

Supports two modes:
  1. **GET /api/inject** — Legacy query-param based context fetch (returns raw content).
  2. **POST /api/inject** — Accepts an ``InjectRequest`` body with ``context_variables``
     for Jinja2-templated context rendering.  Returns rendered content with governance
     metadata (hash, version, classification) as proof of delivery.

Sandarb Resource Name (SRN) conventions (inspired by URNs — Uniform Resource Names):
  - Agent:   ``agent.{kebab-case-name}``   e.g. ``agent.retail-banking-finance-bot``
  - Prompt:  ``prompt.{kebab-case-name}``   e.g. ``prompt.asia-pacific-fraud-detection-playbook``
  - Context: ``context.{kebab-case-name}``  e.g. ``context.eu-refund-policy``
"""

import json
from fastapi import APIRouter, Request, Query, HTTPException, Body
from fastapi.responses import Response

from backend.auth import require_api_key_and_agent
from backend.services.contexts import (
    get_context_by_id,
    get_context_by_name,
    get_latest_approved_version_id,
    get_rendered_context,
)
from backend.services.agents import get_agent_by_identifier
from backend.services.agent_links import is_context_linked_to_agent
from backend.services.audit import log_inject_success, log_inject_denied
from backend.schemas.common import InjectRequest, ApiResponse

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


def _strip_srn_prefix(name: str, prefix: str) -> str:
    """Strip an SRN prefix (e.g. 'context.', 'prompt.', 'agent.') from a name."""
    if name.startswith(prefix):
        return name[len(prefix):]
    return name


@router.get("/inject")
def get_inject(
    request: Request,
    name: str | None = Query(None, description="Context name"),
    id: str | None = Query(None, alias="id", description="Context UUID"),
    format: str = Query("json", description="json, yaml, or text"),
    agentId: str | None = Query(None),
    traceId: str | None = Query(None),
):
    """Get context for injection (legacy query-param mode). Requires API key (Bearer or X-API-Key) and X-Sandarb-Agent-ID / X-Sandarb-Trace-ID. Agent ID must match the key's linked agent (no header trust). Context is returned only if linked to that agent."""
    agent_id_header, trace_id_header = _get_audit_ids(request, agentId, traceId)
    _account, agent_id_header, trace_id_header = require_api_key_and_agent(
        request, agent_id_header, trace_id_header, allow_preview_for_client_id="sandarb-ui"
    )
    if format not in ("json", "yaml", "text"):
        raise HTTPException(status_code=400, detail="Invalid format. Use json, yaml, or text.")

    if id:
        context = get_context_by_id(id)
    elif name:
        context = get_context_by_name(_strip_srn_prefix(name, "context."))
    else:
        raise HTTPException(status_code=400, detail="Either id or name parameter is required.")

    if not context:
        raise HTTPException(status_code=404, detail="Context not found.")
    if not context.get("isActive", True):
        raise HTTPException(status_code=403, detail="Context is inactive.")

    # Preview mode: only allowed by require_api_key_and_agent when dev or sandarb-ui key
    is_preview = agent_id_header == PREVIEW_AGENT_ID
    if not is_preview:
        agent = get_agent_by_identifier(_strip_srn_prefix(agent_id_header, "agent."))
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
    if isinstance(content, str):
        body = content
    else:
        body = _format_content(content, format)
    media_type = "application/json" if format == "json" else "text/yaml" if format == "yaml" else "text/plain"
    resp_headers = {
        "X-Context-Name": context.get("name", ""),
        "X-Context-ID": context["id"],
        "X-Sandarb-Trace-ID": trace_id_header,
    }
    # Include governance metadata headers (org, classification, regulatory hooks)
    if context.get("dataClassification"):
        resp_headers["X-Data-Classification"] = str(context["dataClassification"])
    if context.get("orgId"):
        resp_headers["X-Org-ID"] = str(context["orgId"])
    org = context.get("organization")
    if org and isinstance(org, dict) and org.get("name"):
        resp_headers["X-Org-Name"] = str(org["name"])
    hooks = context.get("regulatoryHooks")
    if hooks and isinstance(hooks, list) and len(hooks) > 0:
        resp_headers["X-Regulatory-Hooks"] = ",".join(str(h) for h in hooks)
    if not is_preview and version_id:
        resp_headers["X-Context-Version-ID"] = version_id
    return Response(content=body, media_type=media_type, headers=resp_headers)


@router.post("/inject", response_model=ApiResponse)
def post_inject(
    request: Request,
    body: InjectRequest = Body(...),
):
    """Inject context with Jinja2 template rendering.

    Accepts an ``InjectRequest`` body with ``context_variables`` — a dict mapping
    context SRNs (e.g. ``context.eu-refund-policy``) to their template variables.
    Sandarb renders each context template, returns the fully resolved content,
    and logs an audit trail with governance metadata (hash, version, classification).

    **SRN conventions:**
      - Agent:   ``agent.{kebab-case-name}``
      - Prompt:  ``prompt.{kebab-case-name}``
      - Context: ``context.{kebab-case-name}``

    **Example request:**

    .. code-block:: json

        {
            "agent_id": "agent.service-account-refund-bot",
            "prompt_key": "prompt.refund-main-prompt",
            "context_variables": {
                "context.eu-refund-policy": {
                    "region": "EU",
                    "current_date": "2026-02-06",
                    "currency": "EUR",
                    "compliance_code": "GDPR-22"
                }
            }
        }
    """
    # --- Auth: resolve agent from API key ---
    agent_id_raw = body.agent_id
    trace_id_raw = body.trace_id
    agent_id_header, trace_id_header = _get_audit_ids(request, agent_id_raw, trace_id_raw)
    _account, agent_id_header, trace_id_header = require_api_key_and_agent(
        request, agent_id_header, trace_id_header, allow_preview_for_client_id="sandarb-ui"
    )

    is_preview = agent_id_header == PREVIEW_AGENT_ID
    agent_identifier = _strip_srn_prefix(agent_id_header, "agent.")

    # Verify agent registration (unless preview)
    agent_record = None
    if not is_preview:
        agent_record = get_agent_by_identifier(agent_identifier)
        if not agent_record:
            raise HTTPException(
                status_code=403,
                detail=f"Agent '{agent_id_header}' not registered with Sandarb. Register this agent first.",
            )

    if not body.context_variables:
        raise HTTPException(status_code=400, detail="context_variables is required for POST /api/inject.")

    # --- Render each context ---
    rendered_contexts: dict = {}
    for context_srn, variables in body.context_variables.items():
        plain_name = _strip_srn_prefix(context_srn, "context.")

        # Verify context exists
        ctx = get_context_by_name(plain_name)
        if not ctx:
            raise HTTPException(status_code=404, detail=f"Context not found: {context_srn}")
        if not ctx.get("isActive", True):
            raise HTTPException(status_code=403, detail=f"Context is inactive: {context_srn}")

        # Enforce agent–context linking (unless preview)
        if not is_preview and agent_record:
            agent_dict = agent_record.model_dump() if hasattr(agent_record, "model_dump") else dict(agent_record)
            if not is_context_linked_to_agent(agent_dict["id"], ctx["id"]):
                log_inject_denied(
                    agent_id_header,
                    trace_id_header,
                    ctx["id"],
                    plain_name,
                    "Context is not linked to this agent.",
                )
                raise HTTPException(
                    status_code=403,
                    detail=f"Context '{context_srn}' is not linked to agent '{agent_id_header}'. Link it in the Registry.",
                )

        # Render the context with variables
        result = get_rendered_context(plain_name, variables)
        if not result:
            raise HTTPException(status_code=404, detail=f"No approved version found for context: {context_srn}")

        # Log successful injection for audit lineage (with governance metadata)
        if not is_preview:
            log_inject_success(
                agent_id_header,
                trace_id_header,
                ctx["id"],
                plain_name,
                version_id=result["version_id"],
                governance_hash=result["metadata"]["hash"],
                rendered=bool(variables),
            )

        rendered_contexts[context_srn] = {
            "context_id": result["context_id"],
            "version_id": result["version_id"],
            "version": result["version"],
            "content": result["content"],
            "metadata": result["metadata"],
        }

    # --- Optionally pull prompt ---
    prompt_data = None
    if body.prompt_key:
        prompt_name = _strip_srn_prefix(body.prompt_key, "prompt.")
        from backend.services.prompts import get_prompt_by_name, get_current_prompt_version
        from backend.services.agent_links import is_prompt_linked_to_agent
        from backend.services.audit import log_prompt_usage, log_prompt_denied

        prompt = get_prompt_by_name(prompt_name)
        if not prompt:
            raise HTTPException(status_code=404, detail=f"Prompt not found: {body.prompt_key}")

        version = get_current_prompt_version(prompt["id"])
        if not version:
            raise HTTPException(status_code=404, detail=f"No approved version for prompt: {body.prompt_key}")

        if not is_preview and agent_record:
            agent_dict = agent_record.model_dump() if hasattr(agent_record, "model_dump") else dict(agent_record)
            if not is_prompt_linked_to_agent(agent_dict["id"], prompt["id"]):
                log_prompt_denied(agent_id_header, trace_id_header, prompt_name, "Prompt is not linked to this agent.")
                raise HTTPException(
                    status_code=403,
                    detail=f"Prompt '{body.prompt_key}' is not linked to agent '{agent_id_header}'.",
                )
            log_prompt_usage(agent_id_header, trace_id_header, prompt["id"], version.get("id", ""), prompt_name)

        prompt_data = {
            "name": prompt["name"],
            "content": version.get("content", ""),
            "version": version.get("version"),
            "model": version.get("model"),
        }

    return ApiResponse(
        success=True,
        data={
            "agent_id": body.agent_id,
            "trace_id": trace_id_header,
            "prompt": prompt_data,
            "contexts": rendered_contexts,
        },
    )
