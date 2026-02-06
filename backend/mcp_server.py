"""
Sandarb MCP Server — built with the official mcp Python SDK.

Provides MCP tools for AI governance: contexts, prompts, lineage, and agent registration.
Mounted on FastAPI at /mcp using Streamable HTTP transport.

Configure in Claude Desktop / Cursor / mcp-remote as:
  https://agent.sandarb.ai/mcp
"""

import json
import logging
import re
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

logger = logging.getLogger(__name__)

# URL validation pattern for agent registration
VALID_URL_PATTERN = re.compile(r"^https?://[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9](:[0-9]+)?(/.*)?$")

# ---------------------------------------------------------------------------
# Create the FastMCP server instance
# ---------------------------------------------------------------------------

# DNS rebinding protection: since the MCP server is mounted inside FastAPI
# which already handles CORS and security headers, we disable the MCP SDK's
# own DNS rebinding protection to avoid false rejections when running behind
# proxies, load balancers, or in containerized environments.
_transport_security = TransportSecuritySettings(enable_dns_rebinding_protection=False)

mcp = FastMCP(
    name="sandarb-mcp",
    instructions=(
        "Sandarb AI Governance Server. "
        "Provides governed access to approved prompts and contexts, "
        "audit lineage, and agent registration. "
        "Most tools require an API key (passed via Bearer token during MCP auth) "
        "and a registered agent identity."
    ),
    stateless_http=True,
    json_response=True,
    # When mounted on FastAPI at /mcp, the mount strips the prefix so internal path must be /
    streamable_http_path="/",
    transport_security=_transport_security,
)


# ---------------------------------------------------------------------------
# Helper: resolve auth from MCP context (headers)
# ---------------------------------------------------------------------------
def _resolve_auth(api_key: str | None, source_agent: str, trace_id: str) -> tuple[dict[str, Any] | None, str | None]:
    """Verify API key and resolve agent identity. Returns (account, error_message)."""
    if not api_key:
        return None, "Missing API key. Pass Authorization: Bearer <api_key> when connecting."
    from backend.auth import verify_api_key
    account = verify_api_key(api_key)
    if not account:
        return None, "Invalid API key."
    return account, None


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def list_contexts(api_key: str, source_agent: str, trace_id: str) -> str:
    """List context names available to this agent.

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.agents import get_agent_by_identifier
    from backend.services.agent_links import list_contexts_for_agent

    agent_id_from_key = (account.get("agent_id") or "").strip()
    effective_agent = source_agent.strip() or agent_id_from_key
    if not effective_agent or not trace_id.strip():
        return json.dumps({"error": "source_agent and trace_id are required."})

    agent = get_agent_by_identifier(effective_agent)
    if not agent:
        return json.dumps({"error": "Agent not registered with Sandarb."})

    contexts = list_contexts_for_agent(agent.id)
    return json.dumps({"contexts": contexts})


@mcp.tool()
def get_context(name: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """Get approved context content by name. The agent must be linked to this context.

    Args:
        name: The context name to retrieve.
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.contexts import get_context_by_name
    from backend.services.agents import get_agent_by_identifier
    from backend.services.agent_links import is_context_linked_to_agent
    from backend.services.audit import log_inject_success, log_inject_denied

    agent_id_from_key = (account.get("agent_id") or "").strip()
    effective_agent = source_agent.strip() or agent_id_from_key
    if not effective_agent or not trace_id.strip():
        return json.dumps({"error": "source_agent and trace_id are required."})
    if not name.strip():
        return json.dumps({"error": "name is required."})

    context = get_context_by_name(name.strip())
    if not context:
        return json.dumps({"error": f"Context not found: {name}"})

    agent = get_agent_by_identifier(effective_agent)
    if not agent:
        log_inject_denied(effective_agent, trace_id.strip(), context["id"], name.strip(), "Agent not registered with Sandarb.")
        return json.dumps({"error": "Agent not registered with Sandarb."})

    if not is_context_linked_to_agent(agent.id, context["id"]):
        log_inject_denied(effective_agent, trace_id.strip(), context["id"], name.strip(), "Context is not linked to this agent.")
        return json.dumps({"error": "Context is not linked to this agent."})

    log_inject_success(effective_agent, trace_id.strip(), context["id"], context.get("name", ""))
    content = context.get("content")
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            pass
    return json.dumps({"name": context.get("name"), "content": content, "contextId": context.get("id")})


