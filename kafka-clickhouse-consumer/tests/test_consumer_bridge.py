"""Unit tests for the Kafka→ClickHouse consumer bridge.

Tests cover:
  - Event parsing (_parse_event)
  - Timestamp fixing (_fix_timestamp)
  - Metrics tracking (Metrics)
  - Health endpoint (HealthHandler)
  - ClickHouse client (ClickHouseClient)
"""

import json
import threading
import time
import urllib.request
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

# Import from the consumer bridge module
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from consumer_bridge import (
    _parse_event,
    _fix_timestamp,
    Metrics,
    ClickHouseClient,
    HealthHandler,
    _start_health_server,
    JSONFormatter,
)


# ── Timestamp Fixing ──────────────────────────────────────────────


class TestFixTimestamp:
    """Test _fix_timestamp conversion for ClickHouse DateTime64."""

    def test_iso_to_clickhouse(self):
        """ISO 8601 with T and Z is converted to ClickHouse space-separated format."""
        result = _fix_timestamp("2026-01-21T00:21:40.524Z")
        assert result == "2026-01-21 00:21:40.524"

    def test_iso_without_z(self):
        """ISO 8601 without trailing Z still gets T replaced."""
        result = _fix_timestamp("2026-01-21T14:30:00.000")
        assert result == "2026-01-21 14:30:00.000"

    def test_empty_string_returns_now(self):
        """Empty timestamp returns current time."""
        result = _fix_timestamp("")
        assert len(result) > 0
        # Should be in ClickHouse format: YYYY-MM-DD HH:MM:SS.mmm
        assert "T" not in result
        assert "Z" not in result

    def test_none_returns_now(self):
        """None/falsy timestamp returns current time."""
        result = _fix_timestamp(None)
        assert len(result) > 0

    def test_already_clickhouse_format(self):
        """Already in ClickHouse format passes through cleanly."""
        result = _fix_timestamp("2026-01-21 00:21:40.524")
        assert result == "2026-01-21 00:21:40.524"


# ── Event Parsing ─────────────────────────────────────────────────


class TestParseEvent:
    """Test _parse_event Kafka message → ClickHouse row conversion."""

    def _make_event(self, **overrides) -> bytes:
        """Create a minimal valid Kafka event message."""
        event = {
            "event_id": "evt-001",
            "event_type": "context.inject",
            "event_category": "audit",
            "agent_id": "agent-01",
            "agent_name": "Test Agent",
            "org_id": "org-01",
            "org_name": "Test Org",
            "context_id": "ctx-01",
            "context_name": "Test Context",
            "event_time": "2026-01-21T00:21:40.524Z",
            "trace_id": "trace-001",
            "severity": "info",
            "metadata": {"key": "value"},
        }
        event.update(overrides)
        return json.dumps(event).encode("utf-8")

    def test_valid_event(self):
        """A well-formed event is parsed into a complete ClickHouse row."""
        row = _parse_event(self._make_event())
        assert row is not None
        assert row["event_id"] == "evt-001"
        assert row["event_type"] == "context.inject"
        assert row["event_category"] == "audit"
        assert row["agent_id"] == "agent-01"
        assert row["agent_name"] == "Test Agent"
        assert row["org_id"] == "org-01"
        assert row["trace_id"] == "trace-001"

    def test_timestamp_converted(self):
        """event_time is converted from ISO to ClickHouse format."""
        row = _parse_event(self._make_event())
        assert row["event_time"] == "2026-01-21 00:21:40.524"

    def test_ingested_at_set(self):
        """ingested_at is set to current time in ClickHouse format."""
        row = _parse_event(self._make_event())
        assert "ingested_at" in row
        assert "T" not in row["ingested_at"]
        assert "Z" not in row["ingested_at"]

    def test_metadata_dict_serialized(self):
        """Dict metadata is JSON-serialized to a string."""
        row = _parse_event(self._make_event(metadata={"key": "value"}))
        assert row["metadata"] == '{"key": "value"}'

    def test_metadata_string_passthrough(self):
        """String metadata passes through as-is."""
        row = _parse_event(self._make_event(metadata='{"raw":"string"}'))
        assert row["metadata"] == '{"raw":"string"}'

    def test_missing_fields_default_empty(self):
        """Missing optional fields default to empty strings or zero."""
        minimal = json.dumps({"event_id": "evt-min"}).encode("utf-8")
        row = _parse_event(minimal)
        assert row is not None
        assert row["event_id"] == "evt-min"
        assert row["event_type"] == ""
        assert row["agent_id"] == ""
        assert row["version_number"] == 0
        assert row["template_rendered"] is False

    def test_invalid_json_returns_none(self):
        """Invalid JSON returns None (skip the message)."""
        result = _parse_event(b"not valid json")
        assert result is None

    def test_empty_bytes_returns_none(self):
        """Empty bytes that aren't valid JSON returns None."""
        result = _parse_event(b"")
        assert result is None

    def test_version_number_cast_to_int(self):
        """version_number is cast to int even if given as string."""
        row = _parse_event(self._make_event(version_number="5"))
        assert row["version_number"] == 5
        assert isinstance(row["version_number"], int)

    def test_template_rendered_cast_to_bool(self):
        """template_rendered is cast to bool."""
        row = _parse_event(self._make_event(template_rendered=True))
        assert row["template_rendered"] is True
        row2 = _parse_event(self._make_event(template_rendered=0))
        assert row2["template_rendered"] is False

    def test_all_fields_present(self):
        """All expected ClickHouse column fields are present in the parsed row."""
        row = _parse_event(self._make_event())
        expected_fields = [
            "event_id", "event_type", "event_category",
            "agent_id", "agent_name", "org_id", "org_name",
            "context_id", "context_name", "version_id", "version_number",
            "prompt_id", "prompt_name", "data_classification",
            "governance_hash", "hash_type", "template_rendered",
            "denial_reason", "violation_type", "severity",
            "trace_id", "source_ip", "request_method", "request_path",
            "event_time", "ingested_at", "metadata",
        ]
        for field in expected_fields:
            assert field in row, f"Missing field: {field}"


