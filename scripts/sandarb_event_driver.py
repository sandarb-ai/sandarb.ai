#!/usr/bin/env python3
"""
Sandarb AI Governance Event Driver
===================================
Generates realistic governance events and publishes them to Kafka topic `sandarb_events`.

This script simulates the full lifecycle of AI agent governance:
  - Context injection (success + denied)
  - Prompt usage (success + denied)
  - Agent lifecycle (registration, approval, deactivation)
  - Context lifecycle (version create, approve, reject, archive)
  - Governance proof of delivery (with SHA-256 hashes)
  - Policy violations (unauthorized access, data classification breach)
  - A2A communication events

Usage:
  python scripts/sandarb_event_driver.py                          # Default: 10,000 events
  python scripts/sandarb_event_driver.py --count 1000000          # 1M events
  python scripts/sandarb_event_driver.py --count 100000 --rate 5000  # 100K at 5K/sec
  python scripts/sandarb_event_driver.py --mode burst --count 50000  # Burst mode
  python scripts/sandarb_event_driver.py --mode continuous --eps 1000 # Continuous at 1K/sec
  python scripts/sandarb_event_driver.py --topic sandarb.inject      # Specific topic

Kafka cluster: localhost:9092-9096 (5-broker KRaft cluster)
"""

import argparse
import hashlib
import json
import logging
import random
import signal
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from confluent_kafka import Producer, KafkaError

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-5s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("sandarb-driver")

# ── Graceful shutdown ────────────────────────────────────────────────
_running = True


def _signal_handler(sig, frame):
    global _running
    log.info("Shutdown signal received — flushing remaining events...")
    _running = False


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


# ═══════════════════════════════════════════════════════════════════════
# Reference Data (mirrors generate_seed_data.py for realistic events)
# ═══════════════════════════════════════════════════════════════════════

AGENTS = [
    "kyc-verification-bot", "aml-triage-agent", "trade-surveillance-agent",
    "customer-support-assistant", "onboarding-assistant", "compliance-checker",
    "document-reviewer", "risk-reporter", "limit-monitor", "exception-handler",
    "dispute-resolver", "identity-verifier", "transaction-monitor", "audit-logger",
    "suitability-advisor", "portfolio-analyzer", "settlement-agent", "recon-agent",
    "regulatory-filer", "alert-triage-agent", "sanctions-screener", "fraud-detector",
    "credit-assessor", "collateral-monitor", "valuation-agent", "model-validator",
]

CONTEXTS = [
    "trading-limits-policy", "aml-transaction-thresholds", "kyc-cip-requirements",
    "dispute-resolution-policy", "suitability-standards", "pre-trade-compliance",
    "concentration-limits", "var-risk-limits", "client-onboarding-policy",
    "document-acceptance-standards", "sanctions-screening-policy",
    "sar-escalation-procedures", "reg-e-timeframes", "reg-bi-documentation",
    "volcker-rule-compliance", "trade-surveillance-policy", "limit-breach-escalation",
    "exception-handling-procedures", "audit-retention-policy",
    "data-classification-policy", "pii-handling-guidelines", "third-party-risk-policy",
    "model-governance-framework", "credit-risk-policy", "market-risk-limits",
    "operational-risk-framework", "business-continuity-policy",
    "information-security-policy", "vendor-management-policy",
    "conflict-of-interest-policy", "refund-policy", "trading-limits-dynamic",
    "kyc-verification-checklist", "aml-alert-triage", "credit-assessment-policy",
    "fraud-detection-rules", "compliance-access-control", "session-guardrails",
    "rag-knowledge-context", "persona-tone-guide", "lending-compliance-policy",
    "pii-safe-customer-profile",
]

