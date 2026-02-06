#!/usr/bin/env python3
"""
Kafka → ClickHouse Consumer Bridge
====================================
Consumes governance events from Kafka topic `sandarb_events` and batch-inserts
them into ClickHouse `sandarb.events` table.

This bridges the Kafka cluster and ClickHouse cluster (separate Docker networks).
In production, use ClickHouse's native Kafka Engine or Kafka Connect ClickHouse Sink.

Flow: Sandarb API → Kafka (sandarb_events) → [this consumer] → ClickHouse (sandarb.events)

Usage:
  python scripts/kafka_to_clickhouse.py                        # Default settings
  python scripts/kafka_to_clickhouse.py --batch-size 5000      # Larger batches
  python scripts/kafka_to_clickhouse.py --clickhouse-url http://localhost:8123

Requirements:
  pip install confluent-kafka requests
"""

import argparse
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone

from confluent_kafka import Consumer, KafkaError

try:
    import requests
except ImportError:
    print("requests package required: pip install requests")
    sys.exit(1)

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-5s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("kafka-to-clickhouse")

_running = True


def _signal_handler(sig, frame):
    global _running
    log.info("Shutdown signal received...")
    _running = False


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


# ═══════════════════════════════════════════════════════════════════════
# ClickHouse Client (HTTP interface)
# ═══════════════════════════════════════════════════════════════════════

