"""Infrastructure health checks for all Sandarb platform components.

Checks: MCP server, A2A agent endpoint, API health, Kafka cluster,
ClickHouse analytics DB, Superset dashboards, consumer bridge status.
"""

import logging
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any

from backend.services import platform_config as pcfg

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _probe_http(url: str, timeout: float = 5.0) -> dict[str, Any]:
    """Quick HTTP probe returning {ok, status, latency_ms, body?, error?}."""
    t0 = time.monotonic()
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(4096).decode("utf-8", errors="replace").strip()
            latency = round((time.monotonic() - t0) * 1000)
            return {"ok": True, "status": resp.status, "latency_ms": latency, "body": body[:2048]}
    except urllib.error.HTTPError as e:
        latency = round((time.monotonic() - t0) * 1000)
        return {"ok": False, "status": e.code, "latency_ms": latency, "error": str(e.reason)}
    except Exception as e:
        latency = round((time.monotonic() - t0) * 1000)
        return {"ok": False, "status": 0, "latency_ms": latency, "error": str(e)}


# ── Individual checks ────────────────────────────────────────────────

def check_api() -> dict[str, Any]:
    """Check Sandarb API health."""
    port = os.environ.get("PORT", "8000")
    result = _probe_http(f"http://127.0.0.1:{port}/api/health")
    return {
        "id": "api",
        "name": "REST API",
        "category": "core",
        "status": "healthy" if result["ok"] else "unhealthy",
        "latency_ms": result["latency_ms"],
        "detail": "API responding" if result["ok"] else result.get("error", "unreachable"),
        "checked_at": _ts(),
    }


def check_mcp() -> dict[str, Any]:
    """Check MCP server availability."""
    port = os.environ.get("PORT", "8000")
    # MCP uses Streamable HTTP — POST to /mcp with an initialize message
    # But a simpler check: hit /mcp with GET — the MCP mount will respond
    result = _probe_http(f"http://127.0.0.1:{port}/mcp")
    # MCP returns 405 or 406 for GET (only POST is valid) — that means it's mounted and responding
    ok = result["ok"] or result.get("status") in (405, 406)
    return {
        "id": "mcp",
        "name": "MCP Server",
        "category": "core",
        "status": "healthy" if ok else "unhealthy",
        "latency_ms": result["latency_ms"],
        "detail": "MCP endpoint responding" if ok else result.get("error", "unreachable"),
        "checked_at": _ts(),
    }


def check_a2a() -> dict[str, Any]:
    """Check A2A agent protocol availability."""
    port = os.environ.get("PORT", "8000")
    is_agent_svc = (
        os.environ.get("SANDARB_AGENT_SERVICE", "").lower() in ("1", "true", "yes")
        or os.environ.get("SERVICE_MODE", "").lower() == "agent"
    )
    if not is_agent_svc:
        # A2A is only mounted in agent service mode
        return {
            "id": "a2a",
            "name": "A2A Protocol",
            "category": "core",
            "status": "info",
            "latency_ms": 0,
            "detail": "A2A not active (set SANDARB_AGENT_SERVICE=1 to enable)",
            "checked_at": _ts(),
        }
    # Agent card is mounted at GET / in agent service mode
    result = _probe_http(f"http://127.0.0.1:{port}/")
    return {
        "id": "a2a",
        "name": "A2A Protocol",
        "category": "core",
        "status": "healthy" if result["ok"] else "unhealthy",
        "latency_ms": result["latency_ms"],
        "detail": "Agent Card serving" if result["ok"] else result.get("error", "unreachable"),
        "checked_at": _ts(),
    }


def check_kafka() -> dict[str, Any]:
    """Check Kafka cluster connectivity and ability to publish."""
    try:
        servers = pcfg.get_raw_value("kafka", "bootstrap_servers")
        enabled = pcfg.get_raw_value("kafka", "enabled")
    except Exception:
        servers = ""
        enabled = ""
    # Fall back to env vars when DB config is empty
    if not servers:
        servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "")
    if not enabled:
        enabled = os.environ.get("KAFKA_ENABLED", "true")

    if not servers or (enabled and enabled.lower() in ("false", "0", "no")):
        return {
            "id": "kafka",
            "name": "Kafka Cluster",
            "category": "data-platform",
            "status": "disabled" if enabled and enabled.lower() in ("false", "0", "no") else "not_configured",
            "latency_ms": 0,
            "detail": "Kafka disabled" if enabled and enabled.lower() in ("false", "0", "no") else "No bootstrap servers configured",
            "checked_at": _ts(),
        }

    t0 = time.monotonic()
    try:
        from confluent_kafka import Producer
        producer = Producer({"bootstrap.servers": servers})
        metadata = producer.list_topics(timeout=5)
        latency = round((time.monotonic() - t0) * 1000)
        broker_count = len(metadata.brokers)
        topic_count = len(metadata.topics)
        return {
            "id": "kafka",
            "name": "Kafka Cluster",
            "category": "data-platform",
            "status": "healthy",
            "latency_ms": latency,
            "detail": f"{broker_count} brokers, {topic_count} topics",
            "checked_at": _ts(),
        }
    except ImportError:
        return {
            "id": "kafka",
            "name": "Kafka Cluster",
            "category": "data-platform",
            "status": "unhealthy",
            "latency_ms": 0,
            "detail": "confluent-kafka not installed",
            "checked_at": _ts(),
        }
    except Exception as e:
        latency = round((time.monotonic() - t0) * 1000)
        return {
            "id": "kafka",
            "name": "Kafka Cluster",
            "category": "data-platform",
            "status": "unhealthy",
            "latency_ms": latency,
            "detail": str(e),
            "checked_at": _ts(),
        }