PROMPTS = [
    "customer-support-playbook", "kyc-verification-standard", "aml-triage-runbook",
    "pre-trade-compliance-guide", "suitability-assessment-guide",
    "dispute-resolution-playbook", "client-reporting-standard",
    "limit-monitoring-procedures", "document-review-policy",
    "regulatory-reporting-guide", "exception-handling-runbook",
    "identity-verification-cip", "transaction-review-procedures",
    "audit-trail-governance", "risk-reporting-standard",
    "sanctions-screening-guide", "fraud-detection-playbook",
    "credit-assessment-guide", "collateral-management-procedures",
    "valuation-control-standard", "model-validation-guide",
]

ORGS = [
    ("retail-banking-americas", "Retail Banking Americas"),
    ("investment-banking-emea", "Investment Banking EMEA"),
    ("wealth-management-apac", "Wealth Management APAC"),
    ("private-banking-global", "Private Banking Global"),
    ("commercial-banking-americas", "Commercial Banking Americas"),
    ("risk-management-global", "Risk Management Global"),
    ("compliance-global", "Compliance Global"),
    ("markets-trading-emea", "Markets Trading EMEA"),
    ("fixed-income-americas", "Fixed Income Americas"),
    ("equities-apac", "Equities APAC"),
    ("aml-compliance-global", "AML Compliance Global"),
    ("fraud-prevention-americas", "Fraud Prevention Americas"),
    ("credit-risk-emea", "Credit Risk EMEA"),
    ("operational-risk-apac", "Operational Risk APAC"),
    ("regulatory-reporting-global", "Regulatory Reporting Global"),
]

DATA_CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Restricted"]
CLASSIFICATION_WEIGHTS = [5, 40, 35, 20]  # Internal most common

DENIAL_REASONS = [
    "Agent not registered with Sandarb. Only registered agents may pull context.",
    "Context is not linked to this agent. Link the context to the agent in the Registry.",
    "Context is inactive.",
    "Agent approval status is 'draft'. Only approved agents can access contexts.",
    "Data classification 'Restricted' requires explicit agent scope.",
    "Context version has been archived. Request the latest approved version.",
    "Rate limit exceeded for agent.",
    "Prompt is not linked to this agent.",
    "Agent API key has expired.",
    "Agent not authorized for MNPI-classified contexts.",
]

VIOLATION_TYPES = [
    "UNAUTHORIZED_ACCESS", "DATA_CLASSIFICATION_BREACH", "UNREGISTERED_AGENT",
    "EXPIRED_KEY", "RATE_LIMIT_EXCEEDED", "CROSS_ORG_ACCESS",
    "PII_EXFILTRATION_ATTEMPT", "STALE_CONTEXT_USAGE",
]

REGIONS = ["us-east-1", "eu-west-1", "ap-southeast-1", "us-west-2", "eu-central-1"]

SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
SEVERITY_WEIGHTS = [30, 40, 20, 10]

# ── Event type distribution (realistic governance workload) ──────────
EVENT_TYPES = [
    # (event_type, event_category, weight)
    ("INJECT_SUCCESS",       "inject",            45),
    ("INJECT_DENIED",        "inject",            8),
    ("PROMPT_USED",          "prompt",            15),
    ("PROMPT_DENIED",        "prompt",            3),
    ("AGENT_REGISTERED",     "agent-lifecycle",   2),
    ("AGENT_APPROVED",       "agent-lifecycle",   2),
    ("AGENT_DEACTIVATED",    "agent-lifecycle",   1),
    ("CONTEXT_CREATED",      "context-lifecycle", 3),
    ("CONTEXT_VERSION_APPROVED", "context-lifecycle", 3),
    ("CONTEXT_VERSION_REJECTED", "context-lifecycle", 1),
    ("CONTEXT_ARCHIVED",     "context-lifecycle", 1),
    ("PROMPT_VERSION_CREATED", "prompt-lifecycle", 2),
    ("PROMPT_VERSION_APPROVED", "prompt-lifecycle", 2),
    ("GOVERNANCE_PROOF",     "governance-proof",  5),
    ("POLICY_VIOLATION",     "policy-violations", 4),
    ("A2A_CALL",             "a2a",               3),
]

