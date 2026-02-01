# Sandarb.ai
### The Governance & Control Plane for Agentic AI

> **Our Goal:** Governance that doesn't slow shipping AI Agents. Protocol-first (A2A, MCP), versioned prompts/context, and a living agent registry.

**Sandarb** (Sanskrit for "Context") is an open-source **Control Plane** designed to be installed within your infrastructure to govern & manage your AI Agents.

It serves as the regulatory and compliance backbone for your internal agent ecosystem. While your tech teams focus on building Agents, Sandarb runs alongside them to provide approval workflows, validated context, audit logging, and pending-review visibility.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GCP Native](https://img.shields.io/badge/Deploy-Google%20Cloud-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/)

---

## 🛑 The "Hard Problem"
In most production AI systems, prompts are "magic strings" buried in code, and context (RAG) is retrieved opaquely. This lack of separation causes:
1.  **Silent Regressions:** A prompt tweak improves one case but breaks ten others.
2.  **Context Contamination:** Agents access irrelevant or sensitive documents because the retrieval scope wasn't locked.
3.  **Compliance Risks:** No audit trail of *why* an agent gave a specific answer or what instructions it was following.

**Sandarb solves this by acting as the Compliance Layer between your Agents and their LLM providers.**

---

## 🎯 What We Solve
We solve the "Black Box" problem of enterprise AI. Instead of scattered prompts and untraceable decisions, Sandarb provides:

* **Single Source of Truth:** A centralized place for approved prompts and context. Your agents pull validated instructions via API or A2A protocols.
* **Audit Trail & Lineage:** Complete tracking of who requested what and when. This provides the lineage required for compliance and incident resolution.
* **Manifest-Based Registration:** Agents register via strict manifests (using MCP standards where applicable), ensuring every bot in your network is known, authorized, and versioned.
* **Git-like Versioning:** Prompts and context chunks are treated like code—versioned, branched, and diffable.
* **Sandarb as an Agent:** Sandarb runs as an A2A agent itself, so other agents can call it for validation and approved context.

---

## 🏗 Core Capabilities

### 1. A2A (Agent-to-Agent) Governance
Uniquely, **Sandarb runs as an A2A agent**.
* Other agents in your network communicate with Sandarb to request validation, fetch approved context, or log decisions.
* Sandarb acts as the "Gatekeeper Agent," verifying that the requesting agent has the correct permissions (via its manifest) before releasing sensitive prompt instructions or context data.

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

![Integrate Your Way](./docs/images/integrate-your-way.png)
*(Note: Add your screenshot to `docs/images/integrate-your-way.png`)*

* **A2A Protocol:** Sandarb is an AI Agent for AI Governance. Other agents call `POST /api/a2a` with skills like `get_context`, `validate_context`, and `get_lineage`.
* **REST API:** Standard HTTP endpoints (`GET /api/contexts`, `GET /api/agents`) for traditional integration.
* **Git-like Flow:** Propose edits with commit messages. Contexts and prompts get versioned history. Sandarb tracks approvals and revisions like a lightweight Pull Request flow.

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

  // 2. Sandarb logs this request for compliance lineage
  console.log(`Using Prompt Version: ${governanceData.meta.versionId}`);

  // 3. Execute inference using ONLY the governed data
  return llm.generate({
    system: governanceData.prompt.system,
    context: governanceData.context.chunks,
    user: input
  });
}
