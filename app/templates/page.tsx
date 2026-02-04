'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';
import { Plus, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import type { Template } from '@/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(apiUrl('/api/templates'));
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable schemas and default values for context content. Link contexts to a template for consistent structure and governance. See <a href="/docs#templates" className="text-violet-600 dark:text-violet-400 hover:underline">Docs → Templates for context</a>.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Feature status note */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-4 flex gap-3">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Templates for context are currently in progress.</p>
            <p className="mt-1 text-muted-foreground">
              Full support (e.g. validation of context content against template schema at create/update, template-driven UI for context authoring) will be released in a <strong>future version of Sandarb</strong>. The schema and templateId linkage are in place today; enhanced tooling and enforcement are coming next.
            </p>
          </div>
        </div>

        {/* How templates are used – examples */}
        <section className="rounded-lg border border-border bg-muted/20 p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">How templates are used in prompts and context</h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Example 1: Trading limits template</p>
              <p className="mb-2">A template defines the schema for &quot;trading desk limits&quot; context: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">varLimit</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">singleNameLimit</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">desk</code>. A context linked to this template (e.g. <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">ib-trading-limits</code>) might have content: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{'{ "varLimit": 5000000, "singleNameLimit": 500000, "desk": "equities" }'}</code>. Your agent fetches it via <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">get_context(&quot;ib-trading-limits&quot;)</code>; the returned content conforms to the template schema so your agent can safely use <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">content.varLimit</code> and <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">content.singleNameLimit</code>.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Example 2: Compliance policy template</p>
              <p>A template for compliance context: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">policy</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">effectiveDate</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">regulatoryHooks</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">kycRequired</code>. Default values (e.g. <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">kycRequired: true</code>) pre-fill new contexts created from this template.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Example 3: Prompt + context together</p>
              <p>Your prompt (e.g. &quot;finance-bot&quot;) instructs the agent to use governed context. The agent fetches the prompt, then fetches context by name; the context content is shaped by its template. Flow: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">get_prompt(&quot;finance-bot&quot;)</code> → <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">get_context(&quot;ib-trading-limits&quot;)</code> → use <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">content.singleNameLimit</code> in your logic (e.g. reject if order value exceeds the limit).</p>
            </div>
          </div>
          <p className="mt-4 text-sm">
            <a href="/docs#templates" className="text-violet-600 dark:text-violet-400 hover:underline">Full examples and schema samples → Docs</a>
          </p>
        </section>

        {/* Template list */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl border bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Templates define a JSON schema and default values for context content so all contexts of the same type (e.g. trading limits) follow the same structure. Run the seed (Load sample data on Dashboard) to add sample templates: compliance policy, trading limits, suitability policy, KYC config, disclosure policy."
            actionLabel="View docs"
            actionHref="/docs#templates"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {template.description || 'No description'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