# ── Metrics ───────────────────────────────────────────────────────


class TestMetrics:
    """Test thread-safe Metrics tracking."""

    def test_initial_state(self):
        """Fresh metrics start with zero counts and unhealthy status."""
        m = Metrics()
        snap = m.snapshot()
        assert snap["events_consumed"] == 0
        assert snap["events_inserted"] == 0
        assert snap["batches_flushed"] == 0
        assert snap["errors"] == 0
        assert snap["kafka_connected"] is False
        assert snap["clickhouse_connected"] is False
        assert snap["status"] == "unhealthy"

    def test_healthy_when_both_connected(self):
        """Status is healthy only when both Kafka and ClickHouse are connected."""
        m = Metrics()
        m.kafka_connected = True
        m.clickhouse_connected = True
        assert m.snapshot()["status"] == "healthy"

    def test_unhealthy_if_kafka_disconnected(self):
        """Status is unhealthy if Kafka is not connected."""
        m = Metrics()
        m.kafka_connected = False
        m.clickhouse_connected = True
        assert m.snapshot()["status"] == "unhealthy"

    def test_unhealthy_if_clickhouse_disconnected(self):
        """Status is unhealthy if ClickHouse is not connected."""
        m = Metrics()
        m.kafka_connected = True
        m.clickhouse_connected = False
        assert m.snapshot()["status"] == "unhealthy"

    def test_record_consume(self):
        """record_consume increments events_consumed."""
        m = Metrics()
        m.record_consume(10)
        m.record_consume(5)
        assert m.snapshot()["events_consumed"] == 15

    def test_record_insert(self):
        """record_insert increments events_inserted and batches_flushed."""
        m = Metrics()
        m.record_insert(100)
        m.record_insert(200)
        snap = m.snapshot()
        assert snap["events_inserted"] == 300
        assert snap["batches_flushed"] == 2
        assert snap["last_flush_at"] != ""

    def test_record_error(self):
        """record_error increments error count."""
        m = Metrics()
        m.record_error(3)
        m.record_error()
        assert m.snapshot()["errors"] == 4

    def test_started_at_set(self):
        """started_at is set on creation."""
        m = Metrics()
        assert m.snapshot()["started_at"] != ""

    def test_thread_safety(self):
        """Metrics can be safely accessed from multiple threads."""
        m = Metrics()
        errors = []

        def worker():
            try:
                for _ in range(1000):
                    m.record_consume()
                    m.record_insert(1)
                    m.record_error()
                    m.snapshot()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        snap = m.snapshot()
        assert snap["events_consumed"] == 4000
        assert snap["events_inserted"] == 4000
        assert snap["batches_flushed"] == 4000
        assert snap["errors"] == 4000


# ── ClickHouse Client ─────────────────────────────────────────────


