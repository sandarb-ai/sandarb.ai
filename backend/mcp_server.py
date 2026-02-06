"""
Sandarb MCP Server — built with the official mcp Python SDK.

Provides MCP tools for AI governance: agents, organizations, contexts, prompts,
audit lineage, reports, and agent registration.
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
        "Provides governed access to agents, organizations, prompts, contexts, "
        "audit lineage, reports, and agent registration. "
        "Most tools require an API key (passed as the api_key parameter) "
        "and a registered agent identity (source_agent)."
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


def _resolve_agent(account: dict, source_agent: str, trace_id: str):
    """Resolve effective agent from account + source_agent. Returns (effective_agent_id, agent_record, error)."""
    from backend.services.agents import get_agent_by_identifier

    agent_id_from_key = (account.get("agent_id") or "").strip()
    effective_agent = source_agent.strip() or agent_id_from_key
    if not effective_agent or not trace_id.strip():
        return None, None, "source_agent and trace_id are required."

    agent = get_agent_by_identifier(effective_agent)
    if not agent:
        return effective_agent, None, "Agent not registered with Sandarb."
    return effective_agent, agent, None


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


# ---------------------------------------------------------------------------
# MCP Tools — Agents
# ---------------------------------------------------------------------------

@mcp.tool()
def list_agents(api_key: str, source_agent: str, trace_id: str, org_id: str = "", approval_status: str = "") -> str:
    """List all registered agents, optionally filtered by organization or approval status.

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
        org_id: Optional organization ID to filter by.
        approval_status: Optional filter: 'Approved', 'Pending', or 'Rejected'.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.agents import get_all_agents

    agents = get_all_agents(
        org_id=org_id.strip() or None,
        approval_status=approval_status.strip() or None,
    )
    return json.dumps({"agents": _serialize(agents)}, default=str)


