# Sandarb.ai
### AI Governance for your AI Agents

> **Our Goal:** Governance that doesn't slow shipping AI Agents. Protocol-first (A2A, MCP), versioned prompts/context, and a living agent registry.

**Sandarb** (Sanskrit for "Context") is an open-source **Control Plane** AI Governance Agent for prompts & context designed to be installed within your infrastructure to govern & manage your AI Agents.

It serves as the regulatory and compliance backbone for your internal agent ecosystem. While your tech teams focus on building Agents, Sandarb runs alongside them to provide approval workflows, validated context, audit logging, and pending-review visibility.

### Quick Start (local development)

```bash
git clone https://github.com/openint-ai/sandarb.ai.git && cd sandarb.ai
npm install
docker compose up -d postgres
./scripts/start-sandarb.sh
```

**UI:** http://localhost:4000 · **API:** http://localhost:4001  

Full steps (env, troubleshooting): **[docs/QUICKSTART.md](docs/QUICKSTART.md)**

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

Sandarb ships with a **Vitest** test suite (unit + API route tests; no database required). Run:

```bash
npm run test        # watch mode
npm run test:run    # single run (CI)
npm run test:coverage  # with coverage
```

See **[tests/README.md](tests/README.md)** for what’s covered, how to run tests, and how to **extend the suite** (adding lib tests, API route tests, and mocking patterns).

---

## 💻 Developer Experience

Your agents don't guess what to say; they ask Sandarb.

**Example: A2A Request for Validated Context**

```typescript
import { SandarbClient } from '@openint/sandarb-sdk';

// Connect to your internal Sandarb instance
const sandarb = new SandarbClient({ 
  endpoint: process.env.INTERNAL_SANDARB_URL,
  apiKey: process.env.SANDARB_SERVICE_KEY 
});

async function runAgentTask(input: string) {
  
  // 1. The Agent calls Sandarb (A2A) to get its "Operating Manifest"
  // This includes the approved System Prompt + Validated Context
  const governanceData = await sandarb.agent.pull({
    agentId: 'finance-analyst-bot-01',
    intent: 'analyze_q3_report',
    input_variables: { query: input }
  });

  // 2. Execute inference using ONLY the governed data
  return llm.generate({
    system: governanceData.prompt.system,
    context: governanceData.context.chunks,
    user: input
  });
}
