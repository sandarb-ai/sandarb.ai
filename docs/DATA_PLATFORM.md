# Sandarb AI Governance - Data Platform

The Sandarb Data Platform provides real-time analytics, audit trail storage, and dashboarding for the AI governance control plane. It processes **AI Governance Proof (AGP)** events — context injections, prompt deliveries, A2A calls, audit entries, policy violations — from the Sandarb API and stores them in ClickHouse for sub-second analytics and Superset dashboards.

**AGP (AI Governance Proof)** is the core metric that tracks every governance event end-to-end: from context/prompt serving through Kafka streaming to ClickHouse analytics. Every governance action generates an AGP event with cryptographic hash proofs, trace IDs, and full audit metadata.

## Technology Stack

| Layer | Technology | Role | When |
|-------|-----------|------|------|
| OLTP | PostgreSQL | Entity CRUD, approvals, config | Now |
| Streaming | Apache Kafka | Event bus, decouple ingest from analytics | Phase 1 |
| OLAP | ClickHouse | Real-time analytics, dashboards, reports | Phase 1 |
| Data Lakehouse | Apache Iceberg on S3 | Long-term storage, AI/ML use-cases | Phase 2 |

**Supporting services:**

| Service | Technology | Role |
|---------|-----------|------|
| Dashboards | Apache Superset | BI dashboards, visual analytics |
| SKCC (Sandarb Kafka to ClickHouse Consumer) | Python (kafka-python, urllib3) | Kafka to ClickHouse batch pipeline |
| Coordination | ClickHouse Keeper (Raft) | Replicated table coordination (replaces ZooKeeper) |
| PostgreSQL HA | CloudNativePG (GKE) / Streaming Replication (local) | Automated failover, read replicas |

## Architecture

### AGP Pipeline Animation

The Sandarb UI includes an animated SVG pipeline diagram on the **AI Governance Reports** page (`/reports`). It visualizes the real-time AGP (AI Governance Proof) data flow with traveling dots showing governance events flowing through the pipeline:

```
[5 AI Agents] ⇄ [Sandarb] → [Kafka] → [SKCC] → [ClickHouse] → [Superset]
```

The component is at `components/data-pipeline-diagram.tsx` and uses native SVG `<animateMotion>` — no JavaScript animation library needed. It shows:

- **5 AI Agents** (left) sending bidirectional requests to Sandarb (context injection, prompt fetch, audit)
- **Sandarb** (center, purple) as the governance control plane — generates AGP events
- **Kafka** (cylinder) as the event stream buffer
- **SKCC** (wave icon) — Sandarb Kafka to ClickHouse Consumer, batching events
- **ClickHouse** (database cylinder) for OLAP analytics
- **Superset** (bar chart icon) for BI dashboards

### AI Governance Data Flow

The data platform captures every governance event — context injections, prompt deliveries, audit entries, policy violations — and makes them queryable in real time.

