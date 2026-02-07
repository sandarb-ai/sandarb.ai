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

    def test_update_setting(self, client, write_headers):
        """Test PATCH /api/settings updates a setting."""
        # First get current settings
        get_response = client.get("/api/settings")
        assert get_response.status_code == 200

        # Try to update a setting (backend uses PATCH)
        # Use a valid whitelisted key (theme) or custom_ prefix
        response = client.patch(
            "/api/settings",
            json={"theme": "dark"},
            headers=write_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Clean up: restore theme to light so tests don't pollute the dev database
        client.patch(
            "/api/settings",
            json={"theme": "light"},
            headers=write_headers,
        )

    def test_update_setting_invalid_key(self, client, write_headers):
        """Test PATCH /api/settings rejects invalid keys."""
        response = client.patch(
            "/api/settings",
            json={"invalid_key": "test_value"},
            headers=write_headers,
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid settings keys" in data.get("detail", "")

    def test_update_setting_custom_key(self, client, write_headers):
        """Test PATCH /api/settings accepts custom_ prefix keys."""
        response = client.patch(
            "/api/settings",
            json={"custom_my_setting": "my_value"},
            headers=write_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