EVENT_TYPE_NAMES = [e[0] for e in EVENT_TYPES]
EVENT_TYPE_CATEGORIES = {e[0]: e[1] for e in EVENT_TYPES}
EVENT_TYPE_WEIGHTS = [e[2] for e in EVENT_TYPES]


# ═══════════════════════════════════════════════════════════════════════
# Event Generator
# ═══════════════════════════════════════════════════════════════════════

def _governance_hash(context_name: str, template_body: str = "") -> str:
    """Compute a stable SHA-256 governance hash (mirrors backend logic)."""
    raw = f"{context_name}:{template_body or context_name}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _random_time(hours_back: int = 720) -> str:
    """Random timestamp within the last N hours (default 30 days)."""
    offset = random.randint(0, hours_back * 3600)
    dt = datetime.now(timezone.utc) - timedelta(seconds=offset)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def generate_event(event_time: str | None = None) -> dict[str, Any]:
    """Generate a single realistic Sandarb governance event."""
    event_type = random.choices(EVENT_TYPE_NAMES, weights=EVENT_TYPE_WEIGHTS, k=1)[0]
    category = EVENT_TYPE_CATEGORIES[event_type]

    agent = random.choice(AGENTS)
    org_slug, org_name = random.choice(ORGS)
    context = random.choice(CONTEXTS)
    prompt = random.choice(PROMPTS)
    classification = random.choices(DATA_CLASSIFICATIONS, weights=CLASSIFICATION_WEIGHTS, k=1)[0]
    trace_id = f"trace-{uuid.uuid4().hex[:16]}"
    et = event_time or _random_time()

    event = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "event_category": category,
        "agent_id": f"agent.{agent}",
        "agent_name": agent.replace("-", " ").title(),
        "org_id": org_slug,
        "org_name": org_name,
        "trace_id": trace_id,
        "source_ip": f"10.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}",
        "event_time": et,
        "data_classification": classification,
    }

    # ── Inject events ────────────────────────────────────────────────
    if event_type == "INJECT_SUCCESS":
        gov_hash = _governance_hash(context)
        rendered = random.random() > 0.3  # 70% are rendered
        event.update({
            "context_id": str(uuid.uuid4()),
            "context_name": f"context.{context}",
            "version_id": str(uuid.uuid4()),
            "version_number": random.randint(1, 15),
            "governance_hash": gov_hash,
            "template_rendered": rendered,
            "request_method": "POST",
            "request_path": "/api/inject",
            "metadata": json.dumps({
                "response_time_ms": random.randint(5, 250),
                "variables_count": random.randint(0, 12) if rendered else 0,
                "region": random.choice(REGIONS),
            }),
        })

    elif event_type == "INJECT_DENIED":
        reason = random.choice(DENIAL_REASONS)
        event.update({
            "context_id": str(uuid.uuid4()),
            "context_name": f"context.{context}",
            "denial_reason": reason,
            "request_method": "POST",
            "request_path": "/api/inject",
            "severity": random.choices(SEVERITIES, weights=SEVERITY_WEIGHTS, k=1)[0],
        })

    # ── Prompt events ────────────────────────────────────────────────
    elif event_type == "PROMPT_USED":
        event.update({
            "prompt_id": str(uuid.uuid4()),
            "prompt_name": f"prompt.{prompt}",
            "version_number": random.randint(1, 10),
            "request_method": "POST",
            "request_path": "/api/inject",
        })

    elif event_type == "PROMPT_DENIED":
        event.update({
            "prompt_id": str(uuid.uuid4()),
            "prompt_name": f"prompt.{prompt}",
            "denial_reason": random.choice([
                "Prompt is not linked to this agent.",
                "Agent not registered with Sandarb.",
                "Prompt version has been archived.",
            ]),
            "severity": "MEDIUM",
            "request_method": "POST",
            "request_path": "/api/inject",
        })

    # ── Agent lifecycle ──────────────────────────────────────────────
    elif event_type in ("AGENT_REGISTERED", "AGENT_APPROVED", "AGENT_DEACTIVATED"):
        event.update({
            "metadata": json.dumps({
                "a2a_url": f"https://agent.sandarb.ai/{agent}",
                "approval_status": {
                    "AGENT_REGISTERED": "draft",
                    "AGENT_APPROVED": "approved",
                    "AGENT_DEACTIVATED": "inactive",
                }[event_type],
                "pii_handling": random.choice([True, False]),
                "tools_count": random.randint(1, 8),
            }),
        })

    # ── Context lifecycle ────────────────────────────────────────────
    elif event_type in ("CONTEXT_CREATED", "CONTEXT_VERSION_APPROVED",
                         "CONTEXT_VERSION_REJECTED", "CONTEXT_ARCHIVED"):
        event.update({
            "context_id": str(uuid.uuid4()),
            "context_name": f"context.{context}",
            "version_id": str(uuid.uuid4()),
            "version_number": random.randint(1, 20),
            "governance_hash": _governance_hash(context),
            "metadata": json.dumps({
                "status": {
                    "CONTEXT_CREATED": "Draft",
                    "CONTEXT_VERSION_APPROVED": "Approved",
                    "CONTEXT_VERSION_REJECTED": "Rejected",
                    "CONTEXT_ARCHIVED": "Archived",
                }[event_type],
                "approved_by": f"reviewer-{random.randint(1,10)}@sandarb.ai" if "APPROVED" in event_type else None,
                "commit_message": f"Update {context} v{random.randint(1,20)}",
            }),
        })

    # ── Prompt lifecycle ─────────────────────────────────────────────
    elif event_type in ("PROMPT_VERSION_CREATED", "PROMPT_VERSION_APPROVED"):
        event.update({
            "prompt_id": str(uuid.uuid4()),
            "prompt_name": f"prompt.{prompt}",
            "version_number": random.randint(1, 15),
            "metadata": json.dumps({
                "status": "Proposed" if "CREATED" in event_type else "Approved",
                "model": random.choice(["claude-4-sonnet", "claude-4-opus", "gpt-4o", "gemini-2.5"]),
                "temperature": round(random.uniform(0.0, 1.0), 2),
            }),
        })

    # ── Governance proof ─────────────────────────────────────────────
    elif event_type == "GOVERNANCE_PROOF":
        gov_hash = _governance_hash(context)
        event.update({
            "context_id": str(uuid.uuid4()),
            "context_name": f"context.{context}",
            "governance_hash": gov_hash,
            "hash_type": "sha256",
            "template_rendered": True,
            "version_number": random.randint(1, 15),
            "metadata": json.dumps({
                "proof_type": "delivery",
                "hash_stable": True,
                "delivery_count": random.randint(1, 500),
                "first_seen": _random_time(hours_back=2160),
                "regulatory_hooks": random.sample(
                    ["SOC2", "GDPR", "CCPA", "MiFID-II", "Dodd-Frank", "Basel-III", "PCI-DSS"],
                    k=random.randint(0, 3),
                ),
            }),
        })

    # ── Policy violations ────────────────────────────────────────────
    elif event_type == "POLICY_VIOLATION":
        vtype = random.choice(VIOLATION_TYPES)
        event.update({
            "context_name": f"context.{context}",
            "violation_type": vtype,
            "severity": random.choices(SEVERITIES, weights=[10, 25, 35, 30], k=1)[0],
            "denial_reason": f"{vtype}: Agent '{agent}' attempted access to '{context}' "
                             f"with classification '{classification}'.",
            "metadata": json.dumps({
                "violation_details": {
                    "expected_scope": random.choice(DATA_CLASSIFICATIONS[:2]),
                    "actual_scope": classification,
                    "remediation": "Review agent-context linking in Sandarb Registry.",
                },
                "alert_sent": random.choice([True, False]),
                "incident_id": f"INC-{random.randint(10000, 99999)}",
            }),
        })

    # ── A2A call events ──────────────────────────────────────────────
    elif event_type == "A2A_CALL":
        skill = random.choice([
            "get_context", "get_prompt", "list_agents", "get_agent",
            "get_lineage", "get_blocked_injections", "get_audit_log",
            "register", "validate_context", "get_dashboard",
        ])
        event.update({
            "request_method": "POST",
            "request_path": "/a2a",
            "metadata": json.dumps({
                "method": "skills/execute",
                "skill": skill,
                "response_time_ms": random.randint(10, 500),
                "success": random.random() > 0.05,  # 95% success rate
            }),
        })

    return event


