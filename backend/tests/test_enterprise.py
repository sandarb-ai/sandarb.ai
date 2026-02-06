"""Tests for enterprise readiness features: pagination, key expiration, connection pooling."""

import uuid
import time
import pytest
import bcrypt
from backend.db import execute, query_one, get_connection, put_connection


# ---------------------------------------------------------------------------
# Connection pooling tests
# ---------------------------------------------------------------------------

class TestConnectionPooling:
    """Test DB connection pool returns separate connections."""

    def test_pool_returns_connections(self):
        conn1 = get_connection()
        conn2 = get_connection()
        try:
            # Should get different connections from the pool
            assert conn1 is not conn2
        finally:
            put_connection(conn1)
            put_connection(conn2)

    def test_returned_connection_is_reusable(self):
        conn = get_connection()
        put_connection(conn)
        # Should be able to get another connection after returning
        conn2 = get_connection()
        assert conn2 is not None
        put_connection(conn2)


# ---------------------------------------------------------------------------
# API key expiration tests
# ---------------------------------------------------------------------------

EXPIRED_API_SECRET = "expired-test-secret-key"
EXPIRED_CLIENT_ID = f"expired-test-{uuid.uuid4().hex[:8]}"


class TestApiKeyExpiration:
    """Test API key expiration enforcement."""

    @pytest.fixture(autouse=True)
    def setup(self, client, api_key_headers):
        self.client = client
        self.api_key_headers = api_key_headers
        # Create an expired service account
        secret_hash = bcrypt.hashpw(EXPIRED_API_SECRET.encode(), bcrypt.gensalt()).decode()
        execute(
            """INSERT INTO service_accounts (client_id, secret_hash, agent_id, expires_at)
               VALUES (%s, %s, 'sandarb-prompt-preview', '2020-01-01T00:00:00Z')
               ON CONFLICT (client_id) DO UPDATE
               SET secret_hash = EXCLUDED.secret_hash, expires_at = '2020-01-01T00:00:00Z'""",
            (EXPIRED_CLIENT_ID, secret_hash),
        )
        self.expired_headers = {
            "Authorization": f"Bearer {EXPIRED_API_SECRET}",
            "X-Sandarb-Agent-ID": "sandarb-prompt-preview",
            "X-Sandarb-Trace-ID": "test-trace-id",
        }
        yield
        try:
            execute("DELETE FROM service_accounts WHERE client_id = %s", (EXPIRED_CLIENT_ID,))
        except Exception:
            pass

    def test_expired_key_returns_401_on_inject(self):
        """Expired API key should be rejected on SDK endpoints."""
        from backend.auth import verify_api_key, ApiKeyExpiredError
        with pytest.raises(ApiKeyExpiredError):
            verify_api_key(EXPIRED_API_SECRET)

    def test_expired_key_a2a_returns_error(self):
        """Expired key on A2A endpoint returns JSON-RPC error."""
        response = self.client.post(
            "/a2a",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "skills/execute",
                "params": {
                    "skill": "list_agents",
                    "input": {"sourceAgent": "sandarb-prompt-preview", "traceId": "t1"},
                },
            },
            headers=self.expired_headers,
        )
        assert response.status_code == 401
        data = response.json()
        assert "expired" in data["error"]["message"].lower()

    def test_null_expires_at_still_works(self):
        """Keys without expires_at (NULL) should still work."""
        # The default api_key_headers fixture has no expires_at
        response = self.client.post(
            "/a2a",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "skills/execute",
                "params": {
                    "skill": "list_agents",
                    "input": {"sourceAgent": "sandarb-prompt-preview", "traceId": "t1"},
                },
            },
            headers=self.api_key_headers,
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Pagination tests - REST API
# ---------------------------------------------------------------------------

