# Sandarb.ai
### AI Governance for your AI Agents

> **Our Goal:** AI Governance that doesn't slow shipping AI Agents to production. Protocol-first (A2A, MCP, REST API, Git), versioned prompts/context, and a living agent registry.

> ⚠️ **Note:** This project is under active development. Documentation is being updated and may be incomplete in some areas. Contributions and feedback are welcome!

**Sandarb** (derived from "Sandarbh" (संदर्भ), a Hindi/Sanskrit word meaning "context," "reference," or "connection") is an AI governance platform: a single place for approved prompts and context, audit trail, lineage, and a living agent registry. It is open-source and designed to be installed within your infrastructure to govern and manage your AI Agents.

Sandarb is designed to fit seamlessly into your existing engineering workflow. Your AI Agents and Applications integrate via **A2A**, **MCP**, **API**, or **Git**:

- **A2A (Agent-to-Agent Protocol):** Enables your agent to be discovered by the broader AI ecosystem. Other agents can read your "Agent Card" to understand your capabilities and interact with you using standardized skills (like `validate_context` or `get_lineage`) without custom integration code.
- **MCP (Model Context Protocol):** Connect Claude Desktop, Cursor, Windsurf, or any MCP client directly to Sandarb. 22 governance tools exposed via Streamable HTTP transport at `/mcp`. See [Connecting to Sandarb MCP Server](#-connecting-to-sandarb-mcp-server) below.
- **API (REST & SDK):** The runtime fuel for your agents. Use the API to fetch approved Prompts (instructions) and Context (knowledge) instantly during inference. It also handles management tasks like registering new agents, creating organizations, and logging audit trails.
- **Git (Governance as Code):** Manage your Sandarb config and other governance assets like source code in your AI Agents git repo. Inject the config based on your CI/CD and deployment model for AI Agents.

It serves as the regulatory and compliance backbone for your internal agent ecosystem. While your tech teams focus on building Agents, Sandarb runs alongside them to provide approval workflows, validated context, audit logging, and pending-review visibility.

### Quick Start (local development)

```bash
git clone https://github.com/sandarb-ai/sandarb.ai.git && cd sandarb.ai
npm install
docker compose up -d postgres
./scripts/start-sandarb.sh
```

**UI:** http://localhost:3000 · **Backend:** http://localhost:8000  

Full steps (env, troubleshooting): **[docs/QUICKSTART.md](docs/QUICKSTART.md)**

### Where Sandarb runs (local vs production)

Sandarb is designed to run in a **company’s control plane** to implement AI Governance for AI agents. You do **not** control the API or UI endpoints in production—the company does.

| Environment | Who runs it | Endpoints |
|-------------|-------------|-----------|
| **Local development** | You on your laptop | UI: `http://localhost:3000`, API: `http://localhost:8000`. Use the Quick Start above for localhost integration. |
| **Production** | Your company (platform/security team) | Sandarb is designed to run on a **control plane**—hosted behind a **load balancer** or on a **separate, fully protected server**. API and UI URLs are provided by the company (e.g. `https://sandarb.your-company.com`, `https://api.sandarb.your-company.com`). Your agents and SDK point at those URLs; you do not run or expose Sandarb yourself. |

When you go to production, the service must be hosted and fully protected by your organization. See **[docs/developer-guide.md](docs/developer-guide.md#deployment)** and **[docs/deploy-gcp.md](docs/deploy-gcp.md)** for how to host Sandarb (e.g. behind LB, GCP Cloud Run, or a dedicated server).

### Security

Sandarb is built for enterprise and regulated use. Governance data and audit endpoints are protected by **API key authentication**; agent identity is bound to the key (no header trust). **JWT and service account secrets** are enforced in production (no default/weak secrets). Preview bypass is restricted; secrets are not logged; CORS and SQL are hardened. **DB connection pooling**, **API key expiration**, **offset-based pagination** (default 50, max 500), and **tiered rate limiting** across REST and A2A endpoints. Security headers (CSP, X-Frame-Options) and **error sanitization** prevent stack-trace leakage. **[Full security documentation →](docs/SECURITY.md)**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## 🛑 The "Hard Problem"
In most production AI systems, prompts are "magic strings" buried in code, and context (RAG) is retrieved opaquely. This lack of separation causes:
1.  **Silent Regressions:** A prompt tweak improves one case but breaks ten others.
2.  **Context Contamination:** Agents access irrelevant or sensitive documents because the retrieval scope wasn't locked.
3.  **Compliance Risks:** No audit trail of *why* an agent gave a specific answer or what instructions it was following.

Sandarb addresses this through **AI Governance in the control plane**—governing all AI agents running across your company, without sitting in the middle of every agent–LLM call.

---

## 🎯 What We Solve
We solve the "Black Box" problem of enterprise AI. Instead of scattered prompts and untraceable decisions, Sandarb provides:

* **Single Source of Truth:** A centralized place for approved prompts and context. Your agents pull validated instructions via API, A2A, or MCP protocols.
* **Audit Trail & Lineage:** Complete tracking of who requested what and when. This provides the lineage required for compliance and incident resolution.
* **Manifest-Based Registration:** Agents register via strict manifests (using MCP standards where applicable), ensuring every bot in your network is known, authorized, and versioned.
* **Git-like Versioning:** Prompts and context chunks are treated like code—versioned, branched, and diffable.
* **Sandarb AI Governance Agent:** Sandarb is an AI agent that participates in A2A (fast becoming the industry standard for agent-to-agent communication). Other agents call Sandarb for validation and approved context; Sandarb also communicates with other agents via A2A as a first-class participant.

---

## 🏗 Core Capabilities

### 1. Protocol-First Governance (A2A & MCP)
**The Sandarb AI Governance Agent is crucial.** A2A and MCP are the industry standard protocols for agent-to-agent and tool-to-model communication. Sandarb participates in both: it runs as an A2A server (24 skills at `POST /a2a`) and an MCP server (22 tools at `POST /mcp`) so your agents and AI tools can call it for governance.
* Other agents communicate with Sandarb via A2A or MCP to request validation, fetch approved context, or log decisions.
* MCP clients (Claude Desktop, Cursor, Windsurf) connect directly to Sandarb for governed prompts, contexts, and audit lineage.
* Sandarb acts as the governance agent in the agent mesh, verifying that the requesting agent has the correct permissions (via its manifest) before releasing sensitive prompt instructions or context data.

### 2. Enterprise Workflow & Compliance
* **Approval Workflows:** Prompts are not deployed until they pass through `Draft` → `Pending Review` → `Approved`.
* **Pending-Review Visibility:** A clear dashboard for Compliance Officers or Engineering Leads to see every prompt change awaiting sign-off.
* **Incident Resolution:** When an agent hallucinates, check the Audit Trail to pinpoint exactly which prompt version and context source were active at that microsecond.

### 3. Prompt & Context Engineering
* **Git-Like Versioning:** Roll back instantly. Fork prompts for A/B testing. Merge "Staging" prompts to "Production."
* **Context Validation:** Sandarb ensures that the context injected (RAG) is not just "semantically relevant" but also "compliance approved" for that specific agent intent.

---

## 🔌 Integrate Your Way

Sandarb fits into your architecture however you need it to.

<!-- TODO: Add architecture diagram at docs/images/integrate-your-way.png -->

* **MCP (Model Context Protocol):** Connect Claude Desktop, Cursor, Windsurf, or any MCP client directly to Sandarb. Governed prompts, contexts, and audit lineage are exposed as MCP tools via Streamable HTTP transport. See [Connecting to Sandarb MCP Server](#-connecting-to-sandarb-mcp-server) below.
* **A2A Protocol:** The Sandarb AI Governance Agent participates in A2A (the industry standard for agent-to-agent communication). Other agents call `POST /a2a` with skills like `get_context`, `validate_context`, and `get_lineage`; Sandarb can also communicate with other agents via A2A.
* **API:** Standard HTTP endpoints (`GET /api/contexts`, `GET /api/agents`) for traditional integration.
* **Git-like Flow:** Propose edits with commit messages. Contexts and prompts get versioned history. Sandarb tracks approvals and revisions like a lightweight Pull Request flow.

---

## 🔗 Connecting to Sandarb MCP Server

Sandarb exposes a fully compliant MCP server at `/mcp` using the [official mcp Python SDK](https://github.com/modelcontextprotocol/python-sdk) with **Streamable HTTP transport**. This means Claude Desktop, Cursor, Windsurf, VS Code Copilot, and any MCP-compatible client can connect directly.

### Available MCP Tools (22 tools)

**Agents**

| Tool | Description |
|------|-------------|
| `list_agents` | List all registered agents, optionally filtered by org or approval status |
| `get_agent` | Get detailed info about a specific agent by ID |
| `get_agent_contexts` | List all contexts linked to a specific agent |
| `get_agent_prompts` | List all prompts linked to a specific agent |
| `register_agent` | Register a new agent with the governance platform |

**Organizations**

| Tool | Description |
|------|-------------|
| `list_organizations` | List all organizations |
| `get_organization` | Get organization details by UUID or slug |
| `get_organization_tree` | Get the full organization hierarchy tree |

**Contexts**

| Tool | Description |
|------|-------------|
| `list_contexts` | List context names available to your agent |
| `get_context` | Get approved context content by name (agent must be linked) |
| `get_context_by_id` | Get context details by UUID, including active version content |
| `get_context_revisions` | List all revisions (versions) of a context |

**Prompts**

| Tool | Description |
|------|-------------|
| `list_prompts` | List prompts available to your agent |
| `get_prompt` | Get approved prompt content by name (agent must be linked) |
| `get_prompt_by_id` | Get prompt details by UUID, including all versions |
| `get_prompt_versions` | List all versions of a prompt |

**Audit & Lineage**

| Tool | Description |
|------|-------------|
| `get_lineage` | Get recent context delivery audit trail (successful deliveries) |
| `get_blocked_injections` | Get blocked/denied context injection attempts |
| `get_audit_log` | Get the full A2A audit log (inject, prompt, inference events) |

**Dashboard & Reports**

| Tool | Description |
|------|-------------|
| `get_dashboard` | Get aggregated dashboard data (counts, recent activity) |
| `get_reports` | Get governance reports (risk, regulatory, compliance) |

**Validation**

| Tool | Description |
|------|-------------|
| `validate_context` | Validate context content against governance rules |

### Prerequisites

1. **Sandarb backend running** (locally or deployed)
2. **A registered service account** with an API key (created via the Sandarb UI or database)
3. **An agent registered** in Sandarb and linked to the prompts/contexts it needs access to

### Claude Desktop

Add to your Claude Desktop MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

**Direct connection (Streamable HTTP):**

```json
{
  "mcpServers": {
    "sandarb": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

**Production (via mcp-remote proxy for SSE compatibility):**

```json
{
  "mcpServers": {
    "sandarb": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://api.your-company.com/mcp"
      ]
    }
  }
}
```

### Cursor / Windsurf

In your project's `.cursor/mcp.json` or equivalent config:

```json
{
  "mcpServers": {
    "sandarb": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

Or for production:

```json
{
  "mcpServers": {
    "sandarb": {
      "url": "https://api.your-company.com/mcp"
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add sandarb --transport http http://localhost:8000/mcp
```

### Using the MCP Tools

Once connected, the AI assistant has access to Sandarb governance tools. Each tool that accesses governed data requires three parameters:

- **`api_key`** — Your Sandarb service account API key
- **`source_agent`** — The registered agent ID making the request
- **`trace_id`** — A unique trace identifier for audit logging

Example interaction in Claude Desktop:

> "Use the sandarb MCP server to get the approved prompt named 'customer-support'."

The assistant will call the `get_prompt` tool with the required parameters and return the governed prompt content.

### Testing the MCP Endpoint

You can verify the MCP server is running with a simple curl:

```bash
# Check MCP endpoint (Streamable HTTP)
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# List all available tools
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

### Architecture

The MCP server is built using the official `mcp` Python SDK (`FastMCP`) and mounted on the existing FastAPI application:

```
FastAPI app (backend/main.py)
  ├── /api/*         REST API routers
  ├── /mcp           MCP server (22 tools, Streamable HTTP transport)
  ├── /a2a           A2A JSON-RPC endpoint (24 skills)
  └── /              Agent Card (when SERVICE_MODE=agent or SANDARB_AGENT_SERVICE=1)
```

The MCP server (`backend/mcp_server.py`) and A2A handler (`backend/routers/agent_protocol.py`) use the same underlying backend services (contexts, prompts, audit, agents, organizations, reports). Both expose equivalent functionality: 22 MCP tools + 2 A2A discovery skills = 24 total A2A skills.

---

## 🤝 A2A Protocol (Agent-to-Agent)

Sandarb is also an **AI Governance Agent** that other agents can discover and interact with using the [A2A protocol](https://a2a.dev). When deployed with `SERVICE_MODE=agent` (or `SANDARB_AGENT_SERVICE=1`), the Agent Card is served at `GET /` and A2A skills are available at `POST /a2a`.

### Agent Card (Discovery)

```bash
# Fetch the Agent Card
curl -s https://agent.sandarb.ai/

# Or via the /a2a endpoint
curl -s https://agent.sandarb.ai/a2a
```

### A2A Skills (24 total)

All 22 MCP tools are available as A2A skills, plus 2 discovery methods:

| Category | Skills |
|----------|--------|
| **Discovery** | `agent/info`, `skills/list` |
| **Agents** | `list_agents`, `get_agent`, `get_agent_contexts`, `get_agent_prompts`, `register` |
| **Organizations** | `list_organizations`, `get_organization`, `get_organization_tree` |
| **Contexts** | `list_contexts`, `get_context`, `get_context_by_id`, `get_context_revisions` |
| **Prompts** | `list_prompts`, `get_prompt`, `get_prompt_by_id`, `get_prompt_versions` |
| **Audit & Lineage** | `get_lineage`, `get_blocked_injections`, `get_audit_log` |
| **Dashboard & Reports** | `get_dashboard`, `get_reports` |
| **Validation** | `validate_context` |

### Invoking Skills

```bash
# List all skills
curl -s -X POST https://agent.sandarb.ai/a2a \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"skills/list","params":{}}'

# Execute a skill (requires Authorization header for governed data)
curl -s -X POST https://agent.sandarb.ai/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":2,"method":"skills/execute","params":{"skill":"list_agents","input":{"sourceAgent":"my-agent","traceId":"trace-123"}}}'
```

---

## Enterprise Readiness

Sandarb is built for production enterprise workloads. The platform includes features that support high-availability, secure multi-tenant operation, and compliance at scale.

### Database Connection Pooling

The backend uses **`psycopg2.ThreadedConnectionPool`** instead of a single shared connection, supporting concurrent requests without connection contention.

| Setting | Default | Environment Variable |
|---------|---------|---------------------|
| Minimum pool connections | 2 | `DB_POOL_MIN` |
| Maximum pool connections | 10 | `DB_POOL_MAX` |
| Connection timeout | 10s | `DB_CONNECT_TIMEOUT` |

Connections are automatically returned to the pool after each request. The pool is gracefully closed on application shutdown.

### API Key Expiration

Service account API keys support an optional **`expires_at`** timestamp. When set, the key is automatically rejected after expiry with a `401 Unauthorized` response (REST) or JSON-RPC error (A2A). Keys without an expiration date remain valid indefinitely.

```sql
-- Set a key to expire in 90 days
ALTER TABLE service_accounts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

UPDATE service_accounts
  SET expires_at = NOW() + INTERVAL '90 days'
  WHERE client_id = 'my-service';
```

### Pagination

All list endpoints (REST API, A2A skills, and MCP tools) support **`limit`** and **`offset`** parameters for paginated responses. The default page size is 50, with a maximum of 500 items per request.

**REST API response shape:**
```json
{
  "success": true,
  "data": {
    "agents": [...],
    "total": 951,
    "limit": 50,
    "offset": 0
  }
}
```

**Paginated endpoints:** `/api/agents`, `/api/organizations`, `/api/prompts`, `/api/contexts`, and all A2A list/get skills.

### Per-Skill A2A Rate Limiting

A2A skills are rate-limited by tier using a **sliding window** algorithm, applied per API key:

| Tier | Skills | Default Limit | Environment Variable |
|------|--------|---------------|---------------------|
| Discovery | `agent/info`, `skills/list`, `validate_context` | Unlimited | — |
| List | `list_agents`, `list_organizations`, `list_contexts`, `list_prompts` | 30/min | `RATE_LIMIT_A2A_LIST` |
| Get | `get_agent`, `get_context`, `get_prompt`, etc. | 60/min | `RATE_LIMIT_A2A_GET` |
| Audit | `get_lineage`, `get_blocked_injections`, `get_audit_log` | 10/min | `RATE_LIMIT_A2A_AUDIT` |
| Reports | `get_dashboard`, `get_reports` | 10/min | `RATE_LIMIT_A2A_REPORTS` |
| Register | `register` | 5/min | `RATE_LIMIT_A2A_REGISTER` |

When a rate limit is exceeded, the A2A endpoint returns a **429** response with `retry_after` metadata.

### REST API Rate Limiting

REST endpoints are protected by **slowapi** with configurable per-endpoint limits:

| Endpoint Category | Default Limit | Environment Variable |
|-------------------|---------------|---------------------|
| General API | 100/minute | `RATE_LIMIT_DEFAULT` |
| Seed endpoint | 5/hour | `RATE_LIMIT_SEED` |
| Authentication | 20/minute | `RATE_LIMIT_AUTH` |

### Security Headers & Error Sanitization

All responses include security headers (CSP, X-Frame-Options, X-Content-Type-Options, XSS protection). Error responses are sanitized to prevent information disclosure—database errors, stack traces, and file paths are logged server-side only.

For full security documentation, see **[docs/SECURITY.md](docs/SECURITY.md)**.

---

## Data Platform

Sandarb includes a real-time analytics data platform for governance event processing, audit trail storage, and dashboarding.

### Technology Stack

| Layer | Technology | Role | When |
|-------|-----------|------|------|
| OLTP | PostgreSQL | Entity CRUD, approvals, config | Now |
| Streaming | Apache Kafka | Event bus, decouple ingest from analytics | Phase 1 |
| OLAP | ClickHouse | Real-time analytics, dashboards, reports | Phase 1 |
| Data Lakehouse | Apache Iceberg on S3 | Long-term storage, AI/ML use-cases | Phase 2 |

### Architecture

```
Sandarb API  -->  Kafka (5 KRaft brokers)  -->  Consumer Bridge (2-3 instances)  -->  ClickHouse (4 nodes, 3 Keeper)  -->  Superset (HA)
                                                                                       PostgreSQL (1 primary + 2 replicas, CNPG on GKE)
```

### Local Development

The local environment runs 6 Docker Compose projects mirroring the GKE production topology:

| Service | Containers | Technology |
|---------|-----------|------------|
| PostgreSQL HA | 1 primary + 2 streaming replicas | Native streaming replication |
| Kafka | 5 KRaft brokers | No ZooKeeper |
| ClickHouse | 4 nodes + 3 ClickHouse Keeper | Raft consensus, no ZooKeeper |
| Consumer Bridge | 2 instances | Kafka consumer group, auto partition rebalance |
| Superset | 2 nodes (HA) | Shared PostgreSQL metadata |

### GKE Production

The data platform deploys to GKE via a single command:

```bash
./scripts/deploy-data-platform-gcp.sh [PROJECT_ID] [REGION]
```

The core services (UI, API, Agent) run on Cloud Run. The data platform (Kafka, ClickHouse, PostgreSQL, Consumer, Superset) runs on GKE as stateful workloads. PostgreSQL uses the CloudNativePG (CNPG) operator for automated failover.

Full data platform documentation: **[docs/DATA_PLATFORM.md](docs/DATA_PLATFORM.md)**

GKE deployment guide: **[docs/deploy-gcp.md](docs/deploy-gcp.md)**

---

## Testing

Sandarb has **198 tests** covering both frontend and backend:

```bash
# Run all tests (recommended)
npm run test:all

# Frontend tests (Vitest) - 76 tests
npm run test           # watch mode
npm run test:run       # single run (CI)
npm run test:coverage  # with coverage

# Backend tests (Pytest) - 122 tests
npm run test:backend        # run backend API tests
npm run test:backend:cov    # with coverage
```

| Suite | Tests | Coverage |
|-------|-------|----------|
| Frontend (Vitest) | 76 | lib/, API client, pagination handling |
| Backend (Pytest) | 122 | All API endpoints, enterprise features (pooling, expiration, pagination, rate limits) |

See **[tests/README.md](tests/README.md)** for full documentation on running and extending tests.

---

## 💻 Developer Experience

Your agents don't guess what to say; they ask Sandarb.

### Python SDK (Recommended)

Install the Sandarb Python SDK to integrate governance in minutes:

```bash
pip install sandarb                  # Basic
pip install sandarb[openai]          # With OpenAI integration
pip install sandarb[langchain]       # With LangChain integration
pip install sandarb[all]             # Everything
```

**Quick Example:**

```python
from sandarb import Sandarb

# Initialize client
client = Sandarb(
    "https://api.sandarb.ai",
    agent_id="my-agent-v1",
    token=os.environ.get("SANDARB_TOKEN"),
)

# Register your agent on startup
client.register(
    agent_id="my-agent-v1",
    name="My AI Agent",
    version="1.0.0",
    url="https://my-agent.example.com/a2a",
    owner_team="platform",
)

# Get governed prompt
prompt = client.get_prompt("customer-support", variables={"tier": "gold"})

# Use with your LLM
response = openai.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": prompt.content},
        {"role": "user", "content": user_input},
    ],
)

# Log audit event
client.audit("inference", details={"tokens": response.usage.total_tokens})
```

**Using Decorators (Declarative Governance):**

```python
from sandarb import governed, configure

configure("https://api.sandarb.ai", agent_id="my-agent")

@governed(prompt="customer-support", context="support-policies")
def handle_query(query: str, governed_prompt: str, governed_context: str):
    """Prompt and context are automatically injected!"""
    return llm_call(governed_prompt, governed_context, query)
```

**OpenAI Integration:**

```python
from sandarb import Sandarb
from sandarb.integrations.openai import GovernedChatOpenAI

client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")
llm = GovernedChatOpenAI(client=client, prompt_name="customer-support", model="gpt-4")

response = llm.chat("How can I help you?")  # Automatic governance + audit logging
```

**LangChain Integration:**

```python
from langchain_openai import ChatOpenAI
from sandarb.integrations.langchain import SandarbLangChainCallback

callback = SandarbLangChainCallback(client=sandarb_client, log_tokens=True)
llm = ChatOpenAI(callbacks=[callback])

response = llm.invoke("Hello!")  # Automatically logged to Sandarb
```

📚 **Full SDK Documentation:** [sdk/README.md](sdk/README.md)
