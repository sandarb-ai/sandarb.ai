"""
Agent protocol router: Agent Card (discovery) and A2A JSON-RPC.

MCP is now served via the official mcp Python SDK (see backend/mcp_server.py),
mounted separately on FastAPI using Streamable HTTP transport at /mcp.

This module handles:
- GET / -> Agent Card (A2A discovery)
- POST /a2a -> A2A JSON-RPC
"""

import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.config import settings as config

logger = logging.getLogger(__name__)

# URL validation pattern for agent registration
VALID_URL_PATTERN = re.compile(r"^https?://[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9](:[0-9]+)?(/.*)?$")

# -----------------------------------------------------------------------------
# Agent Card (A2A discovery)
# -----------------------------------------------------------------------------

def _build_agent_card() -> dict[str, Any]:
    """Build Sandarb AI Governance Agent Card for A2A discovery."""
    base_url = (config.agent_base_url or config.agent_public_url).rstrip("/")
    return {
        "name": "Sandarb AI Governance Agent",
        "description": (
            "AI Governance platform for your AI Agents. "
            "Provides governed access to agents, organizations, prompts, contexts, "
            "audit lineage, reports, and agent registration."
        ),
        "url": f"{base_url}/a2a",
        "version": "0.2.0",
        "capabilities": {
            "streaming": False,
            "push_notifications": False,
            "state_transition_history": False,
        },
        "default_input_modes": ["application/json", "text/plain"],
        "default_output_modes": ["application/json", "text/plain"],
        "skills": [
            # Discovery
            {"id": "agent/info", "name": "Agent info", "description": "Returns Sandarb agent card", "tags": ["discovery"]},
            {"id": "skills/list", "name": "Skills list", "description": "List supported A2A skills", "tags": ["discovery"]},
            # Agents
            {"id": "list_agents", "name": "List agents", "description": "List all registered agents, optionally filtered by org or approval status", "tags": ["agents"]},
            {"id": "get_agent", "name": "Get agent", "description": "Get detailed info about a specific agent by ID", "tags": ["agents"]},
            {"id": "get_agent_contexts", "name": "Get agent contexts", "description": "List all contexts linked to a specific agent", "tags": ["agents", "context"]},
            {"id": "get_agent_prompts", "name": "Get agent prompts", "description": "List all prompts linked to a specific agent", "tags": ["agents", "prompt"]},
            {"id": "register", "name": "Register agent", "description": "Register a new agent with the governance platform", "tags": ["agents", "registry"]},
            # Organizations
            {"id": "list_organizations", "name": "List organizations", "description": "List all organizations", "tags": ["organizations"]},
            {"id": "get_organization", "name": "Get organization", "description": "Get organization details by UUID or slug", "tags": ["organizations"]},
            {"id": "get_organization_tree", "name": "Organization tree", "description": "Get the full organization hierarchy tree", "tags": ["organizations"]},
            # Contexts
            {"id": "list_contexts", "name": "List contexts", "description": "List context names available to the agent", "tags": ["context"]},
            {"id": "get_context", "name": "Get context", "description": "Get approved context by name (requires sourceAgent)", "tags": ["context"]},
            {"id": "get_context_by_id", "name": "Get context by ID", "description": "Get context details by UUID, including active version content", "tags": ["context"]},
            {"id": "get_context_revisions", "name": "Context revisions", "description": "List all revisions (versions) of a context", "tags": ["context"]},
            # Prompts
            {"id": "list_prompts", "name": "List prompts", "description": "List prompts available to the agent", "tags": ["prompt"]},
            {"id": "get_prompt", "name": "Get prompt", "description": "Get approved prompt content by name (requires sourceAgent)", "tags": ["prompt"]},
            {"id": "get_prompt_by_id", "name": "Get prompt by ID", "description": "Get prompt details by UUID, including all versions", "tags": ["prompt"]},
            {"id": "get_prompt_versions", "name": "Prompt versions", "description": "List all versions of a prompt", "tags": ["prompt"]},
            # Audit & Lineage
            {"id": "get_lineage", "name": "Get lineage", "description": "Get recent context delivery audit trail (successful deliveries)", "tags": ["audit"]},
            {"id": "get_blocked_injections", "name": "Blocked injections", "description": "Get blocked/denied context injection attempts", "tags": ["audit"]},
            {"id": "get_audit_log", "name": "Audit log", "description": "Get the full A2A audit log (inject, prompt, inference events)", "tags": ["audit"]},
            # Dashboard & Reports
            {"id": "get_dashboard", "name": "Dashboard", "description": "Get aggregated dashboard data (counts, recent activity)", "tags": ["reports"]},
            {"id": "get_reports", "name": "Reports", "description": "Get governance reports (risk, regulatory, compliance)", "tags": ["reports"]},
            # Validation
            {"id": "validate_context", "name": "Validate context", "description": "Validate context content against governance rules", "tags": ["context"]},
        ],
    }


