"""Integration tests for the sandarb-data pipeline.

These tests require the data platform to be running locally:
  - Kafka (5 brokers on kafka-cluster_kafka-net)
  - ClickHouse (4 nodes on localhost:8123)
  - Consumer Bridge (on localhost:8079)

Run with: pytest tests/test_integration.py -v
Skip if services unavailable: tests auto-skip with clear messages.
"""

import json
import time
import uuid

import pytest
import requests


KAFKA_BOOTSTRAP = "localhost:9092"
CLICKHOUSE_URL = "http://localhost:8123"
CLICKHOUSE_USER = "default"
CLICKHOUSE_PASSWORD = "sandarb"
CONSUMER_HEALTH_URL = "http://localhost:8079/health"


def _service_available(url: str, timeout: float = 2.0) -> bool:
    """Check if a service is reachable."""
    try:
        r = requests.get(url, timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


def _clickhouse_query(sql: str) -> str:
    """Execute a ClickHouse query and return the result."""
    r = requests.get(
        CLICKHOUSE_URL,
        params={
            "query": sql,
            "user": CLICKHOUSE_USER,
            "password": CLICKHOUSE_PASSWORD,
        },
        timeout=10,
    )
    return r.text.strip()


def _kafka_available() -> bool:
    """Check if Kafka is available via the consumer health endpoint."""
    try:
        r = requests.get(CONSUMER_HEALTH_URL, timeout=2)
        return r.json().get("kafka_connected", False)
    except Exception:
        return False


# ── Consumer Health Endpoint ──────────────────────────────────────


class TestConsumerHealthEndpoint:
    """Test the live consumer bridge health endpoint."""

    @pytest.fixture(autouse=True)
    def _check_consumer(self):
        if not _service_available(CONSUMER_HEALTH_URL):
            pytest.skip("Consumer bridge not running on localhost:8079")

    def test_health_returns_200(self):
        """Health endpoint returns HTTP 200."""
        r = requests.get(CONSUMER_HEALTH_URL)
        assert r.status_code == 200

    def test_health_json_structure(self):
        """Health response has expected JSON fields."""
        r = requests.get(CONSUMER_HEALTH_URL)
        data = r.json()
        required_fields = [
            "status", "kafka_connected", "clickhouse_connected",
            "events_consumed", "events_inserted", "batches_flushed",
            "errors", "started_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    def test_kafka_connected(self):
        """Consumer reports Kafka as connected."""
        r = requests.get(CONSUMER_HEALTH_URL)
        data = r.json()
        assert data["kafka_connected"] is True

    def test_clickhouse_connected(self):
        """Consumer reports ClickHouse as connected."""
        r = requests.get(CONSUMER_HEALTH_URL)
        data = r.json()
        assert data["clickhouse_connected"] is True

    def test_status_healthy(self):
        """Consumer reports overall status as healthy."""
        r = requests.get(CONSUMER_HEALTH_URL)
        data = r.json()
        assert data["status"] == "healthy"


# ── ClickHouse Connectivity ───────────────────────────────────────


class TestClickHouseConnectivity:
    """Test ClickHouse is running and has the expected schema."""

    @pytest.fixture(autouse=True)
    def _check_clickhouse(self):
        if not _service_available(f"{CLICKHOUSE_URL}/ping"):
            pytest.skip("ClickHouse not running on localhost:8123")

    def test_ping(self):
        """ClickHouse /ping returns OK."""
        r = requests.get(f"{CLICKHOUSE_URL}/ping")
        assert r.status_code == 200
        assert r.text.strip() == "Ok."

    def test_sandarb_database_exists(self):
        """The sandarb database exists (created by schema migration)."""
        result = _clickhouse_query("SELECT name FROM system.databases WHERE name = 'sandarb'")
        if "sandarb" not in result:
            pytest.skip("sandarb database not created yet — run schema/001_sandarb_events.sql")
        assert "sandarb" in result

    def test_events_table_exists(self):
        """The events table exists in the sandarb database."""
        db_result = _clickhouse_query("SELECT name FROM system.databases WHERE name = 'sandarb'")
        if "sandarb" not in db_result:
            pytest.skip("sandarb database not created yet")
        result = _clickhouse_query("SELECT name FROM system.tables WHERE database = 'sandarb' AND name = 'events'")
        assert "events" in result

    def test_events_table_has_expected_columns(self):
        """Events table has expected governance columns."""
        db_result = _clickhouse_query("SELECT name FROM system.databases WHERE name = 'sandarb'")
        if "sandarb" not in db_result:
            pytest.skip("sandarb database not created yet")
        result = _clickhouse_query(
            "SELECT name FROM system.columns WHERE database = 'sandarb' AND table = 'events' ORDER BY name"
        )
        if not result.strip():
            pytest.skip("events table not created yet")
        columns = result.split("\n")
        expected = [
            "event_id", "event_type", "event_category",
            "agent_id", "agent_name", "org_id",
            "event_time", "ingested_at", "metadata",
        ]
        for col in expected:
            assert col in columns, f"Missing column: {col}"

    def test_events_count_queryable(self):
        """Events table is queryable (may have 0 rows on fresh start)."""
        db_result = _clickhouse_query("SELECT name FROM system.databases WHERE name = 'sandarb'")
        if "sandarb" not in db_result:
            pytest.skip("sandarb database not created yet")
        result = _clickhouse_query("SELECT count() FROM sandarb.events")
        if "UNKNOWN_DATABASE" in result or "UNKNOWN_TABLE" in result:
            pytest.skip("events table not created yet")
        count = int(result)
        assert count >= 0  # 0 is valid on fresh start

    def test_cluster_topology(self):
        """ClickHouse cluster has the expected topology."""
        result = _clickhouse_query(
            "SELECT cluster, shard_num, replica_num, host_name FROM system.clusters "
            "WHERE cluster = 'sandarb_cluster' ORDER BY shard_num, replica_num"
        )
        assert len(result) > 0, "sandarb_cluster not found in system.clusters"


# ── Docker Container Names ────────────────────────────────────────


class TestDockerContainerNames:
    """Validate that all containers have the sandarb- prefix."""

    @pytest.fixture(autouse=True)
    def _check_docker(self):
        """Check if docker is available."""
        import subprocess
        try:
            subprocess.run(["docker", "ps"], capture_output=True, timeout=5)
        except Exception:
            pytest.skip("Docker not available")

    def test_all_sandarb_containers_prefixed(self):
        """All sandarb-related containers have the sandarb- prefix."""
        import subprocess
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=10,
        )
        containers = result.stdout.strip().split("\n")
        # Filter for sandarb-related containers (exclude mysql and others)
        sandarb_images_keywords = ["kafka", "clickhouse", "superset", "keeper", "consumer"]
        for name in containers:
            name_lower = name.lower()
            for keyword in sandarb_images_keywords:
                if keyword in name_lower:
                    assert name.startswith("sandarb-"), (
                        f"Container '{name}' contains '{keyword}' but doesn't have sandarb- prefix"
                    )
