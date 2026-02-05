# Sandarb.ai
### AI Governance for your AI Agents

> **Our Goal:** Governance that doesn't slow shipping AI Agents. Protocol-first (A2A, MCP), versioned prompts/context, and a living agent registry.

**Sandarb** (derived from "Sandarbh" (संदर्भ), a Hindi/Sanskrit word meaning "context," "reference," or "connection") is an open-source **Control Plane** AI Governance Agent for prompts & context designed to be installed within your infrastructure to govern & manage your AI Agents.

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
| **Production** | Your company (platform/security team) | Sandarb is hosted behind a **load balancer** or on a **separate, fully protected server**. API and UI URLs are provided by the company (e.g. `https://sandarb.your-company.com`, `https://api.sandarb.your-company.com`). Your agents and SDK point at those URLs; you do not run or expose Sandarb yourself. |

When you go to production, the service must be hosted and fully protected by your organization—not exposed directly from a developer machine. See **[docs/developer-guide.md](docs/developer-guide.md#deployment)** and **[docs/deploy-gcp.md](docs/deploy-gcp.md)** for how to host Sandarb (e.g. behind LB, GCP Cloud Run, or a dedicated server).

### Security

Sandarb is built for enterprise and regulated use. Governance data and audit endpoints are protected by **API key authentication**; agent identity is bound to the key (no header trust). **JWT and service account secrets** are enforced in production (no default/weak secrets). Preview bypass is restricted; secrets are not logged; CORS and SQL are hardened. **[Full security documentation →](docs/SECURITY.md)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GCP Native](https://img.shields.io/badge/Deploy-Google%20Cloud-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/)

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

* **Single Source of Truth:** A centralized place for approved prompts and context. Your agents pull validated instructions via API or A2A protocols.
* **Audit Trail & Lineage:** Complete tracking of who requested what and when. This provides the lineage required for compliance and incident resolution.
* **Manifest-Based Registration:** Agents register via strict manifests (using MCP standards where applicable), ensuring every bot in your network is known, authorized, and versioned.
* **Git-like Versioning:** Prompts and context chunks are treated like code—versioned, branched, and diffable.
* **Sandarb AI Governance Agent:** Sandarb is an AI agent that participates in A2A (fast becoming the industry standard for agent-to-agent communication). Other agents call Sandarb for validation and approved context; Sandarb also communicates with other agents via A2A as a first-class participant.

---

## 🏗 Core Capabilities

### 1. A2A (Agent-to-Agent) Governance
**The Sandarb AI Governance Agent is crucial.** A2A is fast becoming the industry standard for AI agents to discover, communicate, and collaborate across vendors and frameworks. Sandarb is an AI agent that participates in A2A: it communicates with other agents via A2A and runs as an A2A server so your agents can call it for governance.
* Other agents in your network communicate with Sandarb (via A2A) to request validation, fetch approved context, or log decisions.
* Sandarb acts as the governance agent in the agent mesh, verifying that the requesting agent has the correct permissions (via its manifest) before releasing sensitive prompt instructions or context data.

### 2. Enterprise Workflow & Compliance
* **Approval Workflows:** Prompts are not deployed until they pass through `Draft` → `Pending Review` → `Approved`.
* **Pending-Review Visibility:** A clear dashboard for Compliance Officers or Engineering Leads to see every prompt change awaiting sign-off.
* **Incident Resolution:** When an agent hallucinates, check the Audit Trail to pinpoint exactly which prompt version and context source were active at that microsecond.

### 3. Prompt & Context themEngineering
* **Git-Like Versioning:** Roll back instantly. Fork prompts for A/B testing. Merge "Staging" prompts to "Production."
* **Context Validation:** Sandarb ensures that the context injected (RAG) is not just "semantically relevant" but also "compliance approved" for that specific agent intent.

---

## 🔌 Integrate Your Way

Sandarb fits into your architecture however you need it to.

![Integrate Your Way](./docs/images/integrate-your-way.png)
*(Note: Add your screenshot to `docs/images/integrate-your-way.png`)*

* **A2A Protocol:** The Sandarb AI Governance Agent participates in A2A (the industry standard for agent-to-agent communication). Other agents call `POST /api/a2a` with skills like `get_context`, `validate_context`, and `get_lineage`; Sandarb can also communicate with other agents via A2A.
* **API:** Standard HTTP endpoints (`GET /api/contexts`, `GET /api/agents`) for traditional integration.
* **Git-like Flow:** Propose edits with commit messages. Contexts and prompts get versioned history. Sandarb tracks approvals and revisions like a lightweight Pull Request flow.

---

## Testing

Sandarb has **120+ tests** covering both frontend and backend:

```bash
# Run all tests (recommended)
npm run test:all

# Frontend tests (Vitest) - 67 tests
npm run test           # watch mode
npm run test:run       # single run (CI)
npm run test:coverage  # with coverage

# Backend tests (Pytest) - 53 tests
npm run test:backend        # run backend API tests
npm run test:backend:cov    # with coverage
```

| Suite | Tests | Coverage |
|-------|-------|----------|
| Frontend (Vitest) | 67 | lib/, API client |
| Backend (Pytest) | 53 | All API endpoints (agents, contexts, prompts, orgs) |

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

📚 **Full SDK Documentation:** [sdk/python/README.md](sdk/python/README.md)
