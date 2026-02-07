#!/usr/bin/env python3
"""
sandarb-kafka-to-clickhouse-consumer
======================================
Standalone Kafka -> ClickHouse consumer bridge for Sandarb AI governance events.

Consumes events from Kafka topic `sandarb_events` and batch-inserts them into
ClickHouse `sandarb.events` table.

Architecture:
  Sandarb API -> Kafka (sandarb_events) -> [this consumer] -> ClickHouse (sandarb.events) -> Superset

All configuration is via environment variables (Docker-native).
Includes an HTTP health endpoint for Docker healthcheck and Sandarb infra monitoring.

Requirements:
  pip install confluent-kafka requests
"""

import json
import logging
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

from confluent_kafka import Consumer, KafkaError

try:
    import requests
except ImportError:
    print("requests package required: pip install requests")
    sys.exit(1)


# ── Configuration (all via env vars) ────────────────────────────────

KAFKA_BOOTSTRAP_SERVERS = os.environ.get(
    "KAFKA_BOOTSTRAP_SERVERS",
    "host.docker.internal:9092,host.docker.internal:9093,"
    "host.docker.internal:9094,host.docker.internal:9095,"
    "host.docker.internal:9096",
)
KAFKA_TOPIC = os.environ.get("KAFKA_TOPIC", "sandarb_events")
KAFKA_GROUP_ID = os.environ.get("KAFKA_GROUP_ID", "sandarb-clickhouse-consumer")
KAFKA_AUTO_OFFSET_RESET = os.environ.get("KAFKA_AUTO_OFFSET_RESET", "latest")

