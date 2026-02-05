"""
Agent protocol router: Agent Card (discovery), MCP JSON-RPC, and A2A JSON-RPC.

Mounted at root when running as the Sandarb Agent service (agent.sandarb.ai).
- GET / -> Agent Card (A2A discovery)
- POST /mcp -> MCP JSON-RPC
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
        "description": "Approved prompts and context, audit trail, lineage, and agent registry. Skills: get_context, validate_context, get_lineage, get_prompt, register.",
        "url": f"{base_url}/a2a",
        "version": "0.1.0",
        "capabilities": {
            "streaming": False,
            "push_notifications": False,
            "state_transition_history": False,
        },
        "default_input_modes": ["application/json", "text/plain"],
        "default_output_modes": ["application/json", "text/plain"],
        "skills": [
            {"id": "list_contexts", "name": "List contexts", "description": "List available context names", "tags": ["context"]},
            {"id": "get_context", "name": "Get context", "description": "Get approved context by name (requires sourceAgent)", "tags": ["context"]},
            {"id": "get_prompt", "name": "Get prompt", "description": "Get prompt content by name with optional variables", "tags": ["prompt"]},
            {"id": "validate_context", "name": "Validate context", "description": "Validate context content", "tags": ["context"]},
            {"id": "get_lineage", "name": "Get lineage", "description": "Recent context deliveries", "tags": ["audit"]},
            {"id": "register", "name": "Register", "description": "Register an agent (manifest)", "tags": ["registry"]},
            {"id": "agent/info", "name": "Agent info", "description": "Returns Sandarb agent card", "tags": ["discovery"]},
            {"id": "skills/list", "name": "Skills list", "description": "List supported A2A skills", "tags": ["discovery"]},
        ],
    }


# -----------------------------------------------------------------------------
# MCP router (JSON-RPC 2.0 at POST /mcp)
# -----------------------------------------------------------------------------

mcp_router = APIRouter(prefix="/mcp", tags=["mcp"])


@mcp_router.post("")
async def mcp_jsonrpc(request: Request):
    """MCP JSON-RPC 2.0 endpoint. Configure in Claude Desktop / Cursor as https://agent.sandarb.ai/mcp."""
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

    if method == "initialize":
        return ok({
            "protocolVersion": "2024-11-05",
            "capabilities": {"resources": {}, "tools": {}, "prompts": {}},
            "serverInfo": {"name": "sandarb-mcp", "version": "0.1.0"},
        })
    if method == "resources/list":
        return ok({"resources": []})
    if method == "resources/read":
        return err(-32602, "Sandarb MCP: resources/read not implemented")
    if method == "tools/list":
        return ok({"tools": []})
    if method == "tools/call":
        return err(-32602, "Sandarb MCP: tools/call not implemented")
    if method == "prompts/list":
        return ok({"prompts": []})
    if method == "prompts/get":
        return err(-32602, "Sandarb MCP: prompts/get not implemented")
    return err(-32601, f"Method not found: {method}")


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