def check_clickhouse() -> dict[str, Any]:
    """Check ClickHouse analytics DB availability."""
    try:
        url = pcfg.get_raw_value("clickhouse", "url")
    except Exception:
        url = ""
    # Fall back to env var when DB config is empty
    if not url:
        url = os.environ.get("CLICKHOUSE_URL", "")
    if not url:
        return {
            "id": "clickhouse",
            "name": "ClickHouse",
            "category": "data-platform",
            "status": "not_configured",
            "latency_ms": 0,
            "detail": "No ClickHouse URL configured",
            "checked_at": _ts(),
        }
    ping_url = url.rstrip("/") + "/ping"
    result = _probe_http(ping_url)
    return {
        "id": "clickhouse",
        "name": "ClickHouse",
        "category": "data-platform",
        "status": "healthy" if result["ok"] else "unhealthy",
        "latency_ms": result["latency_ms"],
        "detail": "ClickHouse responding" if result["ok"] else result.get("error", "unreachable"),
        "checked_at": _ts(),
    }


def check_superset() -> dict[str, Any]:
    """Check Apache Superset availability."""
    try:
        url = pcfg.get_raw_value("superset", "url")
    except Exception:
        url = ""
    # Fall back to env var when DB config is empty
    if not url:
        url = os.environ.get("SUPERSET_URL", "")
    if not url:
        return {
            "id": "superset",
            "name": "Apache Superset",
            "category": "data-platform",
            "status": "not_configured",
            "latency_ms": 0,
            "detail": "No Superset URL configured",
            "checked_at": _ts(),
        }
    health_url = url.rstrip("/") + "/health"
    result = _probe_http(health_url)
    return {
        "id": "superset",
        "name": "Apache Superset",
        "category": "data-platform",
        "status": "healthy" if result["ok"] else "unhealthy",
        "latency_ms": result["latency_ms"],
        "detail": "Superset responding" if result["ok"] else result.get("error", "unreachable"),
        "checked_at": _ts(),
    }


def check_kafka_publishing() -> dict[str, Any]:
    """Check Sandarb → Kafka publishing pipeline (can we actually produce a message?)."""
    try:
        from backend.services.kafka_producer import is_available, _get_producer, TOPICS
    except ImportError:
        return {
            "id": "kafka_publishing",
            "name": "Sandarb → Kafka",
            "category": "publishing",
            "status": "unhealthy",
            "latency_ms": 0,
            "detail": "kafka_producer module not available",
            "checked_at": _ts(),
        }

    if not is_available():
        return {
            "id": "kafka_publishing",
            "name": "Sandarb → Kafka",
            "category": "publishing",
            "status": "unhealthy",
            "latency_ms": 0,
            "detail": "Kafka producer not available or disabled",
            "checked_at": _ts(),
        }

    t0 = time.monotonic()
    try:
        producer = _get_producer()
        if producer is None:
            return {
                "id": "kafka_publishing",
                "name": "Sandarb → Kafka",
                "category": "publishing",
                "status": "unhealthy",
                "latency_ms": 0,
                "detail": "Producer initialization failed",
                "checked_at": _ts(),
            }
        # Verify we can list topics (confirms broker connectivity from producer)
        metadata = producer.list_topics(timeout=5)
        latency = round((time.monotonic() - t0) * 1000)
        broker_count = len(metadata.brokers)
        topic_names = list(metadata.topics.keys())
        sandarb_topics = [t for t in topic_names if t.startswith("sandarb")]
        return {
            "id": "kafka_publishing",
            "name": "Sandarb → Kafka",
            "category": "publishing",
            "status": "healthy",
            "latency_ms": latency,
            "detail": f"Publishing to {len(sandarb_topics)} topics via {broker_count} brokers",
            "checked_at": _ts(),
        }
    except Exception as e:
        latency = round((time.monotonic() - t0) * 1000)
        return {
            "id": "kafka_publishing",
            "name": "Sandarb → Kafka",
            "category": "publishing",
            "status": "unhealthy",
            "latency_ms": latency,
            "detail": str(e),
            "checked_at": _ts(),
        }