@mcp.tool()
def get_agent(agent_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """Get detailed information about a specific agent by its ID.

    Args:
        agent_id: The agent identifier (agent_id or UUID).
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.agents import get_agent_by_id, get_agent_by_identifier

    agent = get_agent_by_id(agent_id.strip()) or get_agent_by_identifier(agent_id.strip())
    if not agent:
        return json.dumps({"error": f"Agent not found: {agent_id}"})

    return json.dumps({"agent": _serialize(agent)}, default=str)


@mcp.tool()
def get_agent_contexts(agent_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """List all contexts linked to a specific agent.

    Args:
        agent_id: The agent identifier (agent_id or UUID).
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.agents import get_agent_by_id, get_agent_by_identifier
    from backend.services.agent_links import list_contexts_for_agent

    agent = get_agent_by_id(agent_id.strip()) or get_agent_by_identifier(agent_id.strip())
    if not agent:
        return json.dumps({"error": f"Agent not found: {agent_id}"})

    contexts = list_contexts_for_agent(agent.id)
    return json.dumps({"agentId": agent.agent_id, "contexts": contexts}, default=str)


@mcp.tool()
def get_agent_prompts(agent_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """List all prompts linked to a specific agent.

    Args:
        agent_id: The agent identifier (agent_id or UUID).
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.agents import get_agent_by_id, get_agent_by_identifier
    from backend.services.agent_links import list_prompts_for_agent

    agent = get_agent_by_id(agent_id.strip()) or get_agent_by_identifier(agent_id.strip())
    if not agent:
        return json.dumps({"error": f"Agent not found: {agent_id}"})

    prompts = list_prompts_for_agent(agent.id)
    return json.dumps({"agentId": agent.agent_id, "prompts": prompts}, default=str)


# ---------------------------------------------------------------------------
# MCP Tools — Organizations
# ---------------------------------------------------------------------------

@mcp.tool()
def list_organizations(api_key: str, source_agent: str, trace_id: str) -> str:
    """List all organizations in the governance platform.

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.organizations import get_all_organizations

    orgs = get_all_organizations()
    return json.dumps({"organizations": _serialize(orgs)}, default=str)


@mcp.tool()
def get_organization(org_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """Get detailed information about a specific organization.

    Args:
        org_id: The organization UUID or slug.
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.organizations import get_organization_by_id, get_organization_by_slug

    org = get_organization_by_id(org_id.strip()) or get_organization_by_slug(org_id.strip())
    if not org:
        return json.dumps({"error": f"Organization not found: {org_id}"})

    return json.dumps({"organization": _serialize(org)}, default=str)


@mcp.tool()
def get_organization_tree(api_key: str, source_agent: str, trace_id: str) -> str:
    """Get the full organization hierarchy tree.

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.organizations import get_organizations_tree

    tree = get_organizations_tree()
    return json.dumps({"tree": _serialize(tree)}, default=str)


# ---------------------------------------------------------------------------
# MCP Tools — Contexts
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

    from backend.services.agent_links import list_contexts_for_agent

    _, agent, agent_err = _resolve_agent(account, source_agent, trace_id)
    if agent_err:
        return json.dumps({"error": agent_err})

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
    from backend.services.agent_links import is_context_linked_to_agent
    from backend.services.audit import log_inject_success, log_inject_denied

    effective_agent, agent, agent_err = _resolve_agent(account, source_agent, trace_id)
    if not name.strip():
        return json.dumps({"error": "name is required."})

    context = get_context_by_name(name.strip())
    if not context:
        return json.dumps({"error": f"Context not found: {name}"})

    if agent_err:
        log_inject_denied(effective_agent or source_agent, trace_id.strip(), context["id"], name.strip(), agent_err)
        return json.dumps({"error": agent_err})

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
def get_context_by_id(context_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """Get context details by UUID, including content from the active version.

    Args:
        context_id: The context UUID.
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.contexts import get_context_by_id as _get_context_by_id

    context = _get_context_by_id(context_id.strip())
    if not context:
        return json.dumps({"error": f"Context not found: {context_id}"})

    return json.dumps({"context": _serialize(context)}, default=str)


@mcp.tool()
def get_context_revisions(context_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """List all revisions (versions) of a context.

    Args:
        context_id: The context UUID.
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.contexts import get_context_revisions as _get_context_revisions

    revisions = _get_context_revisions(context_id.strip())
    return json.dumps({"contextId": context_id.strip(), "revisions": _serialize(revisions)}, default=str)


# ---------------------------------------------------------------------------
# MCP Tools — Prompts
# ---------------------------------------------------------------------------

@mcp.tool()
def list_prompts(api_key: str, source_agent: str, trace_id: str) -> str:
    """List prompts available to this agent.

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.agent_links import list_prompts_for_agent

    _, agent, agent_err = _resolve_agent(account, source_agent, trace_id)
    if agent_err:
        return json.dumps({"error": agent_err})

    prompts = list_prompts_for_agent(agent.id)
    return json.dumps({"prompts": prompts})


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
    from backend.services.agent_links import is_prompt_linked_to_agent
    from backend.services.audit import log_prompt_usage, log_prompt_denied

    effective_agent, agent, agent_err = _resolve_agent(account, source_agent, trace_id)
    if not name.strip():
        return json.dumps({"error": "name is required."})

    prompt = get_prompt_by_name(name.strip())
    if not prompt:
        return json.dumps({"error": f"Prompt not found: {name}"})

    version = get_current_prompt_version(prompt["id"])
    if not version:
        return json.dumps({"error": f"No approved version for prompt: {name}"})

    if agent_err:
        log_prompt_denied(effective_agent or source_agent, trace_id.strip(), name.strip(), agent_err)
        return json.dumps({"error": agent_err})

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
def get_prompt_by_id(prompt_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """Get prompt details by UUID, including all versions.

    Args:
        prompt_id: The prompt UUID.
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.prompts import get_prompt_by_id as _get_prompt_by_id

    prompt = _get_prompt_by_id(prompt_id.strip())
    if not prompt:
        return json.dumps({"error": f"Prompt not found: {prompt_id}"})

    return json.dumps({"prompt": _serialize(prompt)}, default=str)


@mcp.tool()
def get_prompt_versions(prompt_id: str, api_key: str, source_agent: str, trace_id: str) -> str:
    """List all versions of a prompt.

    Args:
        prompt_id: The prompt UUID.
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.prompts import get_prompt_versions as _get_prompt_versions

    versions = _get_prompt_versions(prompt_id.strip())
    return json.dumps({"promptId": prompt_id.strip(), "versions": _serialize(versions)}, default=str)


# ---------------------------------------------------------------------------
# MCP Tools — Audit & Lineage
# ---------------------------------------------------------------------------

@mcp.tool()
def get_lineage(api_key: str, source_agent: str, trace_id: str, limit: int = 50) -> str:
    """Get recent context delivery lineage (successful deliveries audit trail).

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
    return json.dumps({"lineage": _serialize(rows)}, default=str)


@mcp.tool()
def get_blocked_injections(api_key: str, source_agent: str, trace_id: str, limit: int = 50) -> str:
    """Get recent blocked/denied context injection attempts (access control violations).

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
        limit: Maximum number of records to return (default 50, max 200).
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.audit import get_blocked_injections as _get_blocked

    safe_limit = min(max(int(limit), 1), 200)
    rows = _get_blocked(safe_limit)
    return json.dumps({"blocked": _serialize(rows)}, default=str)


@mcp.tool()
def get_audit_log(api_key: str, source_agent: str, trace_id: str, limit: int = 100) -> str:
    """Get the full A2A audit log (inject, prompt, and inference events).

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
        limit: Maximum number of records to return (default 100, max 500).
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.audit import get_a2a_log

    safe_limit = min(max(int(limit), 1), 500)
    rows = get_a2a_log(safe_limit)
    return json.dumps({"auditLog": _serialize(rows)}, default=str)


# ---------------------------------------------------------------------------
# MCP Tools — Dashboard & Reports
# ---------------------------------------------------------------------------

@mcp.tool()
def get_dashboard(api_key: str, source_agent: str, trace_id: str) -> str:
    """Get aggregated dashboard data: agent/prompt/context/org counts, recent activity.

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.dashboard import get_dashboard_data

    data = get_dashboard_data()
    return json.dumps({"dashboard": _serialize(data)}, default=str)


@mcp.tool()
def get_reports(api_key: str, source_agent: str, trace_id: str) -> str:
    """Get governance reports: risk overview, regulatory compliance, and access compliance.

    Args:
        api_key: Your Sandarb API key (Bearer token).
        source_agent: Your registered agent ID.
        trace_id: A unique trace ID for this request.
    """
    account, err = _resolve_auth(api_key, source_agent, trace_id)
    if err:
        return json.dumps({"error": err})

    from backend.services.reports import get_all_reports

    reports = get_all_reports()
    return json.dumps({"reports": _serialize(reports)}, default=str)


# ---------------------------------------------------------------------------
# MCP Tools — Agent Registration (Write)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# MCP Tools — Validation (placeholder)
# ---------------------------------------------------------------------------

@mcp.tool()
def validate_context(name: str, content: str) -> str:
    """Validate context content against governance rules (placeholder — always passes in this version).

    Args:
        name: The context name.
        content: The context content to validate.
    """
    return json.dumps({"approved": True, "message": "Validation not enforced in this version."})