async def _execute_a2a_skill(request: Request, skill: str, inp: dict[str, Any]) -> Any:
    """Execute an A2A skill; returns result dict or JSONResponse on error."""
    from backend.auth import get_api_key_from_request, verify_api_key
    from backend.services.contexts import get_context_by_name, get_context_by_id
    from backend.services.prompts import get_prompt_by_name, get_current_prompt_version
    from backend.services.agents import get_agent_by_identifier
    from backend.services.agent_links import is_context_linked_to_agent, is_prompt_linked_to_agent
    from backend.services.audit import log_inject_success, log_inject_denied, log_prompt_usage, log_prompt_denied
    from backend.services.audit import get_lineage
    from backend.services.agents import create_agent
    from backend.schemas.agents import RegisteredAgentCreate

    source_agent = (inp.get("sourceAgent") or inp.get("agentId") or request.headers.get("X-Sandarb-Agent-ID") or "").strip()
    trace_id = (inp.get("traceId") or request.headers.get("X-Sandarb-Trace-ID") or "").strip()
    api_key = get_api_key_from_request(request)
    if not api_key:
        return JSONResponse(
            status_code=401,
            content={"jsonrpc": "2.0", "error": {"code": -32001, "message": "Missing API key. Use Authorization: Bearer <api_key>."}, "id": None},
        )
    account = verify_api_key(api_key)
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

    if skill == "agent/info":
        return _build_agent_card()
    if skill == "skills/list":
        return {"skills": _build_agent_card().get("skills", [])}

    if skill == "get_context":
        name = (inp.get("name") or "").strip()
        if not name:
            return {"error": "get_context requires 'name' in input"}
        context = get_context_by_name(name)
        if not context:
            return {"error": f"Context not found: {name}"}
        agent = get_agent_by_identifier(source_agent)
        if not agent:
            log_inject_denied(source_agent, trace_id, name, "Agent not registered with Sandarb.")
            return {"error": "Agent not registered with Sandarb."}
        if not is_context_linked_to_agent(agent.id, context["id"]):
            log_inject_denied(source_agent, trace_id, name, "Context is not linked to this agent.")
            return {"error": "Context is not linked to this agent."}
        log_inject_success(source_agent, trace_id, context["id"], context.get("name", ""))
        content = context.get("content")
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except Exception:
                pass
        return {"name": context.get("name"), "content": content, "contextId": context.get("id")}

    if skill == "get_prompt":
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

    if skill == "get_lineage":
        limit = min(int(inp.get("limit", 50)), 200)
        rows = get_lineage(limit)
        return {"lineage": rows}

    if skill == "list_contexts":
        from backend.services.agent_links import list_contexts_for_agent
        agent = get_agent_by_identifier(source_agent)
        if not agent:
            return {"error": "Agent not registered with Sandarb."}
        contexts = list_contexts_for_agent(agent.id)
        return {"contexts": contexts}

    if skill == "validate_context":
        # Minimal: accept name + content, return approved
        return {"approved": True, "message": "Validation not enforced in this version."}

    if skill == "register":
        # Register agent from manifest
        agent_id = (inp.get("agent_id") or inp.get("agentId") or "").strip()
        name = (inp.get("name") or "").strip()
        version = (inp.get("version") or "").strip()
        url = (inp.get("url") or "").strip()
        owner_team = (inp.get("owner_team") or inp.get("ownerTeam") or "").strip()
        org_id = (inp.get("orgId") or inp.get("org_id") or "").strip()
        if not name or not url:
            return {"error": "register requires name and url in input"}

        # Validate URL format to prevent malicious URLs
        if not VALID_URL_PATTERN.match(url):
            return {"error": "Invalid URL format. URL must be a valid HTTP/HTTPS URL."}

        # Check for duplicate agent_id
        existing = get_agent_by_identifier(agent_id or name)
        if existing:
            return {"error": f"Agent with ID '{agent_id or name}' already exists."}

        try:
            create_input = RegisteredAgentCreate(
                orgId=org_id or "default",
                name=name,
                a2aUrl=url,
                agent_id=agent_id or name,
                description=inp.get("description") or None,
                owner_team=owner_team or None,
            )
            agent = create_agent(create_input)
            return {"success": True, "agentId": agent.agent_id, "id": agent.id}
        except Exception as e:
            # Log full error server-side, return sanitized message to client
            logger.exception(f"Failed to register agent: {name}")
            return {"error": "Failed to register agent. Please check your input and try again."}

    return {"error": f"Unknown skill: {skill}"}


# -----------------------------------------------------------------------------
# Agent protocol router (root: GET /, and includes /mcp, /a2a)
# -----------------------------------------------------------------------------

router = APIRouter(tags=["agent-protocol"])


@router.get("/")
def agent_card_root():
    """GET / returns the Agent Card (A2A discovery). Used when hitting https://agent.sandarb.ai."""
    return _build_agent_card()


router.include_router(mcp_router)
router.include_router(a2a_router)
