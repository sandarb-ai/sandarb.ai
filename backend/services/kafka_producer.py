"""Sandarb Kafka Producer — publishes governance events to Kafka.

This module provides a singleton Kafka producer that the Sandarb backend
uses to publish all governance events (inject, audit, lifecycle, violations)
to the Kafka cluster for downstream analytics (ClickHouse, Spark, etc.).

Flow: Sandarb (UI, API, A2A, MCP) → Kafka → ClickHouse

The producer is created lazily on first use and reused across all requests.
If Kafka is unavailable, events are logged and the backend continues to
operate normally (graceful degradation — Postgres remains the source of truth).

Configuration:
  KAFKA_BOOTSTRAP_SERVERS  - Comma-separated broker list (default: localhost:9092)
  KAFKA_ENABLED            - Set to "false" to disable Kafka publishing (default: true)
"""

import hashlib
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────

KAFKA_BOOTSTRAP_SERVERS = os.environ.get(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092,localhost:9093,localhost:9094,localhost:9095,localhost:9096",
)
KAFKA_ENABLED = os.environ.get("KAFKA_ENABLED", "true").lower() in ("true", "1", "yes")

# Topic mapping
TOPICS = {
    "events":           "sandarb_events",        # Primary firehose (all events)
    "inject":           "sandarb.inject",         # Context injection events
    "audit":            "sandarb.audit",          # Immutable audit trail
    "agent-lifecycle":  "sandarb.agent-lifecycle", # Agent registration/approval
    "governance-proof": "sandarb.governance-proof", # Governance hash proofs
    "context-lifecycle": "sandarb.context-lifecycle", # Context version lifecycle
    "prompt-lifecycle": "sandarb.prompt-lifecycle",   # Prompt version lifecycle
    "policy-violations": "sandarb.policy-violations", # Policy violations
}

# ── Singleton producer ───────────────────────────────────────────────

_producer = None
_producer_available = None  # None = not checked, True/False = cached result


def _get_producer():
    """Lazily create and return the singleton Kafka producer."""
    global _producer, _producer_available

    if not KAFKA_ENABLED:
        return None

    if _producer is not None:
        return _producer

    if _producer_available is False:
        return None  # Previously failed, don't retry every request

    try:
        from confluent_kafka import Producer

        conf = {
            "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
            "client.id": "sandarb-api",
            # Throughput settings
            "linger.ms": 20,
            "batch.size": 65536,
            "compression.type": "lz4",
            "acks": "1",
            # Reliability
            "retries": 3,
            "retry.backoff.ms": 100,
            "queue.buffering.max.messages": 100000,
            "queue.buffering.max.kbytes": 262144,  # 256MB
        }
        _producer = Producer(conf)
        # Verify connectivity
        metadata = _producer.list_topics(timeout=5)
        broker_count = len(metadata.brokers)
        logger.info(f"Kafka producer connected: {broker_count} brokers at {KAFKA_BOOTSTRAP_SERVERS}")
        _producer_available = True
        return _producer

    except ImportError:
        logger.warning("confluent-kafka not installed — Kafka publishing disabled")
        _producer_available = False
        return None
    except Exception as e:
        logger.warning(f"Kafka unavailable ({e}) — events will be logged only to Postgres")
        _producer_available = False
        return None


def _delivery_cb(err, msg):
    """Kafka delivery callback (logged only on error)."""
    if err:
        logger.error(f"Kafka delivery failed: topic={msg.topic()} err={err}")


# ═══════════════════════════════════════════════════════════════════════
# Public API — publish governance events
# ═══════════════════════════════════════════════════════════════════════