class TestClickHouseClient:
    """Test ClickHouse HTTP client."""

    def test_init_strips_trailing_slash(self):
        """URL has trailing slash stripped."""
        client = ClickHouseClient("http://localhost:8123/", "sandarb", "default", "pass")
        assert client.url == "http://localhost:8123"

    def test_auth_params_set(self):
        """Auth params include user and password when provided."""
        client = ClickHouseClient("http://localhost:8123", "sandarb", "myuser", "mypass")
        assert client.auth_params["user"] == "myuser"
        assert client.auth_params["password"] == "mypass"

    def test_auth_params_empty_when_no_creds(self):
        """Auth params are empty when user and password are empty."""
        client = ClickHouseClient("http://localhost:8123", "sandarb", "", "")
        assert "user" not in client.auth_params
        assert "password" not in client.auth_params

    @patch("consumer_bridge.requests.Session")
    def test_ping_success(self, mock_session_cls):
        """ping() returns True when ClickHouse responds with 200."""
        mock_session = MagicMock()
        mock_session.get.return_value = MagicMock(status_code=200)
        mock_session_cls.return_value = mock_session

        client = ClickHouseClient("http://localhost:8123", "sandarb", "default", "pass")
        assert client.ping() is True

    @patch("consumer_bridge.requests.Session")
    def test_ping_failure(self, mock_session_cls):
        """ping() returns False when ClickHouse is unreachable."""
        mock_session = MagicMock()
        mock_session.get.side_effect = ConnectionError("refused")
        mock_session_cls.return_value = mock_session

        client = ClickHouseClient("http://localhost:8123", "sandarb", "default", "pass")
        assert client.ping() is False

    @patch("consumer_bridge.requests.Session")
    def test_insert_batch_success(self, mock_session_cls):
        """insert_batch returns count when ClickHouse returns 200."""
        mock_session = MagicMock()
        mock_session.post.return_value = MagicMock(status_code=200)
        mock_session_cls.return_value = mock_session

        client = ClickHouseClient("http://localhost:8123", "sandarb", "default", "pass")
        rows = [{"event_id": "1"}, {"event_id": "2"}]
        result = client.insert_batch(rows)
        assert result == 2

    @patch("consumer_bridge.requests.Session")
    def test_insert_batch_empty(self, mock_session_cls):
        """insert_batch with empty list returns 0 without making a request."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        client = ClickHouseClient("http://localhost:8123", "sandarb", "default", "pass")
        result = client.insert_batch([])
        assert result == 0
        mock_session.post.assert_not_called()

    @patch("consumer_bridge.time.sleep")
    @patch("consumer_bridge.requests.Session")
    def test_insert_batch_retry_on_failure(self, mock_session_cls, mock_sleep):
        """insert_batch retries on HTTP errors with exponential backoff."""
        mock_session = MagicMock()
        mock_response_fail = MagicMock(status_code=500, text="Internal Server Error")
        mock_response_ok = MagicMock(status_code=200)
        mock_session.post.side_effect = [mock_response_fail, mock_response_ok]
        mock_session_cls.return_value = mock_session

        client = ClickHouseClient("http://localhost:8123", "sandarb", "default", "pass")
        rows = [{"event_id": "1"}]
        result = client.insert_batch(rows)
        assert result == 1
        assert mock_session.post.call_count == 2
        mock_sleep.assert_called_once_with(2)  # 2^1 = 2s backoff

    @patch("consumer_bridge.time.sleep")
    @patch("consumer_bridge.requests.Session")
    def test_insert_batch_all_retries_fail(self, mock_session_cls, mock_sleep):
        """insert_batch returns 0 when all retries fail."""
        mock_session = MagicMock()
        mock_session.post.return_value = MagicMock(status_code=500, text="Error")
        mock_session_cls.return_value = mock_session

        client = ClickHouseClient("http://localhost:8123", "sandarb", "default", "pass")
        rows = [{"event_id": "1"}]
        result = client.insert_batch(rows)
        assert result == 0
        assert mock_session.post.call_count == 3  # INSERT_MAX_RETRIES = 3


# ── JSON Formatter ────────────────────────────────────────────────


class TestJSONFormatter:
    """Test structured JSON log formatting."""

    def test_formats_as_json(self):
        """Log records are formatted as valid JSON."""
        import logging

        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0,
            msg="Hello world", args=(), exc_info=None,
        )
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["msg"] == "Hello world"
        assert parsed["level"] == "INFO"
        assert "ts" in parsed
        assert "logger" in parsed

    def test_includes_exception(self):
        """Exception info is included in JSON output."""
        import logging

        formatter = JSONFormatter()
        try:
            raise ValueError("test error")
        except ValueError:
            import sys
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test", level=logging.ERROR, pathname="", lineno=0,
            msg="Error occurred", args=(), exc_info=exc_info,
        )
        output = formatter.format(record)
        parsed = json.loads(output)
        assert "exception" in parsed
        assert "ValueError" in parsed["exception"]


# ── Health Endpoint ───────────────────────────────────────────────


class TestHealthEndpoint:
    """Test the HTTP health endpoint."""

    @pytest.fixture(autouse=True)
    def _setup_health_server(self):
        """Start health server on a random port for testing."""
        # Use a different port to avoid conflicts
        import consumer_bridge

        original_port = consumer_bridge.HEALTH_PORT
        consumer_bridge.HEALTH_PORT = 18079  # test port
        self.port = 18079

        # Create fresh metrics for each test
        self.original_metrics = consumer_bridge.metrics
        consumer_bridge.metrics = Metrics()

        from http.server import HTTPServer

        server = HTTPServer(("127.0.0.1", self.port), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        time.sleep(0.1)  # let server start

        yield

        server.shutdown()
        consumer_bridge.HEALTH_PORT = original_port
        consumer_bridge.metrics = self.original_metrics

    def test_health_returns_200(self):
        """GET /health returns HTTP 200."""
        resp = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/health")
        assert resp.status == 200

    def test_health_returns_json(self):
        """GET /health returns valid JSON with expected fields."""
        resp = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/health")
        data = json.loads(resp.read())
        assert "status" in data
        assert "kafka_connected" in data
        assert "clickhouse_connected" in data
        assert "events_consumed" in data
        assert "events_inserted" in data
        assert "errors" in data

    def test_404_on_unknown_path(self):
        """Non /health paths return 404."""
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{self.port}/unknown")
            assert False, "Should have raised HTTPError"
        except urllib.error.HTTPError as e:
            assert e.code == 404
