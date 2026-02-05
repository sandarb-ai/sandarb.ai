# Sandarb developer guide

Developer integration and usage guide for anyone in the firm. For the full interactive guide, open **/docs** in the running Sandarb app (e.g. https://your-sandarb.example.com/docs).

## Overview

Sandarb is AI governance for your AI agents: a single place for approved prompts and context, audit trail, lineage, and a living agent registry. The **Sandarb AI Governance Agent** participates in A2A (fast becoming the industry standard for agent-to-agent communication): other agents call Sandarb for governance, and Sandarb can communicate with other agents via A2A. Integrate via:

- **API** – CRUD for organizations, agents, contexts, templates; inject context by name
- **A2A protocol** – Discovery (Agent Card) and skills: `get_context`, `validate_context`, `get_lineage`, `register`. Sandarb is an AI agent that participates in A2A as both server and first-class participant.
- **Sandarb Client SDK** – A small library you drop into your Worker Agents so developers don’t write raw A2A/API calls every time. It handles **Check-in** (register on startup) and **Audit Push** (audit_log after inference) automatically, plus helpers for `getPrompt`, `validateContext`, `getContext`. See `lib/sandarb-client.ts` (TypeScript/Node) and the [Sandarb Client SDK](/docs#sandarb-client-sdk) section in the in-app docs.
- **Inject API** – `GET /api/inject?name=my-context` returns approved context (JSON/YAML/text) for your agent
- **Templates** – Reusable schemas and default values for context content; link a context to a template for consistent structure

## Prompts vs Context: Governance Perspective

In AI Governance, **Prompts** and **Context** are two distinct asset classes with different risks, lifecycles, and compliance requirements. Think of an AI Agent as a **digital employee**:

- **Prompts** are the **"Employee Handbook"** (instructions on how to behave, tone, and rules).
- **Context** is the **"Reference Library"** (the specific files, user data, or reports the agent is allowed to read to do a task).

### 1. Prompts (The "Behavior")

Prompts are **instructions**. They define the agent's persona, logical constraints, and safety boundaries. In governance, prompts are treated like **source code**.

**Governance Focus:** Behavioral Consistency & Safety.

**Goal:** Ensure the agent doesn't sound rude, promise illegal things, or break brand guidelines.

**The Risk:** Drift & Jailbreaks. A developer changes the prompt to "be more creative," and suddenly the agent starts making up features you don't have.

**How it's Governed:**

- **Versioning** – Like software (v1.0, v1.1). You must be able to roll back to a previous prompt if the new one fails.
- **Approval Workflows** – A junior dev writes a prompt, but a Product Manager or Compliance Officer must "sign off" before it goes to production.
- **Immutable Testing** – Prompts are tested against "Golden Datasets" (standard questions) to ensure the new version performs as well as the old one.

### 2. Context (The "Knowledge")

Context is **data**. It is the dynamic information injected into the agent at runtime (via RAG - Retrieval Augmented Generation) to answer a specific question. In governance, context is treated like **sensitive database records**.

**Governance Focus:** Access Control & Privacy.

**Goal:** Ensure the "Customer Support Agent" can see Order History but CANNOT see Credit Card Numbers or Employee Salaries.

**The Risk:** Data Leaks & Contamination. If an agent is given the wrong context (e.g., an outdated policy PDF or a confidential internal memo), it will confidently state incorrect or leaked information to the user.

**How it's Governed:**

- **Access Scopes (RBAC)** – Defining strict boundaries (e.g., "This agent can only access documents tagged public-support").
- **Data Lineage** – Tracking exactly which document chunk was used to generate an answer. If an agent lies, you need to know if it was the prompt's fault or if the source document was wrong.
- **Sanitization** – Automatically stripping PII (Personally Identifiable Information) from data before it enters the context window.

### Comparison Summary

| Feature | Prompts (Instructions) | Context (Data/Knowledge) |
|---------|------------------------|--------------------------|
| **Analogy** | The Job Description | The Files in the Cabinet |
| **Change Frequency** | Low (Weekly/Monthly updates) | High (Real-time per user query) |
| **Primary Risk** | Hallucination, Brand Damage, Jailbreaks | Data Leakage, Privacy Violation, Outdated Info |
| **Governance Tool** | Versioning & Approval Workflows | Access Control Lists (ACLs) & Vector Management |
| **Audit Question** | "Who approved this behavior?" | "Why did the agent have access to this file?" |

### The Governance Intersection

In Sandarb, these two meet in the **Audit Log**. When an incident occurs (e.g., a user complains about a bad answer), AI Governance requires you to reconstruct the exact state of both:

> "On Feb 1st at 2:00 PM, Agent X used **Prompt v4.2** and accessed **Context Chunk #992 (HR PDF)** to generate this response."

Without governing both, you cannot diagnose whether the error was a failure of **instruction** (bad prompt) or a failure of **information** (bad context). Sandarb is built to govern both asset classes with versioning, approval workflows, and lineage tracking.

## Reference documentation

| Doc | Description |
|-----|-------------|
| [The Governance Protocol](reference/protocol.md) | Registry & Observer pattern, handshake (Mermaid), check-in, separation of concerns, data model and lineage. |
| [A2A Skills (API reference)](reference/api-skills.md) | Every A2A skill from `getAgentSkills()` with request/response examples and required fields. |
| **Sandarb Client SDK** (in-app docs) | Tiny client wrapper: Check-in and Audit Push automatically; `getPrompt`, `validateContext`, `getContext`. Use `lib/sandarb-client.ts` (TypeScript/Node). |
| [Python integration](guides/python-integration.md) | Sandarb Python Client SDK (`sdk/python/sandarb_client.py`): check-in, audit, get_prompt, validate_context, get_context. |
| [Security](reference/security.md) | Manifest-based registration (`sandarb.json`), shadow AI discovery (`runDiscoveryScan`). |

## Quick start

```bash
git clone https://github.com/openint-ai/sandarb.ai.git
cd sandarb.ai
npm install
export DATABASE_URL=postgresql://postgres:sandarb@localhost:5432/sandarb  # optional
./scripts/start-sandarb.sh
```

Open the UI at http://localhost:3000. Backend runs at http://localhost:8000. Demo data: run `npm run db:full-reset-pg` once (backend uses Postgres).

## API (core)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/inject?name=... | Inject context by name |
| GET | /api/contexts | List contexts |
| GET | /api/contexts/:id | Get context |
| POST | /api/contexts | Create context |
| GET | /api/agents | List agents |
| POST | /api/agents/register | Register agent |
| POST | /api/agents/:id/approve | Approve agent |
| GET | /api/organizations | List organizations |
| POST | /api/organizations | Create organization |
| GET | /api/a2a | A2A Agent Card (discovery) |
| POST | /api/a2a | A2A skill execution |
| GET | /api/lineage | Recent context deliveries |

## Inject API

Your agent fetches approved context by name. Sandarb logs the request for lineage.

```bash
GET /api/inject?name=ib-trading-limits
GET /api/inject?name=my-context&format=json
GET /api/inject?name=my-context&vars={"user_id":"123"}
```

Optional headers: `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`, `X-Sandarb-Variables` (JSON).

## A2A protocol

**How A2A URLs work in practice (Sandarb AI Governance Agent; A2A is the industry standard for agent-to-agent communication):**

1. **Discovery** – Agent A uses the A2A URL of Agent B to read its capabilities (e.g. `GET /api/a2a` returns the Agent Card: name, description, url, version, capabilities, skills).
2. **Interaction** – Agent A sends a JSON-RPC 2.0 message over HTTP(S) to that URL to initiate a task (e.g. `POST /api/a2a` with method and params).
3. **Real-time updates** – For long-running tasks, the A2A server may use Server-Sent Events (SSE) to send updates back to the client. Sandarb currently responds synchronously; SSE may be added for streaming or long-running flows.

- **Discovery:** `GET /api/a2a` returns the Agent Card (name, description, url, version, capabilities, skills).
- **Skills:** `POST /api/a2a` with body `{ "skill": "get_context", "input": { "name": "my-context" } }`.
  - `get_context` – Retrieve context by name (lineage logged)
  - `validate_context` – Validate context content
  - `get_lineage` – Recent context deliveries
  - `register` – Register an agent (manifest with agent_id, version, owner_team, url)

Spec: [a2a.dev](https://a2a.dev), [a2a-protocol.org](https://a2a-protocol.org).

## Templates for context

**Templates** define a reusable structure for context content. Each template has:

- **Schema** – A JSON Schema (e.g. `type: object`, `properties`, `required`) that describes the shape of the context `content` (e.g. which keys exist, types, descriptions).
- **Default values** – Optional default key-value pairs so new contexts created from this template start with sensible values.

**Why templates help:**

1. **Consistency** – All contexts of the same type (e.g. “trading limits”) follow the same structure: same fields, types, and optional defaults. Agents and validators can rely on a known shape.
2. **Governance** – When you link a context to a template (via `templateId`), you document which schema that context conforms to. This supports compliance and audit (“this context is a trading-limits policy”).
3. **Faster authoring** – Creating a new context from a template pre-fills content with default values and guides editors to include the right fields.

**Usage:** Create templates via API (`POST /api/templates`) or seed data. When creating or editing a context, set `templateId` to the template’s id so the context is associated with that schema. The context `content` should conform to the template’s schema; validation can be enforced in the UI or in your pipelines.

### Example: Trading limits template

A template defines the schema for "trading desk limits" context (e.g. `varLimit`, `singleNameLimit`, `desk`). A context linked to this template (e.g. `ib-trading-limits`) might have content: `{ "varLimit": 5000000, "singleNameLimit": 500000, "desk": "equities" }`. Your agent fetches it via `get_context("ib-trading-limits")` or the Inject API; the returned `content` conforms to the template schema so your agent can safely use `content.varLimit` and `content.singleNameLimit`.

### Example: Prompt + context together

Your prompt (e.g. "finance-bot") instructs the agent to use governed context. The agent fetches the prompt, then fetches context by name; the context content is shaped by its template: (1) `get_prompt("finance-bot")` → prompt says "Use the trading limits context for pre-trade checks"; (2) `get_context("ib-trading-limits")` → returns `content` with known shape; (3) your logic uses e.g. reject if order value exceeds `content.singleNameLimit`.

**Sample templates** (seeded when running the seed endpoint): compliance-policy-template, trading-limits-template. See **Templates** in the app UI or `GET /api/templates` for the list.

> **Feature status:** Templates for context are currently in progress. Full support (e.g. validation of context content against template schema at create/update, template-driven UI for context authoring) will be released in a **future version of Sandarb**. The schema and `templateId` linkage are in place today; enhanced tooling and enforcement are coming next.

## Audit headers

- `X-Sandarb-Agent-ID` – Calling agent identifier
- `X-Sandarb-Trace-ID` – Request/correlation ID

## Testing

The project includes a **Vitest** test suite under `tests/` (unit tests for `lib/` and API route tests for `app/api/`). No database is required; lib and DB are mocked.

- **Run:** `npm run test` (watch), `npm run test:run` (single run), `npm run test:coverage` (coverage).
- **Docs:** [tests/README.md](../tests/README.md) — full list of test files, what’s covered, and **how to extend** (adding new lib tests, API route tests, and mocking patterns).

Use the test suite to validate changes and to add coverage when you add or change routes or lib code.

## Observability (OpenTelemetry)

Sandarb uses **OpenTelemetry** for tracing and logging when enabled. All API routes are wrapped in spans and errors are logged via the OTel Logs API. Traces and logs are exported to an OTLP endpoint (e.g. OpenTelemetry Collector, Jaeger, or a cloud observability backend).

**Enable OTel:** Set `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. `http://localhost:4318`) in `.env`. The Next.js instrumentation (`instrumentation.ts`) registers the Node SDK on server start. Backend (FastAPI) has its own OTel setup.

When OTel is disabled (default), the tracer and logger are no-ops.

## Environment variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL URL (required) |
| NEXT_PUBLIC_API_URL | Backend API URL (e.g. http://localhost:8000 for FastAPI). UI fetches from this for all /api/*. |
| PORT | Server port (default 3000) |
| NODE_ENV | production / development |
| OTEL_ENABLED | Set to `true` to enable OpenTelemetry |
| OTEL_SERVICE_NAME | Service name for traces/logs (default: sandarb) |
| OTEL_EXPORTER_OTLP_ENDPOINT | OTLP endpoint (e.g. http://localhost:4318) for traces and logs |
| OTEL_TRACES_EXPORTER | Trace exporter: `otlp` or `none` (default: otlp when endpoint set) |
| OTEL_LOGS_EXPORTER | Log exporter: `otlp` or `none` (default: otlp when endpoint set) |

## Deployment

- **Docker:** `docker compose up -d` (Postgres + app). Demo data seeded on start when `DATABASE_URL` is set.
- **GCP Cloud Run:** `./scripts/deploy-gcp.sh PROJECT_ID`. See [deploy-gcp.md](./deploy-gcp.md) for permissions and Cloud SQL.

## More

- In-app docs: open **/docs** in the running Sandarb instance
- Repository: [github.com/openint-ai/sandarb.ai](https://github.com/openint-ai/sandarb.ai)
