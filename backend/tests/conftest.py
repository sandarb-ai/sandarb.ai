"""Pytest configuration and fixtures for backend tests."""

import os
import time
import pytest
import bcrypt
import jwt
from fastapi.testclient import TestClient

# Allow preview agent ID with any valid API key in tests (no sandarb-ui key required)
os.environ.setdefault("SANDARB_DEV", "true")
# Allow test user to perform writes (write_allowed_emails)
os.environ.setdefault("WRITE_ALLOWED_EMAILS", "test@example.com")

from backend.main import app
from backend.db import get_connection, execute, query, query_one
from backend.config import settings


def _make_write_token(email: str = "test@example.com") -> str:
    """Create a JWT with email for write-auth (same secret as backend)."""
    return jwt.encode(
        {"email": email, "exp": int(time.time()) + 3600},
        settings.jwt_secret,
        algorithm="HS256",
    )


@pytest.fixture(scope="session")
def write_headers():
    """Headers for UI write endpoints (POST/PUT/PATCH/DELETE). Use in tests that call write routes."""
    return {"Authorization": f"Bearer {_make_write_token()}"}


@pytest.fixture(scope="session")
def client():
    """Create a test client for the FastAPI app."""
    with TestClient(app) as c:
        yield c


# Known test API key for SDK endpoints (inject, prompts/pull, audit/activity). Service account must exist in DB.
TEST_API_SECRET = "test-api-secret-do-not-use-in-prod"


@pytest.fixture(scope="session")
def api_key_headers():
    """Ensure test service account exists and return headers for API key auth (Bearer + sandarb-prompt-preview agent)."""
    secret_hash = bcrypt.hashpw(TEST_API_SECRET.encode(), bcrypt.gensalt()).decode()
    execute(
        """INSERT INTO service_accounts (client_id, secret_hash, agent_id)
           VALUES ('test-api', %s, 'sandarb-prompt-preview')
           ON CONFLICT (client_id) DO UPDATE SET secret_hash = EXCLUDED.secret_hash, agent_id = EXCLUDED.agent_id""",
        (secret_hash,),
    )
    return {
        "Authorization": f"Bearer {TEST_API_SECRET}",
        "X-Sandarb-Agent-ID": "sandarb-prompt-preview",
        "X-Sandarb-Trace-ID": "test-trace-id",
    }


@pytest.fixture(scope="function")
def db_connection():
    """Get a database connection for tests that need direct DB access."""
    conn = get_connection()
    yield conn
    conn.close()


@pytest.fixture
def sample_context_data():
    """Sample context data for testing."""
    return {
        "name": "test-context-crud",
        "description": "Test context for CRUD operations",
        "lobTag": "Wealth-Management",
        "dataClassification": "Internal",
        "ownerTeam": "test-team",
        "content": {"sections": [{"title": "Test", "body": "Test content"}]},
    }


@pytest.fixture
def sample_prompt_data():
    """Sample prompt data for testing."""
    return {
        "name": "test-prompt-crud",
        "description": "Test prompt for CRUD operations",
        "content": "You are a helpful assistant.",
        "commitMessage": "Initial test prompt",
    }


@pytest.fixture
def sample_organization_data():
    """Sample organization data for testing."""
    return {
        "name": "Test Organization CRUD",
        "slug": "test-org-crud",
        "description": "Test organization for CRUD operations",
    }


@pytest.fixture
def sample_agent_data():
    """Sample agent data for testing."""
    return {
        "name": "Test Agent CRUD",
        "description": "Test agent for CRUD operations",
        "a2aUrl": "http://localhost:8001/agent",
        "agentId": "test-agent-crud",
    }


def cleanup_test_data(name_pattern: str, table: str, column: str = "name"):
    """Helper to clean up test data after tests."""
    try:
        execute(f"DELETE FROM {table} WHERE {column} LIKE %s", (f"%{name_pattern}%",))
    except Exception:
        pass
