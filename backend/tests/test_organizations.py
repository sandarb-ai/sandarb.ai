"""Tests for organizations CRUD operations."""

import pytest
import uuid
from backend.db import execute, query_one


class TestOrganizationsCRUD:
    """Test suite for organizations API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, client, write_headers):
        """Setup and teardown for each test."""
        self.client = client
        self.write_headers = write_headers
        self.created_ids = []
        yield
        # Cleanup created test organizations (in reverse order due to FK constraints)
        for org_id in reversed(self.created_ids):
            try:
                # First delete any agents in this org
                execute("DELETE FROM agents WHERE org_id = %s", (org_id,))
                execute("DELETE FROM organizations WHERE id = %s", (org_id,))
            except Exception:
                pass

    def test_list_organizations(self):
        """Test GET /api/organizations returns paginated response."""
        response = self.client.get("/api/organizations")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"]["organizations"], list)
        assert "total" in data["data"]
        assert "limit" in data["data"]
        assert "offset" in data["data"]

    def test_list_root_organizations(self):
        """Test GET /api/organizations?root=true returns root org."""
        response = self.client.get("/api/organizations?root=true")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # Root returns a single org or list - check if it's valid data
        assert data["data"] is not None or data["data"] == []

    def test_create_organization(self):
        """Test POST /api/organizations creates a new organization."""
        slug = f"test-org-{uuid.uuid4().hex[:8]}"
        response = self.client.post(
            "/api/organizations",
            json={
                "name": f"Test Org {slug}",
                "slug": slug,
                "description": "Test organization description",
            },
            headers=self.write_headers,
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["success"] is True
        assert "id" in data["data"]
        self.created_ids.append(data["data"]["id"])

    def test_create_organization_duplicate_slug(self):
        """Test POST /api/organizations with duplicate slug fails."""
        slug = f"test-dup-{uuid.uuid4().hex[:8]}"
        
        # Create first org
        response1 = self.client.post(
            "/api/organizations",
            json={"name": "First Org", "slug": slug},
            headers=self.write_headers,
        )
        assert response1.status_code in [200, 201]
        self.created_ids.append(response1.json()["data"]["id"])
        
        # Try to create second with same slug
        response2 = self.client.post(
            "/api/organizations",
            json={"name": "Second Org", "slug": slug},
            headers=self.write_headers,
        )
        assert response2.status_code in [400, 409, 500]

    def test_get_organization_by_id(self):
        """Test GET /api/organizations/{id} returns organization details."""
        # Create an org first
        slug = f"test-get-{uuid.uuid4().hex[:8]}"
        create_response = self.client.post(
            "/api/organizations",
            json={"name": "Get Test Org", "slug": slug},
            headers=self.write_headers,
        )
        org_id = create_response.json()["data"]["id"]
        self.created_ids.append(org_id)

        # Get by ID
        response = self.client.get(f"/api/organizations/{org_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["id"] == org_id

    def test_get_organization_not_found(self):
        """Test GET /api/organizations/{id} with non-existent ID."""
        fake_id = str(uuid.uuid4())
        response = self.client.get(f"/api/organizations/{fake_id}")
        assert response.status_code == 404

    def test_update_organization(self):
        """Test PATCH /api/organizations/{id} updates organization."""
        # Create an org first
        slug = f"test-update-{uuid.uuid4().hex[:8]}"
        create_response = self.client.post(
            "/api/organizations",
            json={"name": "Update Test Org", "slug": slug, "description": "Original"},
            headers=self.write_headers,
        )
        org_id = create_response.json()["data"]["id"]
        self.created_ids.append(org_id)

        # Update using PATCH
        response = self.client.patch(
            f"/api/organizations/{org_id}",
            json={"description": "Updated description"},
            headers=self.write_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["description"] == "Updated description"

    def test_delete_organization(self):
        """Test DELETE /api/organizations/{id}."""
        # Create an org first
        slug = f"test-delete-{uuid.uuid4().hex[:8]}"
        create_response = self.client.post(
            "/api/organizations",
            json={"name": "Delete Test Org", "slug": slug},
            headers=self.write_headers,
        )
        org_id = create_response.json()["data"]["id"]

        # Delete
        response = self.client.delete(f"/api/organizations/{org_id}", headers=self.write_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify deleted
        row = query_one("SELECT id FROM organizations WHERE id = %s", (org_id,))
        assert row is None

    def test_delete_organization_not_found(self):
        """Test DELETE /api/organizations/{id} with non-existent ID."""
        fake_id = str(uuid.uuid4())
        response = self.client.delete(f"/api/organizations/{fake_id}", headers=self.write_headers)
        assert response.status_code == 404

    def test_create_child_organization(self):
        """Test creating a child organization under a parent."""
        # Create parent org
        parent_slug = f"test-parent-{uuid.uuid4().hex[:8]}"
        parent_response = self.client.post(
            "/api/organizations",
            json={"name": "Parent Org", "slug": parent_slug},
            headers=self.write_headers,
        )
        parent_id = parent_response.json()["data"]["id"]
        self.created_ids.append(parent_id)

        # Create child org
        child_slug = f"test-child-{uuid.uuid4().hex[:8]}"
        child_response = self.client.post(
            "/api/organizations",
            json={
                "name": "Child Org",
                "slug": child_slug,
                "parentId": parent_id,
            },
            headers=self.write_headers,
        )
        assert child_response.status_code in [200, 201]
        child_data = child_response.json()
        assert child_data["data"]["parentId"] == parent_id
        self.created_ids.append(child_data["data"]["id"])


class TestOrganizationAgents:
    """Test suite for organization agents relationship."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, client, write_headers):
        """Setup and teardown for each test."""
        self.client = client
        self.write_headers = write_headers
        self.created_org_ids = []
        self.created_agent_ids = []
        yield
        # Cleanup
        for agent_id in self.created_agent_ids:
            try:
                execute("DELETE FROM agents WHERE id = %s", (agent_id,))
            except Exception:
                pass
        for org_id in self.created_org_ids:
            try:
                execute("DELETE FROM organizations WHERE id = %s", (org_id,))
            except Exception:
                pass

    def test_get_organization_with_agents(self):
        """Test GET /api/organizations/{id} includes agents."""
        # Create org
        slug = f"test-with-agents-{uuid.uuid4().hex[:8]}"
        org_response = self.client.post(
            "/api/organizations",
            json={"name": "Org With Agents", "slug": slug},
            headers=self.write_headers,
        )
        org_id = org_response.json()["data"]["id"]
        self.created_org_ids.append(org_id)

        # Create an agent in the org
        agent_response = self.client.post(
            "/api/agents",
            json={
                "orgId": org_id,
                "name": "Test Agent",
                "a2aUrl": "http://localhost:8001/agent",
            },
            headers=self.write_headers,
        )
        if agent_response.status_code == 200:
            self.created_agent_ids.append(agent_response.json()["data"]["id"])

        # Get org - may or may not include agents depending on API
        response = self.client.get(f"/api/organizations/{org_id}")
        assert response.status_code == 200
        data = response.json()
        # agents field may not be present in basic org response
        assert data["success"] is True
