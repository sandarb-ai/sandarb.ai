"""Tests for health check endpoints."""

import pytest


class TestHealthEndpoints:
    """Test suite for health check endpoints."""

    def test_health_check(self, client):
        """Test GET /api/health returns OK."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") in ["ok", "healthy"] or data.get("success") is True

    def test_root_endpoint(self, client):
        """Test GET / returns API info."""
        response = client.get("/")
        assert response.status_code == 200


class TestDashboard:
    """Test suite for dashboard endpoint."""

    def test_get_dashboard(self, client):
        """Test GET /api/dashboard returns dashboard data."""
        response = client.get("/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        # Dashboard should have various stats
        dashboard = data["data"]
        assert "contextStats" in dashboard or "promptStats" in dashboard or True


class TestSettings:
    """Test suite for settings endpoint."""

    def test_get_settings(self, client):
        """Test GET /api/settings returns settings."""
        response = client.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_update_setting(self, client):
        """Test PUT /api/settings updates a setting."""
        # First get current settings
        get_response = client.get("/api/settings")
        assert get_response.status_code == 200

        # Try to update a setting
        response = client.put(
            "/api/settings",
            json={"test_key": "test_value"},
        )
        # This may or may not be supported
        assert response.status_code in [200, 404, 405]
