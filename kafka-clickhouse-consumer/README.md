# sandarb-kafka-to-clickhouse-consumer

Standalone Kafka to ClickHouse consumer bridge for the Sandarb AI governance data platform.

## Architecture

```
Sandarb API  -->  Kafka (sandarb_events)  -->  [this consumer ×2]  -->  ClickHouse (sandarb.events)  -->  Superset
```

This service consumes governance events (context injections, prompt usage, A2A calls, audit entries) from Kafka and batch-inserts them into ClickHouse for analytics and dashboarding via Apache Superset.

## Horizontal Scaling

The consumer runs **2 instances locally** (3 on GKE) sharing the same Kafka consumer group (`sandarb-clickhouse-consumer`). Kafka automatically distributes partitions across instances:

| Instances | Partitions per Instance | Notes |
|-----------|------------------------|-------|
| 1 | 12 | Single consumer handles all partitions |
| 2 | 6 | Default local setup |
| 3 | 4 | Default GKE setup |
| 6 | 2 | Maximum useful scaling (12 partitions / 6) |
| 12 | 1 | Maximum parallelism (1 partition per consumer) |

To scale: add more instances to the Docker Compose file (or increase Deployment replicas on GKE). All instances must share the same `KAFKA_GROUP_ID`. Kafka will automatically rebalance partitions when instances join or leave the group.

## Quick Start

```bash
docker compose up -d --build
```

Verify:

```bash
# Health check (consumer-01)
curl http://localhost:8079/health

# Health check (consumer-02)
curl http://localhost:8080/health

# Container logs
docker compose logs -f
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `broker01:9090,...:9090` | Comma-separated Kafka broker addresses |
| `KAFKA_TOPIC` | `sandarb_events` | Kafka topic to consume |
| `KAFKA_GROUP_ID` | `sandarb-clickhouse-consumer` | Consumer group ID (shared across all instances) |
| `KAFKA_AUTO_OFFSET_RESET` | `latest` | Where to start if no committed offset (`latest` or `earliest`) |
| `CLICKHOUSE_URL` | `http://host.docker.internal:8123` | ClickHouse HTTP endpoint |
| `CLICKHOUSE_DATABASE` | `sandarb` | ClickHouse database name |
| `CLICKHOUSE_USER` | `default` | ClickHouse username |
| `CLICKHOUSE_PASSWORD` | `sandarb` | ClickHouse password |
| `BATCH_SIZE` | `2000` | Max events per ClickHouse insert batch |
| `BATCH_TIMEOUT_MS` | `5000` | Max ms before flushing a partial batch |
| `HEALTH_PORT` | `8079` | HTTP health endpoint port (unique per instance) |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |

## Health Endpoint

Each instance exposes a health endpoint on its `HEALTH_PORT`:

```bash
# Consumer 01 (port 8079)
curl http://localhost:8079/health

# Consumer 02 (port 8080)
curl http://localhost:8080/health
```

Returns:

```json
{
  "status": "healthy",
  "kafka_connected": true,
  "clickhouse_connected": true,
  "events_consumed": 1234,
  "events_inserted": 1234,
  "batches_flushed": 5,
  "errors": 0,
  "last_flush_at": "2026-02-07T10:30:00.000000Z",
  "started_at": "2026-02-07T10:00:00.000000Z"
}
```

This endpoint is used by:
- Docker healthcheck (configured in docker-compose.yml)
- Kubernetes liveness/readiness probes (GKE)
- Sandarb notification feed infrastructure health monitoring

## Features

- **Horizontal scaling**: Multiple instances share a Kafka consumer group for automatic partition distribution
- **Batch processing**: Accumulates events and flushes on batch size (2000) or timeout (5s)
- **At-least-once delivery**: Manual Kafka offset commit after successful ClickHouse insert
- **Insert retry**: 3 attempts with exponential backoff on ClickHouse insert failure
- **Startup retry**: Retries Kafka/ClickHouse connections up to 30 times on startup
- **Graceful shutdown**: Flushes remaining batch on SIGTERM/SIGINT before exit
- **Structured logging**: JSON-formatted logs for production log aggregation
- **Health endpoint**: HTTP health check per instance for monitoring
- **Non-root container**: Runs as unprivileged `consumer` user

## Testing

```bash
# All tests (122)
python -m pytest tests/ -v

# Unit tests only (39)
python -m pytest tests/test_consumer_bridge.py -v

# Integration tests (11, requires running services)
python -m pytest tests/test_integration.py -v

# K8s manifest tests (72)
python -m pytest tests/test_k8s_manifests.py -v
```

## Stopping

```bash
docker compose down
```

Both consumer instances will flush any remaining events before exiting.