def publish_event(
    event_type: str,
    event_category: str,
    *,
    agent_id: str = "",
    agent_name: str = "",
    org_id: str = "",
    org_name: str = "",
    context_id: str = "",
    context_name: str = "",
    version_id: str = "",
    version_number: int = 0,
    prompt_id: str = "",
    prompt_name: str = "",
    data_classification: str = "",
    governance_hash: str = "",
    template_rendered: bool = False,
    denial_reason: str = "",
    violation_type: str = "",
    severity: str = "",
    trace_id: str = "",
    source_ip: str = "",
    request_method: str = "",
    request_path: str = "",
    metadata: dict[str, Any] | None = None,
) -> str | None:
    """Publish a governance event to Kafka.

    Returns the event_id if published, None if Kafka is unavailable.
    Events are published to both the primary firehose topic (sandarb_events)
    and the category-specific topic (e.g. sandarb.inject).
    """
    producer = _get_producer()
    if producer is None:
        return None

    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    event = {
        "event_id": event_id,
        "event_type": event_type,
        "event_category": event_category,
        "agent_id": agent_id,
        "agent_name": agent_name,
        "org_id": org_id,
        "org_name": org_name,
        "context_id": str(context_id) if context_id else "",
        "context_name": context_name,
        "version_id": str(version_id) if version_id else "",
        "version_number": version_number,
        "prompt_id": str(prompt_id) if prompt_id else "",
        "prompt_name": prompt_name,
        "data_classification": data_classification,
        "governance_hash": governance_hash,
        "hash_type": "sha256" if governance_hash else "",
        "template_rendered": template_rendered,
        "denial_reason": denial_reason,
        "violation_type": violation_type,
        "severity": severity,
        "trace_id": trace_id,
        "source_ip": source_ip,
        "request_method": request_method,
        "request_path": request_path,
        "event_time": now,
        "ingested_at": now,
        "metadata": json.dumps(metadata) if metadata else "{}",
    }

    # Partition key: org_id for data locality (all events for an org go to same partition)
    key = (org_id or agent_id or "default").encode("utf-8")
    value = json.dumps(event).encode("utf-8")

    try:
        # 1. Primary firehose topic
        producer.produce(
            topic=TOPICS["events"],
            key=key,
            value=value,
            callback=_delivery_cb,
        )

        # 2. Category-specific topic (for filtered consumers)
        category_topic = TOPICS.get(event_category)
        if category_topic and category_topic != TOPICS["events"]:
            producer.produce(
                topic=category_topic,
                key=key,
                value=value,
                callback=_delivery_cb,
            )

        # Non-blocking poll to trigger delivery callbacks
        producer.poll(0)
        return event_id

    except Exception as e:
        logger.error(f"Kafka publish failed: {e}")
        return None


# ── Convenience methods for each event type ──────────────────────────

def publish_inject_success(
    agent_id: str,
    trace_id: str,
    context_id: str,
    context_name: str,
    version_id: str = "",
    governance_hash: str = "",
    rendered: bool = False,
    data_classification: str = "",
    org_id: str = "",
    org_name: str = "",
    source_ip: str = "",
    variables_count: int = 0,
) -> str | None:
    """Publish INJECT_SUCCESS event."""
    return publish_event(
        "INJECT_SUCCESS", "inject",
        agent_id=agent_id,
        trace_id=trace_id,
        context_id=context_id,
        context_name=context_name,
        version_id=version_id,
        governance_hash=governance_hash,
        template_rendered=rendered,
        data_classification=data_classification,
        org_id=org_id,
        org_name=org_name,
        source_ip=source_ip,
        request_method="POST",
        request_path="/api/inject",
        metadata={"variables_count": variables_count},
    )


def publish_inject_denied(
    agent_id: str,
    trace_id: str,
    context_id: str,
    context_name: str,
    reason: str,
    data_classification: str = "",
    org_id: str = "",
    org_name: str = "",
    source_ip: str = "",
) -> str | None:
    """Publish INJECT_DENIED event."""
    return publish_event(
        "INJECT_DENIED", "inject",
        agent_id=agent_id,
        trace_id=trace_id,
        context_id=context_id,
        context_name=context_name,
        denial_reason=reason,
        severity="HIGH",
        data_classification=data_classification,
        org_id=org_id,
        org_name=org_name,
        source_ip=source_ip,
        request_method="POST",
        request_path="/api/inject",
    )


def publish_prompt_used(
    agent_id: str,
    trace_id: str,
    prompt_id: str,
    prompt_name: str,
    version_number: int = 0,
    org_id: str = "",
    org_name: str = "",
) -> str | None:
    """Publish PROMPT_USED event."""
    return publish_event(
        "PROMPT_USED", "prompt-lifecycle",
        agent_id=agent_id,
        trace_id=trace_id,
        prompt_id=prompt_id,
        prompt_name=prompt_name,
        version_number=version_number,
        org_id=org_id,
        org_name=org_name,
        request_method="POST",
        request_path="/api/inject",
    )


