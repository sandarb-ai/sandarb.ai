"""Tests for contexts CRUD operations."""

import pytest
import uuid
from backend.db import execute, query_one


class TestContextsCRUD:
    """Test suite for contexts API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, client):
        """Setup and teardown for each test."""
        self.client = client
        self.created_ids = []
        yield
        # Cleanup created test contexts
        for ctx_id in self.created_ids:
            try:
                execute("DELETE FROM contexts WHERE id = %s", (ctx_id,))
            except Exception:
                pass

    def test_list_contexts(self):
        """Test GET /api/contexts returns a list."""
        response = self.client.get("/api/contexts")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert "contexts" in data["data"]
        assert "total" in data["data"]
        assert isinstance(data["data"]["contexts"], list)

    def test_list_contexts_with_pagination(self):
        """Test GET /api/contexts with limit and offset."""
        response = self.client.get("/api/contexts?limit=5&offset=0")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["contexts"]) <= 5

    def test_create_context_via_db_and_read(self):
        """Test creating a context directly and reading via API."""
        # Create directly in DB (since there's no POST endpoint for contexts)
        ctx_id = str(uuid.uuid4())
        execute(
            """INSERT INTO contexts (id, name, description, org_id, data_classification, owner_team, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (ctx_id, f"test-ctx-{ctx_id[:8]}", "Test context", None, "Internal", "test-team", "test"),
        )
        self.created_ids.append(ctx_id)

        # Create a version for the context
        execute(
            """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, status, is_active)
               VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s)""",
            (ctx_id, 1, '{"test": "content"}', "abc123", "test", "Approved", True),
        )

        # Read via API
        response = self.client.get(f"/api/contexts/{ctx_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["id"] == ctx_id
        assert data["data"]["content"] == {"test": "content"}

    def test_get_context_not_found(self):
        """Test GET /api/contexts/{id} with non-existent ID."""
        fake_id = str(uuid.uuid4())
        response = self.client.get(f"/api/contexts/{fake_id}")
        assert response.status_code == 404

    def test_update_context(self):
        """Test PUT /api/contexts/{id} updates context."""
        # Create a context first
        ctx_id = str(uuid.uuid4())
        execute(
            """INSERT INTO contexts (id, name, description, org_id, data_classification, owner_team, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (ctx_id, f"test-update-{ctx_id[:8]}", "Original description", None, "Internal", "test-team", "test"),
        )
        self.created_ids.append(ctx_id)

        # Update via API
        response = self.client.put(
            f"/api/contexts/{ctx_id}",
            json={
                "description": "Updated description",
                "isActive": True,
                "content": {"updated": True},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["description"] == "Updated description"

    def test_update_context_not_found(self):
        """Test PUT /api/contexts/{id} with non-existent ID."""
        fake_id = str(uuid.uuid4())
        response = self.client.put(
            f"/api/contexts/{fake_id}",
            json={"description": "Should fail"},
        )
        assert response.status_code == 404

    def test_delete_context(self):
        """Test DELETE /api/contexts/{id}."""
        # Create a context first
        ctx_id = str(uuid.uuid4())
        execute(
            """INSERT INTO contexts (id, name, description, org_id, data_classification, owner_team, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (ctx_id, f"test-delete-{ctx_id[:8]}", "To be deleted", None, "Internal", "test-team", "test"),
        )

        # Delete via API
        response = self.client.delete(f"/api/contexts/{ctx_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify deleted
        row = query_one("SELECT id FROM contexts WHERE id = %s", (ctx_id,))
        assert row is None

    def test_delete_context_not_found(self):
        """Test DELETE /api/contexts/{id} with non-existent ID."""
        fake_id = str(uuid.uuid4())
        response = self.client.delete(f"/api/contexts/{fake_id}")
        assert response.status_code == 404

    def test_get_context_revisions(self):
        """Test GET /api/contexts/{id}/revisions."""
        # Create a context with versions
        ctx_id = str(uuid.uuid4())
        execute(
            """INSERT INTO contexts (id, name, description, org_id, data_classification, owner_team, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (ctx_id, f"test-rev-{ctx_id[:8]}", "Context with revisions", None, "Internal", "test-team", "test"),
        )
        self.created_ids.append(ctx_id)

        # Create two versions
        for i in [1, 2]:
            execute(
                """INSERT INTO context_versions (context_id, version, content, sha256_hash, created_by, status, is_active)
                   VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s)""",
                (ctx_id, i, f'{{"version": {i}}}', f"hash{i}", "test", "Approved" if i == 2 else "Pending", i == 2),
            )

        response = self.client.get(f"/api/contexts/{ctx_id}/revisions")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 2

    def test_update_context_compliance_fields(self):
        """Test updating compliance metadata fields."""
        # Create a context
        ctx_id = str(uuid.uuid4())
        execute(
            """INSERT INTO contexts (id, name, description, org_id, data_classification, owner_team, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (ctx_id, f"test-compliance-{ctx_id[:8]}", "Test compliance", None, "Internal", "test-team", "test"),
        )
        self.created_ids.append(ctx_id)

        # Update compliance fields
        response = self.client.put(
            f"/api/contexts/{ctx_id}",
            json={
                "orgId": None,
                "dataClassification": "Confidential",
                "regulatoryHooks": ["FINRA", "SEC"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
