import Link from 'next/link';
import { ArrowRight, BookOpen, Github, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'AI Governance Proof (AGP) — An Open Specification',
  description:
    'AGP is an open specification for capturing cryptographic proof of every AI agent governance action. Designed for interoperability, compliance, and community collaboration.',
};

const InlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-[13px] font-mono text-violet-800 dark:text-violet-200">{children}</code>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">{children}</p>
);

export default function AGPSpecPage() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-3">
            <Shield className="h-4 w-4" />
            Open Specification
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            AI Governance Proof (AGP)
          </h1>
          <p className="text-base text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            An open data format for capturing cryptographic proof of every AI agent governance action.
            AGP is not a product feature &mdash; it&apos;s a proposal for a common language that any platform,
            framework, or organization can adopt.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <a href="https://github.com/sandarb-ai/sandarb.ai" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5 h-9">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
            <Link href="/docs#agp-data-slas">
              <Button size="sm" variant="outline" className="gap-1.5 h-9">
                <BookOpen className="h-4 w-4" />
                SLA Documentation
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6">
        <article className="max-w-3xl mx-auto space-y-12">

          {/* ── Why ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Why AGP?</h2>
            <P>
              AI Agents are being deployed across every industry. They access company data, make decisions,
              and interact with customers. Regulators, auditors, and security teams all need to answer the
              same fundamental question:
            </P>
            <blockquote className="border-l-4 border-violet-500 pl-4 py-2 my-6 bg-violet-50/50 dark:bg-violet-950/20 rounded-r-lg">
              <p className="text-[15px] text-foreground/80 italic leading-relaxed">
                &ldquo;Prove to me that your AI agent accessed the right data, used the approved prompt,
                and didn&apos;t violate any policy.&rdquo;
              </p>
            </blockquote>
            <P>
              Today, every team answers this differently. Some grep through logs. Some build custom audit tables.
              Some don&apos;t track it at all. There is no shared format for what an AI governance proof should look like.
            </P>
            <P>
              AGP is our attempt &mdash; however small &mdash; to start that conversation. It&apos;s a structured,
              cryptographic event format that captures what happened, who did it, what data was involved,
              and whether it was allowed. We don&apos;t claim it&apos;s the final answer. We offer it as a starting
              point, and we welcome anyone who wants to help shape it.
            </P>
          </section>

          {/* ── Principles ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Design Principles</h2>
            <ul className="space-y-3 text-[15px] text-muted-foreground leading-relaxed">
              <li className="flex gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">1</span>
                <span><strong className="text-foreground">Open and protocol-agnostic.</strong> AGP events can be produced by any system &mdash; whether your agents use A2A, MCP, REST, gRPC, or something else entirely. The format doesn&apos;t assume a specific transport.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">2</span>
                <span><strong className="text-foreground">Tamper-evident by default.</strong> Every event includes a SHA-256 <InlineCode>governance_hash</InlineCode> computed at the source. If content changes between creation and storage, the hash won&apos;t match.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">3</span>
                <span><strong className="text-foreground">Traceable end-to-end.</strong> Every event carries a <InlineCode>trace_id</InlineCode> for distributed correlation. A single query can reconstruct the full chain: which agent, which prompt, which context, and what happened.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">4</span>
                <span><strong className="text-foreground">Flat and queryable.</strong> AGP uses a single wide event table &mdash; no joins needed for governance queries. Designed for OLAP engines like ClickHouse, but works with any store that can hold JSON or columnar data.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">5</span>
                <span><strong className="text-foreground">Extensible, not rigid.</strong> Required fields capture the essentials. The <InlineCode>metadata</InlineCode> field (JSON) allows any implementation to attach domain-specific data without breaking the schema.</span>
              </li>
            </ul>
          </section>

          {/* ── Event Schema ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">AGP Event Schema</h2>
            <P>
              An AGP event is a flat record with the following fields. Fields marked <strong className="text-foreground">required</strong> must
              be present in every event. All other fields are optional but encouraged.
            </P>

            {/* Identity */}
            <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mt-8 mb-3">Event Identity</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Field</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Required</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">event_id</td><td className="px-3 py-2">UUID</td><td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">Yes</td><td className="px-3 py-2">Unique identifier for this event</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">event_type</td><td className="px-3 py-2">String</td><td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">Yes</td><td className="px-3 py-2">What happened (e.g. <InlineCode>INJECT_SUCCESS</InlineCode>, <InlineCode>PROMPT_USED</InlineCode>, <InlineCode>AGENT_REGISTERED</InlineCode>)</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">event_category</td><td className="px-3 py-2">String</td><td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">Yes</td><td className="px-3 py-2">Grouping (e.g. <InlineCode>inject</InlineCode>, <InlineCode>audit</InlineCode>, <InlineCode>agent-lifecycle</InlineCode>)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">event_time</td><td className="px-3 py-2">DateTime (ms)</td><td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">Yes</td><td className="px-3 py-2">When the governance action occurred (UTC, millisecond precision)</td></tr>
                </tbody>
              </table>
            </div>

            {/* Agent & Org */}
            <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mt-8 mb-3">Agent &amp; Organization</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Field</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Required</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">agent_id</td><td className="px-3 py-2">String</td><td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">Yes</td><td className="px-3 py-2">The agent that triggered this governance action</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">agent_name</td><td className="px-3 py-2">String</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Human-readable agent name</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">org_id</td><td className="px-3 py-2">String</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Organization the agent belongs to (used for data locality and partitioning)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">org_name</td><td className="px-3 py-2">String</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Human-readable organization name</td></tr>
                </tbody>
              </table>
            </div>

            {/* Governance Proof */}
            <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mt-8 mb-3">Governance Proof</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Field</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Required</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">governance_hash</td><td className="px-3 py-2">String</td><td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">Yes</td><td className="px-3 py-2">SHA-256 hash of the governed content at the time of the action. This is the cryptographic proof.</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">hash_type</td><td className="px-3 py-2">String</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Hash algorithm used (default: <InlineCode>sha256</InlineCode>). Allows future migration to stronger algorithms.</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">trace_id</td><td className="px-3 py-2">String</td><td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">Yes</td><td className="px-3 py-2">Distributed trace ID for end-to-end correlation across systems</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">data_classification</td><td className="px-3 py-2">String</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Classification of the data involved (<InlineCode>public</InlineCode>, <InlineCode>internal</InlineCode>, <InlineCode>confidential</InlineCode>, <InlineCode>restricted</InlineCode>)</td></tr>
                </tbody>
              </table>
            </div>

            {/* Context & Prompt */}
            <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mt-8 mb-3">Context &amp; Prompt</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Field</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">context_id</td><td className="px-3 py-2">String</td><td className="px-3 py-2">ID of the context that was accessed or injected</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">context_name</td><td className="px-3 py-2">String</td><td className="px-3 py-2">Human-readable context name</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">version_id</td><td className="px-3 py-2">String</td><td className="px-3 py-2">Specific version of the context that was used</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">version_number</td><td className="px-3 py-2">Integer</td><td className="px-3 py-2">Numeric version for ordering</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">prompt_id</td><td className="px-3 py-2">String</td><td className="px-3 py-2">ID of the prompt that was used</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">prompt_name</td><td className="px-3 py-2">String</td><td className="px-3 py-2">Human-readable prompt name</td></tr>
                </tbody>
              </table>
            </div>

            {/* Denial & Violation */}
            <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mt-8 mb-3">Denial &amp; Policy Violation</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Field</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">denial_reason</td><td className="px-3 py-2">String</td><td className="px-3 py-2">Why access was denied (human-readable)</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">violation_type</td><td className="px-3 py-2">String</td><td className="px-3 py-2">Category of policy violation</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">severity</td><td className="px-3 py-2">String</td><td className="px-3 py-2">Impact level (<InlineCode>critical</InlineCode>, <InlineCode>high</InlineCode>, <InlineCode>medium</InlineCode>, <InlineCode>low</InlineCode>)</td></tr>
                </tbody>
              </table>
            </div>

            {/* Request & Metadata */}
            <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mt-8 mb-3">Request &amp; Metadata</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Field</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">source_ip</td><td className="px-3 py-2">String</td><td className="px-3 py-2">IP address of the requesting agent or service</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">request_method</td><td className="px-3 py-2">String</td><td className="px-3 py-2">HTTP method or protocol action that triggered the event</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">request_path</td><td className="px-3 py-2">String</td><td className="px-3 py-2">API path or skill name</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">template_rendered</td><td className="px-3 py-2">Boolean</td><td className="px-3 py-2">Whether the context was rendered with variables before delivery</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">ingested_at</td><td className="px-3 py-2">DateTime (ms)</td><td className="px-3 py-2">When the event was received by the analytics store (allows freshness measurement)</td></tr>
                  <tr><td className="px-3 py-2 font-mono text-xs">metadata</td><td className="px-3 py-2">JSON String</td><td className="px-3 py-2">Extensible field for domain-specific data. Implementations may add regulatory hooks, custom tags, or framework-specific context here.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Event Types ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Standard Event Types</h2>
            <P>
              The AGP specification defines 16 event types across 7 categories. Implementations may extend
              these with additional types using the same naming convention (<InlineCode>CATEGORY_ACTION</InlineCode>).
            </P>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Category</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">Event Types</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/40">When emitted</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-semibold text-foreground">Context Injection</td><td className="px-3 py-2"><InlineCode>INJECT_SUCCESS</InlineCode>, <InlineCode>INJECT_DENIED</InlineCode></td><td className="px-3 py-2">Agent requests governed context</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-semibold text-foreground">Prompt Usage</td><td className="px-3 py-2"><InlineCode>PROMPT_USED</InlineCode>, <InlineCode>PROMPT_DENIED</InlineCode></td><td className="px-3 py-2">Agent pulls an approved prompt</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-semibold text-foreground">Agent Lifecycle</td><td className="px-3 py-2"><InlineCode>AGENT_REGISTERED</InlineCode>, <InlineCode>AGENT_APPROVED</InlineCode>, <InlineCode>AGENT_DEACTIVATED</InlineCode></td><td className="px-3 py-2">Agent joins, is approved, or leaves the registry</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-semibold text-foreground">Context Lifecycle</td><td className="px-3 py-2"><InlineCode>CONTEXT_CREATED</InlineCode>, <InlineCode>CONTEXT_VERSION_APPROVED</InlineCode>, <InlineCode>CONTEXT_ARCHIVED</InlineCode></td><td className="px-3 py-2">Context is created, versioned, or archived</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-semibold text-foreground">Prompt Lifecycle</td><td className="px-3 py-2"><InlineCode>PROMPT_VERSION_CREATED</InlineCode>, <InlineCode>PROMPT_VERSION_APPROVED</InlineCode></td><td className="px-3 py-2">Prompt is created or a new version is approved</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-semibold text-foreground">Governance Proof</td><td className="px-3 py-2"><InlineCode>GOVERNANCE_PROOF</InlineCode></td><td className="px-3 py-2">Cryptographic proof-of-delivery is recorded</td></tr>
                  <tr className="border-b border-border/20"><td className="px-3 py-2 font-semibold text-foreground">Policy</td><td className="px-3 py-2"><InlineCode>POLICY_VIOLATION</InlineCode></td><td className="px-3 py-2">A governance policy is violated</td></tr>
                  <tr><td className="px-3 py-2 font-semibold text-foreground">A2A</td><td className="px-3 py-2"><InlineCode>A2A_CALL</InlineCode></td><td className="px-3 py-2">Agent-to-agent protocol call is made</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Example ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Example AGP Event</h2>
            <P>
              A minimal AGP event when an agent successfully injects governed context:
            </P>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 overflow-x-auto">
              <pre className="text-[13px] font-mono text-muted-foreground leading-relaxed whitespace-pre">{`{
  "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event_type": "INJECT_SUCCESS",
  "event_category": "inject",
  "event_time": "2025-01-15T14:30:00.123Z",

  "agent_id": "trading-bot-v2",
  "agent_name": "Trading Bot",
  "org_id": "finco",

  "context_name": "trading-limits",
  "version_number": 4,
  "data_classification": "confidential",

  "governance_hash": "a3f2b8c1d4e5...sha256...",
  "hash_type": "sha256",
  "trace_id": "req-789xyz",

  "template_rendered": true,
  "metadata": "{\\"regulatory_hooks\\": [\\"FINRA\\", \\"SEC\\"]}"
}`}</pre>
            </div>
          </section>

          {/* ── Reference Implementation ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Reference Implementation</h2>
            <P>
              Sandarb is the first reference implementation of AGP. It produces AGP events across
              every integration path (A2A, MCP, REST API, SDK) and streams them through a scalable
              data platform (Kafka + ClickHouse) for real-time analytics.
            </P>
            <P>
              But AGP doesn&apos;t require Sandarb. Any platform that produces events conforming to
              the schema above is AGP-compliant. The format is deliberately simple &mdash; a JSON
              object with well-defined fields &mdash; so that adoption is a low barrier.
            </P>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 overflow-x-auto">
              <pre className="text-[13px] font-mono text-muted-foreground leading-relaxed whitespace-pre">{`# Any system can produce AGP events — just emit JSON
import json, hashlib, uuid, datetime

def create_agp_event(agent_id, event_type, category, content, trace_id):
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "event_category": category,
        "event_time": datetime.datetime.utcnow().isoformat() + "Z",
        "agent_id": agent_id,
        "governance_hash": hashlib.sha256(content.encode()).hexdigest(),
        "hash_type": "sha256",
        "trace_id": trace_id,
        "metadata": "{}"
    }`}</pre>
            </div>
          </section>

          {/* ── How to Collaborate ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">How to Collaborate</h2>
            <P>
              We don&apos;t have all the answers. AI governance is a new field, and the right format
              will emerge from real-world use across different industries, regulatory regimes, and
              agent architectures. Here&apos;s how we hope this can evolve:
            </P>
            <ul className="space-y-3 text-[15px] text-muted-foreground leading-relaxed">
              <li className="flex gap-3">
                <span className="shrink-0 text-violet-600 dark:text-violet-400 font-bold">&bull;</span>
                <span><strong className="text-foreground">Use it and tell us what&apos;s missing.</strong> If you implement AGP and find the schema doesn&apos;t capture something your regulators need, that&apos;s exactly the feedback we want.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 text-violet-600 dark:text-violet-400 font-bold">&bull;</span>
                <span><strong className="text-foreground">Propose new event types.</strong> The 16 standard types cover what we&apos;ve seen so far. Healthcare, autonomous vehicles, and other domains will have governance actions we haven&apos;t imagined.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 text-violet-600 dark:text-violet-400 font-bold">&bull;</span>
                <span><strong className="text-foreground">Challenge the design.</strong> If you think the schema should be nested instead of flat, or that <InlineCode>governance_hash</InlineCode> should use a Merkle tree, or that events should be signed &mdash; open an issue. We&apos;d rather get it right than get it first.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 text-violet-600 dark:text-violet-400 font-bold">&bull;</span>
                <span><strong className="text-foreground">Build your own implementation.</strong> AGP is Apache 2.0 licensed. Build a Go producer, a Rust consumer, a Spark connector. The more implementations exist, the more useful the format becomes.</span>
              </li>
            </ul>
            <div className="mt-6 rounded-lg border border-violet-300/40 dark:border-violet-700/40 bg-violet-50/50 dark:bg-violet-950/20 p-5">
              <p className="text-sm text-foreground/80 leading-relaxed">
                AI governance is too important to be owned by any single company. We started AGP because we needed
                it for Sandarb, and we&apos;re sharing it because we believe the industry needs a common language.
                This is a small step. We hope others will take the next ones with us.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="https://github.com/sandarb-ai/sandarb.ai/issues" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                    <Github className="h-3.5 w-3.5" />
                    Open an Issue
                  </Button>
                </a>
                <a href="https://github.com/sandarb-ai/sandarb.ai/discussions" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                    Start a Discussion
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          </section>

          {/* ── Version ── */}
          <section className="border-t border-border/40 pt-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>AGP Specification v0.1.0 &mdash; Draft</span>
              <span>Apache 2.0 License</span>
            </div>
          </section>

        </article>
      </div>
    </div>
  );
}
