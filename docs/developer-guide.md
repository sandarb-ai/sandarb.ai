# Sandarb developer guide

Developer integration and usage guide for anyone in the firm. For the full interactive guide, open **/docs** in the running Sandarb app (e.g. https://your-sandarb.example.com/docs).

## Overview

Sandarb is a **control-plane** AI Governance service for your AI agents. It is intended to run in your **company’s** infrastructure: on your laptop you use **localhost** for development; in production your company hosts Sandarb behind a **load balancer** or on a **separate, fully protected server**—you do not control the API or UI endpoints there. See [Deployment](#deployment) for local vs production.

Sandarb is AI governance for your AI agents: a single place for approved prompts and context, audit trail, lineage, and a living agent registry. The **Sandarb AI Governance Agent** participates in A2A (fast becoming the industry standard for agent-to-agent communication): other agents call Sandarb for governance, and Sandarb can communicate with other agents via A2A. Integrate via:

- **API** – CRUD for organizations, agents, contexts, prompts, templates; inject context and pull prompt by name. Context and prompt access are **gated by agent linking** (link contexts/prompts to agents in the Registry).
- **A2A protocol** – Discovery (Agent Card) and skills: `get_context`, `validate_context`, `get_lineage`, `register`. Sandarb is an AI agent that participates in A2A as both server and first-class participant.
- **Inject API** – `GET /api/inject?name=my-context` returns approved context (JSON/YAML/text) only if the context is **linked to the calling agent** (agent_contexts). Use `sandarb-context-preview` as Agent ID for UI testing.
- **Prompts Pull API** – `GET /api/prompts/pull?name=my-prompt` returns the current approved prompt only if it is **linked to the calling agent** (agent_prompts). Use `sandarb-prompt-preview` for UI testing.
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
| **[Python SDK](../sdk/python/README.md)** | Full-featured Python SDK with sync/async clients, decorators, and framework integrations. |
| [Security](reference/security.md) | Manifest-based registration (`sandarb.json`), shadow AI discovery (`runDiscoveryScan`). |

---

## Python SDK

The **Sandarb Python SDK** is the recommended way to integrate AI governance into your agents. It provides type-safe APIs, decorators for declarative governance, and built-in integrations with popular AI frameworks.

### Installation

```bash
# Basic installation
pip install sandarb

# With async support (httpx)
pip install sandarb[async]

# With framework integrations
pip install sandarb[openai]      # OpenAI integration
pip install sandarb[langchain]   # LangChain integration
pip install sandarb[anthropic]   # Anthropic integration

# Everything
pip install sandarb[all]
```

Or install from source:

```bash
cd sdk/python
pip install -e .
```

### Quick Start

```python
import os
from sandarb import Sandarb

# Initialize client (can also use SANDARB_URL, SANDARB_TOKEN env vars)
client = Sandarb(
    os.environ.get("SANDARB_URL", "https://api.sandarb.ai"),
    agent_id="my-agent-v1",
    token=os.environ.get("SANDARB_TOKEN"),
)

# 1. Register agent on startup
client.register(
    agent_id="my-agent-v1",
    name="My AI Agent",
    version="1.0.0",
    url="https://my-agent.example.com/a2a",
    owner_team="platform",
    capabilities=["text-generation", "summarization"],
)

# 2. Get governed prompt
prompt = client.get_prompt("customer-support", variables={"tier": "gold"})
system_message = prompt.content

# 3. Get governed context
context = client.get_context("trading-limits")
config_data = context.content

# 4. Run your agent (Sandarb is NOT in the inference path)
response = your_llm_call(system_message, config_data, user_input)

# 5. Log audit event for compliance
client.audit(
    "inference",
    resource_type="llm",
    resource_name="gpt-4",
    details={"tokens": 150, "latency_ms": 230},
)
```

### Configuration

| Parameter | Environment Variable | Description |
|-----------|---------------------|-------------|
| `base_url` | `SANDARB_URL` | API base URL (default: https://api.sandarb.ai) |
| `token` | `SANDARB_TOKEN` | Bearer token for authenticated calls |
| `agent_id` | `SANDARB_AGENT_ID` | Default agent ID for tracking |

### Core Methods

#### Agent Registration

```python
# Using manifest dict
client.check_in({
    "agent_id": "my-agent",
    "version": "1.0.0",
    "owner_team": "platform",
    "url": "https://my-agent.example.com/a2a",
    "name": "My Agent",
})

# Using named parameters (recommended)
client.register(
    agent_id="my-agent",
    name="My Agent",
    version="1.0.0",
    url="https://my-agent.example.com/a2a",
    owner_team="platform",
    description="A helpful assistant",
    capabilities=["text-generation"],
)
```

#### Prompts

```python
# Get prompt with full metadata
prompt = client.get_prompt("my-prompt", variables={"key": "value"})
print(prompt.content)   # The prompt text
print(prompt.version)   # Version number
print(prompt.approved)  # Approval status

# Get just the content string
content = client.pull_prompt("my-prompt")

# List available prompts
prompts = client.list_prompts(tags=["production"])
```

#### Contexts

```python
# Get context with validation info
context = client.get_context("trading-limits")
print(context.content)           # The context data
print(context.approved)          # Is it approved?
print(context.compliance_level)  # Compliance classification

# Validate before use (lightweight check)
validation = client.validate_context("trading-limits", environment="prod")
if validation.approved:
    # Safe to use
    pass

# Inject via REST API (alternative method)
config = client.inject("app-config", format="json")

# List contexts
contexts = client.list_contexts(environment="prod", active_only=True)
```

#### Audit Logging

```python
# Log audit event
client.audit(
    "inference",                    # Event type
    resource_type="llm",            # Resource category
    resource_name="gpt-4",          # Specific resource
    details={                       # Custom metadata
        "tokens": 150,
        "latency_ms": 230,
        "prompt_name": "customer-support",
    },
)

# Convenience log method
client.log("Processing complete", level="info", request_id="req-123")
```

### Decorators

Use decorators for declarative, zero-boilerplate governance:

```python
from sandarb import governed, audit_action, require_prompt, require_context, configure

# Configure global client (required for decorators)
configure(
    "https://api.sandarb.ai",
    agent_id="my-agent",
    token=os.environ.get("SANDARB_TOKEN"),
)

# @governed: Automatically fetch prompt + context, log audit events
@governed(prompt="customer-support", context="support-policies")
def handle_query(query: str, governed_prompt: str, governed_context: str):
    """governed_prompt and governed_context are auto-injected!"""
    return llm_call(governed_prompt, governed_context, query)

# @audit_action: Automatically log function calls
@audit_action("data_access", resource_type="database", include_args=True)
def fetch_user(user_id: str):
    return db.get_user(user_id)

# @require_prompt: Require and inject a specific prompt
@require_prompt("greeting", variables={"lang": "en"})
def greet(user: str, prompt: str):
    return f"{prompt} {user}!"

# @require_context: Require and inject a specific context
@require_context("config", param_name="config")
def process(data: dict, config: str):
    return transform(data, json.loads(config))
```

### Async Support

For high-performance applications:

```python
from sandarb import AsyncSandarb

async with AsyncSandarb("https://api.sandarb.ai", agent_id="my-agent") as client:
    # All methods are async
    prompt = await client.get_prompt("my-prompt")
    await client.audit("event", details={"key": "value"})
    
    # Parallel operations
    import asyncio
    prompts, contexts = await asyncio.gather(
        client.list_prompts(),
        client.list_contexts(),
    )
```

### Framework Integrations

#### OpenAI Integration

```python
from sandarb import Sandarb
from sandarb.integrations.openai import GovernedChatOpenAI

client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")

# Create governed OpenAI wrapper
llm = GovernedChatOpenAI(
    client=client,
    prompt_name="customer-support",  # Auto-fetch governed prompt
    model="gpt-4",
    audit_calls=True,                # Auto-log all LLM calls
)

# Use like normal - governance happens automatically
response = llm.chat(
    "How can I help you?",
    prompt_variables={"user_tier": "premium"},
)
```

#### LangChain Integration

```python
from langchain_openai import ChatOpenAI
from sandarb.integrations.langchain import SandarbLangChainCallback, get_governed_prompt_template

# Create callback for automatic audit logging
callback = SandarbLangChainCallback(
    client=sandarb_client,
    log_tokens=True,
    log_prompts=False,   # Don't log prompt content for privacy
)

# Use with any LangChain LLM
llm = ChatOpenAI(model="gpt-4", callbacks=[callback])
response = llm.invoke("Hello!")  # Automatically logged!

# Or fetch governed prompt for use with LangChain
from langchain_core.prompts import ChatPromptTemplate

system_prompt = get_governed_prompt_template(client, "my-prompt")
prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "{input}"),
])

chain = prompt | llm
response = chain.invoke({"input": "Hello!"})
```

#### Anthropic Integration

```python
from sandarb import Sandarb
from sandarb.integrations.anthropic import GovernedAnthropic

client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")

llm = GovernedAnthropic(
    client=client,
    prompt_name="my-prompt",
    model="claude-3-sonnet-20240229",
    audit_calls=True,
)

response = llm.chat("Hello!")
```

### Error Handling

```python
from sandarb import Sandarb, SandarbError

client = Sandarb("https://api.sandarb.ai")

try:
    prompt = client.get_prompt("nonexistent")
except SandarbError as e:
    print(f"Error: {e.message}")
    print(f"Status Code: {e.status_code}")
    print(f"Response Body: {e.body}")
```

### Full SDK Reference

See **[sdk/python/README.md](../sdk/python/README.md)** for complete API documentation, all methods, models, and examples.

## Quick start

```bash
git clone https://github.com/sandarb-ai/sandarb.ai.git
cd sandarb.ai
npm install
export DATABASE_URL=postgresql://postgres:sandarb@localhost:5432/sandarb  # optional
./scripts/start-sandarb.sh
```

Open the UI at http://localhost:3000. Backend (FastAPI) runs at http://localhost:8000. Set `BACKEND_URL=http://localhost:8000` and `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env` so prompts and contexts lists load. Use the **Try Inject API** and **Try Prompts Pull API** in the in-app docs (/docs) to test. Demo data: run seed (e.g. `scripts/seed_scale.py`) once (backend uses Postgres).

## API (core)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/inject?name=... | Inject context by name (gated by agent_contexts link) |
| GET | /api/prompts/pull?name=... | Pull prompt by name (gated by agent_prompts link) |
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

Sandarb is designed to run in a **company’s control plane** for AI Governance. Developers do **not** control the API or UI endpoints in production—the company hosts and protects the service.

### Local development (your laptop)

- Run everything on **localhost** for integration and testing.
- **UI:** http://localhost:3000 · **API:** http://localhost:8000
- Set `NEXT_PUBLIC_API_URL=http://localhost:8000` and `BACKEND_URL=http://localhost:8000` in `.env`.
- **Start:** `./scripts/start-sandarb.sh` or `npm run dev` (see [QUICKSTART.md](./QUICKSTART.md)).
- Your agents and SDK point at `http://localhost:8000`; you control both ends.

### Production (company control plane)

- In production, Sandarb **must** be hosted by your organization—**not** run from a developer machine or exposed directly to the internet.
- The service must sit behind a **load balancer** or on a **separate, fully protected server** (e.g. private VPC, IAP, VPN, or authenticated ingress). You do **not** control the API server endpoint or the UI endpoint; the company’s platform/security team does.
- API and UI base URLs are provided by the company (e.g. `https://api.sandarb.your-company.com`, `https://sandarb.your-company.com`). Agents and SDKs use those URLs via `SANDARB_URL` / `NEXT_PUBLIC_API_URL`.
- **Hosting options:** Docker behind your LB, [GCP Cloud Run](deploy-gcp.md) (with IAM/private access), GKE, or a dedicated server with TLS and access control.

### Summary

| | Local development | Production |
|---|-------------------|------------|
| **Who runs Sandarb** | You (laptop) | Company (control plane) |
| **API / UI endpoints** | You control (localhost) | Company-controlled; behind LB or protected server |
| **SDK / agents** | Point at `http://localhost:8000` | Point at company-provided Sandarb URL |

- **Docker:** `docker compose up -d` (Postgres + app). Demo data seeded on start when `DATABASE_URL` is set. In prod, run behind a load balancer and restrict access.
- **GCP Cloud Run:** `./scripts/deploy-gcp.sh PROJECT_ID`. See [deploy-gcp.md](./deploy-gcp.md) for permissions, Cloud SQL, and keeping the service fully protected (e.g. no public `allUsers` invoker).

## More

- In-app docs: open **/docs** in the running Sandarb instance
- Repository: [github.com/sandarb-ai/sandarb.ai](https://github.com/sandarb-ai/sandarb.ai)