```
                    ┌─────────────────────────────────────────────────────┐
                    │               AI AGENT ECOSYSTEM                     │
                    │                                                       │
                    │   Agent A          Agent B          Agent C           │
                    │   (OpenAI)         (LangChain)      (Custom)         │
                    └────┬──────────────────┬──────────────────┬───────────┘
                         │ get_context      │ get_prompt       │ validate
                         │ get_prompt       │ register         │ audit
                         ▼                  ▼                  ▼
              ┌─────────────────────────────────────────────────────────┐
              │              SANDARB CONTROL PLANE                       │
              │                                                          │
              │   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
              │   │ REST API │  │ A2A      │  │ MCP Server           │ │
              │   │ /api/*   │  │ 24 skills│  │ 22 tools             │ │
              │   └────┬─────┘  └────┬─────┘  └─────────┬────────────┘ │
              │        │             │                    │              │
              │        └─────────────┴────────────────────┘              │
              │                      │                                    │
              │            ┌─────────▼─────────┐                         │
              │            │  FastAPI Backend   │                         │
              │            │  (Governance Logic)│                         │
              │            └──┬────────────┬───┘                         │
              │               │            │                              │
              │          CRUD │            │ Publish Event                │
              │               ▼            ▼                              │
              └───────────────┼────────────┼──────────────────────────────┘
                              │            │
              ┌───────────────▼──┐   ┌─────▼──────────────────────────────────────────────────┐
              │   PostgreSQL HA   │   │                 DATA PLATFORM                           │
              │                   │   │                                                          │
              │  ┌─────────────┐  │   │  ┌───────────────────┐                                  │
              │  │   Primary    │  │   │  │  Apache Kafka      │                                  │
              │  │   (OLTP)     │  │   │  │  3 KRaft Brokers   │  Topic: sandarb_events           │
              │  │  port 5432   │  │   │  │  (No ZooKeeper)    │  12 partitions                   │
              │  ├─────────────┤  │   │  └─────────┬─────────┘                                  │
              │  │  Replica 1   │  │   │            │ consume (consumer group)                    │
              │  │  port 5433   │  │   │            ▼                                             │
              │  ├─────────────┤  │   │  ┌───────────────────┐                                  │
              │  │  Replica 2   │  │   │  │ SKCC              │  2 instances (local)             │
              │  │  port 5434   │  │   │  │ (Python)           │  1 instance  (GKE)               │
              │  └─────────────┘  │   │  │ Batch: 2000 / 5s   │  Same KAFKA_GROUP_ID             │
              │                   │   │  └─────────┬─────────┘  = auto partition rebalance       │
              │  Databases:       │   │            │ batch insert (HTTP)                          │
              │  - sandarb        │   │            ▼                                             │
              │  - superset       │   │  ┌───────────────────────────────────────────────┐      │
              │                   │   │  │              ClickHouse OLAP                    │      │
              │  GKE: CNPG        │   │  │                                                 │      │
              │  Local: Streaming │   │  │  Shard 01            Shard 02                   │      │
              │   Replication     │   │  │  ┌────────────┐     ┌────────────┐              │      │
              └───────────────────┘   │  │  │clickhouse01│     │clickhouse03│              │      │
                        │             │  │  │clickhouse02│     │clickhouse04│              │      │
                        │             │  │  └────────────┘     └────────────┘              │      │
                        │             │  │                                                 │      │
                        │             │  │  ClickHouse Keeper (3-node Raft ensemble)       │      │
                        │             │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │      │
                        │             │  │  │keeper 01│ │keeper 02│ │keeper 03│           │      │
                        │             │  │  │ (leader)│ │(follower)│ │(follower)│          │      │
                        │             │  │  └─────────┘ └─────────┘ └─────────┘           │      │
                        │             │  └──────────────────┬────────────────────────────┘      │
                        │             │                     │ query                              │
                        │             │                     ▼                                    │
                        │             │  ┌───────────────────────────────────────┐              │
                        ├─────────────│─▶│         Apache Superset (HA)          │              │
                        │  metadata   │  │  2 nodes: port 8088, 8089            │              │
                        │             │  │                                       │              │
                        │             │  │  Dashboards:                          │              │
                        │             │  │  - Daily KPIs (event counts by org)   │              │
                        │             │  │  - Agent Activity Heatmap             │              │
                        │             │  │  - Top Consumed Contexts              │              │
                        │             │  │  - Governance Proof Ledger            │              │
                        │             │  │  - Denial Reasons Breakdown           │              │
                        │             │  └───────────────────────────────────────┘              │
                        │             │                                                          │
                        │             └──────────────────────────────────────────────────────────┘
                        │
              ┌─────────▼─────────────────────────────────────────┐
              │            PHASE 2 (Future)                         │
              │                                                     │
              │  ┌───────────────────────────────────────────────┐ │
              │  │   Apache Iceberg on S3                         │ │
              │  │   Long-term governance data lakehouse               │ │
              │  │   AI/ML training on governance patterns        │ │
              │  └───────────────────────────────────────────────┘ │
              └───────────────────────────────────────────────────────┘
```

### Governance Events Captured

| Event Type | Source | Description |
|------------|--------|-------------|
| `INJECT_SUCCESS` | Context delivery | Agent received approved context |
| `INJECT_DENIED` | Access control | Agent denied context (wrong permissions) |
| `PROMPT_DELIVERED` | Prompt fetch | Agent received approved prompt |
| `PROMPT_DENIED` | Access control | Agent denied prompt access |
| `POLICY_VIOLATION` | Validation | Content failed governance rules |
| `AGENT_REGISTERED` | Agent lifecycle | New agent registered |
| `AUDIT_LOG` | API/A2A/MCP | Any governance API call |