CLICKHOUSE_URL = os.environ.get("CLICKHOUSE_URL", "http://host.docker.internal:8123")
CLICKHOUSE_DATABASE = os.environ.get("CLICKHOUSE_DATABASE", "sandarb")
CLICKHOUSE_USER = os.environ.get("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.environ.get("CLICKHOUSE_PASSWORD", "sandarb")

BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "2000"))
BATCH_TIMEOUT_MS = int(os.environ.get("BATCH_TIMEOUT_MS", "5000"))
HEALTH_PORT = int(os.environ.get("HEALTH_PORT", "8079"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

STARTUP_MAX_RETRIES = 30
STARTUP_RETRY_INTERVAL = 2  # seconds
INSERT_MAX_RETRIES = 3


# ── Structured JSON Logging ─────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production."""

    def format(self, record):
        entry = {
            "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "msg": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info and record.exc_info[0]:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
logging.root.handlers = [handler]
logging.root.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

log = logging.getLogger("consumer-bridge")

_running = True


def _signal_handler(sig, frame):
    global _running
    log.info("Shutdown signal received, flushing final batch...")
    _running = False


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


# ── Metrics (in-memory, exposed via health endpoint) ────────────────

class Metrics:
    """Thread-safe in-memory metrics for the health endpoint."""

    def __init__(self):
        self._lock = threading.Lock()
        self.events_consumed = 0
        self.events_inserted = 0
        self.batches_flushed = 0
        self.errors = 0
        self.kafka_connected = False
        self.clickhouse_connected = False
        self.last_flush_at = ""
        self.started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    def record_consume(self, count: int = 1):
        with self._lock:
            self.events_consumed += count

    def record_insert(self, count: int):
        with self._lock:
            self.events_inserted += count
            self.batches_flushed += 1
            self.last_flush_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    def record_error(self, count: int = 1):
        with self._lock:
            self.errors += count

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "status": "healthy" if (self.kafka_connected and self.clickhouse_connected) else "unhealthy",
                "kafka_connected": self.kafka_connected,
                "clickhouse_connected": self.clickhouse_connected,
                "events_consumed": self.events_consumed,
                "events_inserted": self.events_inserted,
                "batches_flushed": self.batches_flushed,
                "errors": self.errors,
                "last_flush_at": self.last_flush_at,
                "started_at": self.started_at,
            }


metrics = Metrics()


# ── Health HTTP Endpoint ────────────────────────────────────────────

class HealthHandler(BaseHTTPRequestHandler):
    """Minimal HTTP handler for /health endpoint."""

    def do_GET(self):
        if self.path == "/health":
            body = json.dumps(metrics.snapshot()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress default access logs
        pass


def _start_health_server():
    """Start the health endpoint in a daemon thread."""
    server = HTTPServer(("0.0.0.0", HEALTH_PORT), HealthHandler)
    server.timeout = 1
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    log.info(f"Health endpoint listening on :{HEALTH_PORT}/health")
    return server


# ── ClickHouse Client ───────────────────────────────────────────────

class ClickHouseClient:
    """ClickHouse HTTP client with retry support for batch inserts."""

    def __init__(self, url: str, database: str, user: str, password: str):
        self.url = url.rstrip("/")
        self.database = database
        self.session = requests.Session()
        self.auth_params = {}
        if user:
            self.auth_params["user"] = user
        if password:
            self.auth_params["password"] = password

    def ping(self) -> bool:
        """Test ClickHouse connectivity."""
        try:
            r = self.session.get(f"{self.url}/ping", timeout=5)
            return r.status_code == 200
        except Exception:
            return False

    def insert_batch(self, rows: list[dict]) -> int:
        """Insert a batch of event rows with retry. Returns count inserted."""
        if not rows:
            return 0

        payload = "\n".join(json.dumps(row) for row in rows)
        params = {
            "database": self.database,
            "query": "INSERT INTO events FORMAT JSONEachRow",
            **self.auth_params,
        }

        for attempt in range(1, INSERT_MAX_RETRIES + 1):
            try:
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
                    log.error(f"ClickHouse insert failed (HTTP {r.status_code}): {r.text[:300]}")
            except Exception as e:
                log.error(f"ClickHouse insert error (attempt {attempt}/{INSERT_MAX_RETRIES}): {e}")

            if attempt < INSERT_MAX_RETRIES:
                wait = 2 ** attempt  # exponential backoff: 2s, 4s
                log.info(f"Retrying ClickHouse insert in {wait}s...")
                time.sleep(wait)

        log.error(f"ClickHouse insert failed after {INSERT_MAX_RETRIES} attempts, dropping {len(rows)} events")
        return 0

    def query(self, sql: str) -> str:
        """Execute a query and return the result text."""
        try:
            params = {"database": self.database, "query": sql, **self.auth_params}
            r = self.session.get(self.url, params=params, timeout=15)
            return r.text.strip()
        except Exception as e:
            return f"Error: {e}"


# ── Event Parsing ───────────────────────────────────────────────────

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
        "metadata": (
            event.get("metadata", "{}")
            if isinstance(event.get("metadata"), str)
            else json.dumps(event.get("metadata", {}))
        ),
    }


# ── Startup with Retry ──────────────────────────────────────────────

def _connect_with_retry() -> tuple["ClickHouseClient", "Consumer"]:
    """Connect to Kafka and ClickHouse with startup retry."""
    ch = None
    consumer = None

    for attempt in range(1, STARTUP_MAX_RETRIES + 1):
        # ClickHouse
        if ch is None:
            client = ClickHouseClient(
                url=CLICKHOUSE_URL,
                database=CLICKHOUSE_DATABASE,
                user=CLICKHOUSE_USER,
                password=CLICKHOUSE_PASSWORD,
            )
            if client.ping():
                ch = client
                metrics.clickhouse_connected = True
                log.info(f"ClickHouse connected: {CLICKHOUSE_URL}")
            else:
                log.warning(f"ClickHouse not ready (attempt {attempt}/{STARTUP_MAX_RETRIES})")

        # Kafka
        if consumer is None:
            try:
                consumer_conf = {
                    "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
                    "group.id": KAFKA_GROUP_ID,
                    "auto.offset.reset": KAFKA_AUTO_OFFSET_RESET,
                    "enable.auto.commit": False,
                    "max.poll.interval.ms": 300000,
                    "session.timeout.ms": 30000,
                    "fetch.min.bytes": 65536,
                    "fetch.wait.max.ms": 500,
                }
                c = Consumer(consumer_conf)
                # Test connectivity by listing topics
                md = c.list_topics(timeout=5)
                consumer = c
                metrics.kafka_connected = True
                broker_count = len(md.brokers)
                log.info(f"Kafka connected: {broker_count} brokers via {KAFKA_BOOTSTRAP_SERVERS.split(',')[0]}...")
            except Exception as e:
                log.warning(f"Kafka not ready (attempt {attempt}/{STARTUP_MAX_RETRIES}): {e}")

        if ch is not None and consumer is not None:
            return ch, consumer

        if attempt < STARTUP_MAX_RETRIES:
            time.sleep(STARTUP_RETRY_INTERVAL)

    # If we get here, at least one service is still unavailable
    if ch is None:
        log.error("Failed to connect to ClickHouse after all retries")
    if consumer is None:
        log.error("Failed to connect to Kafka after all retries")
    sys.exit(1)


# ── Consumer Loop ───────────────────────────────────────────────────

def consume_and_insert(ch: ClickHouseClient, consumer: Consumer):
    """Main consume-and-insert loop."""
    global _running

    consumer.subscribe([KAFKA_TOPIC])

    log.info(f"Consuming from topic '{KAFKA_TOPIC}' (group: {KAFKA_GROUP_ID})")
    log.info(f"Batch size: {BATCH_SIZE}, timeout: {BATCH_TIMEOUT_MS}ms")
    log.info(f"Inserting into ClickHouse {CLICKHOUSE_URL} / {CLICKHOUSE_DATABASE}")

    batch: list[dict] = []
    batch_start = time.monotonic()
    report_time = time.monotonic()
    period_consumed = 0

    while _running:
        msg = consumer.poll(timeout=1.0)

        if msg is None:
            # Check batch timeout
            if batch and (time.monotonic() - batch_start) * 1000 > BATCH_TIMEOUT_MS:
                inserted = ch.insert_batch(batch)
                metrics.record_insert(inserted)
                if inserted == len(batch):
                    consumer.commit(asynchronous=False)
                else:
                    metrics.record_error(len(batch) - inserted)
                batch.clear()
                batch_start = time.monotonic()
            continue

        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            log.error(f"Consumer error: {msg.error()}")
            metrics.record_error()
            continue

        # Parse message
        event = _parse_event(msg.value())
        if event is None:
            metrics.record_error()
            continue

        metrics.record_consume()
        period_consumed += 1
        batch.append(event)

        # Flush batch when full
        if len(batch) >= BATCH_SIZE:
            inserted = ch.insert_batch(batch)
            metrics.record_insert(inserted)
            if inserted == len(batch):
                consumer.commit(asynchronous=False)
            else:
                metrics.record_error(len(batch) - inserted)
            batch.clear()
            batch_start = time.monotonic()

        # Progress report every 10 seconds
        now = time.monotonic()
        if now - report_time >= 10.0:
            elapsed = now - report_time
            eps = period_consumed / elapsed if elapsed > 0 else 0
            snap = metrics.snapshot()
            log.info(
                f"consumed={snap['events_consumed']} "
                f"inserted={snap['events_inserted']} "
                f"errors={snap['errors']} "
                f"batch={len(batch)} "
                f"rate={eps:,.0f}e/s"
            )
            report_time = now
            period_consumed = 0

    # Final flush
    if batch:
        log.info(f"Flushing final batch of {len(batch)} events...")
        inserted = ch.insert_batch(batch)
        metrics.record_insert(inserted)
        if inserted == len(batch):
            consumer.commit(asynchronous=False)

    consumer.close()

    count = ch.query("SELECT count() FROM events")
    snap = metrics.snapshot()
    log.info(
        f"Shutdown complete. "
        f"total_inserted={snap['events_inserted']} "
        f"total_errors={snap['errors']} "
        f"clickhouse_rows={count}"
    )


# ── Main ────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("sandarb-kafka-to-clickhouse-consumer starting")
    log.info("=" * 60)
    log.info(f"Config: brokers={KAFKA_BOOTSTRAP_SERVERS.split(',')[0]}... "
             f"topic={KAFKA_TOPIC} group={KAFKA_GROUP_ID}")
    log.info(f"Config: clickhouse={CLICKHOUSE_URL} db={CLICKHOUSE_DATABASE}")
    log.info(f"Config: batch_size={BATCH_SIZE} batch_timeout={BATCH_TIMEOUT_MS}ms")

    # Start health endpoint
    _start_health_server()

    # Connect with retry
    ch, consumer = _connect_with_retry()

    # Run consumer loop
    consume_and_insert(ch, consumer)


if __name__ == "__main__":
    main()
