# Sandarb developer guide

Developer integration and usage guide for anyone in the firm. For the full interactive guide, open **/docs** in the running Sandarb app (e.g. https://your-sandarb.example.com/docs).

## Overview

Sandarb (derived from "Sandarbh" (संदर्भ), a Hindi/Sanskrit word meaning "context," "reference," or "connection") is an AI governance platform: a single place for approved prompts and context, audit trail, lineage, and a living agent registry.

Sandarb is designed to fit seamlessly into your existing engineering workflow. Your AI Agents and Applications integrate via **A2A**, **MCP**, **API**, or **Git**:

- **A2A (Agent-to-Agent Protocol):** Enables your agent to be discovered by the broader AI ecosystem. Other agents can read your "Agent Card" to understand your capabilities and interact with you using standardized skills (like `validate_context` or `get_lineage`) without custom integration code.
- **MCP (Model Context Protocol):** Connect Claude Desktop, Cursor, Windsurf, or any MCP client directly to Sandarb. 22 governance tools exposed via Streamable HTTP transport at `/mcp`.
- **API (REST & SDK):** The runtime fuel for your agents. Use the API to fetch approved Prompts (instructions) and Context (knowledge) instantly during inference. It also handles management tasks like registering new agents, creating organizations, and logging audit trails.
- **Git (Governance as Code):** Manage your Sandarb config and other governance assets like source code in your AI Agents git repo. Inject the config based on your CI/CD and deployment model for AI Agents.

Sandarb is a **control-plane** AI Governance service intended to run in your **company's** infrastructure: on your laptop you use **localhost** for development; in production your company hosts Sandarb behind a **load balancer** or on a **separate, fully protected server**—you do not control the API or UI endpoints there. See [Deployment](#deployment) for local vs production.

Integration details:

- **API** – CRUD for organizations, agents, contexts, prompts, templates; inject context and pull prompt by name. Context and prompt access are **gated by agent linking** (link contexts/prompts to agents in the Registry).
- **A2A protocol** – Discovery (Agent Card) and 24 skills: agents (list, get, register), organizations (list, get, tree), contexts (list, get, revisions), prompts (list, get, versions), audit (lineage, blocked injections, audit log), reports (dashboard, governance reports), and validation. Sandarb is an AI agent that participates in A2A as both server and first-class participant.
- **MCP protocol** – 22 governance tools via Streamable HTTP at `/mcp`. Same capabilities as A2A skills (agents, contexts, prompts, audit, reports, validation). Connect Claude Desktop, Cursor, Windsurf, or any MCP-compatible client directly.
- **Inject API** – `GET /api/inject?name=my-context` returns approved context (JSON/YAML/text) only if the context is **linked to the calling agent** (agent_contexts). Use `sandarb-context-preview` as Agent ID for UI testing.
- **Prompts Pull API** – `GET /api/prompts/pull?name=my-prompt` returns the current approved prompt only if it is **linked to the calling agent** (agent_prompts). Use `sandarb-prompt-preview` for UI testing.
- **Templates** – Reusable schemas and default values for context content; link a context to a template for consistent structure

## The Library Model: Information Architecture

Sandarb implements **The Library Model** — an organizational pattern where each Organization is the top-level container that owns all governance assets. Under each organization, there are **Three Pillars**:

| Pillar | Description |
|--------|-------------|
| **Agent Registry** | All AI agents that belong to the organization. |
| **Prompt Library** | Functional instructions that define agent behavior. |
| **Context Registry** | Templates and knowledge sources the agents consume at runtime. |

### Sandarb Resource Names (SRN)

Every asset in Sandarb follows a standardized naming convention called **Sandarb Resource Names (SRN)**, inspired by [URNs (Uniform Resource Names)](https://en.wikipedia.org/wiki/Uniform_Resource_Name). SRNs use a `type.kebab-case-name` format for consistent identification across APIs, SDKs, and audit logs.

| Resource | SRN Format | Example |
|----------|-----------|---------|
| **Agent** | `agent.{kebab-case-name}` | `agent.retail-banking-finance-bot` |
| **Prompt** | `prompt.{kebab-case-name}` | `prompt.asia-pacific-fraud-detection-playbook` |
| **Context** | `context.{kebab-case-name}` | `context.eu-refund-policy` |

**Rules:**
- All SRNs are **globally unique** — no two resources of any type can share the same SRN.
- All names are **lowercase kebab-case** (no underscores, no double hyphens).
- The prefix (`agent.`, `prompt.`, `context.`) identifies the resource type.
- SRNs are used in the Inject API, SDK calls, audit logs, and agent-to-agent communication.

### Template Variable Naming Convention

All Jinja2 template variables in context templates must use **lowercase snake_case**. This is enforced by the `POST /api/contexts/validate-template` endpoint, which returns `variable_warnings` for any variables that don't comply. The context editor surfaces these as inline warnings.

| Valid (snake_case) | Invalid | Why |
|---|---|---|
| `region` | `Region` | No uppercase first letter |
| `risk_tier` | `riskTier` | No camelCase |
| `max_txn_per_hour` | `max-txn-per-hour` | No hyphens — use underscores |
| `ctr_threshold` | `CTRThreshold` | No PascalCase / all-caps |

**Pattern:** `^[a-z][a-z0-9]*(_[a-z0-9]+)*$`

This convention ensures consistency across context templates, the Inject API `context_variables` parameter, and agent integrations. Property access on nested objects (e.g. `customer.risk_score`, `check.passed`) should also use snake_case.

### The Three Resources: How They Differ

While all three resource types use SRNs, they serve fundamentally different purposes in the governance lifecycle:

| | Agents | Contexts | Prompts |
|---|---|---|---|
| **Who creates it?** | The agent itself (self-registration via manifest) | Compliance/governance team (manual authoring) | Prompt engineers (manual authoring) |
| **SRN stored in** | `agent_id` column (globally unique, NOT NULL) | `name` column (globally unique, NOT NULL) | `name` column (globally unique, NOT NULL) |
| **Display name** | `name` column (separate, human-friendly) | Same as SRN | Same as SRN |
| **Example SRN** | `agent.retail-banking-kyc-verification-bot` | `context.eu-refund-policy` | `prompt.americas-aml-triage-runbook` |
| **Example display** | "KYC Verification Bot (Retail Banking)" | — | — |
| **Used in audit logs** | Yes — TEXT in `sandarb_access_logs` | Yes — via context UUID | Yes — via prompt UUID |
| **Used in API auth** | Yes — bound to API keys and service accounts | No | No |

**Why agents have two name fields:** Agents are self-registering runtime entities — they announce themselves via a manifest with a machine-readable `agent_id` SRN (e.g. `agent.retail-banking-kyc-verification-bot`) and a human-readable `name` (e.g. "KYC Verification Bot (Retail Banking)"). Contexts and prompts are authored governance assets where the SRN IS the name — compliance teams don't need a separate display name for a policy document.

This is the same pattern used by AWS (ARN vs display name), Kubernetes (`metadata.name` vs labels), and GitHub (username vs display name).

**Example usage in API calls:**

```python
# Using SRNs in the Inject API (POST /api/inject)
response = requests.post("/api/inject", json={
    "agent_id": "agent.service-account-refund-bot",
    "prompt_key": "prompt.refund-main-prompt",
    "context_variables": {
        "context.eu-refund-policy": {
            "region": "EU",
            "currency": "EUR",
        }
    }
})
```

---

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

## Templated Context (Jinja2 Rendering)

Sandarb implements **context templates using Jinja2**, the industry-standard Python template engine used by Ansible, Flask, Django, Airflow, dbt, and thousands of production systems. Jinja2 is the de facto choice for templated configuration and policy rendering because of its proven security model, rich feature set, and wide ecosystem support.

Templated contexts transform Sandarb from a static file host into a **dynamic Governance Engine**: context content is stored as Jinja2 templates with `{{ variable }}` placeholders that are rendered at injection time with agent-provided variables. This ensures agents only see exactly what they are supposed to see for each specific execution — the right policy, for the right region, for the right customer, at the right time.

> **The Keys and Treasure Model:** Think of the variables from the AI Agent as **"Keys"** and the context template as the **"Treasure."** The agent holds the keys (runtime variables like region, customer ID, risk level), but the treasure (the governed policy template) is locked inside Sandarb's vault. Only when the agent presents the right keys does Sandarb unlock and render the treasure — producing a fully resolved, audited, governance-stamped policy. The compliance team controls the treasure (template authoring, versioning, approval); the agent only controls which keys it brings.

### What is Jinja2?

[Jinja2](https://jinja.palletsprojects.com/) is a fast, expressive, extensible templating engine for Python. Key features used by Sandarb:

| Feature | Syntax | Purpose in Sandarb |
|---------|--------|-------------------|
| **Variable substitution** | `{{ variable }}` | Insert runtime values (region, currency, customer ID) |
| **Conditionals** | `{% if condition %}...{% endif %}` | Include/exclude policy sections based on context |
| **Loops** | `{% for item in list %}...{% endfor %}` | Iterate over lists (required documents, checklist items) |
| **Filters** | `{{ value \| upper }}` | Transform values (uppercase, default, join) |
| **Default values** | `{{ var \| default('N/A') }}` | Provide fallbacks for optional variables |
| **Comments** | `{# comment #}` | Document template intent (stripped from output) |

Sandarb uses Jinja2's **SandboxedEnvironment** with `autoescape=True` — this prevents template injection attacks by restricting what template code can do (no file access, no arbitrary Python execution, no system calls). Variable values are HTML-escaped by default to prevent XSS.

### How It Works

1. **Author** a context template with Jinja2 syntax (e.g. `{{ region }}`, `{{ currency }}`).
2. **Store** it in Sandarb with versioning and approval workflows (just like any context).
3. **At runtime**, the agent calls `POST /api/inject` with `context_variables` — a dict mapping context SRNs to their template variables.
4. **Sandarb renders** the template in a sandboxed environment, returns the fully resolved content, and logs an immutable audit record with governance metadata.

### Governance Hash and Audit Trail

The SHA-256 governance hash is derived from the **context name + raw Jinja2 template** of the active version — NOT the rendered output. This design is deliberate:

- The hash is **stable** across invocations with different runtime variables — calling the same template with `region=EU` or `region=APAC` produces the same hash.
- It changes **only** when the template itself is modified (new version approved).
- It serves as a **version-level fingerprint** for audit and compliance checks.

**What gets logged for every injection:**

| Audit Field | Description | Example |
|-------------|-------------|---------|
| `agent_id` | SRN of the calling agent | `agent.refund-bot-0001` |
| `trace_id` | Correlation ID for the request | `trace-abc123` |
| `context_id` | UUID of the context | `550e8400-...` |
| `context_name` | SRN of the context | `context.eu-refund-policy` |
| `version_id` | UUID of the specific version served | `6ba7b810-...` |
| `governance_hash` | SHA-256 of `context_name:raw_template` | `a94a8fe5ccb1...` |
| `rendered` | Whether Jinja2 variables were applied | `true` |
| `accessed_at` | Timestamp of the injection | `2026-02-06T14:30:00Z` |
| `request_ip` | Source IP of the calling agent | `10.0.1.42` |

This means for any incident investigation, you can reconstruct:

> "On Feb 6th at 2:30 PM, `agent.refund-bot-0001` (trace `trace-abc123`) received `context.eu-refund-policy` version `6ba7b810` (template hash `a94a8fe5...`) rendered with runtime variables. The template was approved by `@alice.johnson` on Jan 15th."

### Simple Template Example: EU Refund Policy

This example uses only **variable substitution** (`{{ var }}`) — the simplest Jinja2 feature. No conditionals, no loops.

**Step 1: Create the context template**

The compliance team creates `context.eu-refund-policy` with this Jinja2 template:

```
# Refund Policy for {{ region }}
Current Date: {{ current_date }}
Customer ID: {{ customer_id }}

RULES:
1. Refunds are processed in {{ currency }}.
2. Strictly follow the {{ compliance_code }} protocol.
3. Maximum refund amount: {{ max_refund_amount }} {{ currency }}.
4. Refund window: {{ refund_window_days }} days from purchase date.
5. Escalate any refund above {{ escalation_threshold }} {{ currency }} to manager.
```

**Step 2: Agent developer calls the Inject API**

```python
# Agent code using the Sandarb SDK
response = sandarb.inject(
    agent_id="agent.service-account-refund-bot",
    prompt_key="prompt.refund-main-prompt",
    context_variables={
        "context.eu-refund-policy": {
            "region": "EU",
            "current_date": "2026-02-06",
            "customer_id": "CUST-90210",
            "currency": "EUR",
            "compliance_code": "GDPR-22",
            "max_refund_amount": "5000",
            "refund_window_days": "30",
            "escalation_threshold": "2500",
        }
    }
)
```

**Step 3: Sandarb returns the rendered content + governance proof**

```json
{
  "success": true,
  "data": {
    "agent_id": "agent.service-account-refund-bot",
    "trace_id": "trace-abc123",
    "prompt": {
      "name": "prompt.refund-main-prompt",
      "content": "You are a refund processing agent...",
      "version": 3,
      "model": "gpt-4"
    },
    "contexts": {
      "context.eu-refund-policy": {
        "context_id": "550e8400-e29b-41d4-a716-446655440000",
        "version_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "version": 4,
        "content": "# Refund Policy for EU\nCurrent Date: 2026-02-06\nCustomer ID: CUST-90210\n\nRULES:\n1. Refunds are processed in EUR.\n2. Strictly follow the GDPR-22 protocol.\n3. Maximum refund amount: 5000 EUR.\n4. Refund window: 30 days from purchase date.\n5. Escalate any refund above 2500 EUR to manager.",
        "metadata": {
          "classification": "Confidential",
          "owner": "compliance-team@bank.com",
          "hash": "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3...",
          "hash_type": "sha256"
        }
      }
    }
  }
}
```

### Complex Template Example: KYC Verification Checklist

This example uses **conditionals**, **loops**, **filters**, and **default values** — demonstrating the full power of Jinja2 for governance.

**The template** (`context.kyc-verification-checklist`):

```jinja2
# KYC Verification Checklist
Jurisdiction: {{ jurisdiction }}
Customer Type: {{ customer_type }}
Risk Rating: {{ risk_rating }}
Relationship Manager: {{ relationship_manager | default('Unassigned') }}

## Required Documents
{% for doc in required_documents %}
- {{ doc }}
{% endfor %}

{% if risk_rating == 'HIGH' %}
## Enhanced Due Diligence (EDD) — Required for HIGH Risk
- Source of Wealth documentation
- Senior Management approval required
- Enhanced monitoring for 12 months post-onboarding
- Politically Exposed Person (PEP) screening: {{ pep_screening | default('Standard') }}
{% endif %}

{% if customer_type == 'Corporate Entity' %}
## Entity-Specific Requirements
- Certificate of Incorporation
- Board Resolution authorizing account opening
- Beneficial Ownership Declaration (25%+ equity holders)
- Ultimate Beneficial Owner (UBO) verification
{% endif %}

## Compliance Notes
- Regulatory framework: {{ regulatory_framework }}
- Review frequency: Every {{ review_frequency_months | default('12') }} months
- Data retention: {{ retention_years | default('7') }} years
{# This template is governed under the firm's KYC/AML policy framework #}
```

**Agent call with variables:**

```python
response = sandarb.inject(
    agent_id="agent.retail-banking-kyc-verification-bot",
    context_variables={
        "context.kyc-verification-checklist": {
            "jurisdiction": "United Kingdom",
            "customer_type": "Corporate Entity",
            "risk_rating": "HIGH",
            "relationship_manager": "alice.johnson@bank.com",
            "required_documents": [
                "Government-issued ID for all directors",
                "Proof of Registered Address",
                "Audited Financial Statements (last 2 years)",
                "Source of Funds Documentation",
            ],
            "pep_screening": "Enhanced — covers family and close associates",
            "regulatory_framework": "FCA / MLR 2017",
            "review_frequency_months": "6",
            "retention_years": "10",
        }
    }
)
```

**Rendered output** (the agent receives this):

```
# KYC Verification Checklist
Jurisdiction: United Kingdom
Customer Type: Corporate Entity
Risk Rating: HIGH
Relationship Manager: alice.johnson@bank.com

## Required Documents
- Government-issued ID for all directors
- Proof of Registered Address
- Audited Financial Statements (last 2 years)
- Source of Funds Documentation

## Enhanced Due Diligence (EDD) — Required for HIGH Risk
- Source of Wealth documentation
- Senior Management approval required
- Enhanced monitoring for 12 months post-onboarding
- Politically Exposed Person (PEP) screening: Enhanced — covers family and close associates

## Entity-Specific Requirements
- Certificate of Incorporation
- Board Resolution authorizing account opening
- Beneficial Ownership Declaration (25%+ equity holders)
- Ultimate Beneficial Owner (UBO) verification

## Compliance Notes
- Regulatory framework: FCA / MLR 2017
- Review frequency: Every 6 months
- Data retention: 10 years
```

Notice how the `{% if risk_rating == 'HIGH' %}` block was included (because the risk rating is HIGH), the `{% if customer_type == 'Corporate Entity' %}` block was included (because this is a corporate entity), and the `{% for doc in required_documents %}` loop expanded the list. If the risk rating were MEDIUM, the EDD section would be completely absent from the rendered output — the agent would never see it.

**Governance impact:** The same template (same governance hash) produces different rendered output depending on the customer's risk rating and type. The audit trail records that `agent.retail-banking-kyc-verification-bot` received `context.kyc-verification-checklist` with template hash `abc123...` — the compliance team can verify the template was the correct approved version regardless of what runtime variables were used.

### Example: Dynamic Trading Limits

```python
response = sandarb.inject(
    agent_id="agent.pre-trade-compliance-bot",
    context_variables={
        "context.trading-limits-dynamic": {
            "desk_name": "Equities APAC",
            "region": "APAC",
            "effective_date": "2026-01-15",
            "approved_by": "Chief Risk Officer",
            "single_name_limit": "500000",
            "currency": "USD",
            "sector_cap_pct": "25",
            "var_limit": "5000000",
            "breach_notify_minutes": "15",
            "escalation_contact": "risk-apac@bank.com",
            "override_authority": "CRO or Regional Head of Risk",
        }
    }
)
```

### Why Templated Context Matters for Enterprise Governance

| Without Templated Context | With Templated Context |
|---------------------------|------------------------|
| Sandarb is a static file host (like S3) | Sandarb is a dynamic Governance Engine |
| Same policy served to all agents | Each agent sees policy rendered for its specific execution |
| No runtime variable audit trail | Full audit trail: who requested what variables, when |
| Hash changes on every content edit | Stable governance hash per template version |
| Cannot enforce per-region/per-customer policies | Region, customer, and jurisdiction-specific rendering |
| Compliance team must create N copies for N regions | One approved template serves all regions dynamically |

### Jinja2 Quick Reference for Context Authors

```jinja2
{# ---- Variables ---- #}
{{ customer_name }}                    {# Simple substitution #}
{{ amount | default('0') }}            {# Default if variable missing #}
{{ name | upper }}                     {# Filter: uppercase #}
{{ items | join(', ') }}               {# Filter: join list into string #}

{# ---- Conditionals ---- #}
{% if risk_level == 'HIGH' %}
  Enhanced monitoring required.
{% elif risk_level == 'MEDIUM' %}
  Standard monitoring.
{% else %}
  Basic monitoring.
{% endif %}

{# ---- Loops ---- #}
{% for doc in required_documents %}
- {{ doc }}
{% endfor %}

{# ---- Comments (stripped from output) ---- #}
{# This section is governed under SOX compliance #}
```

### Security

- Templates are rendered using Jinja2's **SandboxedEnvironment** with `autoescape=True` to prevent template injection attacks.
- The sandbox restricts template code: no file I/O, no system calls, no arbitrary Python execution.
- Variable values are HTML-escaped by default to prevent XSS and injection.
- Only **approved** template versions are rendered — draft or rejected versions are never served.
- The governance hash ensures template integrity: any unauthorized modification changes the hash, which is flagged during audit.

---

## Reference documentation

| Doc | Description |
|-----|-------------|
| **[Python SDK](../sdk/README.md)** | Full-featured Python SDK with sync/async clients, decorators, and framework integrations. |
| [Security](SECURITY.md) | API authentication, rate limiting, security headers, error handling, and production checklist. |
| [Deployment](DEPLOYMENT.md) | Local, GCP Cloud Run, and enterprise/on-premises deployment guides. |
| [Environment Configuration](../.env.example) | Complete environment variable reference with examples. |

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
    agent_id="agent.my-agent-v1",      # Use SRN format
    token=os.environ.get("SANDARB_TOKEN"),
)

# 1. Register agent on startup
client.register(
    agent_id="agent.my-agent-v1",       # SRN: agent.{kebab-case-name}
    name="My AI Agent",
    version="1.0.0",
    url="https://my-agent.example.com/a2a",
    owner_team="platform",
    capabilities=["text-generation", "summarization"],
)

# 2. Get governed prompt
prompt = client.get_prompt("prompt.customer-support", variables={"tier": "gold"})
system_message = prompt.content

# 3. Get governed context (static)
context = client.get_context("context.trading-limits")
config_data = context.content

# 4. Get governed context with Jinja2 template rendering (dynamic)
result = client.inject(
    agent_id="agent.my-agent-v1",
    prompt_key="prompt.customer-support",
    context_variables={
        "context.eu-refund-policy": {
            "region": "EU",
            "current_date": "2026-02-06",
            "currency": "EUR",
            "compliance_code": "GDPR-22",
        }
    }
)
rendered_policy = result["contexts"]["context.eu-refund-policy"]["content"]
governance_hash = result["contexts"]["context.eu-refund-policy"]["metadata"]["hash"]

# 5. Run your agent (Sandarb is NOT in the inference path)
response = your_llm_call(system_message, rendered_policy, user_input)

# 6. Log audit event for compliance
client.audit(
    "inference",
    resource_type="llm",
    resource_name="gpt-4",
    details={"tokens": 150, "latency_ms": 230, "governance_hash": governance_hash},
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
| GET | /api/inject?name=... | Inject context by name — static content (gated by agent_contexts link) |
| POST | /api/inject | Inject context with Jinja2 template rendering and governance metadata |
| GET | /api/prompts/pull?name=... | Pull prompt by name (gated by agent_prompts link) |
| GET | /api/contexts | List contexts |
| GET | /api/contexts/:id | Get context |
| POST | /api/contexts | Create context |
| GET | /api/agents | List agents |
| POST | /api/agents/register | Register agent |
| POST | /api/agents/:id/approve | Approve agent |
| GET | /api/organizations | List organizations |
| POST | /api/organizations | Create organization |
| GET | /a2a | A2A Agent Card (discovery) |
| POST | /a2a | A2A skill execution |
| GET | /api/lineage | Recent context deliveries |

## Inject API

Your agent fetches approved context by name. Sandarb logs the request for lineage. The Inject API supports two modes:

### GET /api/inject (Legacy — Static Context)

Fetches raw context content by name or ID. No template rendering.

```bash
GET /api/inject?name=ib-trading-limits
GET /api/inject?name=context.my-context&format=json
GET /api/inject?id=550e8400-e29b-41d4-a716-446655440000&format=yaml
```

Optional headers: `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`.

### POST /api/inject (Templated Context — Jinja2 Rendering)

Renders one or more Jinja2-templated contexts with agent-provided variables. Returns rendered content with governance metadata (hash, version, classification).

```bash
POST /api/inject
Content-Type: application/json
Authorization: Bearer <api_key>

{
    "agent_id": "agent.service-account-refund-bot",
    "prompt_key": "prompt.refund-main-prompt",
    "trace_id": "trace-abc123",
    "context_variables": {
        "context.eu-refund-policy": {
            "region": "EU",
            "current_date": "2026-02-06",
            "currency": "EUR",
            "compliance_code": "GDPR-22"
        },
        "context.trading-limits-dynamic": {
            "desk_name": "Equities EMEA",
            "region": "EMEA",
            "currency": "EUR",
            "var_limit": "3000000"
        }
    }
}
```

**Request fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | SRN of the calling agent (e.g. `agent.my-bot`) |
| `prompt_key` | string | No | SRN of the prompt to pull (e.g. `prompt.my-prompt`) |
| `context_variables` | object | Yes | Map of context SRN → template variables dict |
| `trace_id` | string | No | Correlation ID for audit lineage |

**Response:** Returns rendered content for each context, plus governance metadata (hash, version, classification, owner) as proof of delivery. See [Templated Context](#templated-context-jinja2-rendering) for full response example.

## Agent endpoint (MCP & A2A)

The **Sandarb MCP Server** and **A2A Server** run on the `agent.sandarb.ai` subdomain, separate from the main REST API. Use the same backend Docker image deployed as the `sandarb-agent` Cloud Run service.

| Purpose | URL |
|--------|-----|
| **Agent Endpoint** | `https://agent.sandarb.ai` |
| **MCP URL** (Claude Desktop / Cursor) | `https://agent.sandarb.ai/mcp` |
| **A2A URL** (discovery + JSON-RPC) | `https://agent.sandarb.ai/a2a` |

- **Discovery:** `GET https://agent.sandarb.ai` or `GET https://agent.sandarb.ai/a2a` returns the Agent Card (v0.2.0) with 24 skills.
- **MCP:** Configure `https://agent.sandarb.ai/mcp` in Claude Desktop or Cursor to use Sandarb as an MCP server (22 tools, Streamable HTTP transport).
- **A2A:** Use `POST https://agent.sandarb.ai/a2a` for A2A skill execution (JSON-RPC 2.0: `agent/info`, `skills/list`, `skills/execute` with 24 skills).

**Environment:** The agent service is activated by setting `SERVICE_MODE=agent` (used by `deploy-gcp.sh`) or `SANDARB_AGENT_SERVICE=1`. This mounts the Agent Card at `GET /` and the A2A endpoint at `POST /a2a`.

## A2A protocol

**How A2A URLs work in practice (Sandarb AI Governance Agent; A2A is the industry standard for agent-to-agent communication):**

1. **Discovery** – Agent A uses the A2A URL of Agent B to read its capabilities (e.g. `GET /a2a` returns the Agent Card: name, description, url, version, capabilities, skills).
2. **Interaction** – Agent A sends a JSON-RPC 2.0 message over HTTP(S) to that URL to initiate a task (e.g. `POST /a2a` with method and params).
3. **Real-time updates** – For long-running tasks, the A2A server may use Server-Sent Events (SSE) to send updates back to the client. Sandarb currently responds synchronously; SSE may be added for streaming or long-running flows.

- **Discovery:** `GET /a2a` returns the Agent Card (name, description, url, version, capabilities, 24 skills).
- **Skills:** `POST /a2a` with body `{ "method": "skills/execute", "params": { "skill": "get_context", "input": { "name": "my-context" } } }`.

### Available A2A skills (24)

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

These skills match the 22 MCP tools (plus 2 discovery methods). Both A2A and MCP use the same underlying backend services.

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

### Core Configuration

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL URL (required) |
| NEXT_PUBLIC_API_URL | Backend API URL (e.g. http://localhost:8000 for FastAPI). UI fetches from this for all /api/*. |
| PORT | Server port (default 3000) |
| NODE_ENV | production / development |

### Enterprise Domain Configuration

For on-premises or custom cloud deployments, configure your domain:

| Variable | Description |
|----------|-------------|
| SANDARB_DOMAIN | Base domain (e.g. `governance.company.com`). Auto-configures `ui.`, `api.`, `agent.` subdomains. |
| NEXT_PUBLIC_DOMAIN | Frontend domain for subdomain detection |
| NEXT_PUBLIC_API_SUBDOMAIN | API subdomain (default: `api`) |
| NEXT_PUBLIC_AGENT_SUBDOMAIN | Agent subdomain (default: `agent`) |
| CORS_ORIGINS | Comma-separated allowed origins (auto-configured from SANDARB_DOMAIN if not set) |

### Security

| Variable | Description |
|----------|-------------|
| SANDARB_ENV | Set to `production` for production security checks |
| JWT_SECRET | Strong secret for JWT signing (required in production) |
| WRITE_ALLOWED_EMAILS | Comma-separated emails for write access |
| RATE_LIMIT_DEFAULT | API rate limit (default: `100/minute`) |
| RATE_LIMIT_SEED | Seed endpoint limit (default: `5/hour`) |
| ALLOW_SEED_IN_PRODUCTION | Enable /api/seed in production (default: false) |

### OpenTelemetry

| Variable | Description |
|----------|-------------|
| OTEL_ENABLED | Set to `true` to enable OpenTelemetry |
| OTEL_SERVICE_NAME | Service name for traces/logs (default: sandarb) |
| OTEL_EXPORTER_OTLP_ENDPOINT | OTLP endpoint (e.g. http://localhost:4318) for traces and logs |
| OTEL_TRACES_EXPORTER | Trace exporter: `otlp` or `none` (default: otlp when endpoint set) |
| OTEL_LOGS_EXPORTER | Log exporter: `otlp` or `none` (default: otlp when endpoint set) |

### Kafka (Data Platform)

| Variable | Description |
|----------|-------------|
| KAFKA_BOOTSTRAP_SERVERS | Comma-separated Kafka broker list (default: `localhost:9092,...,localhost:9096`) |
| KAFKA_ENABLED | Set to `false` to disable Kafka publishing (default: `true`) |

### ClickHouse (Analytics)

| Variable | Description |
|----------|-------------|
| CLICKHOUSE_URL | ClickHouse HTTP URL with auth (e.g. `http://sandarb:sandarb@localhost:8123`) |

See [.env.example](../.env.example) for a complete list of configuration options.

---

## Sandarb AI Governance Data Platform

Sandarb's transactional PostgreSQL database serves OLTP workloads (entity CRUD, approval workflows, access control) but cannot scale for analytics at 100M+ events/day. The **Sandarb Data Platform** extends the architecture with a three-tier design: PostgreSQL (OLTP) + Kafka (streaming) + ClickHouse (OLAP).

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  SANDARB PLATFORM (UI, API, A2A, MCP)                        │
│                                                               │
│  POST /api/inject  ──► audit.py (dual-write)                 │
│  POST /a2a         ──►   ├── PostgreSQL  (OLTP, source of truth)
│  MCP tools         ──►   └── Kafka       (fire-and-forget)   │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  KAFKA CLUSTER (5 brokers, KRaft, ports 9092–9096)           │
│                                                               │
│  8 Topics:                                                    │
│    sandarb_events ────────── Primary firehose (all events)    │
│    sandarb.inject ────────── Context injection events          │
│    sandarb.audit ─────────── Immutable audit trail (∞ retain) │
│    sandarb.agent-lifecycle ─ Agent register/approve/deactivate│
│    sandarb.governance-proof  Governance hash proofs (compacted)│
│    sandarb.context-lifecycle Context version lifecycle         │
│    sandarb.prompt-lifecycle  Prompt version lifecycle          │
│    sandarb.policy-violations Policy & compliance violations   │
└──────────────────┬───────────────────────────────────────────┘
                   │  kafka_to_clickhouse.py (consumer bridge)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  CLICKHOUSE CLUSTER (4 nodes, 2 shards x 2 replicas)         │
│                                                               │
│  Database: sandarb                                            │
│    events ─────────── All governance events (denormalized)    │
│    daily_kpis ─────── Pre-aggregated daily KPIs               │
│    agent_activity ──── Agent hourly heatmap                   │
│    top_contexts ────── Top consumed contexts by day           │
│    governance_proofs ─ Hash + delivery ledger                 │
│    denial_reasons ──── Blocked injection reason breakdown     │
└──────────────────────────────────────────────────────────────┘
```

### Dual-Write Architecture

Every governance event writes to **two** destinations:

1. **PostgreSQL** (source of truth) — the `sandarb_access_logs` table stores the transactional record with ACID guarantees. This is the authoritative audit trail.
2. **Kafka** (analytics pipeline) — the `kafka_producer.py` service publishes events to the `sandarb_events` firehose topic and to category-specific topics for filtered consumers. This is fire-and-forget.

If Kafka is unavailable, PostgreSQL remains the authoritative record — the backend continues to operate normally (graceful degradation). The Kafka producer is a singleton, created lazily on first event, and managed by the FastAPI lifecycle (initialized on startup, flushed on shutdown).

### Kafka Topics

Sandarb publishes governance events to 8 Kafka topics:

| Topic | Partitions | RF | Retention | Purpose |
|-------|-----------|-----|-----------|---------|
| `sandarb_events` | 5 | 3 | 7 days | Primary firehose — all events. ClickHouse consumes from here. |
| `sandarb.inject` | 12 | 3 | 30 days | Context injection events (success + denied) |
| `sandarb.audit` | 6 | 3 | Infinite | Immutable audit trail — never deleted |
| `sandarb.agent-lifecycle` | 6 | 3 | 30 days | Agent registration, approval, deactivation |
| `sandarb.governance-proof` | 6 | 3 | Infinite | Governance hash proofs (log-compacted) |
| `sandarb.context-lifecycle` | 6 | 3 | 30 days | Context version create, approve, reject, archive |
| `sandarb.prompt-lifecycle` | 6 | 3 | 30 days | Prompt version lifecycle events |
| `sandarb.policy-violations` | 6 | 3 | Infinite | Policy and compliance violation alerts |

**Partition key:** `org_id` — all events for an organization go to the same partition, enabling per-org ordering and data locality.

**Compression:** LZ4 across all topics for fast compression/decompression with minimal CPU overhead.

### Governance Event Types

The data platform captures 16 event types across 7 categories:

| Category | Event Types | Description |
|----------|-------------|-------------|
| **inject** | `INJECT_SUCCESS`, `INJECT_DENIED` | Context injection (the primary governance action) |
| **prompt** | `PROMPT_USED`, `PROMPT_DENIED` | Prompt pull events |
| **agent-lifecycle** | `AGENT_REGISTERED`, `AGENT_APPROVED`, `AGENT_DEACTIVATED` | Agent registry mutations |
| **context-lifecycle** | `CONTEXT_CREATED`, `CONTEXT_VERSION_APPROVED`, `CONTEXT_VERSION_REJECTED`, `CONTEXT_ARCHIVED` | Context version workflow |
| **prompt-lifecycle** | `PROMPT_VERSION_CREATED`, `PROMPT_VERSION_APPROVED` | Prompt version workflow |
| **governance-proof** | `GOVERNANCE_PROOF` | Immutable proof of delivery with governance hash |
| **policy-violations** | `POLICY_VIOLATION` | Unauthorized access, data classification breach, etc. |
| **a2a** | `A2A_CALL` | Agent-to-agent communication events |

### ClickHouse Schema

ClickHouse stores events in a **denormalized** columnar table optimized for analytical queries. No JOINs are needed — agent name, org name, classification are embedded in each event row.

**Primary table:** `sandarb.events`

| Column | Type | Description |
|--------|------|-------------|
| `event_id` | UUID | Unique event identifier |
| `event_type` | LowCardinality(String) | Event type (e.g. `INJECT_SUCCESS`) |
| `event_category` | LowCardinality(String) | Category (e.g. `inject`, `audit`) |
| `agent_id` | String | SRN of the agent (e.g. `agent.kyc-bot`) |
| `agent_name` | LowCardinality(String) | Human-readable agent name |
| `org_id` | String | Organization slug |
| `org_name` | LowCardinality(String) | Organization display name |
| `context_id` | String | Context UUID (for inject events) |
| `context_name` | LowCardinality(String) | Context SRN |
| `version_id` | String | Context version UUID |
| `version_number` | UInt32 | Version number |
| `prompt_id` | String | Prompt UUID (for prompt events) |
| `prompt_name` | LowCardinality(String) | Prompt SRN |
| `data_classification` | LowCardinality(String) | Public, Internal, Confidential, Restricted |
| `governance_hash` | String | SHA-256 governance hash |
| `template_rendered` | Bool | Whether Jinja2 rendering was applied |
| `denial_reason` | String | Reason for denial (INJECT_DENIED, etc.) |
| `violation_type` | LowCardinality(String) | Violation type (for POLICY_VIOLATION) |
| `severity` | LowCardinality(String) | LOW, MEDIUM, HIGH, CRITICAL |
| `trace_id` | String | Correlation / trace ID |
| `event_time` | DateTime64(3, 'UTC') | Event timestamp |
| `metadata` | String | JSON string for flexible extra fields |

**Engine:** `MergeTree()` partitioned by `toYYYYMM(event_time)`, ordered by `(org_id, event_type, event_time, event_id)`. TTL: 2 years.

### Materialized Views

ClickHouse materialized views pre-aggregate data at insert time for sub-10ms dashboard queries:

| View | Target Table | Aggregation | Use Case |
|------|-------------|-------------|----------|
| `daily_kpis_mv` | `daily_kpis` | Daily count by org, event_type, classification | Dashboard KPI cards, inject trend chart |
| `agent_activity_mv` | `agent_activity` | Hourly count by agent, event_type | Agent activity heatmap, Agent Pulse |
| `top_contexts_mv` | `top_contexts` | Daily inject count by context name | Top consumed contexts chart |
| `governance_proofs_mv` | `governance_proofs` | Daily delivery count by context, hash, agent | Governance proof-of-delivery ledger |
| `denial_reasons_mv` | `denial_reasons` | Daily denial count by reason, event_type | Blocked injection reason breakdown |

**Example: Daily KPI query (sub-10ms at billion-event scale):**

```sql
SELECT
    day,
    sumIf(event_count, event_type = 'INJECT_SUCCESS') AS success,
    sumIf(event_count, event_type = 'INJECT_DENIED') AS denied
FROM sandarb.daily_kpis
WHERE day >= today() - 30
GROUP BY day
ORDER BY day;
```

### ClickHouse SQL Differences from PostgreSQL

ClickHouse has its own SQL dialect. Key differences from PostgreSQL:

| PostgreSQL | ClickHouse | Notes |
|-----------|-----------|-------|
| `COUNT(*) FILTER (WHERE cond)` | `countIf(cond)` | Conditional count |
| `SUM(x) FILTER (WHERE cond)` | `sumIf(x, cond)` | Conditional sum |
| `AVG(x) FILTER (WHERE cond)` | `avgIf(x, cond)` | Conditional average |
| `date_trunc('day', ts)` | `toDate(ts)` | Date truncation |
| `date_trunc('hour', ts)` | `toStartOfHour(ts)` | Hour truncation |
| `ts::date` | `toDate(ts)` | Cast to date |
| `now() - interval '30 days'` | `now() - INTERVAL 30 DAY` | Interval (no quotes, singular) |
| `metadata->>'key'` | `JSONExtractString(metadata, 'key')` | JSON field extraction |

### Infrastructure Setup

#### Kafka Cluster

The Kafka cluster runs 5 brokers using **KRaft** (no external ZooKeeper) on Apache Kafka 3.7.0:

| Node | Role | External Port |
|------|------|--------------|
| broker01 | Controller + Broker | 9092 |
| broker02 | Controller + Broker | 9093 |
| broker03 | Controller + Broker | 9094 |
| broker04 | Broker only | 9095 |
| broker05 | Broker only | 9096 |

```bash
# Start the Kafka cluster
cd kafka-cluster && docker compose up -d

# Verify brokers
docker exec broker01 /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9090

# Describe a topic
docker exec broker01 /opt/kafka/bin/kafka-topics.sh --describe \
  --topic sandarb_events --bootstrap-server localhost:9090
```

#### ClickHouse Cluster

The ClickHouse cluster runs 4 nodes (2 shards x 2 replicas) with ZooKeeper coordination:

| Node | Shard | Replica | HTTP Port | Native Port |
|------|-------|---------|-----------|------------|
| clickhouse01 | 01 | replica_01 | 8123 | 9000 |
| clickhouse02 | 01 | replica_02 | 8124 | 9001 |
| clickhouse03 | 02 | replica_01 | 8125 | 9002 |
| clickhouse04 | 02 | replica_02 | 8126 | 9003 |

Cluster name: `sandarb_cluster` (defined in `clickhouse-cluster/config.xml`).

```bash
# Start the ClickHouse cluster
cd clickhouse-cluster && docker compose up -d

# Initialize schema (run once)
docker exec clickhouse01 clickhouse-client --multiquery \
  < clickhouse-cluster/schema/001_sandarb_events.sql

# Verify tables
docker exec clickhouse01 clickhouse-client \
  --query "SHOW TABLES FROM sandarb"

# Query event count
docker exec clickhouse01 clickhouse-client \
  --query "SELECT count() FROM sandarb.events"
```

### Event Driver (Generating Test Events)

The **sandarb_event_driver.py** script generates realistic governance events and publishes them to Kafka at 40K+ events/sec. It simulates 16 event types across 26 agents, 42 contexts, 21 prompts, and 15 organizations.

```bash
# Generate 10K events (burst mode, maximum throughput)
python scripts/sandarb_event_driver.py --count 10000 --mode burst

# Generate 1M events
python scripts/sandarb_event_driver.py --count 1000000

# Rate-limited (5K events/sec)
python scripts/sandarb_event_driver.py --count 100000 --rate 5000

# Continuous mode (real-time simulation at 1K events/sec)
python scripts/sandarb_event_driver.py --mode continuous --eps 1000

# Fan-out to all category-specific topics
python scripts/sandarb_event_driver.py --count 50000 --fan-out

# Specific topic
python scripts/sandarb_event_driver.py --topic sandarb.inject --count 50000
```

### Kafka to ClickHouse Consumer

The **kafka_to_clickhouse.py** consumer bridge reads events from Kafka and batch-inserts them into ClickHouse:

```bash
# Consume all events from the beginning
python scripts/kafka_to_clickhouse.py --from-beginning

# Custom batch size (for higher throughput)
python scripts/kafka_to_clickhouse.py --batch-size 5000

# Custom ClickHouse URL
python scripts/kafka_to_clickhouse.py \
  --clickhouse-url http://sandarb:sandarb@localhost:8123
```

The consumer automatically:
- Batches events (default: 2000 per insert) for ClickHouse efficiency
- Converts timestamps from ISO 8601 (`2026-01-21T00:21:40.524Z`) to ClickHouse format (`2026-01-21 00:21:40.524`)
- Commits Kafka offsets only after successful ClickHouse insertion (at-least-once delivery)
- Reports progress every 10 seconds with throughput metrics

### Full Pipeline Test

```bash
# 1. Start both clusters
cd kafka-cluster && docker compose up -d
cd ../clickhouse-cluster && docker compose up -d

# 2. Initialize ClickHouse schema
docker exec clickhouse01 clickhouse-client --multiquery \
  < clickhouse-cluster/schema/001_sandarb_events.sql

# 3. Generate events into Kafka
python scripts/sandarb_event_driver.py --count 100000 --mode burst

# 4. Consume into ClickHouse
python scripts/kafka_to_clickhouse.py --from-beginning

# 5. Verify in ClickHouse
docker exec clickhouse01 clickhouse-client \
  --query "SELECT event_type, count() AS cnt FROM sandarb.events GROUP BY event_type ORDER BY cnt DESC FORMAT PrettyCompact"

# 6. Query materialized views
docker exec clickhouse01 clickhouse-client \
  --query "SELECT day, sumIf(event_count, event_type = 'INJECT_SUCCESS') AS success, sumIf(event_count, event_type = 'INJECT_DENIED') AS denied FROM sandarb.daily_kpis GROUP BY day ORDER BY day DESC LIMIT 10 FORMAT PrettyCompact"
```

### Kafka Producer Service

The backend Kafka producer (`backend/services/kafka_producer.py`) is designed for zero-impact integration:

- **Singleton pattern:** One producer per process, created lazily on first event
- **Graceful degradation:** If Kafka is unavailable, events are logged only to PostgreSQL — no exceptions, no failures
- **Dual-topic publishing:** Each event goes to both the firehose (`sandarb_events`) and the category-specific topic (e.g. `sandarb.inject`)
- **High throughput:** LZ4 compression, 20ms linger, 64KB batches, leader-only acks
- **Lifecycle managed:** Producer is initialized in the FastAPI `lifespan` context and flushed on shutdown

**Convenience methods for each event type:**

```python
from backend.services.kafka_producer import (
    publish_inject_success,
    publish_inject_denied,
    publish_prompt_used,
    publish_prompt_denied,
    publish_governance_proof,
    publish_agent_lifecycle,
    publish_context_lifecycle,
    publish_policy_violation,
    publish_a2a_call,
)
```

### Production Scaling

| Layer | Technology | Dev (Docker) | Production |
|-------|-----------|-------------|------------|
| **OLTP** | PostgreSQL | localhost:5432 | Cloud SQL / RDS |
| **Streaming** | Apache Kafka | 5-broker KRaft cluster | MSK / Confluent Cloud |
| **OLAP** | ClickHouse | 4-node cluster (2x2) | ClickHouse Cloud / self-hosted |
| **Lake** | Apache Iceberg on S3 | — | S3 + Spark (Phase 3) |
| **ML** | Spark + Python | — | Databricks / EMR (Phase 4) |

**Cost estimate at 500M events/day:**

| Component | Monthly Cost |
|-----------|-------------|
| ClickHouse Cloud (3x Production) | ~$800–1,200 |
| Kafka (Confluent Cloud Basic) | ~$400–600 |
| S3 Iceberg storage (1TB/mo) | ~$25 |
| Spark (serverless, occasional) | ~$200–500 |
| **Total** | **~$1,500–2,300** |

---

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