### Data Flow Summary

```
1. Agent calls Sandarb  ──▶  2. API publishes to Kafka  ──▶  3. Consumer batches + inserts
   (A2A / MCP / REST)           (sandarb_events topic)          (2000 events or 5s flush)
                                                                          │
4. Superset dashboards  ◀──  5. ClickHouse OLAP queries  ◀────────────────┘
   (sub-10ms via MVs)          (materialized views)
```

## Local Development (Docker Compose)

The local environment mirrors the GKE production topology across 6 Docker Compose projects. All containers are prefixed with `sandarb-`.

### Services

| Compose Project | Containers | Ports | Directory |
|----------------|-----------|-------|-----------|
| `sandarb-postgres` | 1 primary + 2 streaming replicas | 5432, 5433, 5434 | `postgres/` |
| `sandarb-kafka-cluster` | 5 KRaft brokers | 9090-9094 | `kafka-cluster/` |
| `sandarb-clickhouse-cluster` | 4 ClickHouse nodes + 3 Keeper nodes | 8123-8126, 9181-9183 | `clickhouse-cluster/` |
| `sandarb-kafka-clickhouse-consumer` | 2 consumer instances | 8079, 8080 | `kafka-clickhouse-consumer/` |
| `sandarb-superset-cluster` | 2 Superset nodes (HA) | 8088, 8089 | `superset/` |

### Start Order

Services must be started in dependency order:

```bash
# 1. PostgreSQL HA cluster (1 primary + 2 streaming replicas)
docker compose -f postgres/docker-compose.yml up -d

# 2. Kafka cluster (5 KRaft brokers — no ZooKeeper)
docker compose -f kafka-cluster/docker-compose.yml up -d

# 3. ClickHouse cluster (4 nodes + 3 ClickHouse Keeper — no ZooKeeper)
docker compose -f clickhouse-cluster/docker-compose.yml up -d

# 4. Apply ClickHouse schema
docker exec sandarb-clickhouse01 clickhouse-client --password sandarb \
  --multiquery -q "$(cat clickhouse-cluster/schema/001_sandarb_events.sql)"

# 5. SKCC (2 instances, auto-scales via Kafka consumer groups)
docker compose -f kafka-clickhouse-consumer/docker-compose.yml up -d

# 6. Superset HA (2 nodes, shared PostgreSQL metadata)
docker compose -f superset/docker-compose.yml up -d
```

### Verify

```bash
# PostgreSQL: replication status
docker exec sandarb-postgres-primary psql -U postgres -c \
  "SELECT client_addr, state, sent_lsn, replay_lsn FROM pg_stat_replication;"

# Kafka: list topics
docker exec broker01 /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9090

# ClickHouse: Keeper status (should show "leader" + 2 followers)
echo "mntr" | nc localhost 9181

# ClickHouse: cluster topology
docker exec sandarb-clickhouse01 clickhouse-client --password sandarb \
  -q "SELECT cluster, shard_num, replica_num, host_name FROM system.clusters WHERE cluster='sandarb_cluster'"

# Consumer: health check (both instances)
curl http://localhost:8079/health
curl http://localhost:8080/health

# Superset: health check (both nodes)
curl http://localhost:8088/health
curl http://localhost:8089/health
```

## Production (GKE)

The data platform runs on Google Kubernetes Engine (GKE) as stateful workloads. The core Sandarb services (UI, API, Agent) run separately on Cloud Run.

```
Cloud Run (core):       sandarb-ui, sandarb-api, sandarb-agent
GKE (data platform):    PostgreSQL (CNPG) + Kafka + ClickHouse + Consumer + Superset
```

### GKE Architecture

| Component | Resource Type | Replicas | Configuration |
|-----------|--------------|----------|---------------|
| PostgreSQL | Cloud SQL | Managed | Cloud SQL for PostgreSQL (SOR) |
| Kafka | StatefulSet | 3 (all controller+broker) | KRaft consensus, EXTERNAL listener on :9094 |
| ClickHouse | StatefulSet | 2 (1 shard × 2 replicas) | 1Gi premium-rwo per node |
| ClickHouse Keeper | StatefulSet | 3 | Raft consensus (replaces ZooKeeper) |
| SKCC | Deployment | 1 | Sandarb Kafka to ClickHouse Consumer |
| Superset | Deployment | 1 | Apache Superset BI dashboard |

