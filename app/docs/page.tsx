import Link from 'next/link';
import { headers } from 'next/headers';
import { BookOpen, ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Developer documentation - Sandarb',
  description:
    'Developer integration and usage guide for Sandarb: REST API, A2A protocol, inject API, contexts, agents, and deployment.',
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 mb-3 text-base font-semibold text-foreground border-b border-border pb-1">{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground">{children}</h3>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground mb-3">{children}</p>
);
const CodeBlock = ({ children }: { children: React.ReactNode }) => (
  <pre className="bg-muted rounded-lg p-4 text-xs font-mono text-foreground overflow-x-auto mb-4">
    <code>{children}</code>
  </pre>
);
const InlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{children}</code>
);
const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">{children}</ul>
);

export default async function DocsPage() {
  const headersList = headers();
  const host = headersList.get('host') || '';
  const protocol = headersList.get('x-forwarded-proto') || 'http';
  const baseUrl = host ? `${protocol}://${host}` : 'https://your-sandarb.example.com';

  const tocItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'quick-start', label: 'Quick start' },
    { id: 'rest-api', label: 'REST API' },
    { id: 'inject', label: 'Inject API' },
    { id: 'a2a', label: 'A2A protocol' },
    { id: 'contexts-agents', label: 'Contexts & agents' },
    { id: 'audit-headers', label: 'Audit headers' },
    { id: 'environment', label: 'Environment variables' },
    { id: 'deployment', label: 'Deployment' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
      <div className="flex flex-1 min-h-0 flex-row">
        {/* Left panel: sticky TOC */}
        <aside className="shrink-0 w-52 sm:w-56 lg:w-64 border-r border-border bg-muted/30 min-h-0 overflow-y-auto">
          <nav className="sticky top-0 p-4 py-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents</p>
            <ul className="space-y-0.5">
              {tocItems.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block text-sm text-muted-foreground hover:text-foreground py-2 px-3 rounded-md hover:bg-muted/60 transition-colors"
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
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-6 w-6 text-violet-500 shrink-0" />
              <h1 className="text-xl font-semibold text-foreground">Developer documentation</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-8">
              Integration and usage guide for developers and anyone in the firm. Use Sandarb for AI governance: approved context, prompts, audit trail, and agent registry.
            </p>

            <section id="overview" className="scroll-mt-4">
          <H2>Overview</H2>
          <P>
            Sandarb is an AI governance platform: a single place for approved prompts and context, audit trail, lineage, and a living agent registry. Your AI agents and applications integrate via <strong className="text-foreground">REST API</strong>, <strong className="text-foreground">A2A protocol</strong>, or <strong className="text-foreground">Inject API</strong>. Sandarb also runs as an A2A agent so other agents can call it for validation and approved context.
          </P>
          <Ul>
            <li><strong className="text-foreground">REST API</strong> – CRUD for organizations, agents, contexts, templates; inject context by name.</li>
            <li><strong className="text-foreground">A2A</strong> – Discovery (Agent Card) and skills: <InlineCode>get_context</InlineCode>, <InlineCode>validate_context</InlineCode>, <InlineCode>get_lineage</InlineCode>, <InlineCode>register</InlineCode>.</li>
            <li><strong className="text-foreground">Inject</strong> – <InlineCode>GET /api/inject?name=...</InlineCode> returns approved context (JSON/YAML/text) for your agent.</li>
            <li><strong className="text-foreground">Git-like</strong> – Propose revisions; approve/reject in the UI. Version history for compliance.</li>
          </Ul>
        </section>

        <section id="quick-start" className="scroll-mt-4">
          <H2>Quick start</H2>
          <P>Run Sandarb locally (Node 18+):</P>
          <CodeBlock>{`# Clone and install
git clone https://github.com/openint-ai/sandarb.ai.git
cd sandarb.ai
npm install

# Optional: Postgres (demo data seeded on start)
export DATABASE_URL=postgresql://postgres:sandarb@localhost:5432/sandarb-dev

# Start (UI on 4000, API on 4001)
./scripts/start-sandarb.sh
# Or: npm run dev`}</CodeBlock>
          <P>Open the UI at <InlineCode>http://localhost:4000</InlineCode>. Use <strong className="text-foreground">Try the demo</strong> to sign in (demo session lasts 24 hours). After sign-in you see the dashboard, organizations, agents, and contexts.</P>
        </section>

        <section id="rest-api" className="scroll-mt-4">
          <H2>REST API</H2>
          <P>Base URL: same origin as the UI (e.g. <InlineCode>{baseUrl}</InlineCode>). When running locally with two servers, set <InlineCode>NEXT_PUBLIC_API_URL=http://localhost:4001</InlineCode> so the UI calls the API port.</P>
          <H3>Core endpoints</H3>
          <CodeBlock>{`GET  /api/health                    # Health check
GET  /api/inject?name=my-context     # Inject context (see Inject API)
GET  /api/contexts                   # List contexts
GET  /api/contexts/:id               # Get context by ID
POST /api/contexts                   # Create context (body: name, content, ...)
GET  /api/agents                     # List agents
GET  /api/agents/:id                 # Get agent by ID
POST /api/agents/register            # Register agent (body: orgId, name, a2aUrl, ...)
POST /api/agents/:id/approve         # Approve agent
POST /api/agents/:id/reject          # Reject agent
GET  /api/organizations              # List organizations
POST /api/organizations              # Create organization
GET  /api/templates                  # List templates
GET  /api/a2a                        # A2A Agent Card (discovery)
POST /api/a2a                        # A2A skill execution (JSON body)
GET  /api/lineage                    # Recent context deliveries (lineage)`}</CodeBlock>
          <P>All mutations and inject support optional audit headers (see Audit headers).</P>
        </section>

        <section id="inject" className="scroll-mt-4">
          <H2>Inject API</H2>
          <P>Your AI agent or application fetches approved context by name. Sandarb returns the content and logs the request for lineage.</P>
          <CodeBlock>{`# By name (recommended)
GET /api/inject?name=ib-trading-limits

# By name + format
GET /api/inject?name=my-context&format=json
GET /api/inject?name=my-context&format=yaml
GET /api/inject?name=my-context&format=text

# Variable substitution (if context has {{variable}} placeholders)
GET /api/inject?name=my-context&vars={"user_id":"123"}`}</CodeBlock>
          <P>Optional headers: <InlineCode>X-Sandarb-Agent-ID</InlineCode>, <InlineCode>X-Sandarb-Trace-ID</InlineCode>, <InlineCode>X-Sandarb-Variables</InlineCode> (JSON).</P>
        </section>

        <section id="a2a" className="scroll-mt-4">
          <H2>A2A protocol</H2>
          <P>
            Sandarb implements the <a href="https://a2a.dev" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">A2A protocol</a>. Other agents discover Sandarb via <InlineCode>GET /api/a2a</InlineCode> (Agent Card) and call skills via <InlineCode>POST /api/a2a</InlineCode>.
          </P>
          <H3>Discovery</H3>
          <CodeBlock>{`curl -s "${baseUrl}/api/a2a"`}</CodeBlock>
          <P>Returns the Agent Card (name, description, url, version, capabilities, skills).</P>
          <H3>Skill invocation</H3>
          <CodeBlock>{`# POST /api/a2a
# Body: { "skill": "get_context", "input": { "name": "ib-trading-limits" } }

# Skills:
# - get_context    – Retrieve context by name (lineage logged)
# - validate_context – Validate context content
# - get_lineage    – Recent context deliveries for an agent/trace
# - register       – Register an agent (manifest with agent_id, version, owner_team, url)`}</CodeBlock>
          <P>See <a href="https://a2a-protocol.org/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">a2a-protocol.org</a> and <a href="https://a2a.dev" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">a2a.dev</a> for the full spec.</P>
        </section>

        <section id="contexts-agents" className="scroll-mt-4">
          <H2>Contexts & agents</H2>
          <P><strong className="text-foreground">Contexts</strong> are named, versioned blobs of configuration (e.g. trading limits, suitability policy). Create and edit in the UI or via API. Use Inject or A2A <InlineCode>get_context</InlineCode> to pull into your agent.</P>
          <P><strong className="text-foreground">Agents</strong> are registered in Sandarb (by manifest ping or API). Approved agents can request context; unregistered agents can be blocked by policy. Register via <InlineCode>POST /api/agents/register</InlineCode> or A2A <InlineCode>register</InlineCode> skill with a manifest.</P>
          <P><strong className="text-foreground">Organizations</strong> – Root org is created on first run. Create sub-orgs and attach agents to them.</P>
        </section>

        <section id="audit-headers" className="scroll-mt-4">
          <H2>Audit headers</H2>
          <P>Optional headers for inject and API calls so Sandarb can record lineage (who requested what, when):</P>
          <Ul>
            <li><InlineCode>X-Sandarb-Agent-ID</InlineCode> – Identifier of the calling agent.</li>
            <li><InlineCode>X-Sandarb-Trace-ID</InlineCode> – Request/correlation ID for tracing.</li>
          </Ul>
          <P>Example: <InlineCode>curl -H "X-Sandarb-Agent-ID: my-agent" -H "X-Sandarb-Trace-ID: req-123" "{baseUrl}/api/inject?name=my-context"</InlineCode></P>
        </section>

        <section id="environment" className="scroll-mt-4">
          <H2>Environment variables</H2>
          <CodeBlock>{`# Database (optional; default: SQLite at ./data/sandarb.db)
DATABASE_URL=postgresql://user:pass@host:5432/sandarb-dev

# When UI and API run on different ports (e.g. 4000 and 4001)
NEXT_PUBLIC_API_URL=http://localhost:4001

# Server
PORT=3000
NODE_ENV=production`}</CodeBlock>
        </section>

        <section id="deployment" className="scroll-mt-4">
          <H2>Deployment</H2>
          <P>Docker: build and run with <InlineCode>docker compose up -d</InlineCode> (Postgres + app). Demo data is seeded on container start when <InlineCode>DATABASE_URL</InlineCode> is set.</P>
          <P>GCP Cloud Run: use <InlineCode>./scripts/deploy-gcp.sh PROJECT_ID</InlineCode>. See <Link href="https://github.com/openint-ai/sandarb.ai/blob/main/docs/deploy-gcp.md" className="text-violet-600 dark:text-violet-400 hover:underline">docs/deploy-gcp.md</Link> for permissions, Cloud SQL, and IAM.</P>
        </section>

            <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-3">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
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
