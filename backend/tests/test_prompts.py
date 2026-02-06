"""Tests for prompts CRUD operations."""

import pytest
import uuid
from backend.db import execute, query_one


class TestPromptsCRUD:
    """Test suite for prompts API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, client, write_headers):
        """Setup and teardown for each test."""
        self.client = client
        self.write_headers = write_headers
        self.created_ids = []
        yield
        # Cleanup created test prompts
        for prompt_id in self.created_ids:
            try:
                execute("DELETE FROM prompt_versions WHERE prompt_id = %s", (prompt_id,))
                execute("DELETE FROM prompts WHERE id = %s", (prompt_id,))
            except Exception:
                pass

    def _create_prompt_in_db(self, name: str = None, description: str = None):
        """Helper to create a prompt directly in the database."""
        prompt_id = str(uuid.uuid4())
        name = name or f"test-prompt-{prompt_id[:8]}"
        description = description or "Test prompt"
        execute(
            """INSERT INTO prompts (id, name, description, created_by)
               VALUES (%s, %s, %s, %s)""",
            (prompt_id, name, description, "test"),
        )
        self.created_ids.append(prompt_id)
        return prompt_id

    def test_list_prompts(self):
        """Test GET /api/prompts returns paginated prompts."""
        response = self.client.get("/api/prompts")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        # Response is a dict with prompts list, total, and pagination info
        assert isinstance(data["data"], dict)
        assert "prompts" in data["data"]
        assert isinstance(data["data"]["prompts"], list)
        assert "total" in data["data"]

    def test_get_prompt_by_id(self):
        """Test GET /api/prompts/{id} returns prompt details."""
        # Create a prompt first
        prompt_id = self._create_prompt_in_db()

        # Get by ID
        response = self.client.get(f"/api/prompts/{prompt_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["id"] == prompt_id

    def test_get_prompt_not_found(self):
        """Test GET /api/prompts/{id} with non-existent ID."""
        fake_id = str(uuid.uuid4())
        response = self.client.get(f"/api/prompts/{fake_id}")
        assert response.status_code == 404

    def test_delete_prompt(self):
        """Test DELETE /api/prompts/{id}."""
        # Create a prompt first
        prompt_id = self._create_prompt_in_db()
        self.created_ids.remove(prompt_id)  # Will be deleted by API

        # Delete
        response = self.client.delete(f"/api/prompts/{prompt_id}", headers=self.write_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify deleted
        row = query_one("SELECT id FROM prompts WHERE id = %s", (prompt_id,))
        assert row is None

    def test_delete_prompt_not_found(self):
        """Test DELETE /api/prompts/{id} with non-existent ID."""
        fake_id = str(uuid.uuid4())
        response = self.client.delete(f"/api/prompts/{fake_id}", headers=self.write_headers)
        assert response.status_code == 404


class TestPromptVersions:
    """Test suite for prompt versions API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, client, write_headers):
        """Setup and teardown for each test."""
        self.client = client
        self.write_headers = write_headers
        self.created_prompt_ids = []
        yield
        # Cleanup
        for prompt_id in self.created_prompt_ids:
            try:
                execute("DELETE FROM prompt_versions WHERE prompt_id = %s", (prompt_id,))
                execute("DELETE FROM prompts WHERE id = %s", (prompt_id,))
            except Exception:
                pass

    def _create_test_prompt(self):
        """Helper to create a test prompt in DB."""
        prompt_id = str(uuid.uuid4())
        name = f"test-versions-{prompt_id[:8]}"
        execute(
            """INSERT INTO prompts (id, name, description, created_by)
               VALUES (%s, %s, %s, %s)""",
            (prompt_id, name, "Test prompt for versions", "test"),
        )
        self.created_prompt_ids.append(prompt_id)
        return prompt_id

    def test_list_prompt_versions(self):
        """Test GET /api/prompts/{id}/versions."""
        prompt_id = self._create_test_prompt()
        
        response = self.client.get(f"/api/prompts/{prompt_id}/versions")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)

    def test_create_prompt_version(self):
        """Test POST /api/prompts/{id}/versions creates a version."""
        prompt_id = self._create_test_prompt()
        
        response = self.client.post(
            f"/api/prompts/{prompt_id}/versions",
            headers=self.write_headers,
            json={
                "content": "You are a helpful assistant.",
                "commitMessage": "Initial version",
                "autoApprove": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["version"] == 1

    def test_create_multiple_versions(self):
        """Test creating multiple versions of a prompt."""
        prompt_id = self._create_test_prompt()
        
        # Create first version
        self.client.post(
            f"/api/prompts/{prompt_id}/versions",
            headers=self.write_headers,
            json={
                "content": "Version 1 content",
                "commitMessage": "First version",
                "autoApprove": True,
            },
        )

        # Create second version
        response = self.client.post(
            f"/api/prompts/{prompt_id}/versions",
            headers=self.write_headers,
            json={
                "content": "Version 2 content",
                "commitMessage": "Second version",
                "autoApprove": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["version"] == 2

    def test_approve_prompt_version(self):
        """Test POST /api/prompts/{id}/versions/{versionId}/approve."""
        prompt_id = self._create_test_prompt()
        
        # Create a version (not auto-approved)
        version_response = self.client.post(
            f"/api/prompts/{prompt_id}/versions",
            headers=self.write_headers,
            json={
                "content": "Pending approval content",
                "commitMessage": "Needs approval",
                "autoApprove": False,
            },
        )
        version_id = version_response.json()["data"]["id"]

        # Approve
        response = self.client.post(
            f"/api/prompts/{prompt_id}/versions/{version_id}/approve",
            json={"approvedBy": "test"},
            headers=self.write_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_reject_prompt_version(self):
        """Test POST /api/prompts/{id}/versions/{versionId}/reject."""
        prompt_id = self._create_test_prompt()
        
        # Create a version (not auto-approved)
        version_response = self.client.post(
            f"/api/prompts/{prompt_id}/versions",
            headers=self.write_headers,
            json={
                "content": "To be rejected",
                "commitMessage": "Will be rejected",
                "autoApprove": False,
            },
        )
        version_id = version_response.json()["data"]["id"]

        # Reject
        response = self.client.post(
            f"/api/prompts/{prompt_id}/versions/{version_id}/reject",
            json={},
            headers=self.write_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestPromptPull:
    """Test suite for prompt pull/inject API."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, client):
        """Setup and teardown for each test."""
        self.client = client
        self.created_prompt_ids = []
        yield
        for prompt_id in self.created_prompt_ids:
            try:
                execute("DELETE FROM prompt_versions WHERE prompt_id = %s", (prompt_id,))
                execute("DELETE FROM prompts WHERE id = %s", (prompt_id,))
            except Exception:
                pass

    def _create_test_prompt_with_version(self, name: str):
        """Create a prompt with an approved version."""
        prompt_id = str(uuid.uuid4())
        execute(
            """INSERT INTO prompts (id, name, description, created_by)
               VALUES (%s, %s, %s, %s)""",
            (prompt_id, name, "Test prompt for pull", "test"),
        )
        self.created_prompt_ids.append(prompt_id)
        return prompt_id

    def test_pull_prompt_missing_api_key(self):
        """Test GET /api/prompts/pull requires API key (401 without auth)."""
        response = self.client.get("/api/prompts/pull?name=test&agentId=preview&traceId=trace")
        assert response.status_code == 401

    def test_pull_prompt_not_found(self, api_key_headers):
        """Test GET /api/prompts/pull with non-existent name (with valid API key)."""
        response = self.client.get(
            "/api/prompts/pull?name=nonexistent-prompt&agentId=sandarb-prompt-preview&traceId=test-trace",
            headers=api_key_headers,
        )
        assert response.status_code == 404

    def test_pull_prompt_preview_mode(self, api_key_headers):
        """Test prompt pull in preview mode (sandarb-prompt-preview agent) with API key."""
        from backend.services.prompts import create_prompt_version, approve_prompt_version

        name = f"test-pull-preview-{uuid.uuid4().hex[:8]}"
        prompt_id = self._create_test_prompt_with_version(name)

        # Create version then approve (INSERT with status=Approved may require approved_by in DB)
        v = create_prompt_version(
            prompt_id,
            content="Preview test content",
            commit_message="For preview test",
            auto_approve=False,
            created_by="test",
        )
        if v and v.get("id"):
            approve_prompt_version(prompt_id, v["id"], approved_by="test")

        # Pull using preview agent ID and test API key
        response = self.client.get(
            f"/api/prompts/pull?name={name}&agentId=sandarb-prompt-preview&traceId=preview-trace",
            headers=api_key_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["content"] == "Preview test content"