class ClickHouseClient:
    """Simple ClickHouse HTTP client for batch inserts."""

    def __init__(self, url: str = "http://localhost:8123", database: str = "sandarb"):
        self.database = database
        self.session = requests.Session()
        self.auth_params = {}

        # Parse auth from URL (http://user:pass@host:port)
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.username:
            self.auth_params["user"] = parsed.username
            self.auth_params["password"] = parsed.password or ""
            self.url = f"{parsed.scheme}://{parsed.hostname}:{parsed.port or 8123}"
        else:
            self.url = url.rstrip("/")

        # Test connectivity
        try:
            r = self.session.get(f"{self.url}/ping", timeout=5)
            if r.status_code == 200:
                log.info(f"ClickHouse connected: {self.url}")
            else:
                log.warning(f"ClickHouse ping returned {r.status_code}")
        except Exception as e:
            log.error(f"Cannot connect to ClickHouse at {self.url}: {e}")
            sys.exit(1)

    def insert_batch(self, rows: list[dict]) -> int:
        """Insert a batch of event rows into sandarb.events. Returns count inserted."""
        if not rows:
            return 0

        # Build JSONEachRow payload
        payload = "\n".join(json.dumps(row) for row in rows)

        try:
            params = {
                "database": self.database,
                "query": "INSERT INTO events FORMAT JSONEachRow",
                **self.auth_params,
            }
            r = self.session.post(
                self.url,
                params=params,
                data=payload.encode("utf-8"),
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            if r.status_code == 200:
                return len(rows)
            else:
                log.error(f"ClickHouse insert failed ({r.status_code}): {r.text[:200]}")
                return 0
        except Exception as e:
            log.error(f"ClickHouse insert error: {e}")
            return 0

    def query(self, sql: str) -> str:
        """Execute a query and return the result text."""
        try:
            params = {"database": self.database, "query": sql, **self.auth_params}
            r = self.session.get(self.url, params=params, timeout=15)
            return r.text.strip()
        except Exception as e:
            return f"Error: {e}"


def _fix_timestamp(ts: str) -> str:
    """Convert ISO timestamps to ClickHouse-compatible format.

    ClickHouse DateTime64 expects: '2026-01-21 00:21:40.524' (no Z, no T).
    Input format: '2026-01-21T00:21:40.524Z'
    """
    if not ts:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    return ts.replace("T", " ").replace("Z", "")


def _parse_event(raw: bytes) -> dict | None:
    """Parse a Kafka message value into a ClickHouse-ready dict."""
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        return None

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    # Map fields to ClickHouse schema (ensure types match)
    return {
        "event_id": event.get("event_id", ""),
        "event_type": event.get("event_type", ""),
        "event_category": event.get("event_category", ""),
        "agent_id": event.get("agent_id", ""),
        "agent_name": event.get("agent_name", ""),
        "org_id": event.get("org_id", ""),
        "org_name": event.get("org_name", ""),
        "context_id": event.get("context_id", ""),
        "context_name": event.get("context_name", ""),
        "version_id": event.get("version_id", ""),
        "version_number": int(event.get("version_number", 0)),
        "prompt_id": event.get("prompt_id", ""),
        "prompt_name": event.get("prompt_name", ""),
        "data_classification": event.get("data_classification", ""),
        "governance_hash": event.get("governance_hash", ""),
        "hash_type": event.get("hash_type", ""),
        "template_rendered": bool(event.get("template_rendered", False)),
        "denial_reason": event.get("denial_reason", ""),
        "violation_type": event.get("violation_type", ""),
        "severity": event.get("severity", ""),
        "trace_id": event.get("trace_id", ""),
        "source_ip": event.get("source_ip", ""),
        "request_method": event.get("request_method", ""),
        "request_path": event.get("request_path", ""),
        "event_time": _fix_timestamp(event.get("event_time", "")),
        "ingested_at": now,
        "metadata": event.get("metadata", "{}") if isinstance(event.get("metadata"), str) else json.dumps(event.get("metadata", {})),
    }


# ═══════════════════════════════════════════════════════════════════════
# Consumer Loop
# ═══════════════════════════════════════════════════════════════════════

def consume_and_insert(
    brokers: str,
    topic: str,
    clickhouse_url: str,
    group_id: str,
    batch_size: int,
    batch_timeout_ms: int,
    from_beginning: bool,
):
    """Consume from Kafka and batch-insert into ClickHouse."""
    global _running

    ch = ClickHouseClient(url=clickhouse_url)

    consumer_conf = {
        "bootstrap.servers": brokers,
        "group.id": group_id,
        "auto.offset.reset": "earliest" if from_beginning else "latest",
        "enable.auto.commit": False,
        "max.poll.interval.ms": 300000,
        "session.timeout.ms": 30000,
        "fetch.min.bytes": 65536,
        "fetch.wait.max.ms": 500,
    }
    consumer = Consumer(consumer_conf)
    consumer.subscribe([topic])

    log.info(f"Consuming from topic '{topic}' (group: {group_id})")
    log.info(f"Batch size: {batch_size}, timeout: {batch_timeout_ms}ms")
    log.info(f"Inserting into ClickHouse at {clickhouse_url}")
    log.info("")

    total_consumed = 0
    total_inserted = 0
    total_errors = 0
    batch: list[dict] = []
    batch_start = time.monotonic()
    report_time = time.monotonic()

    while _running:
        msg = consumer.poll(timeout=1.0)

        if msg is None:
            # Check batch timeout
            if batch and (time.monotonic() - batch_start) * 1000 > batch_timeout_ms:
                inserted = ch.insert_batch(batch)
                total_inserted += inserted
                if inserted == len(batch):
                    consumer.commit(asynchronous=False)
                batch.clear()
                batch_start = time.monotonic()
            continue

        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            log.error(f"Consumer error: {msg.error()}")
            total_errors += 1
            continue

        # Parse message
        event = _parse_event(msg.value())
        if event is None:
            total_errors += 1
            continue

        total_consumed += 1
        batch.append(event)

        # Flush batch when full
        if len(batch) >= batch_size:
            inserted = ch.insert_batch(batch)
            total_inserted += inserted
            if inserted == len(batch):
                consumer.commit(asynchronous=False)
            else:
                total_errors += len(batch) - inserted
            batch.clear()
            batch_start = time.monotonic()

        # Progress report every 10 seconds
        now = time.monotonic()
        if now - report_time >= 10.0:
            eps = total_consumed / (now - report_time) if now - report_time > 0 else 0
            log.info(
                f"  ▸ consumed: {total_consumed:,} │ "
                f"inserted: {total_inserted:,} │ "
                f"errors: {total_errors} │ "
                f"batch: {len(batch)} │ "
                f"~{eps:,.0f} events/sec"
            )
            report_time = now
            total_consumed = 0  # Reset for rate calc

    # Final flush
    if batch:
        inserted = ch.insert_batch(batch)
        total_inserted += inserted
        if inserted == len(batch):
            consumer.commit(asynchronous=False)

    consumer.close()

    # Report final stats
    count = ch.query("SELECT count() FROM events")
    log.info("")
    log.info(f"  ✅ Consumer stopped.")
    log.info(f"  Total inserted: {total_inserted:,}")
    log.info(f"  Total errors:   {total_errors}")
    log.info(f"  ClickHouse sandarb.events count: {count}")


def main():
    parser = argparse.ArgumentParser(
        description="Kafka → ClickHouse consumer bridge for Sandarb governance events",
    )
    parser.add_argument("--brokers", default="localhost:9092,localhost:9093,localhost:9094,localhost:9095,localhost:9096")
    parser.add_argument("--topic", default="sandarb_events")
    parser.add_argument("--clickhouse-url", default="http://sandarb:sandarb@localhost:8123")
    parser.add_argument("--group-id", default="sandarb-clickhouse-consumer")
    parser.add_argument("--batch-size", type=int, default=2000, help="Batch size for ClickHouse inserts")
    parser.add_argument("--batch-timeout-ms", type=int, default=5000, help="Max ms before flushing partial batch")
    parser.add_argument("--from-beginning", action="store_true", help="Consume from the beginning of the topic")

    args = parser.parse_args()

    log.info("╔══════════════════════════════════════════════════════════╗")
    log.info("║     Kafka → ClickHouse Consumer Bridge                  ║")
    log.info("║     Sandarb AI Governance Data Pipeline                 ║")
    log.info("╚══════════════════════════════════════════════════════════╝")

    consume_and_insert(
        brokers=args.brokers,
        topic=args.topic,
        clickhouse_url=args.clickhouse_url,
        group_id=args.group_id,
        batch_size=args.batch_size,
        batch_timeout_ms=args.batch_timeout_ms,
        from_beginning=args.from_beginning,
    )


if __name__ == "__main__":
    main()