# -----------------------------------------------------------------------------
# MCP is now served via the official mcp Python SDK (backend/mcp_server.py).
# It is mounted on the FastAPI app in main.py using Streamable HTTP transport.
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# A2A router (JSON-RPC 2.0 at POST /a2a)
# -----------------------------------------------------------------------------

a2a_router = APIRouter(prefix="/a2a", tags=["a2a"])


@a2a_router.get("")
def a2a_discovery():
    """GET /a2a returns the Agent Card (same as GET /)."""
    return _build_agent_card()


@a2a_router.post("")
async def a2a_jsonrpc(request: Request):
    """A2A JSON-RPC 2.0 endpoint. Methods: agent/info, skills/list, skills/execute."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": None},
        )
    req_id = body.get("id")
    method = body.get("method")
    params = body.get("params") or {}

    def ok(result: Any) -> JSONResponse:
        return JSONResponse(content={"jsonrpc": "2.0", "result": result, "id": req_id})

    def err(code: int, message: str) -> JSONResponse:
        return JSONResponse(
            content={"jsonrpc": "2.0", "error": {"code": code, "message": message}, "id": req_id},
        )

    if method == "agent/info":
        return ok(_build_agent_card())
    if method == "skills/list":
        card = _build_agent_card()
        return ok({"skills": card.get("skills", [])})
    if method == "skills/execute":
        skill = (params.get("skill") or params.get("skillId") or "").strip()
        inp = params.get("input") or params.get("params") or {}
        if not skill:
            return err(-32602, "skills/execute requires 'skill' and 'input'")
        # Delegate to backend services (inject, prompts, lineage, agents)
        result = await _execute_a2a_skill(request, skill, inp)
        if isinstance(result, JSONResponse):
            return result
        return ok(result)
    return err(-32601, f"Method not found: {method}")


# -----------------------------------------------------------------------------
# Helper: serialize objects to JSON-safe types
# -----------------------------------------------------------------------------

def _serialize(obj: Any) -> Any:
    """Make objects JSON-safe: convert datetimes, UUIDs, etc. to strings."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize(v) for v in obj]
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "__dict__") and not isinstance(obj, type):
        return _serialize(vars(obj))
    return obj


# -----------------------------------------------------------------------------
# A2A skill execution (all 22 skills matching MCP tools)
# -----------------------------------------------------------------------------

