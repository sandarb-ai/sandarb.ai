import Link from 'next/link';
import { FileCheck, GitBranch, Code, Bot, GitMerge, BookOpen, Shield, ArrowRight, Github, LayoutDashboard, Network, Lock, Eye, ScrollText, Cpu, Workflow, ShieldCheck, FileKey, Fingerprint, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Sandarb - AI Governance for AI Agents',
  description:
    'Manage and govern your AI Agents prompts and context in a protocol first approach (think A2A, MCP, API and Git). Every request tracked; lineage and audit built in and automated reports for AI Governance.',
};

/* Floating background icons — hero section, edges & corners only (clear center for text) */
const bgIcons = [
  // Top-left cluster
  { Icon: Bot,          top: '4%',  left: '2%',   size: 52, rotate: -15 },
  { Icon: Network,      top: '6%',  left: '18%',  size: 44, rotate: 10 },
  { Icon: Shield,       top: '25%', left: '3%',   size: 48, rotate: 12 },
  { Icon: ShieldCheck,  top: '22%', left: '16%',  size: 40, rotate: -8 },
  // Top-right cluster
  { Icon: FileCheck,    top: '5%',  left: '80%',  size: 48, rotate: 18 },
  { Icon: Lock,         top: '3%',  left: '93%',  size: 52, rotate: -12 },
  { Icon: Workflow,     top: '24%', left: '82%',  size: 44, rotate: -15 },
  { Icon: Cpu,          top: '20%', left: '94%',  size: 40, rotate: 20 },
  // Mid-left
  { Icon: Code,         top: '48%', left: '2%',   size: 48, rotate: -10 },
  { Icon: ScrollText,   top: '50%', left: '15%',  size: 44, rotate: 22 },
  { Icon: Eye,          top: '42%', left: '8%',   size: 40, rotate: 8 },
  // Mid-right
  { Icon: Radio,        top: '46%', left: '88%',  size: 48, rotate: 14 },
  { Icon: Bot,          top: '50%', left: '94%',  size: 44, rotate: -18 },
  { Icon: Fingerprint,  top: '44%', left: '82%',  size: 40, rotate: -6 },
  // Bottom-left cluster
  { Icon: GitMerge,     top: '72%', left: '3%',   size: 52, rotate: 16 },
  { Icon: FileKey,      top: '75%', left: '17%',  size: 44, rotate: -12 },
  { Icon: Shield,       top: '92%', left: '5%',   size: 44, rotate: -8 },
  // Bottom-right cluster
  { Icon: ShieldCheck,  top: '70%', left: '84%',  size: 48, rotate: 8 },
  { Icon: Network,      top: '74%', left: '94%',  size: 44, rotate: -20 },
  { Icon: LayoutDashboard, top: '90%', left: '85%', size: 48, rotate: 15 },
  // Bottom center (below buttons area, safe)
  { Icon: Lock,         top: '92%', left: '35%',  size: 40, rotate: -10 },
  { Icon: Cpu,          top: '90%', left: '60%',  size: 44, rotate: 20 },
];

