import Link from 'next/link';
import Image from 'next/image';
import { Shield, Bot, FileCheck, GitBranch, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'About Sandarb',
  description:
    'Governance for AI agents while your teams build. Regulatory, controls, risk, and compliance—without slowing shipping.',
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-6">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            About Sandarb
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Why we built it and what we’re trying to solve
          </p>
        </div>
      </div>

      <div className="flex-1 p-6">
        <article className="max-w-3xl mx-auto space-y-10">
          {/* Hero / one-liner */}
          <section className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            <div className="shrink-0 rounded-lg overflow-hidden border border-border bg-card w-16 h-16 flex items-center justify-center">
              <Image
                src="/logo.svg"
                alt="Sandarb"
                width={40}
                height={40}
                className="text-primary"
              />
            </div>
            <div>
              <p className="text-lg text-foreground font-medium">
                Governance for AI agents while your teams build.
              </p>
              <p className="text-muted-foreground mt-1">
                Sandarb (derived from &quot;Sandarbh&quot; (संदर्भ), a Hindi/Sanskrit word meaning &quot;context,&quot; &quot;reference,&quot; or &quot;connection&quot;) is an AI governance platform: a single place for approved prompts and context, audit trail, lineage, and a living agent registry.
              </p>
              <p className="text-muted-foreground mt-2">
                Sandarb is designed to fit seamlessly into your existing engineering workflow. Your AI agents and applications integrate via <strong className="text-foreground">A2A</strong>, <strong className="text-foreground">MCP</strong>, <strong className="text-foreground">API</strong>, or <strong className="text-foreground">Git</strong>—so teams can ship agents without skipping governance.
              </p>
            </div>
          </section>

          {/* Problem */}
          <section>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" />
              What we’re trying to solve
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Tech orgs need to ship AI agents quickly, but they also need approval workflows, audit trails, and a single place to manage which prompts and context go to which agents. Without that, you get shadow agents, unapproved context, and no lineage when something goes wrong.
            </p>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Sandarb sits in the control plane: approved prompts and context live here; agents request them via API, A2A, or MCP. Every request is logged, so you get "who asked for what, when" for compliance and incident review.
            </p>
          </section>

          {/* Goal */}
          <section>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-violet-500" />
              Goal
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              We want governance that doesn’t slow teams down. Manifest-based agent registration, git-like versioning for prompts and context, and protocol-first integration (A2A, MCP) so Sandarb fits into how you already build agents.
            </p>
            <ul className="text-muted-foreground mt-3 space-y-1.5 list-disc list-inside">
              <li>Approved prompts and context; propose / edit / approve workflows</li>
              <li>Audit trail and lineage: who requested which context, when</li>
              <li>Sandarb AI Governance Agent: Sandarb is an AI agent that participates in A2A and MCP (industry standard protocols for agent-to-agent and tool-to-model communication); other agents call Sandarb for validation and approved context via A2A or MCP</li>
            </ul>
          </section>

          {/* How it works (short) */}
          <section>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-500" />
              How it works
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Agents register with Sandarb (by URL or by pinging with a manifest). When an agent needs context, it calls Sandarb's API, A2A skill, or MCP tool; Sandarb returns the approved content and logs the request. The Sandarb AI Governance Agent participates in A2A and MCP—you get organizations, an agent registry, versioned prompts and contexts, and lineage, all exposed as an API, A2A participant, and MCP server so other agents and AI tools can talk to Sandarb directly.
            </p>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Sandarb also exposes a fully compliant MCP server (22 tools via Streamable HTTP at <code className="rounded bg-muted px-1 text-sm">/mcp</code>)—connect Claude Desktop, Cursor, Windsurf, or any MCP client directly for governed prompts, contexts, and audit lineage.
            </p>
          </section>

          {/* Open source note */}
          <section className="rounded-lg border border-border bg-muted/30 p-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-violet-500" />
              Open source
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Sandarb is built to be transparent and extensible. Run it yourself, extend the API, or contribute. We’re focused on governance that works for real teams—low-key, practical, and protocol-first.
            </p>
          </section>

          {/* CTA */}
          <section className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2">
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contexts">
              <Button variant="outline">Contexts</Button>
            </Link>
            <Link href="/agents">
              <Button variant="outline">Agent Registry</Button>
            </Link>
          </section>
        </article>
      </div>
    </div>
  );
}
