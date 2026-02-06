-- Sandarb ClickHouse Schema
-- ===========================
-- Creates the sandarb database, events table, and materialized views.
-- Run: docker exec clickhouse01 clickhouse-client --multiquery < schema/001_sandarb_events.sql
--
-- Flow: Sandarb API → Kafka (sandarb_events) → ClickHouse (sandarb.events)
--       via either Kafka Engine (in-cluster) or external batch insert.

CREATE DATABASE IF NOT EXISTS sandarb;

-- ═══════════════════════════════════════════════════════════════════════
-- Primary event table (all governance events, denormalized for OLAP)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sandarb.events
(
    event_id          UUID DEFAULT generateUUIDv4(),
    event_type        LowCardinality(String),    -- INJECT_SUCCESS, INJECT_DENIED, etc.
    event_category    LowCardinality(String),    -- inject, audit, agent-lifecycle, etc.

    -- Agent identity
    agent_id          String DEFAULT '',
    agent_name        LowCardinality(String) DEFAULT '',
    org_id            String DEFAULT '',
    org_name          LowCardinality(String) DEFAULT '',

    -- Context fields
    context_id        String DEFAULT '',
    context_name      LowCardinality(String) DEFAULT '',
    version_id        String DEFAULT '',
    version_number    UInt32 DEFAULT 0,

    -- Prompt fields
    prompt_id         String DEFAULT '',
    prompt_name       LowCardinality(String) DEFAULT '',

    -- Governance proof
    data_classification LowCardinality(String) DEFAULT '',
    governance_hash     String DEFAULT '',
    hash_type           LowCardinality(String) DEFAULT 'sha256',
    template_rendered   Bool DEFAULT false,

    -- Denial / violation
    denial_reason     String DEFAULT '',
    violation_type    LowCardinality(String) DEFAULT '',
    severity          LowCardinality(String) DEFAULT '',

    -- Trace & request
    trace_id          String DEFAULT '',
    source_ip         String DEFAULT '',
    request_method    LowCardinality(String) DEFAULT '',
    request_path      String DEFAULT '',

    -- Timestamps
    event_time        DateTime64(3, 'UTC') DEFAULT now64(3),
    ingested_at       DateTime64(3, 'UTC') DEFAULT now64(3),

    -- Flexible metadata
    metadata          String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (org_id, event_type, event_time, event_id)
TTL toDateTime(event_time) + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;


-- ═══════════════════════════════════════════════════════════════════════
-- Materialized Views (pre-aggregated for sub-10ms dashboard queries)
-- ═══════════════════════════════════════════════════════════════════════

-- Daily KPIs
CREATE TABLE IF NOT EXISTS sandarb.daily_kpis
(
    day                 Date,
    org_id              String,
    event_type          LowCardinality(String),
    data_classification LowCardinality(String),
    event_count         UInt64,
    rendered_count      UInt64,
    unique_agents       AggregateFunction(uniqExact, String),
    unique_contexts     AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (org_id, event_type, day, data_classification);

CREATE MATERIALIZED VIEW IF NOT EXISTS sandarb.daily_kpis_mv
TO sandarb.daily_kpis
AS SELECT
    toDate(event_time) AS day,
    org_id,
    event_type,
    data_classification,
    count() AS event_count,
    countIf(template_rendered) AS rendered_count,
    uniqExactState(agent_id) AS unique_agents,
    uniqExactState(context_name) AS unique_contexts
FROM sandarb.events
GROUP BY day, org_id, event_type, data_classification;

-- Agent activity heatmap
CREATE TABLE IF NOT EXISTS sandarb.agent_activity
(
    agent_id     String,
    agent_name   LowCardinality(String),
    hour         DateTime,
    event_type   LowCardinality(String),
    event_count  UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (agent_id, hour, event_type);

CREATE MATERIALIZED VIEW IF NOT EXISTS sandarb.agent_activity_mv
TO sandarb.agent_activity
AS SELECT
    agent_id,
    agent_name,
    toStartOfHour(event_time) AS hour,
    event_type,
    count() AS event_count
FROM sandarb.events
GROUP BY agent_id, agent_name, hour, event_type;

-- Top consumed contexts
CREATE TABLE IF NOT EXISTS sandarb.top_contexts
(
    context_name   LowCardinality(String),
    day            Date,
    inject_count   UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (context_name, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS sandarb.top_contexts_mv
TO sandarb.top_contexts
AS SELECT
    context_name,
    toDate(event_time) AS day,
    count() AS inject_count
FROM sandarb.events
WHERE event_type IN ('INJECT_SUCCESS', 'INJECT_DENIED')
GROUP BY context_name, day;

-- Governance proof ledger
CREATE TABLE IF NOT EXISTS sandarb.governance_proofs
(
    context_name      LowCardinality(String),
    governance_hash   String,
    agent_id          String,
    day               Date,
    delivery_count    UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (context_name, governance_hash, day, agent_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS sandarb.governance_proofs_mv
TO sandarb.governance_proofs
AS SELECT
    context_name,
    governance_hash,
    agent_id,
    toDate(event_time) AS day,
    count() AS delivery_count
FROM sandarb.events
WHERE event_type = 'INJECT_SUCCESS' AND governance_hash != ''
GROUP BY context_name, governance_hash, agent_id, day;

-- Denial reasons breakdown
CREATE TABLE IF NOT EXISTS sandarb.denial_reasons
(
    denial_reason   String,
    event_type      LowCardinality(String),
    day             Date,
    denial_count    UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (denial_reason, event_type, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS sandarb.denial_reasons_mv
TO sandarb.denial_reasons
AS SELECT
    denial_reason,
    event_type,
    toDate(event_time) AS day,
    count() AS denial_count
FROM sandarb.events
WHERE event_type IN ('INJECT_DENIED', 'PROMPT_DENIED', 'POLICY_VIOLATION')
GROUP BY denial_reason, event_type, day;