/** Landing page. Home links here. After login (e.g. Try the demo), users go to Dashboard. */
export default function LandingPage() {
  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-y-auto">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-b from-violet-200/20 via-violet-100/5 to-transparent dark:from-violet-950/25 dark:via-violet-950/5" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <section className="relative flex-shrink-0 border-b border-border px-6 py-5 overflow-hidden">
        {/* Floating governance & protocol icons — hero background only */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          {bgIcons.map(({ Icon, top, left, size, rotate }, i) => (
            <Icon
              key={i}
              className="absolute text-violet-400/[0.12] dark:text-violet-400/[0.10]"
              style={{ top, left, width: size, height: size, transform: `rotate(${rotate}deg)` }}
            />
          ))}
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight pb-1 bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600 dark:from-violet-400 dark:via-purple-300 dark:to-indigo-400 bg-clip-text text-transparent drop-shadow-sm">
            AI Governance for your AI Agents
          </h1>
          <p className="text-base sm:text-lg text-foreground/70 mt-4 max-w-2xl mx-auto leading-relaxed font-bold tracking-[-0.01em]">
            Manage and govern your AI Agents&apos;{' '}
            <span className="bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100 px-1.5 py-0.5 rounded">prompts</span> and{' '}
            <span className="bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100 px-1.5 py-0.5 rounded">contexts</span>{' '}
            using a protocol-first approach (think{' '}
            <span className="text-violet-600 dark:text-violet-400">A2A</span>,{' '}
            <span className="text-violet-600 dark:text-violet-400">MCP</span>,{' '}
            <span className="text-violet-600 dark:text-violet-400">API</span> and{' '}
            <span className="text-violet-600 dark:text-violet-400">Git-like</span>).{' '}
            Every request is tracked, with built-in lineage, auditing, and automated reports for AI Governance.
          </p>
          <div className="mt-5 max-w-2xl mx-auto rounded-lg border border-violet-300/40 dark:border-violet-700/40 bg-violet-50/60 dark:bg-violet-950/30 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-1">The Problem</p>
            <p className="text-sm sm:text-base text-foreground/80 leading-relaxed italic">
              &ldquo;Prove to me that your AI agent accessed the right data, used the approved prompt, and didn&apos;t violate any policy.&rdquo;
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Every regulator, auditor, and CISO will ask this. Sandarb answers it in under 10&nbsp;seconds.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center items-center gap-3">
            <Link href="/docs">
              <Button size="sm" className="gap-1.5 h-9 px-4 bg-foreground/10 hover:bg-foreground/15 text-foreground border border-border font-semibold">
                <BookOpen className="h-4 w-4" />
                Documentation
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5 h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white">
                Try the demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative px-6 py-4 border-b border-border bg-muted/5">
        <div className="max-w-5xl mx-auto grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-background/50 p-4">
            <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <FileCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Goal
            </h2>
            <ol className="text-sm text-muted-foreground/90 space-y-1 list-decimal list-inside leading-relaxed">
              <li>AI Governance that doesn&apos;t slow shipping AI Agents to production</li>
              <li>Version mgmt &amp; traceability for Agent prompts and contexts</li>
              <li>Living AI Agents registry</li>
              <li>A small step toward standardizing AI Governance &mdash; open protocols (A2A, MCP), open data formats (AGP), and open infrastructure</li>
            </ol>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/50 p-4">
            <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              What we solve
            </h2>
            <ol className="text-sm text-muted-foreground/90 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Single place for approved prompts and context; agents pull via API, A2A, or MCP</li>
              <li>Audit trail: who requested what, when</li>
              <li>Manifest-based registration; git-like versioning</li>
              <li>AI Governance Proof (AGP) &mdash; cryptographic proof for every governance action, with trace IDs and full audit metadata</li>
              <li>Scalable Data Platform (Kafka + ClickHouse) &mdash; AGP events queryable in under 10 seconds for compliance and regulatory needs</li>
              <li>Sandarb AI Governance Agent: participates in A2A and MCP (industry standard protocols for agent-to-agent and tool-to-model communication)</li>
            </ol>
          </div>
          <a
            href="https://github.com/sandarb-ai/sandarb.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border/80 bg-background/50 p-4 block hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors"
          >
            <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Github className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Open source
            </h2>
            <p className="text-sm text-muted-foreground/90 leading-relaxed mb-1.5">
              Run it anywhere, build on it, or contribute back.
            </p>
            <div className="flex items-center gap-2 mb-1">
              <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache License 2.0" className="h-5" />
            </div>
            <span className="text-sm text-violet-600 dark:text-violet-400 font-medium">
              github.com/sandarb-ai/sandarb.ai
            </span>
          </a>
        </div>
      </section>

      <section className="relative px-6 py-4 border-b border-border bg-muted/10">
        <div className="max-w-5xl mx-auto space-y-4">
          <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Integrate your way
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/80 bg-background/50 p-4 hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors">
              <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                A2A
              </h3>
              <p className="text-sm text-muted-foreground/90 leading-relaxed mb-2">
                Sandarb is an AI Agent for AI Governance. It can communicate with other AI Agents over the{' '}
                <a href="https://a2a.dev" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">A2A protocol</a>
                . Other agents call <code className="rounded bg-muted px-1">GET /a2a</code> for discovery, then <code className="rounded bg-muted px-1">POST /a2a</code> with a skill (<code>get_context</code>, <code>validate_context</code>, <code>get_lineage</code>, <code>register</code>).
              </p>
              <a href="https://a2a-protocol.org/" target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline">
                a2a-protocol.org →
              </a>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/50 p-4 hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors">
              <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                MCP
              </h3>
              <p className="text-sm text-muted-foreground/90 leading-relaxed mb-2">
                Connect Claude Desktop, Cursor, Windsurf, or any{' '}
                <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">MCP</a>
                {' '}client directly to Sandarb. 22 governance tools (prompts, contexts, audit, agents) exposed via Streamable HTTP transport at <code className="rounded bg-muted px-1">POST /mcp</code>.
              </p>
              <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline">
                modelcontextprotocol.io →
              </a>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/50 p-4 hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors">
              <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Code className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                API
              </h3>
              <p className="text-sm text-muted-foreground/90 leading-relaxed">
                All resources and actions over HTTP. Inject context from your agent: <code className="rounded bg-muted px-1">GET /api/inject?name=my-context</code>. List and manage via <code className="rounded bg-muted px-1">/api/contexts</code>, <code className="rounded bg-muted px-1">/api/agents</code>, <code className="rounded bg-muted px-1">/api/organizations</code>.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/50 p-4 hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors">
              <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <LayoutDashboard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                GUI
              </h3>
              <p className="text-sm text-muted-foreground/90 leading-relaxed mb-2">
                Full governance dashboard: approve or reject prompts and context, browse the agent registry, view audit trail and lineage, generate governance reports, and explore version history. Built-in API playground included.
              </p>
              <Link href="/dashboard" className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline">
                Open Dashboard →
              </Link>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/50 p-4 hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors">
              <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <GitMerge className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Git-like
              </h3>
              <p className="text-sm text-muted-foreground/90 leading-relaxed mb-2">
                Every agent can maintain a <code className="rounded bg-muted px-1">sandarb.json</code> in its git repo. On startup, the agent pings Sandarb to register and pull approved prompts and context. Propose edits with commit messages; approve or reject in the UI. Sandarb tracks versions like a lightweight PR flow.
              </p>
              <Link href="/docs" className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline">
                See sandarb.json spec →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
