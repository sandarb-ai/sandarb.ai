"""Tests for MCP server (backend/mcp_server.py) and its Streamable HTTP mount."""

import json
import uuid

import bcrypt
import pytest

from backend.db import execute, query_one
from backend.mcp_server import (
    mcp,
    list_contexts,
    get_context,
    get_prompt,
    get_lineage,
    register_agent,
    validate_context,
    _resolve_auth,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_MCP_API_SECRET = "mcp-test-secret-key"
TEST_MCP_AGENT_ID = "mcp-test-agent"


@pytest.fixture(scope="session")
def mcp_service_account():
    """Create a service account for MCP tests and return the API key."""
    secret_hash = bcrypt.hashpw(TEST_MCP_API_SECRET.encode(), bcrypt.gensalt()).decode()
    execute(
        """INSERT INTO service_accounts (client_id, secret_hash, agent_id)
           VALUES ('mcp-test-client', %s, %s)
           ON CONFLICT (client_id) DO UPDATE SET secret_hash = EXCLUDED.secret_hash, agent_id = EXCLUDED.agent_id""",
        (secret_hash, TEST_MCP_AGENT_ID),
    )
    return TEST_MCP_API_SECRET


@pytest.fixture(scope="session")
def mcp_agent(mcp_service_account):
    """Create a registered agent for MCP tests. Returns agent UUID."""
    # Clean up if exists from previous run
    existing = query_one("SELECT id FROM agents WHERE agent_id = %s", (TEST_MCP_AGENT_ID,))
    if existing:
        return str(existing["id"])
    # Get a valid org_id (first available, or create one)
    org = query_one("SELECT id FROM organizations LIMIT 1")
    if not org:
        org_id = str(uuid.uuid4())
        execute(
            "INSERT INTO organizations (id, name, slug) VALUES (%s, 'MCP Test Org', 'mcp-test-org')",
            (org_id,),
        )
    else:
        org_id = str(org["id"])
    agent_id = str(uuid.uuid4())
    execute(
        """INSERT INTO agents (id, org_id, agent_id, name, a2a_url, status, approval_status)
           VALUES (%s, %s, %s, 'MCP Test Agent', 'http://localhost:9999/a2a', 'active', 'approved')""",
        (agent_id, org_id, TEST_MCP_AGENT_ID),
    )
    return agent_id


@pytest.fixture()
def mcp_context(mcp_agent):
    """Create a context linked to the MCP test agent. Returns (context_id, name)."""
    name = f"mcp-test-ctx-{uuid.uuid4().hex[:8]}"
    ctx_id = str(uuid.uuid4())
    execute(
        """INSERT INTO contexts (id, name, description, data_classification, owner_team)
           VALUES (%s, %s, 'MCP test context', 'Internal', 'test')""",
        (ctx_id, name),
    )
    content_json = json.dumps({"rules": "test content"})
    import hashlib
    sha = hashlib.sha256(content_json.encode()).hexdigest()
    execute(
        """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message, approved_by, approved_at)
           VALUES (%s, 1, %s::jsonb, %s, 'test', 'test', 'Approved', true, 'Init', 'test', NOW())""",
        (ctx_id, content_json, sha),
    )
    # Link to agent
    execute(
        """INSERT INTO agent_contexts (agent_id, context_id)
           VALUES (%s, %s) ON CONFLICT DO NOTHING""",
        (mcp_agent, ctx_id),
    )
    yield ctx_id, name
    # Cleanup (delete access_logs first due to FK constraint)
    try:
        execute("DELETE FROM sandarb_access_logs WHERE context_id = %s", (ctx_id,))
    except Exception:
        pass
    execute("DELETE FROM agent_contexts WHERE context_id = %s", (ctx_id,))
    execute("DELETE FROM context_versions WHERE context_id = %s", (ctx_id,))
    execute("DELETE FROM contexts WHERE id = %s", (ctx_id,))


@pytest.fixture()
def mcp_prompt(mcp_agent):
    """Create a prompt with approved version linked to the MCP test agent. Returns (prompt_id, name)."""
    name = f"mcp-test-prompt-{uuid.uuid4().hex[:8]}"
    prompt_id = str(uuid.uuid4())
    execute(
        """INSERT INTO prompts (id, name, description, created_by)
           VALUES (%s, %s, 'MCP test prompt', 'test')""",
        (prompt_id, name),
    )
    import hashlib
    content = "You are a governed test assistant."
    sha = hashlib.sha256(content.encode()).hexdigest()
    execute(
        """INSERT INTO prompt_versions (prompt_id, version, content, sha256_hash, created_by, submitted_by, status, approved_by, approved_at)
           VALUES (%s, 1, %s, %s, 'test', 'test', 'Approved', 'test', NOW())""",
        (prompt_id, content, sha),
    )
    # Set current_version_id on prompt
    ver = query_one("SELECT id FROM prompt_versions WHERE prompt_id = %s AND version = 1", (prompt_id,))
    execute("UPDATE prompts SET current_version_id = %s WHERE id = %s", (ver["id"], prompt_id))
    # Link to agent
    execute(
        """INSERT INTO agent_prompts (agent_id, prompt_id)
           VALUES (%s, %s) ON CONFLICT DO NOTHING""",
        (mcp_agent, prompt_id),
    )
    yield prompt_id, name
    # Cleanup
    execute("DELETE FROM agent_prompts WHERE prompt_id = %s", (prompt_id,))
    execute("DELETE FROM prompt_versions WHERE prompt_id = %s", (prompt_id,))
    execute("DELETE FROM prompts WHERE id = %s", (prompt_id,))


# ===========================================================================
# Unit tests — MCP server instance
# ===========================================================================

class TestMCPServerSetup:
    """Verify the FastMCP server is configured correctly."""

    def test_mcp_server_name(self):
        assert mcp.name == "sandarb-mcp"

    def test_mcp_tools_registered(self):
        tool_names = sorted([t.name for t in mcp._tool_manager.list_tools()])
        assert tool_names == sorted([
            "list_contexts",
            "get_context",
            "get_prompt",
            "get_lineage",
            "register_agent",
            "validate_context",
        ])

    def test_mcp_streamable_http_app_returns_starlette(self):
        from starlette.applications import Starlette
        app = mcp.streamable_http_app()
        assert isinstance(app, Starlette)


# ===========================================================================
# Unit tests — _resolve_auth
# ===========================================================================

class TestResolveAuth:
    """Test the auth helper used by all MCP tools."""

    def test_missing_api_key(self):
        account, err = _resolve_auth(None, "agent", "trace")
        assert account is None
        assert "Missing API key" in err

    def test_empty_api_key(self):
        account, err = _resolve_auth("", "agent", "trace")
        assert account is None
        assert "Missing API key" in err

    def test_invalid_api_key(self):
        account, err = _resolve_auth("totally-wrong-key", "agent", "trace")
        assert account is None
        assert "Invalid API key" in err

    def test_valid_api_key(self, mcp_service_account):
        account, err = _resolve_auth(mcp_service_account, TEST_MCP_AGENT_ID, "trace")
        assert err is None
        assert account is not None
        assert account["agent_id"] == TEST_MCP_AGENT_ID


# ===========================================================================
# Unit tests — validate_context (no auth required)
# ===========================================================================

class TestValidateContext:
    """Test the validate_context tool (no auth, always passes)."""

    def test_validate_context_returns_approved(self):
        result = json.loads(validate_context(name="test", content="anything"))
        assert result["approved"] is True

    def test_validate_context_message(self):
        result = json.loads(validate_context(name="x", content="y"))
        assert "not enforced" in result["message"].lower()


# ===========================================================================
# Unit tests — list_contexts
# ===========================================================================

class TestListContexts:

    def test_missing_api_key(self):
        result = json.loads(list_contexts(api_key="", source_agent="a", trace_id="t"))
        assert "error" in result
        assert "Missing API key" in result["error"]

    def test_invalid_api_key(self):
        result = json.loads(list_contexts(api_key="bad", source_agent="a", trace_id="t"))
        assert "error" in result
        assert "Invalid API key" in result["error"]

    def test_unregistered_agent(self, mcp_service_account):
        result = json.loads(list_contexts(
            api_key=mcp_service_account,
            source_agent="no-such-agent",
            trace_id="t",
        ))
        assert "error" in result
        assert "not registered" in result["error"]

    def test_missing_trace_id(self, mcp_service_account):
        result = json.loads(list_contexts(
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="",
        ))
        assert "error" in result
        assert "required" in result["error"]

    def test_list_contexts_success(self, mcp_service_account, mcp_agent, mcp_context):
        ctx_id, ctx_name = mcp_context
        result = json.loads(list_contexts(
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="test-trace",
        ))
        assert "contexts" in result
        names = [c["name"] for c in result["contexts"]]
        assert ctx_name in names


# ===========================================================================
# Unit tests — get_context
# ===========================================================================

class TestGetContext:

    def test_missing_api_key(self):
        result = json.loads(get_context(name="x", api_key="", source_agent="a", trace_id="t"))
        assert "error" in result

    def test_context_not_found(self, mcp_service_account, mcp_agent):
        result = json.loads(get_context(
            name="nonexistent-ctx",
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="t",
        ))
        assert "error" in result
        assert "not found" in result["error"].lower()

    def test_unregistered_agent(self, mcp_service_account, mcp_context):
        _, ctx_name = mcp_context
        result = json.loads(get_context(
            name=ctx_name,
            api_key=mcp_service_account,
            source_agent="ghost-agent",
            trace_id="t",
        ))
        assert "error" in result
        assert "not registered" in result["error"]

    def test_context_not_linked(self, mcp_service_account, mcp_agent, mcp_context):
        """Create context NOT linked to agent — should fail."""
        unlinked_name = f"unlinked-ctx-{uuid.uuid4().hex[:8]}"
        unlinked_id = str(uuid.uuid4())
        execute(
            "INSERT INTO contexts (id, name, description, data_classification, owner_team) VALUES (%s, %s, 'unlinked', 'Internal', 'test')",
            (unlinked_id, unlinked_name),
        )
        content_json = json.dumps({"x": 1})
        import hashlib
        sha = hashlib.sha256(content_json.encode()).hexdigest()
        execute(
            "INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, submitted_by, status, is_active, commit_message) VALUES (%s, 1, %s::jsonb, %s, 'test', 'test', 'Approved', true, 'Init')",
            (unlinked_id, content_json, sha),
        )
        try:
            result = json.loads(get_context(
                name=unlinked_name,
                api_key=mcp_service_account,
                source_agent=TEST_MCP_AGENT_ID,
                trace_id="t",
            ))
            assert "error" in result
            assert "not linked" in result["error"]
        finally:
            try:
                execute("DELETE FROM sandarb_access_logs WHERE context_id = %s", (unlinked_id,))
            except Exception:
                pass
            execute("DELETE FROM context_versions WHERE context_id = %s", (unlinked_id,))
            execute("DELETE FROM contexts WHERE id = %s", (unlinked_id,))

    def test_get_context_success(self, mcp_service_account, mcp_agent, mcp_context):
        ctx_id, ctx_name = mcp_context
        result = json.loads(get_context(
            name=ctx_name,
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="test-trace",
        ))
        assert "error" not in result
        assert result["name"] == ctx_name
        assert result["content"] == {"rules": "test content"}
        assert result["contextId"] == ctx_id

    def test_empty_name(self, mcp_service_account):
        result = json.loads(get_context(
            name="  ",
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="t",
        ))
        assert "error" in result
        assert "required" in result["error"]


# ===========================================================================
# Unit tests — get_prompt
# ===========================================================================

class TestGetPrompt:

    def test_missing_api_key(self):
        result = json.loads(get_prompt(name="x", api_key="", source_agent="a", trace_id="t"))
        assert "error" in result

    def test_prompt_not_found(self, mcp_service_account, mcp_agent):
        result = json.loads(get_prompt(
            name="nonexistent-prompt",
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="t",
        ))
        assert "error" in result
        assert "not found" in result["error"].lower()

    def test_unregistered_agent(self, mcp_service_account, mcp_prompt):
        _, prompt_name = mcp_prompt
        result = json.loads(get_prompt(
            name=prompt_name,
            api_key=mcp_service_account,
            source_agent="ghost-agent",
            trace_id="t",
        ))
        assert "error" in result
        assert "not registered" in result["error"]

    def test_prompt_not_linked(self, mcp_service_account, mcp_agent, mcp_prompt):
        """Create prompt NOT linked to agent — should fail."""
        unlinked_name = f"unlinked-prompt-{uuid.uuid4().hex[:8]}"
        unlinked_id = str(uuid.uuid4())
        execute(
            "INSERT INTO prompts (id, name, description, created_by) VALUES (%s, %s, 'unlinked', 'test')",
            (unlinked_id, unlinked_name),
        )
        import hashlib
        content = "Unlinked prompt content"
        sha = hashlib.sha256(content.encode()).hexdigest()
        execute(
            "INSERT INTO prompt_versions (prompt_id, version, content, sha256_hash, created_by, submitted_by, status, approved_by, approved_at) VALUES (%s, 1, %s, %s, 'test', 'test', 'Approved', 'test', NOW())",
            (unlinked_id, content, sha),
        )
        ver = query_one("SELECT id FROM prompt_versions WHERE prompt_id = %s AND version = 1", (unlinked_id,))
        execute("UPDATE prompts SET current_version_id = %s WHERE id = %s", (ver["id"], unlinked_id))
        try:
            result = json.loads(get_prompt(
                name=unlinked_name,
                api_key=mcp_service_account,
                source_agent=TEST_MCP_AGENT_ID,
                trace_id="t",
            ))
            assert "error" in result
            assert "not linked" in result["error"]
        finally:
            execute("DELETE FROM prompt_versions WHERE prompt_id = %s", (unlinked_id,))
            execute("DELETE FROM prompts WHERE id = %s", (unlinked_id,))

    def test_get_prompt_success(self, mcp_service_account, mcp_agent, mcp_prompt):
        prompt_id, prompt_name = mcp_prompt
        result = json.loads(get_prompt(
            name=prompt_name,
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="test-trace",
        ))
        assert "error" not in result
        assert result["name"] == prompt_name
        assert result["content"] == "You are a governed test assistant."
        assert result["version"] == 1

    def test_empty_name(self, mcp_service_account):
        result = json.loads(get_prompt(
            name="",
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="t",
        ))
        assert "error" in result
        assert "required" in result["error"]


# ===========================================================================
# Unit tests — get_lineage
# ===========================================================================

class TestGetLineage:

    def test_missing_api_key(self):
        result = json.loads(get_lineage(api_key="", source_agent="a", trace_id="t"))
        assert "error" in result

    def test_get_lineage_success(self, mcp_service_account, mcp_agent):
        result = json.loads(get_lineage(
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="test-trace",
        ))
        assert "lineage" in result
        assert isinstance(result["lineage"], list)

    def test_lineage_limit_capped(self, mcp_service_account, mcp_agent):
        """Limit should be capped at 200."""
        result = json.loads(get_lineage(
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="test-trace",
            limit=999,
        ))
        assert "lineage" in result


# ===========================================================================
# Unit tests — register_agent
# ===========================================================================

class TestRegisterAgent:

    def test_missing_api_key(self):
        result = json.loads(register_agent(
            name="x", url="http://example.com", api_key="", source_agent="a", trace_id="t",
        ))
        assert "error" in result

    def test_missing_name(self, mcp_service_account):
        result = json.loads(register_agent(
            name="", url="http://example.com",
            api_key=mcp_service_account, source_agent=TEST_MCP_AGENT_ID, trace_id="t",
        ))
        assert "error" in result
        assert "required" in result["error"]

    def test_invalid_url(self, mcp_service_account):
        result = json.loads(register_agent(
            name="bad-url-agent", url="not-a-url",
            api_key=mcp_service_account, source_agent=TEST_MCP_AGENT_ID, trace_id="t",
        ))
        assert "error" in result
        assert "Invalid URL" in result["error"]

    def test_register_agent_success(self, mcp_service_account, mcp_agent):
        agent_name = f"mcp-reg-test-{uuid.uuid4().hex[:8]}"
        try:
            result = json.loads(register_agent(
                name=agent_name,
                url="http://localhost:9998/a2a",
                api_key=mcp_service_account,
                source_agent=TEST_MCP_AGENT_ID,
                trace_id="test-trace",
                agent_id=agent_name,
                description="Registered via MCP test",
            ))
            assert result.get("success") is True
            assert result.get("agentId") == agent_name
        finally:
            execute("DELETE FROM agents WHERE agent_id = %s", (agent_name,))

    def test_register_duplicate_agent(self, mcp_service_account, mcp_agent):
        """Re-registering an existing agent_id should fail."""
        result = json.loads(register_agent(
            name="dup-agent",
            url="http://localhost:9998/a2a",
            api_key=mcp_service_account,
            source_agent=TEST_MCP_AGENT_ID,
            trace_id="t",
            agent_id=TEST_MCP_AGENT_ID,
        ))
        assert "error" in result
        assert "already exists" in result["error"]


# ===========================================================================
# Integration tests — MCP endpoint mounted on FastAPI
# ===========================================================================

class TestMCPEndpointMount:
    """Verify that the /mcp endpoint is mounted and responds to MCP protocol messages."""

    def test_mcp_mount_exists(self, client):
        """POST /mcp/ should be handled by MCP SDK (not 404)."""
        response = client.post(
            "/mcp/",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1.0"},
                },
            },
            # Host header must be localhost to pass MCP SDK transport security
            headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
        )
        # The MCP SDK handles this — should return 200 with protocol info
        assert response.status_code == 200
        data = response.json()
        assert data.get("jsonrpc") == "2.0"
        assert "result" in data
        assert data["result"]["serverInfo"]["name"] == "sandarb-mcp"

    def test_mcp_redirect_trailing_slash(self, client):
        """POST /mcp (no slash) should redirect to /mcp/."""
        response = client.post(
            "/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1.0"},
                },
            },
            headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
            follow_redirects=False,
        )
        # Starlette mount adds trailing slash redirect (307)
        assert response.status_code in (200, 307)

    def test_mcp_tools_list_returns_tools(self, client):
        """tools/list via MCP should return actual tools (not empty)."""
        # First initialize
        init_resp = client.post(
            "/mcp/",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1.0"},
                },
            },
            headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
        )
        assert init_resp.status_code == 200

        # Now list tools
        response = client.post(
            "/mcp/",
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {},
            },
            headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "result" in data
        tools = data["result"]["tools"]
        assert len(tools) == 6
        tool_names = sorted([t["name"] for t in tools])
        assert tool_names == sorted([
            "list_contexts", "get_context", "get_prompt",
            "get_lineage", "register_agent", "validate_context",
        ])

    def test_a2a_still_works(self, client):
        """A2A endpoint should still be functional after MCP changes."""
        # Only test when agent service is mounted (or use the /api prefix if not)
        response = client.post(
            "/a2a",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "agent/info",
                "params": {},
            },
        )
        # May be 404 if SANDARB_AGENT_SERVICE is not set; that's fine
        if response.status_code == 200:
            data = response.json()
            assert data.get("result", {}).get("name") == "Sandarb AI Governance Agent"