@mcp.tool()
def get_prompt(name: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """Get approved prompt content by name. The agent must be linked to this prompt.

    Args:
        name: The prompt name to retrieve.
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.prompts import get_prompt_by_name, get_current_prompt_version
    from backend.services.agents import get_agent_by_identifier
    from backend.services.agent_links import is_prompt_linked_to_agent
    from backend.services.audit import log_prompt_usage, log_prompt_denied

    agent_id_from_key = (account.get("agent_id") or "").strip()
    effective_agent = source_agent.strip() or agent_id_from_key
    if not effective_agent or not trace_id.strip():
        return json.dumps({"error": "source_agent and trace_id are required."})
    if not name.strip():
        return json.dumps({"error": "name is required."})

    prompt = get_prompt_by_name(name.strip())
    if not prompt:
        return json.dumps({"error": f"Prompt not found: {name}"})

    version = get_current_prompt_version(prompt["id"])
    if not version:
        return json.dumps({"error": f"No approved version for prompt: {name}"})

    agent = get_agent_by_identifier(effective_agent)
    if not agent:
        log_prompt_denied(effective_agent, trace_id.strip(), name.strip(), "Agent not registered with Sandarb.")
        return json.dumps({"error": "Agent not registered with Sandarb."})

    if not is_prompt_linked_to_agent(agent.id, prompt["id"]):
        log_prompt_denied(effective_agent, trace_id.strip(), name.strip(), "Prompt is not linked to this agent.")
        return json.dumps({"error": "Prompt is not linked to this agent."})

    log_prompt_usage(effective_agent, trace_id.strip(), prompt["id"], version.get("id", ""), name.strip())
    return json.dumps({
        "name": prompt.get("name"),
        "content": version.get("content", ""),
        "version": version.get("version"),
        "model": version.get("model"),
    })


@mcp.tool()
def get_lineage(api_key: str, source_agent: str, trace_id: str, limit: int = 50) -> str:
    """Get recent context delivery lineage (audit trail).

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
        limit: Maximum number of records to return (default 50, max 200).
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.audit import get_lineage as _get_lineage

    safe_limit = min(max(int(limit), 1), 200)
    rows = _get_lineage(safe_limit)
    return json.dumps({"lineage": rows})


@mcp.tool()
def register_agent(
    name: str,
    url: str,
    api_key: str,
    source_agent: str,
    trace_id: str,
    agent_id: str = "",
    description: str = "",
    owner_team: str = "",
    org_id: str = "default",
) -> str:
    """Register a new agent with Sandarb governance platform.

    Args:
        name: Display name for the agent.
        url: The agent's A2A endpoint URL (must be valid HTTP/HTTPS).
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID (for auth).
        trace_id: A unique trace ID for this request.
        agent_id: Optional unique agent identifier (defaults to name).
        description: Optional description of the agent.
        owner_team: Optional team that owns this agent.
        org_id: Organization ID (defaults to 'default').
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.agents import get_agent_by_identifier, create_agent
    from backend.services.organizations import get_root_organization
    from backend.schemas.agents import RegisteredAgentCreate
    from backend.db import query_one as _query_one

    if not name.strip() or not url.strip():
        return json.dumps({"error": "name and url are required."})

    if not VALID_URL_PATTERN.match(url.strip()):
        return json.dumps({"error": "Invalid URL format. URL must be a valid HTTP/HTTPS URL."})

    identifier = agent_id.strip() or name.strip()
    existing = get_agent_by_identifier(identifier)
    if existing:
        return json.dumps({"error": f"Agent with ID '{identifier}' already exists."})

    # Resolve org_id: use provided UUID, or fall back to root/first org
    resolved_org_id = org_id.strip() if org_id.strip() else ""
    if not resolved_org_id or resolved_org_id == "default":
        root = get_root_organization()
        if root:
            resolved_org_id = root.id
        else:
            org_row = _query_one("SELECT id FROM organizations LIMIT 1")
            resolved_org_id = str(org_row["id"]) if org_row else ""
    if not resolved_org_id:
        return json.dumps({"error": "No organization found. Create an organization first."})

    try:
        create_input = RegisteredAgentCreate(
            orgId=resolved_org_id,
            name=name.strip(),
            a2aUrl=url.strip(),
            agent_id=identifier,
            description=description.strip() or None,
            owner_team=owner_team.strip() or None,
        )
        agent = create_agent(create_input)
        return json.dumps({"success": True, "agentId": agent.agent_id, "id": agent.id})
    except Exception:
        logger.exception(f"Failed to register agent: {name}")
        return json.dumps({"error": "Failed to register agent. Please check your input and try again."})


@mcp.tool()
def validate_context(name: str, content: str) -> str:
    """Validate context content against governance rules (placeholder — always passes in this version).

    Args:
        name: The context name.
        content: The context content to validate.
    """
    return json.dumps({"approved": True, "message": "Validation not enforced in this version."})
