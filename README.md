# Sandarb - AI Governance for AI Agents

<div align="center">
  <img src="public/logo.svg" alt="Sandarb" width="120" />
  <h3>Governance for AI agents while your teams build</h3>
  <p><strong>Sandarb</strong> is designed to provide a single place for your company to govern & manage AI Agents and its prompts and context. It is designed to be installed and operate in the control plane and is intended to play a role in regulatory and compliance layer for AI agents in any company. Tech teams focus on building Agents; Sandarb provides approval workflows, validated context and prompts, audit logging, and pending-review visibility. Sandarb runs as <strong> a UI/API and an AI Agent</strong>—other agents can talk to Sandarb via A2A for prompts, context , validation, audit trail, and compliance checks.</p>
</div>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#organizations-and-agents">Organizations & Agents</a> •
  <a href="#quick-start">Quick Start</a> •
  
  <a href="#api">API</a> •
  <a href="#mcp">MCP Server</a> •
  <a href="#a2a">A2A Protocol</a> •
  <a href="#docker">Docker</a>
</p>

---

## Why Sandarb?

Tech orgs need governance while shipping AI agents:
- **Regulatory & controls** – Approved prompts and context; propose/edit/approve workflows.
- **Risk management** – Audit trail, incident reporting, and visibility into pending reviews.
- **Agent-to-agent (A2A)** – Sandarb runs as an agent: other agents call Sandarb for validation, approved context, and audit logging instead of bypassing governance.

### Sandarb as Supervisor / Governor Agent

Sandarb is architected as a **Supervisor Agent** (or “Governor Agent”) that uses emerging protocols to talk to other agents. **Data and context sanctity are maintained**—built for real-world use.

**A. MCP (Model Context Protocol) – Pull-based monitoring**

The lightest way for Sandarb to “see” into other agents is for them to implement an **MCP Server**. Sandarb acts as an **MCP Client** and can query any agent (the server) for:

- Its current state
- Last N prompts
- Active tool calls
- Tools and resources it exposes

This makes Sandarb a **pull-based** monitor rather than a push-based logger—much lighter for the agents (no push logging required). Use the A2A skill `mcp_poll_agent` (with `agentId` or `mcpUrl`) or `GET /api/agents/:id/mcp-poll` to poll an agent’s MCP server.

**B. A2A (Agent-to-Agent) – Push-based controls & lineage**