class TestAgentsPagination:
    """Test pagination on GET /api/agents."""

    @pytest.fixture(autouse=True)
    def setup(self, client):
        self.client = client

    def test_default_pagination(self):
        response = self.client.get("/api/agents")
        assert response.status_code == 200
        data = response.json()["data"]
        assert "agents" in data
        assert "total" in data
        assert data["limit"] == 50
        assert data["offset"] == 0

    def test_custom_limit_and_offset(self):
        response = self.client.get("/api/agents?limit=5&offset=2")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data["agents"]) <= 5
        assert data["limit"] == 5
        assert data["offset"] == 2

    def test_limit_capped_at_500(self):
        response = self.client.get("/api/agents?limit=9999")
        # FastAPI Query validation should reject > 500
        assert response.status_code == 422

    def test_negative_offset_rejected(self):
        response = self.client.get("/api/agents?offset=-1")
        assert response.status_code == 422

    def test_filter_with_pagination(self):
        response = self.client.get("/api/agents?approval_status=approved&limit=3")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["limit"] == 3


class TestOrganizationsPagination:
    """Test pagination on GET /api/organizations."""

    @pytest.fixture(autouse=True)
    def setup(self, client):
        self.client = client

    def test_default_pagination(self):
        response = self.client.get("/api/organizations")
        assert response.status_code == 200
        data = response.json()["data"]
        assert "organizations" in data
        assert "total" in data
        assert data["limit"] == 50
        assert data["offset"] == 0

    def test_tree_mode_not_paginated(self):
        """Tree mode should return full tree, not paginated dict."""
        response = self.client.get("/api/organizations?tree=true")
        assert response.status_code == 200
        data = response.json()["data"]
        # Tree returns a list, not the pagination dict
        assert isinstance(data, list)

    def test_root_mode_not_paginated(self):
        """Root mode returns single org, not paginated."""
        response = self.client.get("/api/organizations?root=true")
        assert response.status_code == 200
        # Root returns single org or None


# ---------------------------------------------------------------------------
# Pagination tests - A2A skills
# ---------------------------------------------------------------------------

class TestA2APagination:
    """Test pagination on A2A list skills."""

    @pytest.fixture(autouse=True)
    def setup(self, client, api_key_headers):
        self.client = client
        self.headers = api_key_headers

    def _a2a_call(self, skill, inp=None):
        return self.client.post(
            "/a2a",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "skills/execute",
                "params": {
                    "skill": skill,
                    "input": {
                        "sourceAgent": "sandarb-prompt-preview",
                        "traceId": "test-trace",
                        **(inp or {}),
                    },
                },
            },
            headers=self.headers,
        )

    def test_list_agents_paginated(self):
        response = self._a2a_call("list_agents", {"limit": 5, "offset": 0})
        assert response.status_code == 200
        result = response.json()["result"]
        assert "agents" in result
        assert "total" in result
        assert result["limit"] == 5
        assert result["offset"] == 0
        assert len(result["agents"]) <= 5

    def test_list_organizations_paginated(self):
        response = self._a2a_call("list_organizations", {"limit": 3, "offset": 0})
        assert response.status_code == 200
        result = response.json()["result"]
        assert "organizations" in result
        assert "total" in result
        assert result["limit"] == 3

    def test_list_agents_limit_capped_at_500(self):
        response = self._a2a_call("list_agents", {"limit": 9999})
        assert response.status_code == 200
        result = response.json()["result"]
        assert result["limit"] == 500  # Capped

    def test_audit_skills_support_offset(self):
        response = self._a2a_call("get_lineage", {"limit": 10, "offset": 5})
        assert response.status_code == 200
        result = response.json()["result"]
        assert result["limit"] == 10
        assert result["offset"] == 5

    def test_blocked_injections_paginated(self):
        response = self._a2a_call("get_blocked_injections", {"limit": 5, "offset": 0})
        assert response.status_code == 200
        result = response.json()["result"]
        assert "blocked" in result
        assert result["limit"] == 5

    def test_audit_log_paginated(self):
        response = self._a2a_call("get_audit_log", {"limit": 10, "offset": 0})
        assert response.status_code == 200
        result = response.json()["result"]
        assert "auditLog" in result
        assert result["limit"] == 10