async def _execute_a2a_skill(request: Request, skill: str, inp: dict[str, Any]) -> Any:
    """Execute an A2A skill; returns result dict or JSONResponse on error."""
    from backend.auth import get_api_key_from_request, verify_api_key, ApiKeyExpiredError

    source_agent = (inp.get("sourceAgent") or inp.get("agentId") or request.headers.get("X-Sandarb-Agent-ID") or "").strip()
    trace_id = (inp.get("traceId") or request.headers.get("X-Sandarb-Trace-ID") or "").strip()
    api_key = get_api_key_from_request(request)

    # --- Skills that don't require auth ---
    if skill == "agent/info":
        return _build_agent_card()
    if skill == "skills/list":
        return {"skills": _build_agent_card().get("skills", [])}
    if skill == "validate_context":
        return {"approved": True, "message": "Validation not enforced in this version."}

    # --- Auth required for all other skills ---
    if not api_key:
        return JSONResponse(
            status_code=401,
            content={"jsonrpc": "2.0", "error": {"code": -32001, "message": "Missing API key. Use Authorization: Bearer <api_key>."}, "id": None},
        )
    try:
        account = verify_api_key(api_key)
    except ApiKeyExpiredError:
        return JSONResponse(
            status_code=401,
            content={"jsonrpc": "2.0", "error": {"code": -32001, "message": "API key has expired. Please generate a new key."}, "id": None},
        )
    if not account:
        return JSONResponse(
            status_code=401,
            content={"jsonrpc": "2.0", "error": {"code": -32001, "message": "Invalid API key."}, "id": None},
        )
    agent_id_from_key = (account.get("agent_id") or "").strip()
    if not source_agent:
        source_agent = agent_id_from_key
    if not source_agent or not trace_id:
        return JSONResponse(
            status_code=400,
            content={"jsonrpc": "2.0", "error": {"code": -32602, "message": "sourceAgent and traceId (or X-Sandarb-Agent-ID, X-Sandarb-Trace-ID) are required."}, "id": None},
        )

    # --- Per-skill rate limiting ---
    from backend.middleware.a2a_rate_limit import a2a_limiter, get_skill_rate_limit
    skill_limit = get_skill_rate_limit(skill)
    if skill_limit:
        rate_key = f"{api_key[:16]}:{skill}"
        allowed, retry_info = a2a_limiter.is_allowed(rate_key, skill_limit)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"jsonrpc": "2.0", "error": {"code": -32000, "message": f"Rate limit exceeded for skill '{skill}'. Limit: {retry_info}."}, "id": None},
            )

    # ----- Agents -----
    if skill == "list_agents":
        from backend.services.agents import get_all_agents
        a2a_limit = min(int(inp.get("limit", 50)), 500)
        a2a_offset = max(int(inp.get("offset", 0)), 0)
        agents, total = get_all_agents(
            org_id=(inp.get("orgId") or inp.get("org_id") or "").strip() or None,
            approval_status=(inp.get("approvalStatus") or inp.get("approval_status") or "").strip() or None,
            limit=a2a_limit,
            offset=a2a_offset,
        )
        return {"agents": _serialize(agents), "total": total, "limit": a2a_limit, "offset": a2a_offset}

    if skill == "get_agent":
        from backend.services.agents import get_agent_by_id, get_agent_by_identifier
        agent_id = (inp.get("agentId") or inp.get("agent_id") or "").strip()
        if not agent_id:
            return {"error": "get_agent requires 'agentId' in input"}
        agent = get_agent_by_id(agent_id) or get_agent_by_identifier(agent_id)
        if not agent:
            return {"error": f"Agent not found: {agent_id}"}
        return {"agent": _serialize(agent)}

    if skill == "get_agent_contexts":
        from backend.services.agents import get_agent_by_id, get_agent_by_identifier
        from backend.services.agent_links import list_contexts_for_agent
        agent_id = (inp.get("agentId") or inp.get("agent_id") or "").strip()
        if not agent_id:
            return {"error": "get_agent_contexts requires 'agentId' in input"}
        agent = get_agent_by_id(agent_id) or get_agent_by_identifier(agent_id)
        if not agent:
            return {"error": f"Agent not found: {agent_id}"}
        contexts = list_contexts_for_agent(agent.id)
        return {"agentId": agent.agent_id, "contexts": contexts}

    if skill == "get_agent_prompts":
        from backend.services.agents import get_agent_by_id, get_agent_by_identifier
        from backend.services.agent_links import list_prompts_for_agent
        agent_id = (inp.get("agentId") or inp.get("agent_id") or "").strip()
        if not agent_id:
            return {"error": "get_agent_prompts requires 'agentId' in input"}
        agent = get_agent_by_id(agent_id) or get_agent_by_identifier(agent_id)
        if not agent:
            return {"error": f"Agent not found: {agent_id}"}
        prompts = list_prompts_for_agent(agent.id)
        return {"agentId": agent.agent_id, "prompts": prompts}

    if skill == "register":
        from backend.services.agents import get_agent_by_identifier, create_agent
        from backend.services.organizations import get_root_organization
        from backend.schemas.agents import RegisteredAgentCreate
        from backend.db import query_one as _query_one
        agent_id = (inp.get("agent_id") or inp.get("agentId") or "").strip()
        name = (inp.get("name") or "").strip()
        url = (inp.get("url") or "").strip()
        owner_team = (inp.get("owner_team") or inp.get("ownerTeam") or "").strip()
        org_id = (inp.get("orgId") or inp.get("org_id") or "").strip()
        if not name or not url:
            return {"error": "register requires name and url in input"}
        if not VALID_URL_PATTERN.match(url):
            return {"error": "Invalid URL format. URL must be a valid HTTP/HTTPS URL."}
        identifier = agent_id or name
        existing = get_agent_by_identifier(identifier)
        if existing:
            return {"error": f"Agent with ID '{identifier}' already exists."}
        # Resolve org_id
        resolved_org_id = org_id
        if not resolved_org_id or resolved_org_id == "default":
            root = get_root_organization()
            if root:
                resolved_org_id = root.id
            else:
                org_row = _query_one("SELECT id FROM organizations LIMIT 1")
                resolved_org_id = str(org_row["id"]) if org_row else ""
        if not resolved_org_id:
            return {"error": "No organization found. Create an organization first."}
        try:
            create_input = RegisteredAgentCreate(
                orgId=resolved_org_id,
                name=name,
                a2aUrl=url,
                agent_id=identifier,
                description=inp.get("description") or None,
                owner_team=owner_team or None,
            )
            agent = create_agent(create_input)
            return {"success": True, "agentId": agent.agent_id, "id": agent.id}
        except Exception:
            logger.exception(f"Failed to register agent: {name}")
            return {"error": "Failed to register agent. Please check your input and try again."}

    # ----- Organizations -----
    if skill == "list_organizations":
        from backend.services.organizations import get_all_organizations
        a2a_limit = min(int(inp.get("limit", 50)), 500)
        a2a_offset = max(int(inp.get("offset", 0)), 0)
        orgs, total = get_all_organizations(limit=a2a_limit, offset=a2a_offset)
        return {"organizations": _serialize(orgs), "total": total, "limit": a2a_limit, "offset": a2a_offset}

    if skill == "get_organization":
        from backend.services.organizations import get_organization_by_id, get_organization_by_slug
        org_id = (inp.get("orgId") or inp.get("org_id") or "").strip()
        if not org_id:
            return {"error": "get_organization requires 'orgId' in input"}
        org = get_organization_by_id(org_id) or get_organization_by_slug(org_id)
        if not org:
            return {"error": f"Organization not found: {org_id}"}
        return {"organization": _serialize(org)}

    if skill == "get_organization_tree":
        from backend.services.organizations import get_organizations_tree
        tree = get_organizations_tree()
        return {"tree": _serialize(tree)}

    # ----- Contexts -----
    if skill == "list_contexts":
        from backend.services.agents import get_agent_by_identifier
        from backend.services.agent_links import list_contexts_for_agent
        agent = get_agent_by_identifier(source_agent)
        if not agent:
            return {"error": "Agent not registered with Sandarb."}
        contexts = list_contexts_for_agent(agent.id)
        return {"contexts": contexts}

    if skill == "get_context":
        from backend.services.contexts import get_context_by_name
        from backend.services.agents import get_agent_by_identifier
        from backend.services.agent_links import is_context_linked_to_agent
        from backend.services.audit import log_inject_success, log_inject_denied
        name = (inp.get("name") or "").strip()
        if not name:
            return {"error": "get_context requires 'name' in input"}
        context = get_context_by_name(name)
        if not context:
            return {"error": f"Context not found: {name}"}
        agent = get_agent_by_identifier(source_agent)
        if not agent:
            log_inject_denied(source_agent, trace_id, context["id"], name, "Agent not registered with Sandarb.")
            return {"error": "Agent not registered with Sandarb."}
        if not is_context_linked_to_agent(agent.id, context["id"]):
            log_inject_denied(source_agent, trace_id, context["id"], name, "Context is not linked to this agent.")
            return {"error": "Context is not linked to this agent."}
        log_inject_success(source_agent, trace_id, context["id"], context.get("name", ""))
        content = context.get("content")
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except Exception:
                pass
        return {"name": context.get("name"), "content": content, "contextId": context.get("id")}

    if skill == "get_context_by_id":
        from backend.services.contexts import get_context_by_id as _get_context_by_id
        context_id = (inp.get("contextId") or inp.get("context_id") or "").strip()
        if not context_id:
            return {"error": "get_context_by_id requires 'contextId' in input"}
        context = _get_context_by_id(context_id)
        if not context:
            return {"error": f"Context not found: {context_id}"}
        return {"context": _serialize(context)}

    if skill == "get_context_revisions":
        from backend.services.contexts import get_context_revisions as _get_context_revisions
        context_id = (inp.get("contextId") or inp.get("context_id") or "").strip()
        if not context_id:
            return {"error": "get_context_revisions requires 'contextId' in input"}
        revisions = _get_context_revisions(context_id)
        return {"contextId": context_id, "revisions": _serialize(revisions)}

    # ----- Prompts -----
    if skill == "list_prompts":
        from backend.services.agents import get_agent_by_identifier
        from backend.services.agent_links import list_prompts_for_agent
        agent = get_agent_by_identifier(source_agent)
        if not agent:
            return {"error": "Agent not registered with Sandarb."}
        prompts = list_prompts_for_agent(agent.id)
        return {"prompts": prompts}

    if skill == "get_prompt":
        from backend.services.prompts import get_prompt_by_name, get_current_prompt_version
        from backend.services.agents import get_agent_by_identifier
        from backend.services.agent_links import is_prompt_linked_to_agent
        from backend.services.audit import log_prompt_usage, log_prompt_denied
        name = (inp.get("name") or "").strip()
        if not name:
            return {"error": "get_prompt requires 'name' in input"}
        prompt = get_prompt_by_name(name)
        if not prompt:
            return {"error": f"Prompt not found: {name}"}
        version = get_current_prompt_version(prompt["id"])
        if not version:
            return {"error": f"No approved version for prompt: {name}"}
        agent = get_agent_by_identifier(source_agent)
        if not agent:
            log_prompt_denied(source_agent, trace_id, name, "Agent not registered with Sandarb.")
            return {"error": "Agent not registered with Sandarb."}
        if not is_prompt_linked_to_agent(agent.id, prompt["id"]):
            log_prompt_denied(source_agent, trace_id, name, "Prompt is not linked to this agent.")
            return {"error": "Prompt is not linked to this agent."}
        log_prompt_usage(source_agent, trace_id, prompt["id"], version.get("id", ""), name)
        return {
            "name": prompt.get("name"),
            "content": version.get("content", ""),
            "version": version.get("version"),
            "model": version.get("model"),
        }

    if skill == "get_prompt_by_id":
        from backend.services.prompts import get_prompt_by_id as _get_prompt_by_id
        prompt_id = (inp.get("promptId") or inp.get("prompt_id") or "").strip()
        if not prompt_id:
            return {"error": "get_prompt_by_id requires 'promptId' in input"}
        prompt = _get_prompt_by_id(prompt_id)
        if not prompt:
            return {"error": f"Prompt not found: {prompt_id}"}
        return {"prompt": _serialize(prompt)}

    if skill == "get_prompt_versions":
        from backend.services.prompts import get_prompt_versions as _get_prompt_versions
        prompt_id = (inp.get("promptId") or inp.get("prompt_id") or "").strip()
        if not prompt_id:
            return {"error": "get_prompt_versions requires 'promptId' in input"}
        versions = _get_prompt_versions(prompt_id)
        return {"promptId": prompt_id, "versions": _serialize(versions)}

    # ----- Audit & Lineage -----
    if skill == "get_lineage":
        from backend.services.audit import get_lineage
        a2a_limit = min(int(inp.get("limit", 50)), 200)
        a2a_offset = max(int(inp.get("offset", 0)), 0)
        rows = get_lineage(a2a_limit, a2a_offset)
        return {"lineage": _serialize(rows), "limit": a2a_limit, "offset": a2a_offset}

    if skill == "get_blocked_injections":
        from backend.services.audit import get_blocked_injections as _get_blocked
        a2a_limit = min(int(inp.get("limit", 50)), 200)
        a2a_offset = max(int(inp.get("offset", 0)), 0)
        rows = _get_blocked(a2a_limit, a2a_offset)
        return {"blocked": _serialize(rows), "limit": a2a_limit, "offset": a2a_offset}

    if skill == "get_audit_log":
        from backend.services.audit import get_a2a_log
        a2a_limit = min(int(inp.get("limit", 100)), 500)
        a2a_offset = max(int(inp.get("offset", 0)), 0)
        rows = get_a2a_log(a2a_limit, a2a_offset)
        return {"auditLog": _serialize(rows), "limit": a2a_limit, "offset": a2a_offset}

    # ----- Dashboard & Reports -----
    if skill == "get_dashboard":
        from backend.services.dashboard import get_dashboard_data
        data = get_dashboard_data()
        return {"dashboard": _serialize(data)}

    if skill == "get_reports":
        from backend.services.reports import get_all_reports
        reports = get_all_reports()
        return {"reports": _serialize(reports)}

    return {"error": f"Unknown skill: {skill}"}


# -----------------------------------------------------------------------------
# Agent protocol router (root: GET /, and includes /a2a)
# -----------------------------------------------------------------------------

router = APIRouter(tags=["agent-protocol"])


@router.get("/")
def agent_card_root():
    """GET / returns the Agent Card (A2A discovery). Used when hitting https://agent.sandarb.ai."""
    return _build_agent_card()


router.include_router(a2a_router)