def publish_prompt_denied(
    agent_id: str,
    trace_id: str,
    prompt_name: str,
    reason: str,
) -> str | None:
    """Publish PROMPT_DENIED event."""
    return publish_event(
        "PROMPT_DENIED", "prompt-lifecycle",
        agent_id=agent_id,
        trace_id=trace_id,
        prompt_name=prompt_name,
        denial_reason=reason,
        severity="MEDIUM",
        request_method="POST",
        request_path="/api/inject",
    )


def publish_governance_proof(
    agent_id: str,
    trace_id: str,
    context_id: str,
    context_name: str,
    governance_hash: str,
    version_number: int = 0,
    data_classification: str = "",
    org_id: str = "",
    regulatory_hooks: list[str] | None = None,
) -> str | None:
    """Publish GOVERNANCE_PROOF event (immutable proof of delivery)."""
    return publish_event(
        "GOVERNANCE_PROOF", "governance-proof",
        agent_id=agent_id,
        trace_id=trace_id,
        context_id=context_id,
        context_name=context_name,
        governance_hash=governance_hash,
        template_rendered=True,
        version_number=version_number,
        data_classification=data_classification,
        org_id=org_id,
        metadata={
            "proof_type": "delivery",
            "hash_stable": True,
            "regulatory_hooks": regulatory_hooks or [],
        },
    )


def publish_agent_lifecycle(
    event_type: str,
    agent_id: str,
    agent_name: str = "",
    org_id: str = "",
    org_name: str = "",
    a2a_url: str = "",
    approval_status: str = "",
) -> str | None:
    """Publish agent lifecycle event (AGENT_REGISTERED, AGENT_APPROVED, AGENT_DEACTIVATED)."""
    return publish_event(
        event_type, "agent-lifecycle",
        agent_id=agent_id,
        agent_name=agent_name,
        org_id=org_id,
        org_name=org_name,
        metadata={
            "a2a_url": a2a_url,
            "approval_status": approval_status,
        },
    )


def publish_context_lifecycle(
    event_type: str,
    context_id: str,
    context_name: str,
    version_id: str = "",
    version_number: int = 0,
    governance_hash: str = "",
    data_classification: str = "",
    org_id: str = "",
    status: str = "",
    approved_by: str = "",
) -> str | None:
    """Publish context lifecycle event."""
    return publish_event(
        event_type, "context-lifecycle",
        context_id=context_id,
        context_name=context_name,
        version_id=version_id,
        version_number=version_number,
        governance_hash=governance_hash,
        data_classification=data_classification,
        org_id=org_id,
        metadata={
            "status": status,
            "approved_by": approved_by,
        },
    )


def publish_policy_violation(
    agent_id: str,
    trace_id: str,
    context_name: str,
    violation_type: str,
    severity: str,
    reason: str,
    data_classification: str = "",
    org_id: str = "",
) -> str | None:
    """Publish POLICY_VIOLATION event."""
    return publish_event(
        "POLICY_VIOLATION", "policy-violations",
        agent_id=agent_id,
        trace_id=trace_id,
        context_name=context_name,
        violation_type=violation_type,
        severity=severity,
        denial_reason=reason,
        data_classification=data_classification,
        org_id=org_id,
    )


def publish_a2a_call(
    agent_id: str,
    trace_id: str,
    skill: str,
    success: bool = True,
    response_time_ms: int = 0,
) -> str | None:
    """Publish A2A_CALL event."""
    return publish_event(
        "A2A_CALL", "audit",
        agent_id=agent_id,
        trace_id=trace_id,
        request_method="POST",
        request_path="/a2a",
        metadata={
            "method": "skills/execute",
            "skill": skill,
            "response_time_ms": response_time_ms,
            "success": success,
        },
    )


# ── Lifecycle ────────────────────────────────────────────────────────

def flush(timeout: float = 5.0) -> int:
    """Flush pending events. Returns number of events still in queue."""
    if _producer is not None:
        return _producer.flush(timeout=timeout)
    return 0


def close():
    """Flush and close the producer."""
    global _producer, _producer_available
    if _producer is not None:
        _producer.flush(timeout=10)
        _producer = None
    _producer_available = None


def is_available() -> bool:
    """Check if Kafka is configured and reachable."""
    if not KAFKA_ENABLED:
        return False
    if _producer_available is not None:
        return _producer_available
    # Try to create producer (will cache result)
    return _get_producer() is not None
