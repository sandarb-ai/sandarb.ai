import Link from 'next/link';
import { FileCheck, GitBranch, Code, Bot, GitMerge, BookOpen, Shield, ArrowRight, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Sandarb - AI Governance for AI Agents',
  description:
    'Manage and govern your AI Agents prompts and context in a protocol first approach workflows (think A2A, API and Git). Every request logged; lineage and audit built in.',
};

export default function MarketingPage() {
  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-y-auto">
      {/* Subtle background: gradient + grid evoking data, audit, governance */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        {/* Soft violet gradient from top (prompts / context / governance) */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-200/20 via-violet-100/5 to-transparent dark:from-violet-950/25 dark:via-violet-950/5" />
        {/* Very subtle grid (audit / structure) */}
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
        {/* Optional: add your own image in public/landing-bg.jpg and use next/image with fill, object-cover, opacity-[0.08] */}
      </div>

      {/* AI Governance — at top */}
      <section className="relative flex-shrink-0 border-b border-border bg-muted/20 px-6 py-5">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-tight">
            AI Governance for your AI Agents.
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-2xl mx-auto leading-relaxed">
            Manage and govern your AI Agents <span className="bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100 px-1 rounded font-medium">prompts</span> and <span className="bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100 px-1 rounded font-medium">context</span> in a protocol first approach workflows (think <span className="font-medium text-violet-600 dark:text-violet-400">A2A</span>, <span className="font-medium text-violet-600 dark:text-violet-400">API</span> and <span className="font-medium text-violet-600 dark:text-violet-400">Git-like</span>).{' '}
            Every request logged; lineage and audit built in.
          </p>
          <div className="mt-5 flex flex-wrap justify-center items-center gap-3">
            <Link href="/docs">
              <Button size="sm" variant="outline" className="gap-1.5">
                <BookOpen className="h-4 w-4" />
                Documentation
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                Try the demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Goal + What we solve + Open source — one row, low-key */}
      <section className="relative px-6 py-4 border-b border-border bg-muted/5">
        <div className="max-w-5xl mx-auto grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-background/50 p-4">
            <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <FileCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Goal
            </h2>
            <ol className="text-sm text-muted-foreground/90 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Governance that doesn’t slow shipping AI Agents to production</li>
              <li>Protocol-first (A2A, MCP, HTTP)</li>
              <li>Version mgmt & traceability for prompts and context</li>
              <li>Living AI Agents registry</li>
            </ol>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/50 p-4">
            <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              What we solve
            </h2>
            <ol className="text-sm text-muted-foreground/90 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Single place for approved prompts and context; agents pull via API or A2A</li>
              <li>Audit trail: who requested what, when</li>
              <li>Manifest-based registration; git-like versioning</li>
              <li>Sandarb runs as an AI Agent and communicates via A2A</li>
            </ol>
          </div>
          <a
            href="https://github.com/openint-ai/sandarb.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border/80 bg-background/50 p-4 block hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors"
          >
            <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Github className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Open source
            </h2>
            <p className="text-sm text-muted-foreground/90 leading-relaxed mb-1.5">
              Run it yourself, extend the API, or contribute. Protocol-first.
            </p>
            <span className="text-sm text-violet-600 dark:text-violet-400 font-medium">
              github.com/openint-ai/sandarb.ai
            </span>
          </a>
        </div>
      </section>

      {/* Integrate your way */}
      <section className="relative px-6 py-4 border-b border-border bg-muted/10">
        <div className="max-w-5xl mx-auto space-y-4">
          <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Integrate your way
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* A2A */}
            <div className="rounded-lg border border-border/80 bg-background/50 p-4 hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors">
              <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                A2A
              </h3>
              <p className="text-sm text-muted-foreground/90 leading-relaxed mb-2">
                Sandarb is an AI Agent for AI Governance. It can communicate with other AI Agents over the{' '}
                <a href="https://a2a.dev" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">A2A protocol</a>
                . Other agents call <code className="rounded bg-muted px-1">GET /api/a2a</code> for discovery, then <code className="rounded bg-muted px-1">POST /api/a2a</code> with a skill (<code>get_context</code>, <code>validate_context</code>, <code>get_lineage</code>, <code>register</code>).
              </p>
              <a href="https://a2a-protocol.org/" target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline">
                a2a-protocol.org →
              </a>
            </div>

            {/* API */}
            <div className="rounded-lg border border-border/80 bg-background/50 p-4 hover:border-violet-200/80 dark:hover:border-violet-800/40 transition-colors">
              <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Code className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                API
              </h3>
              <p className="text-sm text-muted-foreground/90 leading-relaxed">
                All resources and actions over HTTP. Inject context from your agent: <code className="rounded bg-muted px-1">GET /api/inject?name=my-context</code>. List and manage via <code className="rounded bg-muted px-1">/api/contexts</code>, <code className="rounded bg-muted px-1">/api/agents</code>, <code className="rounded bg-muted px-1">/api/organizations</code>.
              </p>
            </div>

            {/* Git (push) */}
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