# ═══════════════════════════════════════════════════════════════════════
# Kafka Producer
# ═══════════════════════════════════════════════════════════════════════

def create_producer(brokers: str) -> Producer:
    """Create a high-throughput Kafka producer."""
    conf = {
        "bootstrap.servers": brokers,
        "client.id": "sandarb-event-driver",
        # High-throughput settings
        "linger.ms": 50,              # Batch for 50ms before sending
        "batch.size": 131072,         # 128KB batches
        "batch.num.messages": 1000,   # Up to 1000 messages per batch
        "compression.type": "lz4",    # LZ4 compression (fast)
        "acks": "1",                  # Leader ack only (throughput > durability for driver)
        "queue.buffering.max.messages": 500000,
        "queue.buffering.max.kbytes": 1048576,  # 1GB buffer
        "message.max.bytes": 1048576,
        "retries": 3,
        "retry.backoff.ms": 100,
    }
    return Producer(conf)


# Delivery callback
_delivered = 0
_errors = 0


def _delivery_cb(err, msg):
    global _delivered, _errors
    if err:
        _errors += 1
        if _errors <= 10:
            log.error(f"Delivery failed: {err}")
    else:
        _delivered += 1


def produce_events(
    producer: Producer,
    topic: str,
    count: int,
    rate_limit: int = 0,
    time_range_hours: int = 720,
):
    """Produce N events to the given Kafka topic."""
    global _delivered, _errors, _running
    _delivered = 0
    _errors = 0

    log.info(f"🚀 Producing {count:,} events to topic '{topic}'")
    log.info(f"   Time range: last {time_range_hours} hours ({time_range_hours // 24} days)")
    if rate_limit:
        log.info(f"   Rate limit: {rate_limit:,} events/sec")
    log.info("")

    start = time.monotonic()
    batch_start = start
    batch_count = 0
    poll_interval = 1000  # Poll every 1000 events

    for i in range(count):
        if not _running:
            break

        event = generate_event(event_time=_random_time(time_range_hours))

        # Partition key: org_id for data locality
        key = event.get("org_id", "default")
        value = json.dumps(event)

        try:
            producer.produce(
                topic=topic,
                key=key.encode("utf-8"),
                value=value.encode("utf-8"),
                callback=_delivery_cb,
            )
        except BufferError:
            # Buffer full — flush and retry
            producer.flush(timeout=5)
            producer.produce(
                topic=topic,
                key=key.encode("utf-8"),
                value=value.encode("utf-8"),
                callback=_delivery_cb,
            )

        batch_count += 1

        # Poll for delivery callbacks periodically
        if batch_count % poll_interval == 0:
            producer.poll(0)

        # Progress reporting every 10K events
        if batch_count % 10000 == 0:
            elapsed = time.monotonic() - start
            eps = batch_count / elapsed if elapsed > 0 else 0
            log.info(
                f"  ▸ {batch_count:>10,} / {count:,} "
                f"({batch_count * 100 / count:.1f}%) "
                f"│ {eps:,.0f} events/sec "
                f"│ delivered: {_delivered:,} "
                f"│ errors: {_errors}"
            )

        # Rate limiting
        if rate_limit and batch_count % rate_limit == 0:
            elapsed_since_batch = time.monotonic() - batch_start
            if elapsed_since_batch < 1.0:
                time.sleep(1.0 - elapsed_since_batch)
            batch_start = time.monotonic()

    # Final flush
    log.info("  ⏳ Flushing remaining events...")
    remaining = producer.flush(timeout=30)

    elapsed = time.monotonic() - start
    eps = batch_count / elapsed if elapsed > 0 else 0

    log.info("")
    log.info("═" * 60)
    log.info(f"  ✅ Complete!")
    log.info(f"  Events produced : {batch_count:,}")
    log.info(f"  Delivered (ack) : {_delivered:,}")
    log.info(f"  Errors          : {_errors:,}")
    log.info(f"  Remaining       : {remaining:,}")
    log.info(f"  Elapsed         : {elapsed:.2f}s")
    log.info(f"  Throughput      : {eps:,.0f} events/sec")
    log.info("═" * 60)