### Kubernetes Manifests

All manifests are in `k8s/`:

| File | Resource | Description |
|------|----------|-------------|
| `namespace.yaml` | Namespace | `sandarb-data` namespace |
| `secrets.yaml.example` | Secret | Template for passwords and secret keys |
| `kafka-statefulset.yaml` | StatefulSet + Services | 3-broker KRaft cluster + headless Service + topic init Job |
| `kafka-internal-lb.yaml` | Internal LoadBalancer | Cloud Run → Kafka bootstrap on port 9094 |
| `clickhouse-configmap.yaml` | ConfigMap | Cluster config + per-node macros |
| `clickhouse-statefulset.yaml` | StatefulSet + Services | 2 ClickHouse nodes + 3 Keeper nodes |
| `clickhouse-internal-lb.yaml` | Internal LoadBalancer | Cloud Run → ClickHouse on port 8123 |
| `consumer-deployment.yaml` | Deployment + Service | SKCC (Sandarb Kafka to ClickHouse Consumer) |
| `superset-deployment.yaml` | Deployment + Service | Apache Superset BI dashboard |
| `superset-internal-lb.yaml` | Internal LoadBalancer | Cloud Run → Superset on port 8088 |

### One-Command Deploy

```bash
./scripts/deploy-data-platform-gcp.sh [PROJECT_ID] [REGION]
```

This will:
1. Enable GKE + Cloud Build + Artifact Registry APIs
2. Build Superset and SKCC images via Cloud Build
3. Create a GKE Autopilot cluster (`sandarb-data`)
4. Apply namespace and secrets
5. Deploy Kafka StatefulSet (3 KRaft brokers) + Internal LoadBalancer
6. Deploy ClickHouse StatefulSet (2 nodes + 3 Keepers) + Internal LoadBalancer
7. Deploy SKCC (Sandarb Kafka to ClickHouse Consumer)
8. Deploy Superset + Internal LoadBalancer

Flags:
- `--build-only`: Build and push images only (no GKE deploy)
- `--deploy-only`: Apply k8s manifests only (images must exist)

### Accessing Services

```bash
# Superset dashboard
kubectl port-forward svc/superset -n sandarb-data 8088:8088
# Open http://localhost:8088

# Consumer health
kubectl port-forward svc/sandarb-consumer -n sandarb-data 8079:8079
curl http://localhost:8079/health

# ClickHouse query
kubectl exec -it clickhouse-0 -n sandarb-data -- \
  clickhouse-client -q "SELECT count() FROM sandarb.events"

# PostgreSQL (CNPG status)
kubectl cnpg status sandarb-postgres -n sandarb-data
```

### Cloud Run → GKE Connectivity

Cloud Run services (sandarb-api, sandarb-agent) connect to GKE data platform services via **Direct VPC Egress** and **Internal LoadBalancers**:

| Cloud Run Service | GKE Target | Internal LB IP | Port | Purpose |
|-------------------|-----------|----------------|------|---------|
| sandarb-api | Kafka | `sandarb-kafka-internal` | 9094 | Publish AGP events (EXTERNAL listener) |
| sandarb-api | ClickHouse | `sandarb-clickhouse-internal` | 8123 | Health checks, analytics queries |
| sandarb-api | Superset | `sandarb-superset-internal` | 8088 | Health checks |

**How it works:**
1. Cloud Run uses **Direct VPC Egress** to get a NIC on the VPC
2. **Internal LoadBalancers** provide stable VPC IPs for each GKE service
3. For Kafka: Cloud Run bootstraps via the Internal LB, then connects directly to pod VPC IPs on port 9094 (EXTERNAL listener advertises `${POD_IP}:9094`)
4. Cloud Run env vars: `KAFKA_BOOTSTRAP_SERVERS`, `CLICKHOUSE_URL`, `SUPERSET_URL`

## Component Details

### PostgreSQL HA

**Local:** Native streaming replication with 1 primary + 2 read replicas. Replicas are initialized via `pg_basebackup` and maintain `standby.signal` for continuous WAL streaming. The primary runs on port 5432, replicas on 5433 and 5434.

