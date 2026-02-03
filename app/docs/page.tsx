import Link from 'next/link';
import { headers } from 'next/headers';
import { BookOpen, ChevronRight, ExternalLink, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Developer documentation - Sandarb',
  description:
    'Developer integration and usage guide for Sandarb: API, A2A protocol, inject API, contexts, agents, and deployment.',
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 mb-4 text-lg font-semibold text-foreground border-l-4 border-violet-500 pl-4 scroll-mt-20">{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground scroll-mt-20">{children}</h3>
);
const P = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-sm text-muted-foreground mb-4 leading-relaxed ${className ?? ''}`}>{children}</p>
);
function CodeBlock({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="mb-5 rounded-lg border border-border bg-muted/50 overflow-hidden">
      {label && (
        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/80">
          {label}
        </div>
      )}
      <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}
const InlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-xs font-mono text-violet-800 dark:text-violet-200">{children}</code>
);
const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc list-outside pl-5 text-sm text-muted-foreground space-y-2 mb-4 leading-relaxed">{children}</ul>
);
function Note({ children, title = 'Note' }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="my-4 rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-900/10 p-4">
      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
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

  const tocItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'prompts-vs-context', label: 'Prompts vs Context' },
    { id: 'quick-start', label: 'Quick start' },
    { id: 'sandarb-json', label: 'sandarb.json manifest' },
    { id: 'rest-api', label: 'API' },
    { id: 'inject', label: 'Inject API' },
    { id: 'a2a', label: 'A2A protocol' },
    { id: 'contexts-agents', label: 'Contexts & agents' },
    { id: 'templates', label: 'Templates for context' },
    { id: 'audit-headers', label: 'Audit headers' },
    { id: 'environment', label: 'Environment variables' },
    { id: 'deployment', label: 'Deployment' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0" aria-hidden />
            <span className="font-medium text-foreground" aria-current="page">
              Documentation
            </span>
          </nav>
          <a href="#quick-start" className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline hidden sm:inline">
            Quick start
          </a>
        </div>
      </header>
      <div className="flex flex-1 min-h-0 flex-row">
        {/* Left panel: sticky TOC */}
        <aside className="shrink-0 w-56 lg:w-64 border-r border-border bg-muted/20 min-h-0 overflow-y-auto hidden sm:block">
          <nav className="sticky top-[52px] p-4 py-6">
            <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-3">On this page</p>
            <ul className="space-y-0.5">
              {tocItems.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block text-sm text-muted-foreground hover:text-foreground py-2 px-3 rounded-md hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        {/* Right panel: documentation content (scrollable) */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 lg:py-10">
            {/* Hero */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Developer documentation</h1>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                Integration and usage guide for developers and anyone in the firm. Use Sandarb for AI governance: approved context, prompts, audit trail, and agent registry.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="#quick-start" className="inline-flex items-center rounded-md bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors">
                  Quick start
                </a>
                <a href="#sandarb-json" className="inline-flex items-center rounded-md bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors">
                  sandarb.json
                </a>
                <a href="#rest-api" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  API
                </a>
                <a href="#inject" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  Inject API
                </a>
                <a href="#a2a" className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                  A2A protocol
                </a>
              </div>
            </div>

            <section id="overview" className="scroll-mt-24">
          <H2>Overview</H2>
          <P>
            Sandarb is an AI governance platform: a single place for approved prompts and context, audit trail, lineage, and a living agent registry. Your AI agents and applications integrate via <strong className="text-violet-600 dark:text-violet-400">API</strong>, <strong className="text-violet-600 dark:text-violet-400">A2A</strong>, or <strong className="text-foreground">Inject API</strong>. Sandarb also runs as an A2A agent so other agents can call it for validation and approved context.
          </P>
          <Ul>
            <li><strong className="text-violet-600 dark:text-violet-400">API</strong> – CRUD for organizations, agents, contexts, templates; inject context by name.</li>
            <li><strong className="text-violet-600 dark:text-violet-400">A2A</strong> – Discovery (Agent Card) and skills: <InlineCode>get_context</InlineCode>, <InlineCode>validate_context</InlineCode>, <InlineCode>get_lineage</InlineCode>, <InlineCode>register</InlineCode>.</li>
            <li><strong className="text-foreground">Inject</strong> – <InlineCode>GET /api/inject?name=...</InlineCode> returns approved context (JSON/YAML/text) for your agent.</li>
            <li><strong className="text-violet-600 dark:text-violet-400">Git-like</strong> – Propose revisions; approve/reject in the UI. Version history for compliance.</li>
          </Ul>
        </section>

        <section id="prompts-vs-context" className="scroll-mt-24">
          <H2>Prompts vs Context: Governance Perspective</H2>
          <P>
            In AI Governance, <strong className="text-foreground">Prompts</strong> and <strong className="text-foreground">Context</strong> are two distinct asset classes with different risks, lifecycles, and compliance requirements. Think of an AI Agent as a <strong className="text-foreground">digital employee</strong>:
          </P>
          <Ul>
            <li><strong className="text-foreground">Prompts</strong> are the <strong className="text-foreground">&quot;Employee Handbook&quot;</strong> (instructions on how to behave, tone, and rules).</li>
            <li><strong className="text-foreground">Context</strong> is the <strong className="text-foreground">&quot;Reference Library&quot;</strong> (the specific files, user data, or reports the agent is allowed to read to do a task).</li>
          </Ul>

          <H3>1. Prompts (The &quot;Behavior&quot;)</H3>
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

          <H3>2. Context (The &quot;Knowledge&quot;)</H3>
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

          <H3>Comparison Summary</H3>
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

          <H3>The Governance Intersection</H3>
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

        <section id="quick-start" className="scroll-mt-24">
          <H2>Quick start</H2>
          <P>Run Sandarb locally (Node 18+):</P>
          <CodeBlock label="Shell">{`# Clone and install
