import Link from 'next/link';
import { headers } from 'next/headers';
import { BookOpen, ExternalLink, Home, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { MultiAgentA2ADiagram } from '@/components/multi-agent-a2a-diagram';
import { DocsTryInject, DocsTryPromptsPull, DocsTryA2a } from './docs-try-api';
import { DocsLayout } from './docs-layout';
import { DocsCodeBlock } from './docs-code-block';
import type { AgentSkill } from '@/types';

/** Static A2A skills list for docs (canonical list lives in backend/routers/agent_protocol.py). */
const DOCS_AGENT_SKILLS: AgentSkill[] = [
  // Discovery
  { id: 'agent/info', name: 'Agent info', description: 'Returns Sandarb agent card', tags: ['discovery'], examples: [] },
  { id: 'skills/list', name: 'Skills list', description: 'List supported A2A skills', tags: ['discovery'], examples: [] },
  // Agents
  { id: 'list_agents', name: 'List agents', description: 'List all registered agents, optionally filtered by org or approval status', tags: ['agents'], examples: [] },
  { id: 'get_agent', name: 'Get agent', description: 'Get detailed info about a specific agent by ID', tags: ['agents'], examples: [] },
  { id: 'get_agent_contexts', name: 'Get agent contexts', description: 'List all contexts linked to a specific agent', tags: ['agents', 'context'], examples: [] },
  { id: 'get_agent_prompts', name: 'Get agent prompts', description: 'List all prompts linked to a specific agent', tags: ['agents', 'prompt'], examples: [] },
  { id: 'register', name: 'Register agent', description: 'Register a new agent with the governance platform', tags: ['agents', 'registry'], examples: [] },
  // Organizations
  { id: 'list_organizations', name: 'List organizations', description: 'List all organizations', tags: ['organizations'], examples: [] },
  { id: 'get_organization', name: 'Get organization', description: 'Get organization details by UUID or slug', tags: ['organizations'], examples: [] },
  { id: 'get_organization_tree', name: 'Organization tree', description: 'Get the full organization hierarchy tree', tags: ['organizations'], examples: [] },
  // Contexts
  { id: 'list_contexts', name: 'List contexts', description: 'List context names available to the agent', tags: ['context'], examples: [] },
  { id: 'get_context', name: 'Get context', description: 'Get approved context by name (requires sourceAgent)', tags: ['context'], examples: [] },
  { id: 'get_context_by_id', name: 'Get context by ID', description: 'Get context details by UUID, including active version content', tags: ['context'], examples: [] },
  { id: 'get_context_revisions', name: 'Context revisions', description: 'List all revisions (versions) of a context', tags: ['context'], examples: [] },
  // Prompts
  { id: 'list_prompts', name: 'List prompts', description: 'List prompts available to the agent', tags: ['prompt'], examples: [] },
  { id: 'get_prompt', name: 'Get prompt', description: 'Get approved prompt content by name (requires sourceAgent)', tags: ['prompt'], examples: [] },
  { id: 'get_prompt_by_id', name: 'Get prompt by ID', description: 'Get prompt details by UUID, including all versions', tags: ['prompt'], examples: [] },
  { id: 'get_prompt_versions', name: 'Prompt versions', description: 'List all versions of a prompt', tags: ['prompt'], examples: [] },
  // Audit & Lineage
  { id: 'get_lineage', name: 'Get lineage', description: 'Get recent context delivery audit trail (successful deliveries)', tags: ['audit'], examples: [] },
  { id: 'get_blocked_injections', name: 'Blocked injections', description: 'Get blocked/denied context injection attempts', tags: ['audit'], examples: [] },
  { id: 'get_audit_log', name: 'Audit log', description: 'Get the full A2A audit log (inject, prompt, inference events)', tags: ['audit'], examples: [] },
  // Dashboard & Reports
  { id: 'get_dashboard', name: 'Dashboard', description: 'Get aggregated dashboard data (counts, recent activity)', tags: ['reports'], examples: [] },
  { id: 'get_reports', name: 'Reports', description: 'Get governance reports (risk, regulatory, compliance)', tags: ['reports'], examples: [] },
  // Validation
  { id: 'validate_context', name: 'Validate context', description: 'Validate context content against governance rules', tags: ['context'], examples: [] },
];

const HANDSHAKE_MERMAID = `sequenceDiagram
    participant Worker as Worker Agent
    participant Sandarb as Sandarb AI Governance Agent
    participant LLM as LLM Provider

    Note over Worker: 1. Boot / Check-in
    Worker->>Sandarb: A2A Call: register (Send Manifest)
    Sandarb-->>Worker: OK (Agent ID, approval status)

    Note over Worker: 2. Execution start
    Worker->>Sandarb: A2A Call: get_prompt (name: finance-bot)
    Sandarb-->>Worker: (content, version: 4, model: gpt-4-turbo)

    Note over Worker: 3. RAG / context
    Worker->>Worker: Fetch docs from vector DB
    Worker->>Sandarb: A2A Call: validate_context (name: trading-limits, sourceAgent: my-agent)
    Sandarb-->>Worker: (approved: true, content, hasPendingRevisions: false)

    Note over Worker: 4. Inference
    Worker->>LLM: Chat completion (Prompt v4 + context)
    LLM-->>Worker: Response

    Note over Worker: 5. Audit
    Worker->>Sandarb: A2A Call: audit_log (eventType: inference, details)
    Sandarb-->>Worker: (logged: true)`;

const EXAMPLE_AGENTS_A2A_MERMAID = `sequenceDiagram
    participant Support as Support Bot
    participant Trading as Trading Bot
    participant Finance as Finance Bot
    participant Sandarb as Sandarb AI Governance Agent

    Note over Support,Finance: Example agents call Sandarb via A2A
    Support->>Sandarb: A2A: get_prompt
    Sandarb-->>Support: prompt v1
    Trading->>Sandarb: A2A: validate_context
    Sandarb-->>Trading: approved context
    Finance->>Sandarb: A2A: get_context
    Sandarb-->>Finance: context + lineage
    Support->>Sandarb: A2A: audit_log
    Sandarb-->>Support: logged`;

export const metadata = {
  title: 'Developer Documentation - Sandarb',
  description:
    'Developer integration and usage guide for Sandarb: API, A2A protocol, inject API, contexts, agents, and deployment.',
};

function H2WithAnchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="group mt-10 mb-4 text-lg font-semibold text-foreground border-l-4 border-violet-500 pl-4 scroll-mt-24">
      <span className="inline-flex items-center gap-2">
        {children}
        <a href={`#${id}`} className="inline-flex opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 transition-opacity" aria-label={`Link to ${id}`}>#</a>
      </span>
    </h2>
  );
}
function H3WithAnchor({ id, children }: { id?: string; children: React.ReactNode }) {
  const slug = id ?? (typeof children === 'string' ? children.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '');
  return (
    <h3 id={slug || undefined} className="group mt-6 mb-2 text-sm font-semibold text-foreground scroll-mt-24">
      <span className="inline-flex items-center gap-2">
        {children}
        {slug && <a href={`#${slug}`} className="inline-flex opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 transition-opacity" aria-label={`Link to section`}>#</a>}
      </span>
    </h3>
  );
}
const P = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[15px] text-muted-foreground mb-4 leading-relaxed ${className ?? ''}`}>{children}</p>
);
const InlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-[13px] font-mono text-violet-800 dark:text-violet-200">{children}</code>
);
const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc list-outside pl-6 text-[15px] text-muted-foreground space-y-2 mb-4 leading-relaxed">{children}</ul>
);
function Admonition({ children, title = 'Note', icon: Icon = Info }: { children: React.ReactNode; title?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="my-6 rounded-r-lg border border-l-4 border-l-violet-500 border-border/40 bg-violet-50/50 dark:bg-violet-900/10 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
        <Icon className="h-4 w-4 shrink-0" />
        {title}
      </p>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
function MethodBadge({ method }: { method: 'GET' | 'POST' | 'PUT' | 'DELETE' }) {
  const styles = method === 'GET' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-xs px-2 py-0.5 rounded' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-xs px-2 py-0.5 rounded';
  return <span className={styles}>{method}</span>;
}

export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  let baseUrl = 'https://your-sandarb.example.com';
  try {
    const headersList = headers();
    const host = headersList.get('host') || '';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    if (host) baseUrl = `${protocol}://${host}`;
  } catch {
    // Fallback when headers unavailable (e.g. some runtimes)
  }

  const tocGroups = [
    {
      label: 'Getting started',
      items: [
    { id: 'overview', label: 'Overview' },
    { id: 'prompts-vs-context', label: 'Prompts vs Context' },
        { id: 'governance-protocol', label: 'Governance Protocol' },
    { id: 'quick-start', label: 'Quick start' },
    { id: 'sandarb-json', label: 'sandarb.json manifest' },
      ],
    },
    {
      label: 'Integration',
      items: [
        { id: 'unified-sdk-interface', label: 'Unified SDK interface' },
        { id: 'sdks-python-node-go', label: 'SDKs' },
        { id: 'sdks-python', label: 'Python' },
        { id: 'sdks-node', label: 'Node' },
        { id: 'sdks-go', label: 'Go' },
        { id: 'sdks-java', label: 'Java' },
      ],
    },
    {
      label: 'REST API',
      items: [
        { id: 'rest-api', label: 'Core endpoints' },
        { id: 'rest-api-swagger', label: 'API Reference (Swagger UI)' },
        { id: 'inject', label: 'Inject API' },
        { id: 'try-inject', label: 'Try Inject API' },
        { id: 'prompts-pull', label: 'Prompts Pull API' },
        { id: 'try-prompts-pull', label: 'Try Prompts Pull API' },
      ],
    },
    {
      label: 'MCP',
      items: [
        { id: 'mcp', label: 'MCP overview' },
        { id: 'mcp-tools', label: 'Available tools' },
        { id: 'mcp-setup', label: 'Setup & configuration' },
        { id: 'mcp-usage', label: 'Usage' },
      ],
    },
    {
      label: 'A2A',
      items: [
    { id: 'a2a', label: 'A2A protocol' },
        { id: 'a2a-skills-reference', label: 'A2A skills reference' },
        { id: 'try-a2a', label: 'Try A2A' },
      ],
    },
    {
      label: 'Reference',
      items: [
        { id: 'data-model-lineage', label: 'Data model & lineage' },
        { id: 'security', label: 'Security' },
    { id: 'contexts-agents', label: 'Contexts & agents' },
    { id: 'templates', label: 'Templates for context' },
    { id: 'audit-headers', label: 'Audit headers' },
      ],
    },
    {
      label: 'Enterprise',
      items: [
        { id: 'enterprise-readiness', label: 'Enterprise readiness' },
        { id: 'enterprise-connection-pooling', label: 'Connection pooling' },
        { id: 'enterprise-api-key-expiration', label: 'API key expiration' },
        { id: 'enterprise-pagination', label: 'Pagination' },
        { id: 'enterprise-rate-limiting', label: 'Rate limiting' },
      ],
    },
    {
      label: 'Operations',
      items: [
    { id: 'environment', label: 'Environment variables' },
    { id: 'deployment', label: 'Deployment' },
      ],
    },
  ];

  const skills = DOCS_AGENT_SKILLS;

  return (
    <DocsLayout tocGroups={tocGroups}>
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            {/* Hero */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Developer Documentation</h1>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                Integration and usage guide for developers and anyone in the firm. Use Sandarb for AI governance: approved context, prompts, audit trail, and agent registry.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="#governance-protocol" className="inline-flex items-center rounded-md bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors">
                  Governance Protocol
                </a>
                <a href="#quick-start" className="inline-flex items-center rounded-md bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors">
                  Quick start
                </a>
                <a href="#a2a-skills-reference" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  A2A skills
                </a>
                <a href="#unified-sdk-interface" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  Unified SDK
                </a>
                <a href="#python-integration" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  Python integration
                </a>
                <a href="#security" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  Security
                </a>
                <a href="#enterprise-readiness" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  Enterprise
                </a>
              </div>
            </div>

            <section id="overview" className="scroll-mt-24 pt-6 border-t border-border/40 first:border-t-0 first:pt-0">
          <H2WithAnchor id="overview">Overview</H2WithAnchor>
          <P>
            Sandarb (derived from &quot;Sandarbh&quot; (संदर्भ), a Hindi/Sanskrit word meaning &quot;context,&quot; &quot;reference,&quot; or &quot;connection&quot;) is an AI governance platform: a single place for approved prompts and context, audit trail, lineage, and a living agent registry.
          </P>
          <P>
            Sandarb is designed to fit seamlessly into your existing engineering workflow. Your AI agents and applications integrate via <strong className="text-violet-600 dark:text-violet-400">A2A</strong>, <strong className="text-violet-600 dark:text-violet-400">MCP</strong>, <strong className="text-violet-600 dark:text-violet-400">API</strong>, or <strong className="text-violet-600 dark:text-violet-400">Git</strong>.
          </P>
          <Ul>
            <li><strong className="text-violet-600 dark:text-violet-400">A2A (Agent-to-Agent Protocol)</strong> – Enables your agent to be discovered by the broader AI ecosystem. Other agents can read your &quot;Agent Card&quot; to understand your capabilities and interact with you using standardized skills (like <InlineCode>validate_context</InlineCode> or <InlineCode>get_lineage</InlineCode>) without custom integration code.</li>
            <li><strong className="text-violet-600 dark:text-violet-400">MCP (Model Context Protocol)</strong> – Connect Claude Desktop, Cursor, Windsurf, or any MCP client directly to Sandarb. 22 governance tools exposed via Streamable HTTP transport at <InlineCode>/mcp</InlineCode>.</li>
            <li><strong className="text-violet-600 dark:text-violet-400">API (REST &amp; SDK)</strong> – The runtime fuel for your agents. Use the API to fetch approved Prompts (instructions) and Context (knowledge) instantly during inference. It also handles management tasks like registering new agents, creating organizations, and logging audit trails.</li>
            <li><strong className="text-violet-600 dark:text-violet-400">Git (Governance as Code)</strong> – Manage your Sandarb config and other governance assets like source code in your AI Agents git repo. Inject the config based on your CI/CD and deployment model for AI Agents.</li>
          </Ul>
        </section>

        <section id="prompts-vs-context" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="prompts-vs-context">Prompts vs Context: Governance Perspective</H2WithAnchor>
          <P>
            In AI Governance, <strong className="text-foreground">Prompts</strong> and <strong className="text-foreground">Context</strong> are two distinct asset classes with different risks, lifecycles, and compliance requirements. Think of an AI Agent as a <strong className="text-foreground">digital employee</strong>:
          </P>
          <Ul>
            <li><strong className="text-foreground">Prompts</strong> are the <strong className="text-foreground">&quot;Employee Handbook&quot;</strong> (instructions on how to behave, tone, and rules).</li>
            <li><strong className="text-foreground">Context</strong> is the <strong className="text-foreground">&quot;Reference Library&quot;</strong> (the specific files, user data, or reports the agent is allowed to read to do a task).</li>
          </Ul>

          <H3WithAnchor>1. Prompts (The &quot;Behavior&quot;)</H3WithAnchor>
          <P>
            Prompts are <strong className="text-foreground">instructions</strong>. They define the agent&apos;s persona, logical constraints, and safety boundaries. In governance, prompts are treated like <strong className="text-foreground">source code</strong>.
          </P>
          <P><strong className="text-foreground">Governance Focus:</strong> Behavioral Consistency & Safety.</P>
          <P><strong className="text-foreground">Goal:</strong> Ensure the agent doesn&apos;t sound rude, promise illegal things, or break brand guidelines.</P>
          <P><strong className="text-foreground">The Risk:</strong> Drift & Jailbreaks. A developer changes the prompt to &quot;be more creative,&quot; and suddenly the agent starts making up features you don&apos;t have.</P>
          <P><strong className="text-foreground">How it&apos;s Governed:</strong></P>
          <Ul>
            <li><strong className="text-foreground">Versioning</strong> – Like software (v1.0, v1.1). You must be able to roll back to a previous prompt if the new one fails.</li>
            <li><strong className="text-foreground">Approval Workflows</strong> – A junior dev writes a prompt, but a Product Manager or Compliance Officer must &quot;sign off&quot; before it goes to production.</li>
            <li><strong className="text-foreground">Immutable Testing</strong> – Prompts are tested against &quot;Golden Datasets&quot; (standard questions) to ensure the new version performs as well as the old one.</li>
          </Ul>

          <H3WithAnchor>2. Context (The &quot;Knowledge&quot;)</H3WithAnchor>
          <P>
            Context is <strong className="text-foreground">data</strong>. It is the dynamic information injected into the agent at runtime (via RAG - Retrieval Augmented Generation) to answer a specific question. In governance, context is treated like <strong className="text-foreground">sensitive database records</strong>.
          </P>
          <P><strong className="text-foreground">Governance Focus:</strong> Access Control & Privacy.</P>
          <P><strong className="text-foreground">Goal:</strong> Ensure the &quot;Customer Support Agent&quot; can see Order History but CANNOT see Credit Card Numbers or Employee Salaries.</P>
          <P><strong className="text-foreground">The Risk:</strong> Data Leaks & Contamination. If an agent is given the wrong context (e.g., an outdated policy PDF or a confidential internal memo), it will confidently state incorrect or leaked information to the user.</P>
          <P><strong className="text-foreground">How it&apos;s Governed:</strong></P>
          <Ul>
            <li><strong className="text-foreground">Access Scopes (RBAC)</strong> – Defining strict boundaries (e.g., &quot;This agent can only access documents tagged public-support&quot;).</li>
            <li><strong className="text-foreground">Data Lineage</strong> – Tracking exactly which document chunk was used to generate an answer. If an agent lies, you need to know if it was the prompt&apos;s fault or if the source document was wrong.</li>
            <li><strong className="text-foreground">Sanitization</strong> – Automatically stripping PII (Personally Identifiable Information) from data before it enters the context window.</li>
          </Ul>

          <H3WithAnchor>Comparison Summary</H3WithAnchor>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium">Feature</th>
                  <th className="text-left py-2 px-3 font-medium">Prompts (Instructions)</th>
                  <th className="text-left py-2 px-3 font-medium">Context (Data/Knowledge)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-muted-foreground">Analogy</td>
                  <td className="py-2 px-3">The Job Description</td>
                  <td className="py-2 px-3">The Files in the Cabinet</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-muted-foreground">Change Frequency</td>
                  <td className="py-2 px-3">Low (Weekly/Monthly updates)</td>
                  <td className="py-2 px-3">High (Real-time per user query)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-muted-foreground">Primary Risk</td>
                  <td className="py-2 px-3">Hallucination, Brand Damage, Jailbreaks</td>
                  <td className="py-2 px-3">Data Leakage, Privacy Violation, Outdated Info</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-muted-foreground">Governance Tool</td>
                  <td className="py-2 px-3">Versioning & Approval Workflows</td>
                  <td className="py-2 px-3">Access Control Lists (ACLs) & Vector Management</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-muted-foreground">Audit Question</td>
                  <td className="py-2 px-3">&quot;Who approved this behavior?&quot;</td>
                  <td className="py-2 px-3">&quot;Why did the agent have access to this file?&quot;</td>
                </tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>The Governance Intersection</H3WithAnchor>
          <P>
            In Sandarb, these two meet in the <strong className="text-foreground">Audit Log</strong>. When an incident occurs (e.g., a user complains about a bad answer), AI Governance requires you to reconstruct the exact state of both:
          </P>
          <P className="italic text-muted-foreground pl-4 border-l-2 border-violet-500/50">
            &quot;On Feb 1st at 2:00 PM, Agent X used <strong className="text-foreground">Prompt v4.2</strong> and accessed <strong className="text-foreground">Context Chunk #992 (HR PDF)</strong> to generate this response.&quot;
          </P>
          <P>
            Without governing both, you cannot diagnose whether the error was a failure of <strong className="text-foreground">instruction</strong> (bad prompt) or a failure of <strong className="text-foreground">information</strong> (bad context). Sandarb is built to govern both asset classes with versioning, approval workflows, and lineage tracking.
          </P>
        </section>

        <section id="governance-protocol" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="governance-protocol">The Governance Protocol</H2WithAnchor>
          <P>
            Sandarb is a <strong className="text-foreground">protocol-first</strong> AI governance control plane. It does <strong className="text-foreground">not</strong> act as a gateway or proxy. It follows a <strong className="text-foreground">Registry &amp; Observer</strong> pattern: Worker Agents register with Sandarb, then call it over the Google A2A protocol for prompts, context validation, lineage, and audit.
          </P>

          <H3WithAnchor>Terminology</H3WithAnchor>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium text-foreground">Term</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Definition</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">Worker Agent</td><td className="py-2 px-3">The external AI agent (e.g. customer support bot) that needs governed prompts and context.</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">Governance Agent</td><td className="py-2 px-3">Sandarb. The central authority for approved prompts, context, policy, and audit.</td></tr>
                <tr><td className="py-2 px-3 font-mono text-xs">The Handshake</td><td className="py-2 px-3">The flow of registering, fetching a prompt, and validating context before inference.</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>The Handshake (sequence)</H3WithAnchor>
          <P>Canonical flow from boot to inference and audit. The diagram below is rendered with Mermaid and shows the full handshake: check-in → get_prompt → validate_context → inference → audit_log.</P>
          <div className="w-full">
            <MermaidDiagram chart={HANDSHAKE_MERMAID} title="A2A handshake: Worker Agent, Sandarb, LLM" />
          </div>

          <H3WithAnchor>A2A flow: Example agents → Sandarb AI Governance Agent</H3WithAnchor>
          <P>Multiple Worker Agents (e.g. Support Bot, Trading Bot, Finance Bot) call the Sandarb AI Governance Agent via A2A for prompts, context validation, and audit. Below: an animated view of agents connecting to Sandarb, then the sequence of A2A calls.</P>
          <div className="flex flex-col gap-6 w-full">
            <div className="w-full">
              <MultiAgentA2ADiagram />
            </div>
            <div className="w-full">
              <MermaidDiagram chart={EXAMPLE_AGENTS_A2A_MERMAID} title="A2A: Example agents to Sandarb AI Governance Agent" />
            </div>
          </div>

          <H3WithAnchor>Check-in (registration)</H3WithAnchor>
          <P>Agents must check in at boot by sending their manifest to Sandarb. Use the A2A skill <InlineCode>register</InlineCode> or <InlineCode>POST /api/agents/ping</InlineCode>. Unregistered agents should not get access to company data.</P>
          <DocsCodeBlock label="register input">{`{
  "skillId": "register",
  "input": {
    "manifest": {
      "agent_id": "customer-support-bot",
      "version": "1.2.0",
      "owner_team": "platform",
      "url": "https://agents.example.com/support-bot/a2a",
      "name": "Customer Support Bot",
      "tools_used": ["llm", "kb"],
      "allowed_data_scopes": ["orders", "faq"],
      "pii_handling": true,
      "regulatory_scope": ["GDPR"]
    }
  }
}`}</DocsCodeBlock>

          <H3WithAnchor>Separation of concerns</H3WithAnchor>
          <P><strong className="text-foreground">Prompts (behavior)</strong> – Fetched at runtime via <InlineCode>get_prompt</InlineCode>. Versioned and approval-controlled. <strong className="text-foreground">Context (knowledge)</strong> – Validated before use via <InlineCode>validate_context</InlineCode> or <InlineCode>get_approved_context</InlineCode>; Sandarb logs who pulled what (lineage).</P>
          <P>Governance requires both: versioned prompts + access-controlled context, with a single audit trail (see <a href="#data-model-lineage" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">Data model &amp; lineage</a>).</P>
        </section>

        <section id="unified-sdk-interface" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="unified-sdk-interface">Unified SDK interface</H2WithAnchor>
          <P>
            All Sandarb SDKs (Python, TypeScript/Node, Go, and future Java/Kotlin, C#/.NET) implement the same <strong className="text-foreground">abstract interface</strong>. Consistency across languages ensures predictable behavior and simpler integration.
          </P>

          <H3WithAnchor>Authentication</H3WithAnchor>
          <P>All SDKs authenticate via an <strong className="text-foreground">API Key</strong> that maps to the <InlineCode>service_accounts</InlineCode> table in the Sandarb schema:</P>
          <Ul>
            <li><strong className="text-foreground">Header</strong> – <InlineCode>Authorization: Bearer &lt;api_key&gt;</InlineCode> or <InlineCode>X-API-Key: &lt;api_key&gt;</InlineCode></li>
            <li>The backend resolves the API key to a service account (<InlineCode>client_id</InlineCode> / secret) and associates the request with an <InlineCode>agent_id</InlineCode> for audit and linking checks.</li>
            <li>SDK constructors accept <InlineCode>api_key</InlineCode> (or <InlineCode>token</InlineCode>) and send it on every request.</li>
          </Ul>

          <H3WithAnchor>Required methods</H3WithAnchor>

          <H3WithAnchor>1. get_context(context_name, agent_id) → GetContextResult</H3WithAnchor>
          <P>Fetches the current approved context by name for a given agent. Access is gated by <InlineCode>agent_contexts</InlineCode> (the context must be linked to the agent).</P>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium text-foreground">Parameter</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">context_name</td><td className="py-2 px-3">string</td><td className="py-2 px-3">Unique context name (e.g. trading-limits)</td></tr>
                <tr><td className="py-2 px-3 font-mono text-xs">agent_id</td><td className="py-2 px-3">string</td><td className="py-2 px-3">Calling agent identifier (must match a registered agent)</td></tr>
              </tbody>
            </table>
          </div>
          <P><strong className="text-foreground">Returns:</strong> <InlineCode>content</InlineCode> (object, from <InlineCode>context_versions.content</InlineCode> JSONB) and <InlineCode>context_version_id</InlineCode> (string UUID). Backend: <InlineCode>GET /api/inject?name=...</InlineCode> with headers <InlineCode>X-Sandarb-Agent-ID</InlineCode>, <InlineCode>X-Sandarb-Trace-ID</InlineCode>; response may include <InlineCode>X-Context-Version-ID</InlineCode>.</P>

          <H3WithAnchor>2. get_prompt(prompt_name, variables?) → GetPromptResult</H3WithAnchor>
          <P>Fetches the current approved prompt by name with optional variable substitution. Access is gated by <InlineCode>agent_prompts</InlineCode>.</P>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium text-foreground">Parameter</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">prompt_name</td><td className="py-2 px-3">string</td><td className="py-2 px-3">Unique prompt name (e.g. customer-support-v1)</td></tr>
                <tr><td className="py-2 px-3 font-mono text-xs">variables</td><td className="py-2 px-3">dict (optional)</td><td className="py-2 px-3">Key-value map for {'{{variable}}'} substitution in prompt content</td></tr>
              </tbody>
            </table>
          </div>
          <P><strong className="text-foreground">Returns:</strong> <InlineCode>content</InlineCode> (string, compiled prompt text), <InlineCode>version</InlineCode> (int), <InlineCode>model</InlineCode>, <InlineCode>system_prompt</InlineCode> (optional). Backend: <InlineCode>GET /api/prompts/pull?name=...</InlineCode> with <InlineCode>X-Sandarb-Agent-ID</InlineCode>, <InlineCode>X-Sandarb-Trace-ID</InlineCode>.</P>

          <H3WithAnchor>3. log_activity(agent_id, trace_id, inputs, outputs) → void</H3WithAnchor>
          <P>Writes an access/activity record to <InlineCode>sandarb_access_logs</InlineCode> for audit and lineage. Stores <InlineCode>inputs</InlineCode> and <InlineCode>outputs</InlineCode> in the <InlineCode>metadata</InlineCode> JSONB column.</P>
          <P>Backend: <InlineCode>POST /api/audit/activity</InlineCode> with JSON body <InlineCode>{'{ agent_id, trace_id, inputs, outputs }'}</InlineCode>. Throws on HTTP error.</P>

          <H3WithAnchor>Shared conventions</H3WithAnchor>
          <Ul>
            <li><strong className="text-foreground">Trace ID</strong> – If the client does not provide one, the SDK generates one (e.g. UUID) per request for lineage.</li>
            <li><strong className="text-foreground">Strict typing</strong> – Types align with <InlineCode>contexts</InlineCode>, <InlineCode>context_versions</InlineCode>, <InlineCode>prompts</InlineCode>, <InlineCode>prompt_versions</InlineCode>, <InlineCode>sandarb_access_logs</InlineCode> in <InlineCode>schema/sandarb.sql</InlineCode>.</li>
            <li><strong className="text-foreground">Base URL</strong> – Configurable via <InlineCode>base_url</InlineCode> or <InlineCode>SANDARB_URL</InlineCode> (e.g. <InlineCode>http://localhost:8000</InlineCode> for local; in production use your company&apos;s Sandarb API URL).</li>
          </Ul>
        </section>

        <section id="sdks-python-node-go" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="sdks-python-node-go">SDKs (Python, Node, Go)</H2WithAnchor>
          <P>
            The <InlineCode>sdk/</InlineCode> directory in the repo contains unified SDKs for Python, TypeScript/Node, and Go. Each implements the same interface (see <a href="#unified-sdk-interface" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">Unified SDK interface</a>). Additional SDKs (Java/Kotlin, C#/.NET) and REST/OpenAPI specs can be added under <InlineCode>sdk/</InlineCode> following the same contract.
          </P>

          <H3WithAnchor>Project structure</H3WithAnchor>
          <DocsCodeBlock label="sdk/">{`sdk/
├── UNIFIED_INTERFACE.md   # Abstract interface all SDKs implement
├── README.md              # Build, test, usage
├── python/                # Python SDK (pydantic)
│   ├── pyproject.toml
│   └── sandarb/
│       ├── __init__.py
│       ├── client.py
│       └── models.py
├── node/                  # TypeScript/Node SDK (zod)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── client.ts
│       ├── models.ts
│       └── index.ts
├── go/                    # Go SDK (standard structs)
│   ├── go.mod
│   └── sandarb/
│       ├── client.go
│       └── models.go
└── java/                  # Java SDK (Jackson, Java 11+)
    ├── pom.xml
    └── src/main/java/ai/sandarb/
        ├── SandarbClient.java
        ├── GetContextResult.java
        └── GetPromptResult.java`}</DocsCodeBlock>

          <H3WithAnchor>Build and test</H3WithAnchor>
          <P><strong className="text-foreground">Prerequisites:</strong> Python 3.10+, Node 18+, Go 1.21+, Java 11+ (Maven 3.6+).</P>
          <DocsCodeBlock label="Python">{`cd sdk/python
pip install -e .
# Tests: pytest`}</DocsCodeBlock>
          <DocsCodeBlock label="Node (TypeScript)">{`cd sdk/node
npm install
npm run build
# Tests: npm test`}</DocsCodeBlock>
          <DocsCodeBlock label="Go">{`cd sdk/go
go mod tidy
go build ./...
# Tests: go test ./...`}</DocsCodeBlock>
          <DocsCodeBlock label="Java">{`cd sdk/java
mvn compile
# Tests: mvn test`}</DocsCodeBlock>
          <P>From repo root, run all: <InlineCode>pip install -e sdk/python</InlineCode>; <InlineCode>(cd sdk/node &amp;&amp; npm install &amp;&amp; npm run build)</InlineCode>; <InlineCode>(cd sdk/go &amp;&amp; go mod tidy &amp;&amp; go build ./...)</InlineCode>; <InlineCode>(cd sdk/java &amp;&amp; mvn compile)</InlineCode>.</P>

          <H3WithAnchor>Environment variables</H3WithAnchor>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium text-foreground">Variable</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">SANDARB_URL</td><td className="py-2 px-3">API base URL (e.g. http://localhost:8000 for local; your company&apos;s Sandarb URL in production)</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">SANDARB_API_KEY</td><td className="py-2 px-3">API key for auth (service_accounts)</td></tr>
                <tr><td className="py-2 px-3 font-mono text-xs">SANDARB_AGENT_ID</td><td className="py-2 px-3">Default agent ID for get_prompt / audit</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>Usage examples</H3WithAnchor>
          <H3WithAnchor id="sdks-python">Python</H3WithAnchor>
          <DocsCodeBlock label="Python">{`from sandarb import SandarbClient, GetContextResult, GetPromptResult

client = SandarbClient(base_url="http://localhost:8000", api_key="your-api-key")

ctx = client.get_context("trading-limits", "my-agent-id")
print(ctx.content, ctx.context_version_id)

prompt = client.get_prompt("customer-support-v1", {"user_tier": "gold"}, agent_id="my-agent-id")
print(prompt.content, prompt.version)

client.log_activity("my-agent-id", "trace-123", {"query": "..."}, {"answer": "..."})`}</DocsCodeBlock>
          <H3WithAnchor id="sdks-node">Node</H3WithAnchor>
          <DocsCodeBlock label="TypeScript">{`import { SandarbClient } from "@sandarb/sdk-node";

const client = new SandarbClient({
  baseUrl: "http://localhost:8000",
  apiKey: process.env.SANDARB_API_KEY,
});

const ctx = await client.getContext("trading-limits", "my-agent-id");
const prompt = await client.getPrompt("customer-support-v1", { user_tier: "gold" }, { agentId: "my-agent-id" });
await client.logActivity("my-agent-id", "trace-123", { query: "..." }, { answer: "..." });`}</DocsCodeBlock>
          <H3WithAnchor id="sdks-go">Go</H3WithAnchor>
          <DocsCodeBlock label="Go">{`client := sandarb.NewClient(
  sandarb.WithBaseURL("http://localhost:8000"),
  sandarb.WithAPIKey("your-api-key"),
)
ctx, _ := client.GetContext("trading-limits", "my-agent-id")
prompt, _ := client.GetPrompt("customer-support-v1", map[string]interface{}{"user_tier": "gold"}, "my-agent-id", "")
client.LogActivity("my-agent-id", "trace-123", map[string]interface{}{"query": "..."}, map[string]interface{}{"answer": "..."})`}</DocsCodeBlock>
          <H3WithAnchor id="sdks-java">Java</H3WithAnchor>
          <DocsCodeBlock label="Java">{`SandarbClient client = SandarbClient.builder()
  .baseUrl("http://localhost:8000")
  .apiKey("your-api-key")
  .build();
GetContextResult ctx = client.getContext("trading-limits", "my-agent-id");
GetPromptResult prompt = client.getPrompt("customer-support-v1", Map.of("user_tier", "gold"), "my-agent-id");
client.logActivity("my-agent-id", "trace-123", Map.of("query", "..."), Map.of("answer", "..."));`}</DocsCodeBlock>

          <H3WithAnchor>Backend requirements</H3WithAnchor>
          <Ul>
            <li><strong className="text-foreground">Inject</strong> – <InlineCode>GET /api/inject?name={'{context_name}'}&amp;format=json</InlineCode> with headers <InlineCode>X-Sandarb-Agent-ID</InlineCode>, <InlineCode>X-Sandarb-Trace-ID</InlineCode>. Response may include <InlineCode>X-Context-Version-ID</InlineCode>.</li>
            <li><strong className="text-foreground">Prompts pull</strong> – <InlineCode>GET /api/prompts/pull?name={'{prompt_name}'}</InlineCode> (optional <InlineCode>vars</InlineCode> for variables). Headers: <InlineCode>X-Sandarb-Agent-ID</InlineCode>, <InlineCode>X-Sandarb-Trace-ID</InlineCode>.</li>
            <li><strong className="text-foreground">Activity</strong> – <InlineCode>POST /api/audit/activity</InlineCode> with JSON body <InlineCode>{'{ agent_id, trace_id, inputs, outputs }'}</InlineCode>. Writes to <InlineCode>sandarb_access_logs</InlineCode> with <InlineCode>metadata = {'{ inputs, outputs }'}</InlineCode>.</li>
          </Ul>
          <P>See <InlineCode>sdk/UNIFIED_INTERFACE.md</InlineCode> and <InlineCode>sdk/README.md</InlineCode> in the repo for the full contract and schema reference.</P>
        </section>

        <section id="quick-start" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="quick-start">Quick start</H2WithAnchor>
          <P>Run Sandarb locally (Node 18+, Python 3.10+ for backend):</P>
          <DocsCodeBlock label="Shell">{`# Clone and install
git clone https://github.com/sandarb-ai/sandarb.ai.git
cd sandarb.ai
npm install

# Postgres (required for FastAPI backend; demo data seeded on start)
export DATABASE_URL=postgresql://postgres:sandarb@localhost:5432/sandarb

# Start (Next.js UI on 3000, FastAPI backend on 8000)
./scripts/start-sandarb.sh
# Or: start backend (uvicorn) on 8000, then npm run dev for UI on 3000`}</DocsCodeBlock>
          <P>Set <InlineCode>BACKEND_URL=http://localhost:8000</InlineCode> and <InlineCode>NEXT_PUBLIC_API_URL=http://localhost:8000</InlineCode> in <InlineCode>.env</InlineCode> so the UI fetches prompts, contexts, and agents from the backend.</P>
          <Admonition title="Tip">Open the UI at <InlineCode>http://localhost:3000</InlineCode>. Sign in to see the dashboard, organizations, agents, contexts, and prompts. Use the <strong className="text-foreground">Try Inject API</strong> and <strong className="text-foreground">Try Prompts Pull API</strong> sections below to test the APIs.</Admonition>
        </section>

        <section id="sandarb-json" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="sandarb-json">sandarb.json manifest</H2WithAnchor>
          <P>
            Every AI agent can maintain a <InlineCode>sandarb.json</InlineCode> file in its git repository. This manifest declares the agent&apos;s identity, governance metadata, and which prompts/contexts it needs. On agent startup, it pings Sandarb to <strong className="text-foreground">register</strong> and pull approved <strong className="text-foreground">prompts</strong> and <strong className="text-foreground">context</strong>.
          </P>

          <H3WithAnchor>Why use sandarb.json?</H3WithAnchor>
          <Ul>
            <li><strong className="text-foreground">GitOps for AI Governance</strong> – Your agent&apos;s governance config lives in version control alongside your code. Changes are tracked, reviewed, and auditable.</li>
            <li><strong className="text-foreground">Self-registering agents</strong> – On startup, your agent calls Sandarb with its manifest. Sandarb registers/updates the agent and returns approved prompts and context.</li>
            <li><strong className="text-foreground">Compliance by default</strong> – Declare regulatory scope, data scopes, and PII handling upfront. Sandarb enforces policies based on this metadata.</li>
          </Ul>

          <H3WithAnchor>Manifest schema</H3WithAnchor>
          <DocsCodeBlock label="sandarb.json">{`{
  "agent_id": "kyc-verification-agent",
  "name": "KYC Verification Agent",
  "description": "Performs know-your-customer verification and document checks for onboarding and compliance.",
  "version": "1.2.0",
  "url": "https://agents.example.com/kyc-bot",
  "owner_team": "compliance",
  
  "prompts": ["kyc-verification-agent"],
  "contexts": ["kyc-config", "compliance-policy"],
  
  "tools_used": ["document_ocr", "sanctions_check"],
  "allowed_data_scopes": ["pii", "identity_documents"],
  "pii_handling": true,
  "regulatory_scope": ["FINRA", "GDPR", "AML"]
}`}</DocsCodeBlock>

          <H3WithAnchor>Field reference</H3WithAnchor>
          <div className="rounded-lg border border-border overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Field</th>
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Required</th>
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">agent_id</td><td className="py-2 px-3">Yes</td><td className="py-2 px-3">Unique identifier for this agent (slug format)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">name</td><td className="py-2 px-3">Yes</td><td className="py-2 px-3">Human-readable name</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">description</td><td className="py-2 px-3">No</td><td className="py-2 px-3">What the agent does</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">version</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Semantic version (e.g. 1.2.0)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">url</td><td className="py-2 px-3">Yes</td><td className="py-2 px-3">A2A endpoint URL of this agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">owner_team</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Org slug (maps to organization in Sandarb)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">prompts</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Array of prompt names to pull on startup</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">contexts</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Array of context names to pull on startup</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">tools_used</td><td className="py-2 px-3">No</td><td className="py-2 px-3">MCP tools/capabilities this agent uses</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">allowed_data_scopes</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Data types agent can access (for RBAC)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">pii_handling</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Whether agent processes PII (boolean)</td></tr>
                  <tr><td className="py-2 px-3 font-mono text-xs">regulatory_scope</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Regulatory frameworks (FINRA, GDPR, etc.)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <H3WithAnchor>Startup flow</H3WithAnchor>
          <P>On agent startup, read <InlineCode>sandarb.json</InlineCode> and call Sandarb:</P>
          <DocsCodeBlock label="Startup pseudocode">{`// 1. Read manifest from your repo
const manifest = JSON.parse(fs.readFileSync('sandarb.json'));

// 2. Register with Sandarb (creates or updates agent record)
const registration = await fetch('https://sandarb.example.com/api/agents/ping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(manifest)
});

// 3. Pull approved prompts
for (const promptName of manifest.prompts || []) {
  const prompt = await fetch(\`https://sandarb.example.com/api/prompts/\${promptName}/current\`);
  // Use prompt.content as your system prompt
}

// 4. Pull approved context
for (const contextName of manifest.contexts || []) {
  const ctx = await fetch(\`https://sandarb.example.com/api/inject?name=\${contextName}\`);
  // Inject ctx.content into your agent
}`}</DocsCodeBlock>

          <H3WithAnchor>A2A alternative</H3WithAnchor>
          <P>Instead of REST calls, use the A2A protocol:</P>
          <DocsCodeBlock label="A2A skill calls (24 skills available)">{`// Register via A2A
POST /api/a2a
{ "method": "skills/execute", "params": { "skill": "register", "input": { ...manifest } } }

// List all agents
POST /api/a2a
{ "method": "skills/execute", "params": { "skill": "list_agents", "input": {} } }

// Get prompt via A2A
POST /api/a2a
{ "method": "skills/execute", "params": { "skill": "get_prompt", "input": { "name": "kyc-verification-agent" } } }

// Get context via A2A
POST /api/a2a
{ "method": "skills/execute", "params": { "skill": "get_context", "input": { "name": "kyc-config" } } }

// Get dashboard overview
POST /api/a2a
{ "method": "skills/execute", "params": { "skill": "get_dashboard", "input": {} } }

// Get governance reports
POST /api/a2a
{ "method": "skills/execute", "params": { "skill": "get_reports", "input": {} } }`}</DocsCodeBlock>

          <Admonition title="Governance approval">
            Newly registered agents enter <InlineCode>pending_approval</InlineCode> status. A governance admin must approve the agent in the Sandarb UI before it can access restricted contexts. This ensures only vetted agents operate in production.
          </Admonition>
        </section>

        <section id="rest-api" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="rest-api">REST API</H2WithAnchor>
          <P><strong className="text-foreground">API base URL:</strong> The UI talks to the <strong className="text-foreground">FastAPI backend</strong>. For local development use <InlineCode>http://localhost:8000</InlineCode>; in production use your company&apos;s Sandarb API URL. Set <InlineCode>NEXT_PUBLIC_API_URL</InlineCode> (client) and <InlineCode>BACKEND_URL</InlineCode> (server-side/SSR) so prompts and contexts lists load correctly.</P>
          <H3WithAnchor>Core endpoints</H3WithAnchor>
          <div className="rounded-lg border border-border overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Method</th>
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Endpoint</th>
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/health</td><td className="py-2 px-3">Health check</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/inject?name=...</td><td className="py-2 px-3">Inject context (gated by agent_contexts link)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/prompts/pull?name=...</td><td className="py-2 px-3">Pull prompt by name (gated by agent_prompts link)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/contexts</td><td className="py-2 px-3">List contexts</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/contexts/:id</td><td className="py-2 px-3">Get context by ID</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/prompts</td><td className="py-2 px-3">List prompts</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/prompts/:id</td><td className="py-2 px-3">Get prompt by ID</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents</td><td className="py-2 px-3">List agents</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id</td><td className="py-2 px-3">Get agent by ID</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/contexts</td><td className="py-2 px-3">List contexts linked to agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="POST" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/contexts</td><td className="py-2 px-3">Link context to agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/prompts</td><td className="py-2 px-3">List prompts linked to agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="POST" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/prompts</td><td className="py-2 px-3">Link prompt to agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="POST" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/approve</td><td className="py-2 px-3">Approve agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="POST" /></td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/reject</td><td className="py-2 px-3">Reject agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/organizations</td><td className="py-2 px-3">List organizations</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="POST" /></td><td className="py-2 px-3 font-mono text-xs">/api/organizations</td><td className="py-2 px-3">Create organization</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/templates</td><td className="py-2 px-3">List templates</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/a2a</td><td className="py-2 px-3">A2A Agent Card (discovery)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3"><MethodBadge method="POST" /></td><td className="py-2 px-3 font-mono text-xs">/api/a2a</td><td className="py-2 px-3">A2A skill execution</td></tr>
                  <tr><td className="py-2 px-3"><MethodBadge method="GET" /></td><td className="py-2 px-3 font-mono text-xs">/api/lineage</td><td className="py-2 px-3">Recent context deliveries (lineage)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <P>All mutations and inject support optional audit headers (see <a href="#audit-headers" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">Audit headers</a>).</P>
          <H3WithAnchor id="rest-api-swagger">API Reference (Swagger UI)</H3WithAnchor>
          <P>Use the interactive <strong className="text-foreground">Swagger UI</strong> to explore and test all endpoints. You can point it at <InlineCode>http://localhost:8000</InlineCode> when running locally or at your deployed API URL (e.g. GCP Cloud Run) when testing in production.</P>
          <p className="mb-4">
            <a href="/docs/api" className="inline-flex items-center rounded-md bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors">
              Open API Reference (Swagger UI) →
            </a>
          </p>
        </section>

        <section id="inject" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="inject">Inject API</H2WithAnchor>
          <P>Your AI agent or application fetches approved context by name. Sandarb returns the content only if the context is <strong className="text-foreground">linked to the calling agent</strong> (via <InlineCode>agent_contexts</InlineCode> in the Registry). Requires Agent-ID and Trace-ID for audit. Use <InlineCode>sandarb-context-preview</InlineCode> as Agent ID in the Try API to skip registration and link check for testing.</P>

          <H3WithAnchor>Query parameters</H3WithAnchor>
          <div className="rounded-lg border border-border overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Parameter</th>
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Required</th>
                    <th className="text-left font-semibold text-foreground py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">name</td><td className="py-2 px-3">Yes*</td><td className="py-2 px-3">Context name (use <InlineCode>name</InlineCode> or <InlineCode>id</InlineCode>, not both)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">id</td><td className="py-2 px-3">Yes*</td><td className="py-2 px-3">Context UUID (alternative to name)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">format</td><td className="py-2 px-3">No</td><td className="py-2 px-3">Response format: <InlineCode>json</InlineCode>, <InlineCode>yaml</InlineCode>, or <InlineCode>text</InlineCode> (default: json)</td></tr>
                  <tr><td className="py-2 px-3 font-mono text-xs">vars</td><td className="py-2 px-3">No</td><td className="py-2 px-3">JSON object for {'{{variable}}'} substitution in context content</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <H3WithAnchor>Headers (required for audit)</H3WithAnchor>
          <Ul>
            <li><InlineCode>X-Sandarb-Agent-ID</InlineCode> – Calling agent identifier (required). Use <InlineCode>sandarb-context-preview</InlineCode> for UI test mode (skips policy).</li>
            <li><InlineCode>X-Sandarb-Trace-ID</InlineCode> – Request/correlation ID (required).</li>
            <li><InlineCode>X-Sandarb-Variables</InlineCode> – JSON object for variable substitution (optional).</li>
          </Ul>

          <H3WithAnchor>Response</H3WithAnchor>
          <P>Success: 200 with body as the context content (JSON, YAML, or text per <InlineCode>format</InlineCode>). Errors: 400 (missing name/id or invalid format), 403 (agent not registered or context not linked to agent), 404 (context not found).</P>

          <DocsCodeBlock label="cURL">{`# Replace BASE_URL with your Sandarb API URL (e.g. http://localhost:8000 for local)
curl -H "X-Sandarb-Agent-ID: my-agent" -H "X-Sandarb-Trace-ID: req-123" \\
  "\${BASE_URL}/api/inject?name=ib-trading-limits"

# By name + format
# GET /api/inject?name=my-context&format=json
# GET /api/inject?name=my-context&format=yaml

# Variable substitution (if context has {{variable}} placeholders)
# GET /api/inject?name=my-context&vars={"user_id":"123"}`}</DocsCodeBlock>
        </section>

        <section id="try-inject" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="try-inject">Try Inject API</H2WithAnchor>
          <P>Send a test request to the Inject API. Requests go to the FastAPI backend (use <InlineCode>http://localhost:8000</InlineCode> for local). Ensure the backend is running and <InlineCode>NEXT_PUBLIC_API_URL</InlineCode> / <InlineCode>BACKEND_URL</InlineCode> are set.</P>
          <DocsTryInject />
        </section>

        <section id="prompts-pull" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="prompts-pull">Prompts Pull API</H2WithAnchor>
          <P><strong className="text-foreground">GET /api/prompts/pull?name=...</strong> returns the current approved prompt by name. The prompt is returned only if it is <strong className="text-foreground">linked to the calling agent</strong> (via <InlineCode>agent_prompts</InlineCode> in the Registry). Use <InlineCode>sandarb-prompt-preview</InlineCode> as Agent ID in the Try API to skip registration and link check for testing.</P>
          <H3WithAnchor>Headers (required for audit)</H3WithAnchor>
          <Ul>
            <li><InlineCode>X-Sandarb-Agent-ID</InlineCode> – Calling agent identifier (required). Use <InlineCode>sandarb-prompt-preview</InlineCode> for UI test mode.</li>
            <li><InlineCode>X-Sandarb-Trace-ID</InlineCode> – Request/correlation ID (required).</li>
          </Ul>
          <H3WithAnchor>Response</H3WithAnchor>
          <P>Success: 200 with <InlineCode>{'{ success, data: { name, content, version, model, systemPrompt, ... } }'}</InlineCode>. Errors: 400 (missing headers), 403 (agent not registered or prompt not linked to agent), 404 (prompt not found or no approved version).</P>
          <DocsCodeBlock label="cURL">{`curl -H "X-Sandarb-Agent-ID: my-agent" -H "X-Sandarb-Trace-ID: req-456" \\
  "http://localhost:8000/api/prompts/pull?name=retail-customer-support-playbook"`}</DocsCodeBlock>
        </section>

        <section id="try-prompts-pull" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="try-prompts-pull">Try Prompts Pull API</H2WithAnchor>
          <P>Send a test request to the Prompts Pull API.</P>
          <DocsTryPromptsPull />
        </section>

        {/* ── MCP (Model Context Protocol) ── */}
        <section id="mcp" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="mcp">MCP (Model Context Protocol)</H2WithAnchor>
          <P>
            Sandarb exposes a fully compliant <strong>MCP server</strong> at <InlineCode>/mcp</InlineCode> using the official{' '}
            <a href="https://github.com/modelcontextprotocol/python-sdk" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 underline">mcp Python SDK</a>{' '}
            with <strong>Streamable HTTP transport</strong>. Connect Claude Desktop, Cursor, Windsurf, VS Code Copilot, or any MCP-compatible client directly to Sandarb for governed access to prompts, contexts, and audit lineage.
          </P>
          <P>
            MCP is the open standard for connecting AI assistants to external tools and data sources. Instead of building custom integrations, any MCP client can connect to Sandarb and use its governance tools natively.
          </P>
          <Admonition title="Architecture">
            The MCP server is mounted inside the same FastAPI application as the REST API and A2A endpoints. It reuses the same backend services for contexts, prompts, agents, and audit. No separate process is needed.
          </Admonition>
          <DocsCodeBlock label="Architecture">{`FastAPI app (backend/main.py)
  \u251c\u2500\u2500 /api/*         REST API routers
  \u251c\u2500\u2500 /mcp           MCP server (22 tools, Streamable HTTP transport)
  \u251c\u2500\u2500 /a2a           A2A JSON-RPC endpoint (24 skills)
  \u2514\u2500\u2500 /              Agent Card (when SERVICE_MODE=agent or SANDARB_AGENT_SERVICE=1)`}</DocsCodeBlock>
        </section>

        <section id="mcp-tools" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="mcp-tools">MCP Tools (22 tools)</H2WithAnchor>
          <P>Sandarb exposes 22 governance tools through MCP, organized by category:</P>

          <H3WithAnchor>Agents</H3WithAnchor>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                  <th className="text-left py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>list_agents</InlineCode></td><td className="py-2">List all registered agents, optionally filtered by org or approval status</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_agent</InlineCode></td><td className="py-2">Get detailed info about a specific agent by ID</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_agent_contexts</InlineCode></td><td className="py-2">List all contexts linked to a specific agent</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_agent_prompts</InlineCode></td><td className="py-2">List all prompts linked to a specific agent</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>register_agent</InlineCode></td><td className="py-2">Register a new agent with the governance platform</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>Organizations</H3WithAnchor>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                  <th className="text-left py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>list_organizations</InlineCode></td><td className="py-2">List all organizations</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_organization</InlineCode></td><td className="py-2">Get organization details by UUID or slug</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_organization_tree</InlineCode></td><td className="py-2">Get the full organization hierarchy tree</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>Contexts</H3WithAnchor>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                  <th className="text-left py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>list_contexts</InlineCode></td><td className="py-2">List context names available to your agent</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_context</InlineCode></td><td className="py-2">Get approved context content by name (agent must be linked)</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_context_by_id</InlineCode></td><td className="py-2">Get context details by UUID, including active version content</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_context_revisions</InlineCode></td><td className="py-2">List all revisions (versions) of a context</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>Prompts</H3WithAnchor>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                  <th className="text-left py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>list_prompts</InlineCode></td><td className="py-2">List prompts available to your agent</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_prompt</InlineCode></td><td className="py-2">Get approved prompt content by name (agent must be linked)</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_prompt_by_id</InlineCode></td><td className="py-2">Get prompt details by UUID, including all versions</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_prompt_versions</InlineCode></td><td className="py-2">List all versions of a prompt</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>Audit &amp; Lineage</H3WithAnchor>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                  <th className="text-left py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_lineage</InlineCode></td><td className="py-2">Get recent context delivery audit trail (successful deliveries)</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_blocked_injections</InlineCode></td><td className="py-2">Get blocked/denied context injection attempts</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_audit_log</InlineCode></td><td className="py-2">Get the full A2A audit log (inject, prompt, inference events)</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>Dashboard &amp; Reports</H3WithAnchor>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                  <th className="text-left py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_dashboard</InlineCode></td><td className="py-2">Get aggregated dashboard data (counts, recent activity)</td></tr>
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>get_reports</InlineCode></td><td className="py-2">Get governance reports (risk, regulatory, compliance)</td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor>Validation</H3WithAnchor>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                  <th className="text-left py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30"><td className="py-2 pr-4"><InlineCode>validate_context</InlineCode></td><td className="py-2">Validate context content against governance rules</td></tr>
              </tbody>
            </table>
          </div>

          <P>
            Tools that access governed data require three parameters: <InlineCode>api_key</InlineCode> (your service account key),{' '}
            <InlineCode>source_agent</InlineCode> (your registered agent ID), and <InlineCode>trace_id</InlineCode> (unique trace identifier for audit logging).
          </P>
        </section>

        <section id="mcp-setup" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="mcp-setup">MCP Setup &amp; Configuration</H2WithAnchor>

          <H3WithAnchor>Prerequisites</H3WithAnchor>
          <Ul>
            <li>Sandarb backend running (locally or deployed)</li>
            <li>A registered service account with an API key</li>
            <li>An agent registered in Sandarb and linked to the prompts/contexts it needs access to</li>
          </Ul>

          <H3WithAnchor id="mcp-claude-desktop">Claude Desktop</H3WithAnchor>
          <P>
            Add to your Claude Desktop config file (<InlineCode>~/Library/Application Support/Claude/claude_desktop_config.json</InlineCode> on macOS):
          </P>
          <DocsCodeBlock label="Claude Desktop — Direct (Streamable HTTP)">{`{
  "mcpServers": {
    "sandarb": {
      "url": "${baseUrl}/mcp"
    }
  }
}`}</DocsCodeBlock>
          <DocsCodeBlock label="Claude Desktop — via mcp-remote proxy">{`{
  "mcpServers": {
    "sandarb": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${baseUrl}/mcp"]
    }
  }
}`}</DocsCodeBlock>

          <H3WithAnchor id="mcp-cursor">Cursor / Windsurf</H3WithAnchor>
          <P>Add to your project&apos;s <InlineCode>.cursor/mcp.json</InlineCode>:</P>
          <DocsCodeBlock label="Cursor / Windsurf config">{`{
  "mcpServers": {
    "sandarb": {
      "url": "${baseUrl}/mcp"
    }
  }
}`}</DocsCodeBlock>

          <H3WithAnchor id="mcp-claude-code">Claude Code (CLI)</H3WithAnchor>
          <DocsCodeBlock label="Claude Code CLI">{`claude mcp add sandarb --transport http ${baseUrl}/mcp`}</DocsCodeBlock>

          <H3WithAnchor id="mcp-test-endpoint">Test the endpoint</H3WithAnchor>
          <P>Verify the MCP server is running:</P>
          <DocsCodeBlock label="curl test">{`curl -X POST ${baseUrl}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'`}</DocsCodeBlock>
        </section>

        <section id="mcp-usage" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="mcp-usage">MCP Usage</H2WithAnchor>
          <P>
            Once connected, the AI assistant has access to all Sandarb governance tools. Ask the assistant to use the Sandarb MCP server to perform governance operations:
          </P>
          <DocsCodeBlock label="Example prompts in Claude Desktop">{`# List and inspect agents
"List all registered agents in Sandarb."
"Show me details about the 'finance-bot' agent and what contexts it has access to."

# Organizations
"List all organizations in Sandarb."
"Show me the organization hierarchy tree."

# Contexts & Prompts
"What contexts are available to my agent via Sandarb?"
"Get the approved prompt named 'customer-support'."
"Show me all versions of the 'onboarding-flow' prompt."

# Audit & Compliance
"Show me the recent context delivery audit trail from Sandarb."
"Are there any blocked injection attempts?"
"Show me the full audit log."

# Dashboard & Reports
"Get the Sandarb governance dashboard overview."
"Show me the governance compliance reports."

# Register a new agent
"Register a new agent called 'finance-bot' with Sandarb at http://localhost:9000/a2a."`}</DocsCodeBlock>
          <Admonition title="Authentication">
            Each tool call requires an <InlineCode>api_key</InlineCode>, <InlineCode>source_agent</InlineCode>, and <InlineCode>trace_id</InlineCode>.
            The MCP client will prompt you for these values when calling tools. Create a service account in Sandarb to get your API key, and register your agent to get an agent ID.
          </Admonition>
        </section>

        {/* ── A2A ── */}
        <section id="a2a" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="a2a">A2A protocol</H2WithAnchor>
          <P>
            The <strong className="text-foreground">Agent2Agent (A2A) Protocol</strong> is an open standard (see references below) that enables communication and interoperability between AI agents built on different frameworks and by different vendors. A2A allows agents to discover each other&apos;s capabilities, negotiate interaction modalities, manage collaborative tasks, and securely exchange information without accessing each other&apos;s internal state or tools.
          </P>
          <P>
            <strong className="text-foreground">A2A as the industry standard:</strong> The Agent-to-Agent (A2A) protocol is fast becoming the standard for AI agents to discover, communicate, and collaborate across vendors and frameworks. <strong className="text-foreground">The Sandarb AI Governance Agent is central to this:</strong> Sandarb is an AI agent that participates in A2A. It acts as an <strong className="text-foreground">A2A Server (Remote Agent)</strong> so your agents can call it for governance—they discover Sandarb via its <strong className="text-foreground">Agent Card</strong> and invoke skills to get approved context, validate content, retrieve lineage, or register. Sandarb also communicates with other agents via A2A as a first-class agent, so governance lives inside the same protocol your agents already use.
          </P>

          <H3WithAnchor>How A2A URLs work in practice</H3WithAnchor>
          <Ul>
            <li><strong className="text-foreground">Discovery</strong> – Agent A uses the A2A URL of Agent B to read its capabilities (e.g. <InlineCode>GET /api/a2a</InlineCode> returns the Agent Card).</li>
            <li><strong className="text-foreground">Interaction</strong> – Agent A sends a JSON-RPC 2.0 message over HTTP(S) to that URL to initiate a task (e.g. <InlineCode>POST /api/a2a</InlineCode> with method and params).</li>
            <li><strong className="text-foreground">Real-time updates</strong> – For long-running tasks, the A2A server may use Server-Sent Events (SSE) to send updates back to the client. Sandarb currently responds synchronously; SSE may be added for streaming or long-running flows.</li>
          </Ul>

          <H3WithAnchor>Specification &amp; key concepts</H3WithAnchor>
          <P>For the full protocol specification and terminology (Agent Card, Task, Message, Part, Artifact, transport over HTTP/JSON-RPC, streaming, security), use the official resources:</P>
          <Ul>
            <li><a href="https://google.github.io/A2A/specification/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">A2A Protocol Specification</a> (Google) – transport, Agent Card structure, RPC methods, data objects.</li>
            <li><a href="https://google.github.io/A2A/topics/key-concepts/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">Key concepts</a> – A2A Client, A2A Server, Agent Card, Task, Message, Part, Artifact.</li>
          </Ul>
          <Admonition title="Well-known URI">The spec recommends serving the Agent Card at <InlineCode>/.well-known/agent.json</InlineCode>. Sandarb exposes its Agent Card at <InlineCode>GET /api/a2a</InlineCode> for convenience and consistency with the rest of the API.</Admonition>

          <H3WithAnchor>Discovery (Agent Card)</H3WithAnchor>
          <P>Clients discover Sandarb by fetching its Agent Card. The response is a JSON document describing the agent&apos;s name, description, service URL, version, capabilities, and skills.</P>
          <DocsCodeBlock label="cURL">{`# Replace BASE_URL with your Sandarb API URL (e.g. http://localhost:8000 for local)
curl -s "\${BASE_URL}/api/a2a"`}</DocsCodeBlock>
          <P>Returns the Agent Card (v0.2.0) with <InlineCode>name</InlineCode>, <InlineCode>description</InlineCode>, <InlineCode>url</InlineCode>, <InlineCode>version</InlineCode>, <InlineCode>capabilities</InlineCode>, and <InlineCode>skills</InlineCode> (24 skills across agents, organizations, contexts, prompts, audit, reports, and validation).</P>

          <H3WithAnchor>Skill invocation (JSON-RPC 2.0)</H3WithAnchor>
          <P>Clients send <strong className="text-foreground">POST /api/a2a</strong> with a JSON-RPC 2.0 body. Sandarb requires <InlineCode>Authorization: Bearer &lt;token&gt;</InlineCode>. Use <InlineCode>method: &quot;skills/execute&quot;</InlineCode> with <InlineCode>params: { '{ skill, input }' }</InlineCode> to run a skill. All context requests are logged for lineage and audit.</P>
          <DocsCodeBlock label="POST /api/a2a (skills/execute)">{`{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "skills/execute",
  "params": {
    "skill": "get_context",
    "input": {
      "name": "ib-trading-limits",
      "sourceAgent": "your-registered-agent-id"
    }
  }
}`}</DocsCodeBlock>
          <Admonition title="get_context policy">The <InlineCode>get_context</InlineCode> skill requires <InlineCode>sourceAgent</InlineCode> (calling agent identifier). The agent must be registered and the context must be linked to the agent; otherwise the request fails.</Admonition>
          <P>Other methods: <InlineCode>agent/info</InlineCode> (Agent Card), <InlineCode>skills/list</InlineCode> (list skills). For production, use HTTPS and a valid Bearer token.</P>
        </section>

        <section id="a2a-skills-reference" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="a2a-skills-reference">A2A skills reference</H2WithAnchor>
          <P>Sandarb exposes 24 governance skills via A2A (matching the 22 MCP tools plus 2 discovery skills). Discovery: <InlineCode>GET /api/a2a</InlineCode> returns the Agent Card (name, url, capabilities, skills). Invocation: <InlineCode>POST /api/a2a</InlineCode> with a JSON body containing <InlineCode>skillId</InlineCode> and <InlineCode>input</InlineCode>. The A2A protocol is JSON; Sandarb enforces <strong className="text-foreground">required fields</strong> per skill. Documented fields below are the source of truth.</P>

          <H3WithAnchor>Request envelope (POST /api/a2a)</H3WithAnchor>
          <DocsCodeBlock label="A2A message">{`{
  "messageId": "req-unique-id",
  "parts": [{
    "kind": "data",
    "data": {
      "skillId": "get_prompt",
      "input": { "name": "customer-service-main", "variables": { "user_tier": "gold" } }
    }
  }]
}`}</DocsCodeBlock>

          <H3WithAnchor>Key skills (request &amp; response)</H3WithAnchor>

          <div className="mb-6 rounded-lg border border-border bg-muted/10 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-1 font-mono">get_prompt</h4>
            <p className="text-sm text-muted-foreground mb-2">Retrieves the current approved prompt by name, with optional <strong className="text-foreground">variable interpolation</strong> (e.g. placeholders like <InlineCode>{'{{user_tier}}'}</InlineCode> in prompt content are replaced from <InlineCode>variables</InlineCode>).</p>
            <p className="text-xs font-medium text-muted-foreground mb-1">Request: <InlineCode>name</InlineCode> (required), <InlineCode>variables</InlineCode> (optional object).</p>
            <DocsCodeBlock label="Response">{`{
  "name": "customer-service-main",
  "content": "You are a helpful assistant for Gold tier users...",
  "version": 4,
  "model": "gpt-4-turbo",
  "systemPrompt": null,
  "temperature": null,
  "maxTokens": null
}`}</DocsCodeBlock>
          </div>

          <div className="mb-6 rounded-lg border border-border bg-muted/10 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-1 font-mono">validate_context</h4>
            <p className="text-sm text-muted-foreground mb-2">Checks that a context exists and returns its current approved content. Sandarb logs who asked (lineage). Validation respects <strong className="text-foreground">regulatory hooks</strong> (FINRA, SEC, GDPR) defined on the context; access and lineage are recorded for compliance.</p>
            <p className="text-xs font-medium text-muted-foreground mb-1">Request: <InlineCode>name</InlineCode> (required), <InlineCode>sourceAgent</InlineCode>, <InlineCode>intent</InlineCode> (optional).</p>
            <DocsCodeBlock label="Response">{`{
  "approved": true,
  "name": "gdpr-handling-policy",
  "content": { ... },
  "hasPendingRevisions": false
}`}</DocsCodeBlock>
          </div>

          <div className="mb-6 rounded-lg border border-border bg-muted/10 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-1 font-mono">register</h4>
            <p className="text-sm text-muted-foreground mb-2">Check-in: send your Sandarb manifest (e.g. from <InlineCode>sandarb.json</InlineCode>). Creates or updates the agent in the registry. Required: <InlineCode>manifest.agent_id</InlineCode>, <InlineCode>manifest.version</InlineCode>, <InlineCode>manifest.owner_team</InlineCode>, <InlineCode>manifest.url</InlineCode>.</p>
            <DocsCodeBlock label="Response">{`{ "id": "uuid", "agentId": "my-bot", "name": "My Bot", "approvalStatus": "pending_approval" }`}</DocsCodeBlock>
          </div>

          <div className="mb-6 rounded-lg border border-border bg-muted/10 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-1 font-mono">audit_log</h4>
            <p className="text-sm text-muted-foreground mb-2">Logs an event for compliance. Required: <InlineCode>eventType</InlineCode>. Optional: <InlineCode>resourceType</InlineCode>, <InlineCode>resourceId</InlineCode>, <InlineCode>resourceName</InlineCode>, <InlineCode>sourceAgent</InlineCode>, <InlineCode>details</InlineCode>.</p>
            <DocsCodeBlock label="Response">{`{ "logged": true, "eventType": "inference" }`}</DocsCodeBlock>
          </div>

          <div className="mb-6 rounded-lg border border-border bg-muted/10 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-1 font-mono">mcp_poll_agent</h4>
            <p className="text-sm text-muted-foreground mb-2">Pull-based monitoring: Sandarb (as MCP client) queries a Worker Agent (MCP server) for its tools, resources, and optional state. Sandarb can actively reach out to agents via MCP to see what tools they use—no push logging required from the agent. Input: <InlineCode>agentId</InlineCode> (registered) or <InlineCode>mcpUrl</InlineCode> (direct), optional <InlineCode>timeoutMs</InlineCode>.</p>
            <DocsCodeBlock label="Response">{`{
  "tools": [ { "name": "search_kb", "description": "..." } ],
  "resources": [ { "uri": "sandarb://...", "name": "..." } ],
  "state": {},
  "error": null
}`}</DocsCodeBlock>
          </div>

          <H3WithAnchor>All skills (summary)</H3WithAnchor>
          <P>Each skill has required and optional input fields; see the Agent Card (<InlineCode>GET /api/a2a</InlineCode>) for full schemas.</P>
          {skills.map((s) => {
            const schema = s.inputSchema as { required?: string[]; properties?: Record<string, { type?: string; description?: string }> } | undefined;
            const required = schema?.required ?? [];
            const props = schema?.properties ?? {};
            return (
              <div key={s.id} className="mb-6 rounded-lg border border-border bg-muted/10 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-1 font-mono">{s.id}</h4>
                <p className="text-sm text-muted-foreground mb-2">{s.description}</p>
                <p className="text-xs font-medium text-muted-foreground mb-1">Input</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5 mb-2">
                  {required.length > 0 && (
                    <li>Required: <span className="font-mono">{required.join(', ')}</span></li>
                  )}
                  {Object.entries(props).map(([k, v]) => (
                    <li key={k}><span className="font-mono">{k}</span>{required.includes(k) ? ' (required)' : ''}: {(v as { description?: string }).description ?? v.type ?? '—'}</li>
                  ))}
                </ul>
                <DocsCodeBlock label={`Example: ${s.id}`}>{`{ "skillId": "${s.id}", "input": { ${required.map((r) => `"${r}": "<value>"`).join(', ')} } }`}</DocsCodeBlock>
              </div>
            );
          })}
        </section>

        <section id="python-integration" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="python-integration">Python integration</H2WithAnchor>
          <P>Use the <strong className="text-foreground">Sandarb Python Client SDK</strong> in <InlineCode>sdk/python/sandarb_client.py</InlineCode>. Copy the file into your project; <InlineCode>pip install requests</InlineCode> is the only dependency. The SDK handles Check-in and Audit Push automatically.</P>

          <H3WithAnchor>Install</H3WithAnchor>
          <DocsCodeBlock label="Shell">{`pip install -r sdk/python/requirements.txt
# or: pip install requests`}</DocsCodeBlock>

          <H3WithAnchor>Quick start</H3WithAnchor>
          <DocsCodeBlock label="Python">{`import os
from sandarb_client import SandarbClient

sandarb = SandarbClient(
    os.environ.get("SANDARB_URL", "http://localhost:8000"),
    token=os.environ.get("SANDARB_TOKEN"),
)

# 1. Check-in on startup
sandarb.check_in(manifest)

# 2. Get prompt (with optional variable interpolation)
prompt = sandarb.get_prompt("my-agent-v1", variables={"user_tier": "gold"})
system_message = prompt["content"]

# 3. Validate context before use
ctx = sandarb.validate_context("trading-limits", intent="pre-trade")
if not ctx["approved"]:
    raise ValueError("Context not approved")

# 4. Run your agent (Sandarb is NOT in the path)...
# 5. Audit push
sandarb.audit("inference", details={"response_length": 120})`}</DocsCodeBlock>

          <H3WithAnchor>SDK API</H3WithAnchor>
          <P><InlineCode>check_in(manifest)</InlineCode> · <InlineCode>audit(event_type, **kwargs)</InlineCode> · <InlineCode>get_prompt(name, variables=None)</InlineCode> · <InlineCode>validate_context(name, **kwargs)</InlineCode> · <InlineCode>get_context(name, **kwargs)</InlineCode> · <InlineCode>call(skill_id, input_data)</InlineCode></P>
          <P>Full guide and raw A2A format: <a href="https://github.com/sandarb-ai/sandarb.ai/blob/main/docs/guides/python-integration.md" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">docs/guides/python-integration.md</a> and <InlineCode>sdk/python/README.md</InlineCode>.</P>
          <P>For REST context-only: <InlineCode>GET /api/inject?name=my-context</InlineCode> with headers <InlineCode>X-Sandarb-Agent-ID</InlineCode> and <InlineCode>X-Sandarb-Trace-ID</InlineCode>. See <a href="#inject" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">Inject API</a>.</P>
        </section>

        <section id="try-a2a" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="try-a2a">Try A2A</H2WithAnchor>
          <P>Send a test <InlineCode>skills/execute</InlineCode> request to your Sandarb API (e.g. <InlineCode>http://localhost:8000</InlineCode> for local). You need a valid Bearer token for authenticated calls.</P>
          <DocsTryA2a skills={skills} />
        </section>

        <section id="data-model-lineage" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="data-model-lineage">Data model &amp; lineage</H2WithAnchor>
          <P><strong className="text-foreground">Lineage</strong> in Sandarb is the record of who requested which context (or prompt) and when. It is key for compliance and incident response.</P>
          <Ul>
            <li><InlineCode>trace_id</InlineCode> – Request/correlation ID. Every inject, prompt pull, and A2A call should send a stable trace ID. Stored in access logs and lineage entries. Use the same trace_id across a single user request to reconstruct the full chain.</li>
            <li><InlineCode>agent_id</InlineCode> – Calling agent identifier. Identifies which Worker Agent pulled the prompt or context; required for inject and for skills like <InlineCode>get_context</InlineCode> (<InlineCode>sourceAgent</InlineCode>).</li>
          </Ul>
          <H3WithAnchor>Compliance fields</H3WithAnchor>
          <P>From Sandarb&apos;s data model (<InlineCode>types/index.ts</InlineCode>):</P>
          <Ul>
            <li><strong className="text-foreground">Organization</strong> – Context can be associated with an organization (<InlineCode>orgId</InlineCode>) for filtering and display. Access is gated by agent–context linking only.</li>
            <li><strong className="text-foreground">DataClassification</strong> – <InlineCode>public</InlineCode> | <InlineCode>internal</InlineCode> | <InlineCode>confidential</InlineCode> | <InlineCode>restricted</InlineCode>. For MNPI and access control.</li>
            <li><strong className="text-foreground">RegulatoryHook</strong> – <InlineCode>FINRA</InlineCode> | <InlineCode>SEC</InlineCode> | <InlineCode>GDPR</InlineCode>. Marks contexts subject to specific regulatory logging; audit and lineage support &quot;why did the agent have access to this?&quot; for exams.</li>
          </Ul>
          <Admonition title="Why it matters">If you tag a context as <strong className="text-foreground">confidential</strong>, Sandarb logs will flag any access by an agent with public scope. Policy and audit stay in sync with these fields.</Admonition>
        </section>

        <section id="security" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="security">Security</H2WithAnchor>
          <H3WithAnchor>Manifest-based registration</H3WithAnchor>
          <P>Every agent that should use governed prompts and context <strong className="text-foreground">registers</strong> with Sandarb by sending a Sandarb manifest. Unregistered agents should not be granted access to company data.</P>
          <P><strong className="text-foreground">Drop a <InlineCode>sandarb.json</InlineCode> in your agent&apos;s repo.</strong> When the agent boots, it pings Sandarb with this manifest (via the A2A skill <InlineCode>register</InlineCode> or <InlineCode>POST /api/agents/ping</InlineCode>). That makes onboarding feel like &quot;declare once, run anywhere.&quot;</P>
          <H3WithAnchor>Shadow AI discovery</H3WithAnchor>
          <P>Even if developers forget to register their agents, Sandarb can <strong className="text-foreground">actively scan</strong> your internal network (or a list of known endpoints) to discover agents that look like A2A or MCP servers and are <strong className="text-foreground">not</strong> in the registry.</P>
          <P>Sandarb&apos;s <InlineCode>runDiscoveryScan()</InlineCode> (backend governance) probes scan targets and compares discovered agent identities to the agent registry. If an agent is found at a URL but not registered, Sandarb records it in <InlineCode>unauthenticated_detections</InlineCode> for security or platform teams to review and either register or shut down.</P>
          <P><strong className="text-foreground">Summary:</strong> Manifest / <InlineCode>register</InlineCode> ensures only registered (and when required, approved) agents get access. Discovery scan finds agents that never registered so you can remediate.</P>
        </section>

        <section id="contexts-agents" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="contexts-agents">Contexts & agents</H2WithAnchor>
          <P><strong className="text-foreground">Contexts</strong> are named, versioned blobs of configuration (e.g. trading limits, suitability policy). Create and edit in the UI or via API. Use Inject or A2A <InlineCode>get_context</InlineCode> to pull into your agent.</P>
          <P><strong className="text-foreground">Agents</strong> are registered in Sandarb (by manifest ping or API). Each organization has unique agents (<InlineCode>UNIQUE(org_id, agent_id)</InlineCode>). Approved agents can request context and prompts only if they are <strong className="text-foreground">linked</strong>: link contexts to an agent via <InlineCode>POST /api/agents/:id/contexts</InlineCode> and prompts via <InlineCode>POST /api/agents/:id/prompts</InlineCode>. The Inject API and Prompts Pull API return content only when the resource is linked to the calling agent (or when using preview Agent IDs for testing).</P>
          <P><strong className="text-foreground">Organizations</strong> – Root org is created on first run. Organization names must be unique. Create sub-orgs and attach agents to them.</P>
        </section>

        <section id="templates" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="templates">Templates for context</H2WithAnchor>
          <P><strong className="text-foreground">Templates</strong> define a reusable structure for context content. Each template has a <strong className="text-foreground">schema</strong> (JSON Schema describing the shape of context <InlineCode>content</InlineCode>) and optional <strong className="text-foreground">default values</strong>. When you create a context, you link it to a template via <InlineCode>templateId</InlineCode> so the context follows that structure—agents and validators can rely on a known shape.</P>
          <P><strong className="text-foreground">Why templates help:</strong></P>
          <Ul>
            <li><strong className="text-foreground">Consistency</strong> – All contexts of the same type (e.g. trading limits) share the same fields and types so agents and validators can rely on a known shape.</li>
            <li><strong className="text-foreground">Governance</strong> – Linking a context to a template documents which schema it conforms to, supporting compliance and audit.</li>
            <li><strong className="text-foreground">Faster authoring</strong> – New contexts can be pre-filled from a template&apos;s default values and guided to include the right fields.</li>
          </Ul>

          <H3WithAnchor>Example 1: Trading limits template</H3WithAnchor>
          <P>A template defines the schema for &quot;trading desk limits&quot; context. Every context that uses this template has <InlineCode>varLimit</InlineCode>, <InlineCode>singleNameLimit</InlineCode>, and optional <InlineCode>desk</InlineCode>.</P>
          <DocsCodeBlock label="Template schema (trading-limits-template)">{`{
  "type": "object",
  "properties": {
    "varLimit": { "type": "number", "description": "Daily VaR limit (USD)" },
    "singleNameLimit": { "type": "number", "description": "Max exposure per issuer (USD)" },
    "desk": { "type": "string", "enum": ["equities", "fixed_income", "fx", "commodities"] }
  },
  "required": ["varLimit", "singleNameLimit"]
}`}</DocsCodeBlock>
          <P>A context linked to this template might have content like:</P>
          <DocsCodeBlock label="Context content (e.g. ib-trading-limits)">{`{
  "varLimit": 5000000,
  "singleNameLimit": 500000,
  "desk": "equities"
}`}</DocsCodeBlock>
          <P>Your agent fetches this context via <InlineCode>get_context(&quot;ib-trading-limits&quot;)</InlineCode> or the Inject API; the returned <InlineCode>content</InlineCode> conforms to the template schema so your agent can safely use <InlineCode>content.varLimit</InlineCode> and <InlineCode>content.singleNameLimit</InlineCode>.</P>

          <H3WithAnchor>Example 2: Compliance policy template</H3WithAnchor>
          <P>A template for compliance policy context: policy name, effective date, regulatory hooks, KYC flag.</P>
          <DocsCodeBlock label="Template schema (compliance-policy-template)">{`{
  "type": "object",
  "properties": {
    "policy": { "type": "string", "description": "Policy name" },
    "effectiveDate": { "type": "string", "description": "YYYY-MM-DD" },
    "regulatoryHooks": { "type": "array", "items": { "type": "string" }, "description": "e.g. BSA, FINRA, GDPR" },
    "kycRequired": { "type": "boolean" }
  },
  "required": ["policy", "effectiveDate"]
}`}</DocsCodeBlock>
          <DocsCodeBlock label="Default values">{`{ "kycRequired": true }`}</DocsCodeBlock>
          <P>A context created from this template can be pre-filled with <InlineCode>kycRequired: true</InlineCode>; authors supply <InlineCode>policy</InlineCode> and <InlineCode>effectiveDate</InlineCode>.</P>

          <H3WithAnchor>Example 3: Prompt + context together</H3WithAnchor>
          <P>Your prompt instructs the agent to use governed context. The agent fetches the prompt, then fetches context by name; the context content is shaped by its template.</P>
          <DocsCodeBlock label="Flow">{`# 1. Get prompt (e.g. "finance-bot" says: "Use the trading limits context for pre-trade checks")
prompt = sandarb.get_prompt("finance-bot")
# 2. Get context whose content conforms to trading-limits-template
ctx = sandarb.get_context("ib-trading-limits")
# 3. Use content in your logic (known shape: varLimit, singleNameLimit, desk)
if order_value > ctx["content"]["singleNameLimit"]:
    reject("Exceeds single-name limit")
`}</DocsCodeBlock>

          <P>Sample templates (seeded via <InlineCode>POST /api/seed</InlineCode>): compliance-policy-template, trading-limits-template. View under <strong className="text-foreground">Templates</strong> in the app or <InlineCode>GET /api/templates</InlineCode>.</P>

          <Admonition title="Feature status">Templates for context are currently in progress. Full support (e.g. validation of context content against template schema at create/update, template-driven UI for context authoring) will be released in a future version of Sandarb. The schema and templateId linkage are in place today; enhanced tooling and enforcement are coming next.</Admonition>
        </section>

        <section id="audit-headers" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="audit-headers">Audit headers</H2WithAnchor>
          <P>Optional headers for inject and API calls so Sandarb can record lineage (who requested what, when):</P>
          <Ul>
            <li><InlineCode>X-Sandarb-Agent-ID</InlineCode> – Identifier of the calling agent.</li>
            <li><InlineCode>X-Sandarb-Trace-ID</InlineCode> – Request/correlation ID for tracing.</li>
          </Ul>
          <H3WithAnchor>Example</H3WithAnchor>
          <DocsCodeBlock label="cURL">{`# Replace BASE_URL with your Sandarb API URL (e.g. http://localhost:8000 for local)
curl -H "X-Sandarb-Agent-ID: my-agent" -H "X-Sandarb-Trace-ID: req-123" \\
  "\${BASE_URL}/api/inject?name=my-context"`}</DocsCodeBlock>
        </section>

        <section id="enterprise-readiness" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="enterprise-readiness">Enterprise Readiness</H2WithAnchor>
          <P>Sandarb is built for production enterprise workloads. The platform includes features for high-availability, secure multi-tenant operation, and compliance at scale.</P>

          <H3WithAnchor id="enterprise-connection-pooling">Database connection pooling</H3WithAnchor>
          <P>The backend uses <InlineCode>psycopg2.ThreadedConnectionPool</InlineCode> for concurrent request handling without connection contention. Connections are automatically returned to the pool after each request and the pool is gracefully closed on shutdown.</P>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
              <thead className="bg-muted/30"><tr>
                <th className="text-left px-4 py-2 font-semibold text-foreground border-b border-border/40">Setting</th>
                <th className="text-left px-4 py-2 font-semibold text-foreground border-b border-border/40">Default</th>
                <th className="text-left px-4 py-2 font-semibold text-foreground border-b border-border/40">Environment Variable</th>
              </tr></thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/20"><td className="px-4 py-2">Min pool connections</td><td className="px-4 py-2">2</td><td className="px-4 py-2"><InlineCode>DB_POOL_MIN</InlineCode></td></tr>
                <tr className="border-b border-border/20"><td className="px-4 py-2">Max pool connections</td><td className="px-4 py-2">10</td><td className="px-4 py-2"><InlineCode>DB_POOL_MAX</InlineCode></td></tr>
                <tr><td className="px-4 py-2">Connection timeout</td><td className="px-4 py-2">10s</td><td className="px-4 py-2"><InlineCode>DB_CONNECT_TIMEOUT</InlineCode></td></tr>
              </tbody>
            </table>
          </div>

          <H3WithAnchor id="enterprise-api-key-expiration">API key expiration</H3WithAnchor>
          <P>Service account API keys support an optional <InlineCode>expires_at</InlineCode> timestamp. When set, the key is automatically rejected after expiry with a <InlineCode>401 Unauthorized</InlineCode> response (REST API) or JSON-RPC error code (A2A). Keys without an expiration date remain valid indefinitely.</P>
          <DocsCodeBlock label="SQL: Set expiry on a service account">{`-- Set a key to expire in 90 days
UPDATE service_accounts
  SET expires_at = NOW() + INTERVAL '90 days'
  WHERE client_id = 'my-service';

-- Remove expiration (never expires)
UPDATE service_accounts
  SET expires_at = NULL
  WHERE client_id = 'my-service';`}</DocsCodeBlock>
          <Admonition title="Best practice">Rotate API keys regularly and set expiration dates on all production service accounts. Expired keys are immediately rejected; no grace period is applied.</Admonition>

          <H3WithAnchor id="enterprise-pagination">Pagination</H3WithAnchor>
          <P>All list endpoints (REST API, A2A skills, and MCP tools) support <InlineCode>limit</InlineCode> and <InlineCode>offset</InlineCode> parameters for paginated responses. The default page size is 50 items, with a maximum of 500 per request.</P>
          <DocsCodeBlock label="Paginated REST response">{`GET /api/agents?limit=50&offset=0

{
  "success": true,
  "data": {
    "agents": [ ... ],
    "total": 951,
    "limit": 50,
    "offset": 0
  }
}`}</DocsCodeBlock>
          <DocsCodeBlock label="Paginated A2A skill call">{`POST /a2a
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "skills/execute",
  "params": {
    "skill": "list_agents",
    "input": {
      "sourceAgent": "my-agent",
      "traceId": "trace-123",
      "limit": 50,
      "offset": 100
    }
  }
}`}</DocsCodeBlock>
          <P><strong className="text-foreground">Paginated endpoints:</strong> <InlineCode>/api/agents</InlineCode>, <InlineCode>/api/organizations</InlineCode>, <InlineCode>/api/prompts</InlineCode>, <InlineCode>/api/contexts</InlineCode>, and all A2A list/get skills.</P>

          <H3WithAnchor id="enterprise-rate-limiting">Per-skill A2A rate limiting</H3WithAnchor>
          <P>A2A skills are rate-limited by tier using a <strong className="text-foreground">sliding window</strong> algorithm, applied per API key. This protects the platform from abuse while allowing legitimate high-volume integrations.</P>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
              <thead className="bg-muted/30"><tr>
                <th className="text-left px-4 py-2 font-semibold text-foreground border-b border-border/40">Tier</th>
                <th className="text-left px-4 py-2 font-semibold text-foreground border-b border-border/40">Skills</th>
                <th className="text-left px-4 py-2 font-semibold text-foreground border-b border-border/40">Default</th>
                <th className="text-left px-4 py-2 font-semibold text-foreground border-b border-border/40">Env Var</th>
              </tr></thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/20"><td className="px-4 py-2">Discovery</td><td className="px-4 py-2"><InlineCode>agent/info</InlineCode>, <InlineCode>skills/list</InlineCode>, <InlineCode>validate_context</InlineCode></td><td className="px-4 py-2">Unlimited</td><td className="px-4 py-2">&mdash;</td></tr>
                <tr className="border-b border-border/20"><td className="px-4 py-2">List</td><td className="px-4 py-2"><InlineCode>list_agents</InlineCode>, <InlineCode>list_organizations</InlineCode>, <InlineCode>list_contexts</InlineCode>, <InlineCode>list_prompts</InlineCode></td><td className="px-4 py-2">30/min</td><td className="px-4 py-2"><InlineCode>RATE_LIMIT_A2A_LIST</InlineCode></td></tr>
                <tr className="border-b border-border/20"><td className="px-4 py-2">Get</td><td className="px-4 py-2"><InlineCode>get_agent</InlineCode>, <InlineCode>get_context</InlineCode>, <InlineCode>get_prompt</InlineCode>, etc.</td><td className="px-4 py-2">60/min</td><td className="px-4 py-2"><InlineCode>RATE_LIMIT_A2A_GET</InlineCode></td></tr>
                <tr className="border-b border-border/20"><td className="px-4 py-2">Audit</td><td className="px-4 py-2"><InlineCode>get_lineage</InlineCode>, <InlineCode>get_blocked_injections</InlineCode>, <InlineCode>get_audit_log</InlineCode></td><td className="px-4 py-2">10/min</td><td className="px-4 py-2"><InlineCode>RATE_LIMIT_A2A_AUDIT</InlineCode></td></tr>
                <tr className="border-b border-border/20"><td className="px-4 py-2">Reports</td><td className="px-4 py-2"><InlineCode>get_dashboard</InlineCode>, <InlineCode>get_reports</InlineCode></td><td className="px-4 py-2">10/min</td><td className="px-4 py-2"><InlineCode>RATE_LIMIT_A2A_REPORTS</InlineCode></td></tr>
                <tr><td className="px-4 py-2">Register</td><td className="px-4 py-2"><InlineCode>register</InlineCode></td><td className="px-4 py-2">5/min</td><td className="px-4 py-2"><InlineCode>RATE_LIMIT_A2A_REGISTER</InlineCode></td></tr>
              </tbody>
            </table>
          </div>
          <P>When a rate limit is exceeded, the A2A endpoint returns <InlineCode>429 Too Many Requests</InlineCode> with a <InlineCode>retry_after</InlineCode> field in the response metadata. REST API rate limiting is handled separately by <strong className="text-foreground">slowapi</strong> (see <a href="#security" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">Security</a>).</P>
          <DocsCodeBlock label="Environment: customize rate limits">{`# A2A per-skill rate limits (requests per minute)
RATE_LIMIT_A2A_LIST=30
RATE_LIMIT_A2A_GET=60
RATE_LIMIT_A2A_AUDIT=10
RATE_LIMIT_A2A_REPORTS=10
RATE_LIMIT_A2A_REGISTER=5

# REST API rate limits
RATE_LIMIT_DEFAULT=100/minute
RATE_LIMIT_SEED=5/hour
RATE_LIMIT_AUTH=20/minute

# Connection pooling
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_CONNECT_TIMEOUT=10`}</DocsCodeBlock>
        </section>

        <section id="environment" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="environment">Environment variables</H2WithAnchor>
          <P>Set <InlineCode>NEXT_PUBLIC_API_URL</InlineCode> (client and build) and <InlineCode>BACKEND_URL</InlineCode> (server-side/SSR) so the UI can reach the FastAPI backend. For local development use <InlineCode>http://localhost:8000</InlineCode>; in production use your company&apos;s Sandarb API URL. Without these, prompts and contexts lists may be empty.</P>
          <DocsCodeBlock label=".env">{`# Database (PostgreSQL, required for FastAPI backend)
DATABASE_URL=postgresql://user:pass@host:5432/sandarb

# Backend URL (required for UI to load prompts/contexts/agents from FastAPI)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AGENT_URL=http://localhost:8000
BACKEND_URL=http://localhost:8000

# Override when deployed (use your company's Sandarb API and UI URLs)
# NEXT_PUBLIC_API_URL=https://your-sandarb-api.example.com
# NEXT_PUBLIC_AGENT_URL=https://your-sandarb-agent.example.com

# Server
PORT=3000
NODE_ENV=production`}</DocsCodeBlock>
        </section>

        <section id="deployment" className="scroll-mt-24 pt-6 border-t border-border/40">
          <H2WithAnchor id="deployment">Deployment</H2WithAnchor>
          <P>Docker: build and run with <InlineCode>docker compose up -d</InlineCode> (Postgres + app). Demo data is seeded on container start when <InlineCode>DATABASE_URL</InlineCode> is set.</P>
          <P>GCP Cloud Run: use <InlineCode>./scripts/deploy-gcp.sh PROJECT_ID</InlineCode>. In production, host the API behind your load balancer or a dedicated server and set <InlineCode>NEXT_PUBLIC_API_URL</InlineCode> / <InlineCode>BACKEND_URL</InlineCode> to that URL. See <Link href="https://github.com/sandarb-ai/sandarb.ai/blob/main/docs/deploy-gcp.md" className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2">docs/deploy-gcp.md</Link> for permissions, Cloud SQL, and IAM.</P>
        </section>

            <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-3">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </Link>
              <a href="https://github.com/sandarb-ai/sandarb.ai" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  Repository
                </Button>
              </a>
            </div>
          </div>
    </DocsLayout>
  );
}