def produce_continuous(
    producer: Producer,
    topic: str,
    eps: int = 100,
    time_range_hours: int = 1,
):
    """Produce events continuously at a target events/sec rate."""
    global _delivered, _errors, _running
    _delivered = 0
    _errors = 0
    total_sent = 0

    log.info(f"🔄 Continuous mode: ~{eps:,} events/sec to '{topic}'")
    log.info(f"   Press Ctrl+C to stop")
    log.info("")

    start = time.monotonic()

    while _running:
        batch_start = time.monotonic()

        for _ in range(eps):
            if not _running:
                break
            event = generate_event(event_time=None)  # Use current time
            # Override event_time to now for real-time simulation
            event["event_time"] = datetime.now(timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S.%f"
            )[:-3] + "Z"

            key = event.get("org_id", "default")
            value = json.dumps(event)

            try:
                producer.produce(
                    topic=topic,
                    key=key.encode("utf-8"),
                    value=value.encode("utf-8"),
                    callback=_delivery_cb,
                )
            except BufferError:
                producer.flush(timeout=5)
                producer.produce(
                    topic=topic,
                    key=key.encode("utf-8"),
                    value=value.encode("utf-8"),
                    callback=_delivery_cb,
                )

            total_sent += 1

        producer.poll(0)

        # Log every 10 seconds
        elapsed = time.monotonic() - start
        if int(elapsed) % 10 == 0 and int(elapsed) > 0:
            actual_eps = total_sent / elapsed if elapsed > 0 else 0
            log.info(
                f"  ▸ total: {total_sent:,} │ "
                f"{actual_eps:,.0f} eps │ "
                f"delivered: {_delivered:,} │ "
                f"errors: {_errors}"
            )

        # Pace to target EPS
        batch_elapsed = time.monotonic() - batch_start
        if batch_elapsed < 1.0:
            time.sleep(1.0 - batch_elapsed)

    # Final flush
    log.info("  ⏳ Flushing...")
    producer.flush(timeout=30)
    elapsed = time.monotonic() - start
    log.info("")
    log.info(f"  ✅ Stopped. Total: {total_sent:,} events in {elapsed:.1f}s")


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Sandarb AI Governance Event Driver — generate events → Kafka",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                                    # 10K events to sandarb_events
  %(prog)s --count 1000000                    # 1M events
  %(prog)s --count 500000 --rate 10000        # 500K at 10K/sec
  %(prog)s --mode continuous --eps 5000       # Continuous at 5K/sec
  %(prog)s --topic sandarb.inject --count 50000
  %(prog)s --brokers broker01:9092,broker02:9093

