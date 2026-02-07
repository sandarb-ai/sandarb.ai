"""Tests for platform configuration API (Kafka, ClickHouse, Superset, Gen AI)."""

import pytest
from backend.db import execute


class TestPlatformConfigAPI:
    """Test GET/PATCH /api/platform-config endpoints."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        """Clean up config rows after each test."""
        yield
        for table in ("config_kafka", "config_clickhouse", "config_superset", "config_gen_ai"):
            try:
                execute(f"DELETE FROM {table}")
            except Exception:
                pass

    def test_get_all_configs_empty(self, client):
        """GET /api/platform-config returns all 4 sections even when empty."""
        resp = client.get("/api/platform-config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "kafka" in data["data"]
        assert "clickhouse" in data["data"]
        assert "superset" in data["data"]
        assert "gen_ai" in data["data"]

    def test_get_single_section(self, client):
        """GET /api/platform-config/kafka returns kafka section."""
        resp = client.get("/api/platform-config/kafka")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "bootstrap_servers" in data["data"]
        assert "_meta" in data["data"]

    def test_get_invalid_section(self, client):
        """GET /api/platform-config/invalid returns 400."""
        resp = client.get("/api/platform-config/invalid")
        assert resp.status_code == 400

    def test_patch_creates_row(self, client, write_headers):
        """PATCH /api/platform-config/kafka creates a row on first save."""
        resp = client.patch(
            "/api/platform-config/kafka",
            json={"bootstrap_servers": "broker1:9092,broker2:9092"},
            headers=write_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["bootstrap_servers"]["value"] == "broker1:9092,broker2:9092"
        assert data["data"]["_meta"]["has_row"] is True

    def test_patch_updates_existing(self, client, write_headers):
        """PATCH on existing row updates values."""
        client.patch(
            "/api/platform-config/clickhouse",
            json={"url": "http://ch1:8123"},
            headers=write_headers,
        )
        resp = client.patch(
            "/api/platform-config/clickhouse",
            json={"url": "http://ch2:8123", "database_name": "prod"},
            headers=write_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["url"]["value"] == "http://ch2:8123"
        assert data["data"]["database_name"]["value"] == "prod"

    def test_patch_requires_auth(self, client):
        """PATCH without auth returns 403."""
        resp = client.patch(
            "/api/platform-config/kafka",
            json={"bootstrap_servers": "test"},
        )
        assert resp.status_code == 403

    def test_patch_invalid_section(self, client, write_headers):
        """PATCH to invalid section returns 400."""
        resp = client.patch(
            "/api/platform-config/invalid",
            json={"key": "value"},
            headers=write_headers,
        )
        assert resp.status_code == 400

    def test_secret_masking(self, client, write_headers):
        """Secret fields should be masked in GET response."""
        client.patch(
            "/api/platform-config/clickhouse",
            json={"password": "supersecret123"},
            headers=write_headers,
        )
        resp = client.get("/api/platform-config/clickhouse")
        data = resp.json()
        password = data["data"]["password"]
        assert password["is_secret"] is True
        # Should be masked: ****xxxx
        assert password["value"].startswith("****")
        assert "supersecret123" not in password["value"]

    def test_patch_gen_ai(self, client, write_headers):
        """PATCH gen_ai section works for system prompt."""
        resp = client.patch(
            "/api/platform-config/gen_ai",
            json={
                "provider": "openai",
                "model": "gpt-4o",
                "system_prompt": "You are a Sandarb context generator...",
            },
            headers=write_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["provider"]["value"] == "openai"
        assert data["data"]["model"]["value"] == "gpt-4o"
        assert "Sandarb" in data["data"]["system_prompt"]["value"]

    def test_test_kafka(self, client):
        """POST /api/platform-config/kafka/test returns a status."""
        resp = client.post("/api/platform-config/kafka/test")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data["data"]

    def test_test_gen_ai(self, client):
        """POST /api/platform-config/gen_ai/test returns config status."""
        resp = client.post("/api/platform-config/gen_ai/test")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data["data"]


class TestNotificationsAPI:
    """Test GET /api/notifications/health endpoint."""

    def test_health_feed(self, client):
        """GET /api/notifications/health returns all infrastructure checks."""
        resp = client.get("/api/notifications/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "overall" in data["data"]
        assert "summary" in data["data"]
        assert "items" in data["data"]
        items = data["data"]["items"]
        assert len(items) >= 4  # at least core services
        # Each item has required fields
        for item in items:
            assert "id" in item
            assert "name" in item
            assert "status" in item
            assert "detail" in item
            assert "checked_at" in item

    def test_health_feed_has_categories(self, client):
        """Health feed items have both core and data-platform categories."""
        resp = client.get("/api/notifications/health")
        items = resp.json()["data"]["items"]
        categories = {i["category"] for i in items}
        assert "core" in categories
        assert "data-platform" in categories

    def test_health_summary_counts(self, client):
        """Summary counts add up to total."""
        resp = client.get("/api/notifications/health")
        summary = resp.json()["data"]["summary"]
        assert (
            summary["healthy"]
            + summary["unhealthy"]
            + summary["not_configured"]
            + summary["info"]
            == summary["total"]
        )
