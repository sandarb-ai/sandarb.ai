import Link from 'next/link';
import { FileCheck, GitBranch, Code, Bot, GitMerge, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const metadata = {
  title: 'Sandarb - Governance for AI Agents',
  description:
    'AI Governance to manage prompts and context for your AI Agents. A2A, REST API and Git-like workflows. Every request logged; lineage and audit built in.',
};

export default function MarketingPage() {
  return (
    <div className="flex flex-col min-h-full">
      {/* AI Governance — at top */}
      <section className="border-b border-border bg-muted/20 px-6 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            AI Governance to manage prompts and context for your AI Agents.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
            A2A, REST API and Git-like workflows. Every request logged; lineage and audit built in.
          </p>
          <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
            <Link href="/docs">
              <Button size="sm" variant="outline" className="gap-1.5">
                <BookOpen className="h-4 w-4" />
                Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Goal + Open source — in the middle */}
      <section className="px-6 py-6 border-b border-border bg-muted/10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-6">
          <div className="flex-1 rounded-lg border border-border bg-muted/20 p-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
              <FileCheck className="h-4 w-4 text-violet-500" />
              Goal
            </h2>
            <p className="text-sm text-muted-foreground">
              Governance that doesn't slow shipping. Protocol-first (A2A, MCP), versioned prompts/context, and a living agent registry.
            </p>
          </div>
          <a
            href="https://github.com/openint-ai/sandarb.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-border bg-muted/20 p-4 block hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors"
          >
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4 text-violet-500" />
              Open source
            </h2>
            <p className="text-sm text-muted-foreground">
              Run it yourself, extend the API, or contribute. Low-key, practical, protocol-first.
            </p>
          </a>
        </div>
      </section>

      {/* Integrate your way — three cards in a row */}
      <section className="px-6 py-8 border-b border-border bg-muted/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Integrate your way
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* A2A */}
            <Card className="border-border bg-card hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="font-semibold text-foreground">A2A</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sandarb is an AI Agent for AI Governance. It can communicate with other AI Agents over the{' '}
                  <a href="https://a2a.dev" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">A2A protocol</a>
                  . Other agents call <code className="text-xs rounded bg-muted px-1">GET /api/a2a</code> for discovery, then <code className="text-xs rounded bg-muted px-1">POST /api/a2a</code> with a skill (<code className="text-xs">get_context</code>, <code className="text-xs">validate_context</code>, <code className="text-xs">get_lineage</code>, <code className="text-xs">register</code>).
                </p>
                <a href="https://a2a-protocol.org/" target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 dark:text-violet-400 hover:underline">
                  a2a-protocol.org →
                </a>
              </CardContent>
            </Card>

            {/* API */}
            <Card className="border-border bg-card hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <Code className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="font-semibold text-foreground">REST API</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  All resources and actions over HTTP. Inject context from your agent: <code className="text-xs rounded bg-muted px-1">GET /api/inject?name=my-context</code>. List and manage via <code className="text-xs rounded bg-muted px-1">/api/contexts</code>, <code className="text-xs rounded bg-muted px-1">/api/agents</code>, <code className="text-xs rounded bg-muted px-1">/api/organizations</code>.
                </p>
              </CardContent>
            </Card>

            {/* Git (push) */}
            <Card className="border-border bg-card hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <GitMerge className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="font-semibold text-foreground">Git-like</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Propose edits with a commit message; approve or reject in the UI. Contexts and prompts get versioned history. Push-based: register agents via ping or manifest; Sandarb tracks approvals and revisions like a lightweight PR flow.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What we solve — compact */}
      <section className="px-6 py-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-violet-500" />
            What we solve
          </h2>
          <ul className="text-muted-foreground text-sm space-y-1.5 list-disc list-inside max-w-2xl">
            <li>Single place for approved prompts and context; agents pull via API or A2A.</li>
            <li>Audit trail: who requested what, when (lineage for compliance and incidents).</li>
            <li>Manifest-based agent registration; git-like versioning for prompts/context.</li>
            <li>Sandarb runs as an A2A agent so others call it for validation and approved context.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