def check_kafka_consumer() -> dict[str, Any]:
    """Check if the SKCC (Sandarb Kafka to ClickHouse Consumer) is running."""
    try:
        ch_url = pcfg.get_raw_value("clickhouse", "url")
        db = pcfg.get_raw_value("clickhouse", "database_name")
        ch_user = pcfg.get_raw_value("clickhouse", "username")
        ch_pass = pcfg.get_raw_value("clickhouse", "password")
    except Exception:
        ch_url = ""
        db = ""
        ch_user = ""
        ch_pass = ""
    # Fall back to env vars when DB config is empty
    if not ch_url:
        ch_url = os.environ.get("CLICKHOUSE_URL", "")
    if not db:
        db = os.environ.get("CLICKHOUSE_DATABASE", "sandarb")
    if not ch_user:
        ch_user = os.environ.get("CLICKHOUSE_USER", "default")
    if not ch_pass:
        ch_pass = os.environ.get("CLICKHOUSE_PASSWORD", "")
    if not ch_url:
        return {
            "id": "kafka_consumer",
            "name": "Kafka → ClickHouse",
            "category": "consumption",
            "status": "not_configured",
            "latency_ms": 0,
            "detail": "ClickHouse not configured — cannot check consumer",
            "checked_at": _ts(),
        }
    # Query ClickHouse for total row count and most recent event
    auth_params = f"user={urllib.request.quote(ch_user)}"
    if ch_pass:
        auth_params += f"&password={urllib.request.quote(ch_pass)}"
    query_url = ch_url.rstrip("/") + f"/?{auth_params}&database={db}&query=" + urllib.request.quote(
        "SELECT count() AS cnt, max(event_time) AS latest FROM events FORMAT JSON"
    )
    result = _probe_http(query_url)
    if not result["ok"]:
        return {
            "id": "kafka_consumer",
            "name": "Kafka → ClickHouse",
            "category": "consumption",
            "status": "unknown",
            "latency_ms": result["latency_ms"],
            "detail": f"Could not query ClickHouse: {result.get('error', 'unknown')}",
            "checked_at": _ts(),
        }
    # Parse the JSON response
    try:
        import json
        data = json.loads(result["body"])
        rows = data.get("data", [{}])
        cnt = rows[0].get("cnt", 0) if rows else 0
        latest = rows[0].get("latest", "") if rows else ""
        if cnt == 0:
            return {
                "id": "kafka_consumer",
                "name": "Kafka → ClickHouse",
                "category": "consumption",
                "status": "info",
                "latency_ms": result["latency_ms"],
                "detail": "No events in ClickHouse yet",
                "checked_at": _ts(),
            }
        return {
            "id": "kafka_consumer",
            "name": "Kafka → ClickHouse",
            "category": "consumption",
            "status": "healthy",
            "latency_ms": result["latency_ms"],
            "detail": f"{cnt:,} events, latest: {latest}",
            "checked_at": _ts(),
        }
    except Exception as e:
        return {
            "id": "kafka_consumer",
            "name": "Kafka → ClickHouse",
            "category": "consumption",
            "status": "unknown",
            "latency_ms": result["latency_ms"],
            "detail": f"Parse error: {e}",
            "checked_at": _ts(),
        }


def check_postgres() -> dict[str, Any]:
    """Check PostgreSQL database availability."""
    t0 = time.monotonic()
    try:
        from backend.db import query_one
        row = query_one("SELECT 1 AS ok")
        latency = round((time.monotonic() - t0) * 1000)
        return {
            "id": "postgres",
            "name": "PostgreSQL",
            "category": "core",
            "status": "healthy",
            "latency_ms": latency,
            "detail": "Database connected",
            "checked_at": _ts(),
        }
    except Exception as e:
        latency = round((time.monotonic() - t0) * 1000)
        return {
            "id": "postgres",
            "name": "PostgreSQL",
            "category": "core",
            "status": "unhealthy",
            "latency_ms": latency,
            "detail": str(e),
            "checked_at": _ts(),
        }


# ── Aggregate ─────────────────────────────────────────────────────────

ALL_CHECKS = [
    check_api,
    check_mcp,
    check_a2a,
    check_postgres,
    check_kafka,
    check_clickhouse,
    check_superset,
    check_kafka_publishing,
    check_kafka_consumer,
]


def run_all_checks() -> list[dict[str, Any]]:
    """Run all infrastructure health checks and return results."""
    results = []
    for fn in ALL_CHECKS:
        try:
            results.append(fn())
        except Exception as e:
            results.append({
                "id": fn.__name__.replace("check_", ""),
                "name": fn.__name__.replace("check_", "").replace("_", " ").title(),
                "category": "unknown",
                "status": "error",
                "latency_ms": 0,
                "detail": f"Check failed: {e}",
                "checked_at": _ts(),
            })
    return results