**GKE:** CloudNativePG (CNPG) operator manages a 3-instance PostgreSQL cluster with automated failover. CNPG provides:
- Automated primary election and failover (no external HA tools)
- Synchronous replication for zero data loss
- Point-in-time recovery (PITR) with WAL archiving
- `sandarb-postgres-rw` service (primary) and `sandarb-postgres-ro` service (read replicas)
- Prometheus monitoring endpoints

Databases: `sandarb` (governance data) and `superset` (dashboard metadata).

### Kafka (KRaft)

**Local:** 5-broker cluster using KRaft consensus (no ZooKeeper dependency). Brokers 0-4 run as combined controller+broker nodes. 8 topics with 6 partitions each.

**GKE:** 3-broker cluster (all controller+broker). Two listeners: PLAINTEXT (:9092) for intra-cluster and EXTERNAL (:9094) advertising pod VPC IPs for Cloud Run connectivity. An Internal LoadBalancer (`sandarb-kafka-internal`) provides a stable VPC IP for Cloud Run bootstrap. 8 Sandarb topics with 6 partitions each, replication factor 3.

### ClickHouse + Keeper

**Local:** 2 shards with internal replication (4 nodes total).
- Shard 01: `clickhouse01`, `clickhouse02` (2 replicas)
- Shard 02: `clickhouse03`, `clickhouse04` (2 replicas)

**GKE:** 1 shard × 2 replicas (2 nodes). MergeTree engine (non-replicated — schema must be applied to ALL nodes independently). An Internal LoadBalancer (`sandarb-clickhouse-internal`) provides a stable VPC IP for Cloud Run health checks and analytics queries.

**ClickHouse Keeper** (3-node Raft ensemble) replaces ZooKeeper for replicated table coordination. Keeper is wire-compatible with ZooKeeper protocol but runs natively within the ClickHouse ecosystem — no external Java dependency.

| Aspect | ZooKeeper (old) | ClickHouse Keeper (current) |
|--------|----------------|---------------------------|
| Protocol | ZAB | Raft |
| Language | Java | C++ (native ClickHouse) |
| Dependency | External service | Built-in / dedicated image |
| HA | Requires 3+ ZK nodes | 3-node Raft quorum |
| Port | 2181 | 9181 |

### SKCC (Sandarb Kafka to ClickHouse Consumer)

Standalone Python service that consumes events from Kafka and batch-inserts into ClickHouse. Runs 2 instances locally (1 on GKE) sharing the same Kafka consumer group (`sandarb-clickhouse-consumer`) for automatic partition distribution across instances.

Features:
- Batch processing: 2000 events or 5s timeout per flush
- At-least-once delivery: manual Kafka offset commit after ClickHouse insert
- Insert retry: 3 attempts with exponential backoff
- Horizontal scaling: add instances to the consumer group; Kafka rebalances partitions automatically

### Apache Superset

BI dashboard for governance analytics. Runs as a 2-node HA cluster with shared PostgreSQL metadata store. Connected to ClickHouse for real-time event queries.

ClickHouse schema includes pre-aggregated materialized views for sub-10ms dashboard queries:
- `daily_kpis` — Daily event counts by org, type, classification
- `agent_activity` — Hourly agent activity heatmap
- `top_contexts` — Most consumed contexts
- `governance_proofs` — Hash-verified delivery ledger
- `denial_reasons` — Denial breakdown by reason and type

## Event Flow

```
1. Agent calls Sandarb API (context injection, prompt fetch, audit log)
        │
2. Sandarb API publishes event to Kafka topic "sandarb_events"
        │
3. SKCC consumes from Kafka
   - Batch accumulation (2000 events or 5s timeout)
   - Parse, validate, and enrich events
        │
4. Batch insert into ClickHouse (sandarb.events table)
   - Materialized views auto-aggregate for dashboards
        │
5. Superset queries ClickHouse for real-time dashboards
   - Daily KPIs, agent activity, governance proofs, denial analysis
```

## Testing

The data platform has **122 backend tests** across 3 test files:

```bash
# Run all tests
python -m pytest kafka-clickhouse-consumer/tests/ -v

# Individual test files
python -m pytest kafka-clickhouse-consumer/tests/test_consumer_bridge.py -v   # 39 unit tests
python -m pytest kafka-clickhouse-consumer/tests/test_integration.py -v       # 11 integration tests
python -m pytest kafka-clickhouse-consumer/tests/test_k8s_manifests.py -v     # 72 k8s manifest tests
```

