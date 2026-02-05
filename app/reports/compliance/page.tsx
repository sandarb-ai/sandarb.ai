'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, Bot } from 'lucide-react';
import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { D3BarChart } from '@/components/charts/d3-bar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { getReportsCompliance } from '@/lib/api-client';
import type { ReportsCompliance } from '@/types';

export default function ComplianceReportPage() {
  const [data, setData] = useState<ReportsCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const compliance = await getReportsCompliance();
        if (!cancelled && compliance) setData(compliance);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Compliance Report" description="Access events and audit lineage" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Compliance' }]} className="mb-2" />} />
        <div className="flex-1 p-6 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Compliance Report" description="Access events and audit lineage" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Compliance' }]} className="mb-2" />} />
        <div className="flex-1 p-6">
          <EmptyState title="Could not load report" description={error} />
        </div>
      </div>
    );
  }

  const compliance = data!;
  const hasTimeSeries = compliance.complianceTimeSeries?.length > 0;
  const agentsByPii = compliance.agentsByPiiHandling ?? {};
  const hasAgentsByPii = Object.keys(agentsByPii).length > 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Compliance Report"
        description="Access events, success vs denied injections, prompt usage and audit lineage"
        breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Compliance' }]} className="mb-2" />}
      />
      <div className="flex-1 p-6 overflow-auto space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/80">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Total access events</p>
              <p className="text-2xl font-bold mt-0.5">{compliance.totalAccessEvents}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Context delivered (success)</p>
              <p className="text-2xl font-bold mt-0.5 text-green-600 dark:text-green-400">{compliance.successCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Injections denied</p>
              <p className="text-2xl font-bold mt-0.5 text-rose-600 dark:text-rose-400">{compliance.deniedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Prompt usage events</p>
              <p className="text-2xl font-bold mt-0.5">{compliance.promptUsedCount}</p>
            </CardContent>
          </Card>
        </div>

        {hasTimeSeries && (
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                Access events trend (last 30 days)
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">Total events per day for audit lineage</p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <D3BarChart
                  data={compliance.complianceTimeSeries.map((d) => ({ name: d.date, value: d.total }))}
                  height={280}
                  xTickCount={10}
                  xTickFormat={(v) => {
                    const d = new Date(v);
                    return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {!hasTimeSeries && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No access event history yet. Events will appear as agents request contexts and prompts.
            </CardContent>
          </Card>
        )}

        {hasAgentsByPii && (
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-500" />
                Agents by PII handling
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Registered agents categorized by whether they handle PII (compliance-relevant)
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(agentsByPii).map(([pii, count]) => (
                  <div key={pii} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {pii === 'true' ? 'Handles PII' : 'No PII'}
                    </span>
                    <Badge variant="secondary">{count} agents</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