Kafka Topics (8 total):
  sandarb_events          Primary event firehose (all events)
  sandarb.inject          Context injection events
  sandarb.audit           Immutable audit trail (infinite retention)
  sandarb.agent-lifecycle Agent registration/approval/deactivation
  sandarb.governance-proof Governance hash proofs (compacted)
  sandarb.context-lifecycle Context version lifecycle
  sandarb.prompt-lifecycle  Prompt version lifecycle
  sandarb.policy-violations Policy & compliance violations
        """,
    )
    parser.add_argument(
        "--count", "-n", type=int, default=10000,
        help="Number of events to produce (default: 10,000)",
    )
    parser.add_argument(
        "--topic", "-t", type=str, default="sandarb_events",
        help="Kafka topic (default: sandarb_events)",
    )
    parser.add_argument(
        "--brokers", "-b", type=str,
        default="localhost:9092,localhost:9093,localhost:9094,localhost:9095,localhost:9096",
        help="Kafka bootstrap servers",
    )
    parser.add_argument(
        "--rate", "-r", type=int, default=0,
        help="Max events/sec (0 = unlimited)",
    )
    parser.add_argument(
        "--mode", "-m", type=str, choices=["batch", "continuous", "burst"], default="batch",
        help="Production mode: batch (default), continuous, or burst",
    )
    parser.add_argument(
        "--eps", type=int, default=1000,
        help="Events per second for continuous mode (default: 1000)",
    )
    parser.add_argument(
        "--time-range", type=int, default=720,
        help="Time range in hours for event timestamps (default: 720 = 30 days)",
    )
    parser.add_argument(
        "--fan-out", action="store_true",
        help="Fan-out: also send to category-specific topics (sandarb.inject, etc.)",
    )

    args = parser.parse_args()

    log.info("╔══════════════════════════════════════════════════════════╗")
    log.info("║     Sandarb AI Governance Event Driver                  ║")
    log.info("║     AI Governance for AI Agents                        ║")
    log.info("╚══════════════════════════════════════════════════════════╝")
    log.info(f"  Brokers   : {args.brokers}")
    log.info(f"  Topic     : {args.topic}")
    log.info(f"  Mode      : {args.mode}")
    log.info(f"  Fan-out   : {'yes' if args.fan_out else 'no'}")
    log.info("")

    producer = create_producer(args.brokers)

    # Verify broker connectivity
    try:
        metadata = producer.list_topics(timeout=10)
        broker_count = len(metadata.brokers)
        topic_count = len(metadata.topics)
        log.info(f"  Connected: {broker_count} brokers, {topic_count} topics")
        log.info("")
    except Exception as e:
        log.error(f"Cannot connect to Kafka: {e}")
        sys.exit(1)

    if args.mode == "continuous":
        produce_continuous(producer, args.topic, eps=args.eps)
    elif args.mode == "burst":
        # Burst mode: no rate limit, maximum throughput
        produce_events(producer, args.topic, args.count, rate_limit=0, time_range_hours=args.time_range)
    else:
        produce_events(
            producer, args.topic, args.count,
            rate_limit=args.rate,
            time_range_hours=args.time_range,
        )

    # Fan-out: also send to category-specific topics
    if args.fan_out and args.mode == "batch":
        log.info("")
        log.info("📡 Fan-out: routing events to category-specific topics...")
        # Generate a smaller set for each category topic
        category_counts = {
            "sandarb.inject": int(args.count * 0.53),
            "sandarb.audit": int(args.count * 0.10),
            "sandarb.agent-lifecycle": int(args.count * 0.05),
            "sandarb.governance-proof": int(args.count * 0.05),
            "sandarb.context-lifecycle": int(args.count * 0.08),
            "sandarb.prompt-lifecycle": int(args.count * 0.04),
            "sandarb.policy-violations": int(args.count * 0.04),
        }
        for cat_topic, cat_count in category_counts.items():
            if cat_count > 0:
                produce_events(producer, cat_topic, cat_count, rate_limit=args.rate, time_range_hours=args.time_range)


if __name__ == "__main__":
    main()
