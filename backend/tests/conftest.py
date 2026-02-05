"""Pytest configuration and fixtures for backend tests."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.db import get_connection, execute, query, query_one


@pytest.fixture(scope="session")
def client():
    """Create a test client for the FastAPI app."""
    with TestClient(app) as c:
        yield c


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