git clone https://github.com/openint-ai/sandarb.ai.git
cd sandarb.ai
npm install

# Optional: Postgres (demo data seeded on start)
export DATABASE_URL=postgresql://postgres:sandarb@localhost:5432/sandarb-dev

# Start (UI on 4000, API on 4001)
./scripts/start-sandarb.sh
# Or: npm run dev`}</CodeBlock>
          <Note title="Tip">Open the UI at <InlineCode>http://localhost:4000</InlineCode>. Sign in to see the dashboard, organizations, agents, and contexts.</Note>
        </section>

        <section id="sandarb-json" className="scroll-mt-24">
          <H2>sandarb.json manifest</H2>
          <P>
            Every AI agent can maintain a <InlineCode>sandarb.json</InlineCode> file in its git repository. This manifest declares the agent&apos;s identity, governance metadata, and which prompts/contexts it needs. On agent startup, it pings Sandarb to <strong className="text-foreground">register</strong> and pull approved <strong className="text-foreground">prompts</strong> and <strong className="text-foreground">context</strong>.
          </P>

          <H3>Why use sandarb.json?</H3>
          <Ul>
            <li><strong className="text-foreground">GitOps for AI Governance</strong> – Your agent&apos;s governance config lives in version control alongside your code. Changes are tracked, reviewed, and auditable.</li>
            <li><strong className="text-foreground">Self-registering agents</strong> – On startup, your agent calls Sandarb with its manifest. Sandarb registers/updates the agent and returns approved prompts and context.</li>
            <li><strong className="text-foreground">Compliance by default</strong> – Declare regulatory scope, data scopes, and PII handling upfront. Sandarb enforces policies based on this metadata.</li>
          </Ul>

          <H3>Manifest schema</H3>
          <CodeBlock label="sandarb.json">{`{
  "agent_id": "kyc-verification-bot",
  "name": "KYC Verification Bot",
  "description": "Document verification and identity checking",
  "version": "1.2.0",
  "url": "https://agents.example.com/kyc-bot",
  "owner_team": "compliance",
  
  "prompts": ["kyc-verification-agent"],
  "contexts": ["kyc-config", "compliance-policy"],
  
  "tools_used": ["document_ocr", "sanctions_check"],
  "allowed_data_scopes": ["pii", "identity_documents"],
  "pii_handling": true,
  "regulatory_scope": ["FINRA", "GDPR", "AML"]
}`}</CodeBlock>

          <H3>Field reference</H3>
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

          <H3>Startup flow</H3>
          <P>On agent startup, read <InlineCode>sandarb.json</InlineCode> and call Sandarb:</P>
          <CodeBlock label="Startup pseudocode">{`// 1. Read manifest from your repo
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
}`}</CodeBlock>

          <H3>A2A alternative</H3>
          <P>Instead of REST calls, use the A2A protocol:</P>
          <CodeBlock label="A2A skill calls">{`// Register via A2A
POST /api/a2a
{ "skill": "register", "input": { ...manifest } }

// Get prompt via A2A
POST /api/a2a
{ "skill": "get_prompt", "input": { "name": "kyc-verification-agent" } }

// Get context via A2A
POST /api/a2a
{ "skill": "get_context", "input": { "name": "kyc-config" } }`}</CodeBlock>

          <Note title="Governance approval">
            Newly registered agents enter <InlineCode>pending_approval</InlineCode> status. A governance admin must approve the agent in the Sandarb UI before it can access restricted contexts. This ensures only vetted agents operate in production.
          </Note>
        </section>

        <section id="rest-api" className="scroll-mt-24">
          <H2>API</H2>
          <P>Base URL: same origin as the UI (e.g. <InlineCode>{baseUrl}</InlineCode>). When running locally with two servers, set <InlineCode>NEXT_PUBLIC_API_URL=http://localhost:4001</InlineCode> so the UI calls the API port.</P>
          <H3>Core endpoints</H3>
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
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/health</td><td className="py-2 px-3">Health check</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/inject?name=...</td><td className="py-2 px-3">Inject context (see Inject API)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/contexts</td><td className="py-2 px-3">List contexts</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/contexts/:id</td><td className="py-2 px-3">Get context by ID</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">POST</td><td className="py-2 px-3 font-mono text-xs">/api/contexts</td><td className="py-2 px-3">Create context</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/agents</td><td className="py-2 px-3">List agents</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id</td><td className="py-2 px-3">Get agent by ID</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">POST</td><td className="py-2 px-3 font-mono text-xs">/api/agents/register</td><td className="py-2 px-3">Register agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">POST</td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/approve</td><td className="py-2 px-3">Approve agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">POST</td><td className="py-2 px-3 font-mono text-xs">/api/agents/:id/reject</td><td className="py-2 px-3">Reject agent</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/organizations</td><td className="py-2 px-3">List organizations</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">POST</td><td className="py-2 px-3 font-mono text-xs">/api/organizations</td><td className="py-2 px-3">Create organization</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/templates</td><td className="py-2 px-3">List templates</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/a2a</td><td className="py-2 px-3">A2A Agent Card (discovery)</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2 px-3 font-mono text-xs">POST</td><td className="py-2 px-3 font-mono text-xs">/api/a2a</td><td className="py-2 px-3">A2A skill execution</td></tr>
                  <tr><td className="py-2 px-3 font-mono text-xs">GET</td><td className="py-2 px-3 font-mono text-xs">/api/lineage</td><td className="py-2 px-3">Recent context deliveries (lineage)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <P>All mutations and inject support optional audit headers (see <a href="#audit-headers" className="text-violet-600 dark:text-violet-400 hover:underline">Audit headers</a>).</P>
        </section>

        <section id="inject" className="scroll-mt-24">
          <H2>Inject API</H2>
          <P>Your AI agent or application fetches approved context by name. Sandarb returns the content and logs the request for lineage.</P>
          <CodeBlock label="cURL">{`# By name (recommended)
GET /api/inject?name=ib-trading-limits

# By name + format
GET /api/inject?name=my-context&format=json
GET /api/inject?name=my-context&format=yaml
GET /api/inject?name=my-context&format=text

# Variable substitution (if context has {{variable}} placeholders)
GET /api/inject?name=my-context&vars={"user_id":"123"}`}</CodeBlock>
          <P>Optional headers: <InlineCode>X-Sandarb-Agent-ID</InlineCode>, <InlineCode>X-Sandarb-Trace-ID</InlineCode>, <InlineCode>X-Sandarb-Variables</InlineCode> (JSON).</P>
        </section>

        <section id="a2a" className="scroll-mt-24">
          <H2>A2A protocol</H2>
          <P>
            The <strong className="text-foreground">Agent2Agent (A2A) Protocol</strong> is an open standard (see references below) that enables communication and interoperability between AI agents built on different frameworks and by different vendors. A2A allows agents to discover each other&apos;s capabilities, negotiate interaction modalities, manage collaborative tasks, and securely exchange information without accessing each other&apos;s internal state or tools.
          </P>
          <P>
            <strong className="text-foreground">Sandarb as an A2A Server:</strong> Sandarb implements the A2A protocol as an <strong className="text-foreground">A2A Server (Remote Agent)</strong>. Your AI agents act as <strong className="text-foreground">A2A Clients</strong> when they call Sandarb for governance: they discover Sandarb via its <strong className="text-foreground">Agent Card</strong> and invoke skills to get approved context, validate content, retrieve lineage, or register.
          </P>

          <H3>How A2A URLs work in practice</H3>
          <Ul>
            <li><strong className="text-foreground">Discovery</strong> – Agent A uses the A2A URL of Agent B to read its capabilities (e.g. <InlineCode>GET /api/a2a</InlineCode> returns the Agent Card).</li>
            <li><strong className="text-foreground">Interaction</strong> – Agent A sends a JSON-RPC 2.0 message over HTTP(S) to that URL to initiate a task (e.g. <InlineCode>POST /api/a2a</InlineCode> with method and params).</li>
            <li><strong className="text-foreground">Real-time updates</strong> – For long-running tasks, the A2A server may use Server-Sent Events (SSE) to send updates back to the client. Sandarb currently responds synchronously; SSE may be added for streaming or long-running flows.</li>
          </Ul>

          <H3>Specification &amp; key concepts</H3>
          <P>For the full protocol specification and terminology (Agent Card, Task, Message, Part, Artifact, transport over HTTP/JSON-RPC, streaming, security), use the official resources:</P>
          <Ul>
            <li><a href="https://google.github.io/A2A/specification/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">A2A Protocol Specification</a> (Google) – transport, Agent Card structure, RPC methods, data objects.</li>
            <li><a href="https://google.github.io/A2A/topics/key-concepts/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">Key concepts</a> – A2A Client, A2A Server, Agent Card, Task, Message, Part, Artifact.</li>
          </Ul>
          <Note title="Well-known URI">The spec recommends serving the Agent Card at <InlineCode>/.well-known/agent.json</InlineCode>. Sandarb exposes its Agent Card at <InlineCode>GET /api/a2a</InlineCode> for convenience and consistency with the rest of the API.</Note>

          <H3>Discovery (Agent Card)</H3>
          <P>Clients discover Sandarb by fetching its Agent Card. The response is a JSON document describing the agent&apos;s name, description, service URL, version, capabilities, and skills.</P>
          <CodeBlock label="cURL">{`curl -s "${baseUrl}/api/a2a"`}</CodeBlock>
          <P>Returns the Agent Card with <InlineCode>name</InlineCode>, <InlineCode>description</InlineCode>, <InlineCode>url</InlineCode>, <InlineCode>version</InlineCode>, <InlineCode>capabilities</InlineCode>, and <InlineCode>skills</InlineCode> (get_context, validate_context, get_lineage, register).</P>

          <H3>Skill invocation</H3>
          <P>A2A Clients send HTTP POST requests to Sandarb&apos;s A2A endpoint with a JSON body specifying the skill and input. Sandarb processes the request and returns a JSON-RPC-style response. All context requests are logged for lineage and audit.</P>
          <CodeBlock label="POST /api/a2a">{`# POST /api/a2a
# Content-Type: application/json
# Body: { "skill": "get_context", "input": { "name": "ib-trading-limits" } }

# Skills offered by Sandarb (governance):
# - get_context      – Retrieve approved context by name (lineage logged)
# - validate_context – Validate context content against policy
# - get_lineage      – Recent context deliveries for an agent/trace
# - register         – Register an agent (manifest: agent_id, version, owner_team, url)`}</CodeBlock>
          <P>For production, use HTTPS and follow the specification&apos;s authentication and security guidance (e.g. credentials via HTTP headers, TLS).</P>
        </section>

        <section id="contexts-agents" className="scroll-mt-24">
          <H2>Contexts & agents</H2>
          <P><strong className="text-foreground">Contexts</strong> are named, versioned blobs of configuration (e.g. trading limits, suitability policy). Create and edit in the UI or via API. Use Inject or A2A <InlineCode>get_context</InlineCode> to pull into your agent.</P>
          <P><strong className="text-foreground">Agents</strong> are registered in Sandarb (by manifest ping or API). Approved agents can request context; unregistered agents can be blocked by policy. Register via <InlineCode>POST /api/agents/register</InlineCode> or A2A <InlineCode>register</InlineCode> skill with a manifest.</P>
          <P><strong className="text-foreground">Organizations</strong> – Root org is created on first run. Create sub-orgs and attach agents to them.</P>
        </section>

        <section id="templates" className="scroll-mt-24">
          <H2>Templates for context</H2>
          <P><strong className="text-foreground">Templates</strong> define a reusable structure for context content. Each template has a <strong className="text-foreground">schema</strong> (JSON Schema describing the shape of context <InlineCode>content</InlineCode>) and optional <strong className="text-foreground">default values</strong>. When you create a context, you can link it to a template via <InlineCode>templateId</InlineCode> so the context follows that structure.</P>
          <P><strong className="text-foreground">Why templates help:</strong></P>
          <Ul>
            <li><strong className="text-foreground">Consistency</strong> – All contexts of the same type (e.g. trading limits) share the same fields and types so agents and validators can rely on a known shape.</li>
            <li><strong className="text-foreground">Governance</strong> – Linking a context to a template documents which schema it conforms to, supporting compliance and audit.</li>
            <li><strong className="text-foreground">Faster authoring</strong> – New contexts can be pre-filled from a template&apos;s default values and guided to include the right fields.</li>
          </Ul>
          <P>Sample templates (seeded via <InlineCode>POST /api/seed</InlineCode>): compliance policy, trading limits, suitability policy, KYC config, disclosure policy. View them under <strong className="text-foreground">Templates</strong> in the app or <InlineCode>GET /api/templates</InlineCode>.</P>
          <CodeBlock label="Example: trading limits template schema">{`{
  "type": "object",
  "properties": {
    "policy": { "type": "string", "description": "Policy name" },
    "varLimit": { "type": "number", "description": "VAR limit" },
    "singleNameLimit": { "type": "number", "description": "Single-name limit" },
    "effectiveDate": { "type": "string" }
  },
  "required": ["policy"]
}`}</CodeBlock>
        </section>

        <section id="audit-headers" className="scroll-mt-24">
          <H2>Audit headers</H2>
          <P>Optional headers for inject and API calls so Sandarb can record lineage (who requested what, when):</P>
          <Ul>
            <li><InlineCode>X-Sandarb-Agent-ID</InlineCode> – Identifier of the calling agent.</li>
            <li><InlineCode>X-Sandarb-Trace-ID</InlineCode> – Request/correlation ID for tracing.</li>
          </Ul>
          <H3>Example</H3>
          <CodeBlock label="cURL">{`curl -H "X-Sandarb-Agent-ID: my-agent" -H "X-Sandarb-Trace-ID: req-123" "${baseUrl}/api/inject?name=my-context"`}</CodeBlock>
        </section>

        <section id="environment" className="scroll-mt-24">
          <H2>Environment variables</H2>
          <CodeBlock label=".env">{`# Database (optional; default: SQLite at ./data/sandarb.db)
DATABASE_URL=postgresql://user:pass@host:5432/sandarb-dev

# When UI and API run on different ports (e.g. 4000 and 4001)
NEXT_PUBLIC_API_URL=http://localhost:4001

# Server
PORT=3000
NODE_ENV=production`}</CodeBlock>
        </section>

        <section id="deployment" className="scroll-mt-24">
          <H2>Deployment</H2>
          <P>Docker: build and run with <InlineCode>docker compose up -d</InlineCode> (Postgres + app). Demo data is seeded on container start when <InlineCode>DATABASE_URL</InlineCode> is set.</P>
          <P>GCP Cloud Run: use <InlineCode>./scripts/deploy-gcp.sh PROJECT_ID</InlineCode>. See <Link href="https://github.com/openint-ai/sandarb.ai/blob/main/docs/deploy-gcp.md" className="text-violet-600 dark:text-violet-400 hover:underline">docs/deploy-gcp.md</Link> for permissions, Cloud SQL, and IAM.</P>
        </section>

            <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-3">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </Link>
              <a href="https://github.com/openint-ai/sandarb.ai" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  Repository
                </Button>
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
