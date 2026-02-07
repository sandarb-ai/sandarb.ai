"""Platform configuration router — Kafka, ClickHouse, Superset, Gen AI settings.

Endpoints:
  GET    /platform-config               → all sections
  GET    /platform-config/{section}      → single section
  PATCH  /platform-config/{section}      → update (write auth)
  POST   /platform-config/{section}/test → test connectivity
"""

import logging

from fastapi import APIRouter, HTTPException, Depends

from backend.write_auth import require_write_allowed
from backend.services import platform_config as svc
from backend.schemas.common import ApiResponse

router = APIRouter(prefix="/platform-config", tags=["platform-config"])
logger = logging.getLogger(__name__)

VALID_SECTIONS = {"kafka", "clickhouse", "superset", "gen_ai"}


def _validate_section(section: str) -> str:
    if section not in VALID_SECTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown section: {section}. Valid: {', '.join(sorted(VALID_SECTIONS))}")
    return section


@router.get("", response_model=ApiResponse)
def get_all_configs():
    """Get all platform config sections."""
    data = svc.get_all_configs()
    return ApiResponse(success=True, data=data)


@router.get("/{section}", response_model=ApiResponse)
def get_config(section: str):
    """Get config for a single section."""
    section = _validate_section(section)
    data = svc.get_config(section)
    return ApiResponse(success=True, data=data)


@router.patch("/{section}", response_model=ApiResponse)
def update_config(section: str, body: dict, email: str = Depends(require_write_allowed)):
    """Update config for a section. Only provided keys are updated."""
    section = _validate_section(section)
    try:
        data = svc.update_config(section, body, updated_by=email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ApiResponse(success=True, data=data)


@router.post("/{section}/test", response_model=ApiResponse)
def test_connection(section: str):
    """Test connectivity for a section."""
    section = _validate_section(section)

    if section == "kafka":
        return _test_kafka()
    elif section == "clickhouse":
        return _test_clickhouse()
    elif section == "superset":
        return _test_superset()
    elif section == "gen_ai":
        return _test_gen_ai()

    raise HTTPException(status_code=400, detail=f"No test available for: {section}")


# ── Test helpers ──────────────────────────────────────────────────────

def _test_kafka() -> ApiResponse:
    """Test Kafka connectivity by listing topics."""
    try:
        from confluent_kafka import Producer

        servers = svc.get_raw_value("kafka", "bootstrap_servers")
        enabled = svc.get_raw_value("kafka", "enabled")

        if enabled == "false":
            return ApiResponse(success=True, data={"status": "disabled", "message": "Kafka is disabled in configuration"})

        if not servers:
            return ApiResponse(success=False, data={"status": "error", "message": "No bootstrap servers configured"})

        producer = Producer({"bootstrap.servers": servers})
        metadata = producer.list_topics(timeout=5)
        broker_count = len(metadata.brokers)
        topic_count = len(metadata.topics)

        return ApiResponse(success=True, data={
            "status": "connected",
            "brokers": broker_count,
            "topics": topic_count,
            "bootstrap_servers": servers,
        })
    except ImportError:
        return ApiResponse(success=False, data={"status": "error", "message": "confluent-kafka not installed"})
    except Exception as e:
        return ApiResponse(success=False, data={"status": "error", "message": str(e)})


def _test_clickhouse() -> ApiResponse:
    """Test ClickHouse connectivity via HTTP ping."""
    try:
        import urllib.request
        import urllib.error

        url = svc.get_raw_value("clickhouse", "url")
        if not url:
            return ApiResponse(success=False, data={"status": "error", "message": "No ClickHouse URL configured"})

        ping_url = url.rstrip("/") + "/ping"
        req = urllib.request.Request(ping_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode().strip()
            return ApiResponse(success=True, data={
                "status": "connected",
                "url": url,
                "response": body,
            })
    except Exception as e:
        return ApiResponse(success=False, data={"status": "error", "message": str(e)})


def _test_superset() -> ApiResponse:
    """Test Superset connectivity via health endpoint."""
    try:
        import urllib.request
        import urllib.error

        url = svc.get_raw_value("superset", "url")
        if not url:
            return ApiResponse(success=False, data={"status": "error", "message": "No Superset URL configured"})

        health_url = url.rstrip("/") + "/health"
        req = urllib.request.Request(health_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode().strip()
            return ApiResponse(success=True, data={
                "status": "connected",
                "url": url,
                "response": body,
            })
    except Exception as e:
        return ApiResponse(success=False, data={"status": "error", "message": str(e)})


def _test_gen_ai() -> ApiResponse:
    """Validate Gen AI configuration (no API call — just check config is set)."""
    provider = svc.get_raw_value("gen_ai", "provider")
    model = svc.get_raw_value("gen_ai", "model")
    api_key = svc.get_raw_value("gen_ai", "api_key")

    issues = []
    if not provider:
        issues.append("No provider configured")
    if not model:
        issues.append("No model configured")
    if not api_key:
        issues.append("No API key configured")

    if issues:
        return ApiResponse(success=False, data={
            "status": "incomplete",
            "issues": issues,
            "provider": provider or "(not set)",
            "model": model or "(not set)",
        })

    return ApiResponse(success=True, data={
        "status": "configured",
        "provider": provider,
        "model": model,
        "api_key_set": True,
    })