| Suite | Tests | Coverage |
|-------|-------|----------|
| SKCC (unit) | 39 | Timestamp parsing, event parsing, metrics, ClickHouse client, health endpoint |
| Integration | 11 | Live consumer health, ClickHouse connectivity, schema validation, container naming |
| K8s Manifests | 72 | CNPG cluster, Kafka StatefulSet, ClickHouse ConfigMap/StatefulSet, Consumer Deployment, Superset |

## Configuration

### Environment Variables (SKCC — Sandarb Kafka to ClickHouse Consumer)

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `broker01:9090,...` | Comma-separated Kafka broker addresses |
| `KAFKA_TOPIC` | `sandarb_events` | Kafka topic to consume |
| `KAFKA_GROUP_ID` | `sandarb-clickhouse-consumer` | Consumer group ID (shared across instances) |
| `KAFKA_AUTO_OFFSET_RESET` | `latest` | Where to start if no committed offset |
| `CLICKHOUSE_URL` | `http://host.docker.internal:8123` | ClickHouse HTTP endpoint |
| `CLICKHOUSE_DATABASE` | `sandarb` | ClickHouse database name |
| `CLICKHOUSE_USER` | `default` | ClickHouse username |
| `CLICKHOUSE_PASSWORD` | `sandarb` | ClickHouse password |
| `BATCH_SIZE` | `2000` | Max events per ClickHouse insert batch |
| `BATCH_TIMEOUT_MS` | `5000` | Max ms before flushing a partial batch |
| `HEALTH_PORT` | `8079` | HTTP health endpoint port |
| `LOG_LEVEL` | `INFO` | Logging level |

### Enterprise Configuration

In the Sandarb UI Settings page, enterprise teams can configure their own data platform endpoints:

- **Kafka:** Bootstrap servers, compression, acks
- **ClickHouse:** URL, database, user, password
- **Superset:** URL for external link in sidebar

This allows enterprises to point Sandarb at their existing data infrastructure without changing any code.

## AGP Storage Tiers

AGP (AI Governance Proof) data has multiple use-cases that require different storage characteristics. Sandarb's Data Platform implements a tiered storage strategy:

| Tier | Technology | Retention | Use Case |
|------|-----------|-----------|----------|
| **Hot** | ClickHouse (OLAP) | 90 days | Real-time dashboards, operational analytics, Superset |
| **Warm** | Apache Iceberg on S3 | Years | Compliance audits, regulatory reporting, historical analysis |
| **Archive** | S3 Glacier | Indefinite | Long-term retention for legal/regulatory requirements |

### Phase 1 (Current): ClickHouse Hot Storage

AGP events flow through the Kafka → SKCC → ClickHouse pipeline for sub-second analytics. ClickHouse provides:
- Real-time materialized views for dashboard KPIs
- Columnar storage for efficient analytical queries
- TTL-based automatic data expiration (configurable)

### Phase 2 (Roadmap): Apache Iceberg on S3

For long-term AGP storage, Sandarb will publish governance events to an **Apache Iceberg** table format on S3/GCS. Iceberg provides:

- **Open table format** — vendor-neutral, queryable by Spark, Trino, DuckDB, and other engines
- **Time travel** — query AGP data as it existed at any point in time (critical for compliance audits)
- **Schema evolution** — add new AGP event fields without rewriting historical data
- **Partition evolution** — re-partition data without reprocessing
- **ACID transactions** — concurrent readers and writers without corruption

**Architecture (Phase 2):**
```
Kafka → SKCC → ClickHouse (hot, 90d)
     → Iceberg Writer → S3/GCS Iceberg tables (warm, years)
                                    ↓
                         Spark / Trino / DuckDB (AI/ML, compliance reports)
```

**Use cases for Iceberg-backed AGP:**
- Regulatory compliance reporting (SOC 2, ISO 27001, GDPR Article 30)
- AI governance audit trails with time-travel queries
- AI/ML training on governance patterns (anomaly detection, risk scoring)
- Cross-organization governance benchmarking
- Long-term trend analysis for AI agent behavior