For push-based controls, Sandarb uses a standardized A2A protocol (e.g. [Linux Foundation A2A](https://a2a-protocol.org/)).

- **Handshake:** When Agent A needs context, it asks Sandarb (skills: `get_context`, `get_approved_context`, `validate_context`, `compose_contexts`).
- **Audit:** Sandarb doesn’t just return context—it **logs why** Agent A asked (caller id, intent). Pass `sourceAgent` and optional `intent` in skill input for lineage.
- **Lineage reporting:** Because Sandarb is “in the loop” for context delivery, it is the **single source of truth** for lineage (e.g. “This decision was made using context from Document X, retrieved by Agent Y”). Use the A2A skill `get_lineage` or `GET /api/lineage` for recent context deliveries.

**Data sanctity:** Context and data are not leaked; access is logged and lineage is recorded for compliance and controls.


| Feature | Description |
|---------|-------------|
| **Organizations** | Root + sub-org hierarchy; create orgs under root for teams |
| **Agent Registry** | Register A2A agents by URL or manually; view skills & capabilities |
| **Prompt Versioning** | Git-like version control for prompts |
| **Context Management** | Environment-aware context injection |
| **MCP Server** | Claude/ChatGPT integration via Model Context Protocol |
| **MCP Client (pull-based)** | Sandarb queries agents’ MCP servers for tools, resources, state (no push logging) |
| **Sandarb as A2A agent** | Other agents talk to Sandarb via A2A for validation, audit log, and compliance |
| **Lineage** | Who requested which context and when; single source of truth for “context X, retrieved by Agent Y” |
| **REST API** | All UI functionality exposed as HTTP API |
| **Theme** | Light / dark / system; toggle in Settings |

## Features

### Prompt Management
- Create and version prompts with commit messages
- Variable interpolation (`{{user_name}}`, `{{context}}`)
- Model-specific configurations (temperature, max_tokens)
- System prompt support
- Tag-based organization

### Context Engineering
- Environment-specific contexts (dev/staging/prod)
- Context composition (merge multiple contexts)
- Priority-based ordering
- TTL/expiration support
- JSON, YAML, or plain text output

### Experiments (A/B Testing)
- Create experiments with multiple variants
- Traffic allocation control
- Real-time metrics tracking
- Statistical significance analysis

### Integration Options
- **REST API** - Standard HTTP endpoints
- **MCP Server** - For Claude, ChatGPT, and MCP-compatible clients
- **A2A Protocol** - Google's agent-to-agent communication standard
- **Webhooks** - Real-time event notifications (coming soon)

### Observability
- Request logging with latency tracking
- Usage analytics dashboard
- Error rate monitoring
- Top prompts/contexts reports

## Organizations & Agents

- **Root organization** – Created automatically (e.g. company). Sub-orgs live under it.
- **Create orgs** – From the UI or `POST /api/organizations` (parent optional; default under root).
- **Register agents** – **Protocol-first (recommended):** agents ship a **sandarb.json** (Agent Card / manifest) and **ping** Sandarb on startup (API or A2A). **By URL:** we fetch the Agent Card from the A2A endpoint or `/.well-known/agent.json`. **Manual:** add name, description, A2A URL. Agents are scoped to an organization.
- **Control-plane policy** – Sandarb is designed to run in the **control plane** of the company. **If an agent isn’t registered with Sandarb, it shouldn’t be granted access to company data.** The living registry (manifest-based registration) keeps governance in sync with what’s actually running.
- **A2A-compatible** – Registration follows [A2A discovery](https://google.github.io/A2A/specification/); we store and display skills and capabilities from the Agent Card.
- **Theme** – Settings → Appearance: Light, Dark, or System. Persisted via `PATCH /api/settings` with `{ "theme": "light" | "dark" | "system" }`.

### Manifest-based registration (Agent Card / sandarb.json)

Instead of a heavy UI for registration, use **manifest-based registration**. Every AI agent in your company should include a **sandarb.json** (or “Agent Card”) in its repository or expose it as an endpoint.

**How it works:** When an agent starts up, it **pings** Sandarb’s API with its manifest, or talks to Sandarb’s agent via **A2A** (skill `register`).

**What’s inside the manifest:**

| Field | Required | Description |
|-------|----------|-------------|
| `agent_id` | Yes | Stable identity (e.g. repo name, service id). Used for upsert. |
| `version` | Yes | Semantic version of the agent. |
| `owner_team` | Yes | Owner team or org slug (e.g. `"platform"`, `"fraud"`). Sandarb resolves org by slug or uses root. |
| `url` | Yes | Agent A2A endpoint URL. |
| `name` | No | Human-readable name (defaults to `agent_id`). |
| `description` | No | Short description. |
| `tools_used` | No | Tools this agent uses (e.g. `["llm", "db", "api"]`). |
| `allowed_data_scopes` | No | Data scopes this agent is allowed to access (e.g. `["customers", "transactions"]`). |
| `pii_handling` | No | Whether this agent handles PII (`true`/`false`). |
| `regulatory_scope` | No | Regulatory tags (e.g. `"GDPR"`, `"SOX"`, or `"GDPR/SOX"`). |

**Example sandarb.json:**

```json
{
  "agent_id": "fraud-detection-v1",
  "version": "1.2.0",
  "owner_team": "fraud",
  "url": "https://agents.example.com/fraud",
  "name": "Fraud Detection Agent",
  "tools_used": ["llm", "db"],
  "allowed_data_scopes": ["transactions", "users"],
  "pii_handling": true,
  "regulatory_scope": "GDPR/SOX"
}
```

**Ping via API:** `POST /api/agents/ping` with the manifest as JSON body. Optional query: `?orgId=<id>` to pin to an org; otherwise org is resolved from `owner_team` (slug) or root.

**Ping via A2A:** Call Sandarb’s `register` skill with `{ "manifest": { ... } }` (and optional `orgId`).

**Benefit:** A living registry without manual entry. New or updated agents show up as **pending approval**; governance can approve or reject. Unregistered agents are not in the registry—enforce “no Sandarb registration ⇒ no access to company data” in your control plane.

### Approval workflows & git-like tracking

- **Contexts** – Users can **edit** (save directly) or **propose changes** (commit message + content). Proposed changes appear under **Pending**; users with permission can **Approve** (merge into context) or **Reject**. **History** lists all revisions (approved/rejected) with commit-style entries. All changes are tracked; UI and iconography follow a GitHub-style model (commits, pull requests, approve/reject).
- **Agents** – New registrations start as **Pending review**. Users with permission can **Approve** or **Reject** the registration. Status is shown on agent cards and detail (Draft, Pending review, Approved, Rejected).
- **Activity** – Create, update, propose, approve, and reject actions are logged for audit.

All of the above are available in the UI and via the REST API.

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

**Optional (GCP deploy):** To deploy to Cloud Run, install the gcloud CLI:
- **macOS:** `brew install --cask google-cloud-sdk` then `gcloud auth login`

### Installation

```bash
# Clone the repository
git clone https://github.com/openint-ai/openint.git
cd openint

# Install dependencies
npm install

# Start both UI and API (one command)
npm run dev
```

This starts:
- **UI** at [http://localhost:4000](http://localhost:4000) — open in your browser
- **API** at [http://localhost:4001](http://localhost:4001) — use for `curl`, integrations, and from the UI

To run only the UI (single server on port 4000, API at same origin): `npm run dev:ui`  
To run only the API server (port 4001): `npm run dev:api`

### Create Your First Prompt

```bash
curl -X POST http://localhost:4001/api/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-support",
    "description": "Customer support agent prompt",
    "content": "You are a helpful customer support agent for {{company_name}}. Help the user with their inquiry.\n\nUser: {{user_message}}",
    "variables": [
      {"name": "company_name", "type": "string", "required": true},
      {"name": "user_message", "type": "string", "required": true}
    ],
    "model": "gpt-4",
    "temperature": 0.7
  }'
```

### Inject into Your Agent

```python
import requests

# Get prompt with variables
response = requests.get(
    "http://localhost:4001/api/inject",
    params={
        "name": "customer-support",
        "variables": {"company_name": "Acme Inc", "user_message": "Help!"}
    }
)
prompt = response.text

# Use in your LLM call
completion = openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}]
)
```

## API

Every UI action is exposed as an API. Key endpoints:

### Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/organizations` | List all orgs; `?tree=true` for hierarchy; `?root=true` for root only |
| `POST` | `/api/organizations` | Create org (body: `name`, optional `slug`, `description`, `parentId`) |
| `GET` | `/api/organizations/:id` | Get org; `?children=true` for sub-orgs |
| `PUT` | `/api/organizations/:id` | Update org |
| `DELETE` | `/api/organizations/:id` | Delete org (root cannot be deleted) |

### Agents (A2A registry)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List agents; optional `?orgId=` |
| `POST` | `/api/agents` | Create agent manually (body: `orgId`, `name`, `a2aUrl`, optional `description`, `agentCard`) |
| `POST` | `/api/agents/ping` | **Manifest-based registration** (body: Sandarb manifest; optional `?orgId=`). Agents ping on startup. |
| `POST` | `/api/agents/register` | Register by URL (body: `orgId`, `a2aUrl`; we fetch Agent Card) |
| `GET` | `/api/agents/:id` | Get agent |
| `GET` | `/api/agents/:id/mcp-poll` | Pull-based: poll this agent’s MCP server (tools, resources, state) |
| `PUT` | `/api/agents/:id` | Update agent |
| `DELETE` | `/api/agents/:id` | Remove agent |
| `GET` | `/api/lineage` | Lineage: who requested which context and when (`?limit=50`) |

### Settings (including theme)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get all settings (e.g. `theme`, `defaultFormat`) |
| `PATCH` | `/api/settings` | Update settings (body: `{ "theme": "light" \| "dark" \| "system" }`) |

### Prompts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prompts` | List all prompts |
| `POST` | `/api/prompts` | Create prompt with initial version |
| `GET` | `/api/prompts/:id` | Get prompt with all versions |
| `PUT` | `/api/prompts/:id` | Update prompt metadata |
| `DELETE` | `/api/prompts/:id` | Delete prompt and versions |
| `POST` | `/api/prompts/:id/versions` | Create new version |

### Contexts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/contexts` | List all contexts |
| `POST` | `/api/contexts` | Create context |
| `GET` | `/api/contexts/:id` | Get context |
| `PUT` | `/api/contexts/:id` | Update context |
| `DELETE` | `/api/contexts/:id` | Delete context |

### Injection (bank-grade: Context Lineage)

Every injection is an auditable touchpoint. **Required headers** for `/api/inject`:

- **`X-Sandarb-Agent-ID`** – Calling agent identifier (e.g. `advisor-bot-04`). Enables dependency graph.
- **`X-Sandarb-Trace-ID`** – Request trace id (e.g. `exec-99821`). If a model gives bad advice, you can trace back to the exact context served at that moment.

Without both, the API returns `400` with an error message. You can pass them as query params (`agentId`, `traceId`) or in the POST body instead of headers.

```bash
# Auditable injection (required for /api/inject)
curl "http://localhost:4001/api/inject?name=wealth-advisor-v1&format=json" \
  -H "X-Sandarb-Agent-ID: advisor-bot-04" \
  -H "X-Sandarb-Trace-ID: exec-99821"
```

The response includes `X-Sandarb-Trace-ID` so callers can correlate. Lineage is stored for compliance and dependency-graph reporting (`GET /api/lineage`).

## MCP Server

OpenInt implements the [Model Context Protocol](https://modelcontextprotocol.io/) for integration with Claude, ChatGPT, and other MCP clients.

### HTTP Transport

```bash
# Get server info
curl http://localhost:4001/api/mcp

# JSON-RPC request
curl -X POST http://localhost:4001/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Available Tools

| Tool | Description |
|------|-------------|
| `get_prompt` | Get prompt with variable interpolation |
| `get_context` | Get context configuration |
| `list_prompts` | List available prompts |
| `list_contexts` | List available contexts |
| `compose_context` | Merge multiple contexts |

### Claude Desktop Integration

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "openint": {
      "url": "http://localhost:4001/api/mcp"
    }
  }
}
```

## Sandarb as an A2A Agent

Sandarb **runs as an A2A agent** so other agents can talk to it via [Google's A2A protocol](https://a2a-protocol.org/). The real value: **governance, controls, and risk management**—your agents call Sandarb for validation, approved context, and audit logging instead of bypassing compliance.

### Agent Discovery

```bash
# Get Sandarb's Agent Card (other agents discover Sandarb this way)
curl http://localhost:4001/api/a2a
```

### Skill Execution (other agents call Sandarb)

```bash
# Example: validate a context before use (compliance)
curl -X POST http://localhost:4001/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "validate_context",
    "input": { "name": "my-context" }
  }'

# Example: log an event for audit trail
curl -X POST http://localhost:4001/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "audit_log",
    "input": {
      "eventType": "prompt_used",
      "resourceName": "customer-support",
      "sourceAgent": "my-agent-id",
      "details": { "userId": "u1" }
    }
  }'
```

### Available Skills

**Governance, controls, risk (Sandarb's value add)**

| Skill | Description |
|-------|-------------|
| `validate_context` | Check context exists and return current approved content; `hasPendingRevisions` for oversight |
| `get_approved_context` | Get approved context content only (compliance) |
| `validate_agent` | Check if an agent is registered and approved before delegating |
| `audit_log` | Log an event for compliance/audit trail (other agents call this) |
| `list_pending_reviews` | List pending context revisions and agent registrations for governance |
| `report_incident` | Log a risk/incident event for risk management |

**Prompts & context**

| Skill | Description |
|-------|-------------|
| `get_prompt` | Retrieve and interpolate a prompt |
| `get_context` | Get a context configuration |
| `list_prompts` | List all available prompts |
| `list_contexts` | List all available contexts |
| `compose_contexts` | Merge multiple contexts |
| `set_context` | Create or update a context |

## Docker

The app is containerized for local development and for running on **GCP** (Cloud Run or GKE). See [docs/deploy-gcp.md](docs/deploy-gcp.md) for deployment steps.

### Using Docker Compose (Local)

**Deploy with Postgres (default)** — runs Postgres (password: `sandarb`) and the app; the app uses Postgres:

```bash
docker compose up -d
```

**SQLite only (app alone):**

```bash
DATABASE_URL= docker compose up -d openint-sandarb
```

### Building and running the image

```bash
docker build -t sandarb .
docker run -p 3000:3000 -v sandarb-data:/app/data sandarb
```

**Deploy to GCP (Cloud Run):** `./scripts/deploy-gcp.sh 191433138534` — see [docs/deploy-gcp.md](docs/deploy-gcp.md). Log in first with `gcloud auth login` (e.g. using `sudhir@openint.ai`).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite database location (used when `DATABASE_URL` is not set) | `./data/sandarb.db` |
| `DATABASE_URL` | PostgreSQL connection URL (e.g. `postgresql://user:pass@localhost:5432/sandarb-dev`). When set, Sandarb uses Postgres and creates the DB + tables on first use. Run `npm run db:init-pg` to create `sandarb-dev` and schema. | - |
| `API_KEY` | Optional API key for authentication | - |
| `NEXT_PUBLIC_BASE_URL` | Public URL for A2A agent card | `http://localhost:4001` (when API on 4001) |
| `PORT` | Server port (Cloud Run sets this; default in container is 3000) | `3000` |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           OpenInt                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   UI     │  │ REST API │  │   MCP    │  │   A2A    │        │
│  │ (Next.js)│  │          │  │  Server  │  │  Server  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┴──────┬──────┴─────────────┘               │
│                            │                                    │
│                    ┌───────▼───────┐                            │
│                    │  Core Library │                            │
│                    │  - Prompts    │                            │
│                    │  - Contexts   │                            │
│                    │  - Experiments│                            │
│                    └───────┬───────┘                            │
│                            │                                    │
│                    ┌───────▼───────┐                            │
│                    │    SQLite     │                            │
│                    │   Database    │                            │
│                    └───────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: SQLite (via better-sqlite3) or PostgreSQL (when `DATABASE_URL` is set). Postgres schema: `contexts`, `context_versions` (immutable versioning), `sandarb_audit_log` (regulatory audit), plus organizations, agents, settings.
- **Protocols**: MCP, A2A, REST

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with care by the <a href="https://openint.dev">OpenInt</a> community. Sandarb: open-source tool for capturing prompts and context for AI agents; organizations, agent registry (A2A), dark/light theme, API-first.</sub>
</div>
