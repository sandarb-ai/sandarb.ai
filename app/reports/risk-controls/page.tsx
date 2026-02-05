'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Bot,
  AlertTriangle,
  FileCheck,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { D3LineChart } from '@/components/charts/d3-line-chart';
import { D3BarChart } from '@/components/charts/d3-bar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { getReportsOverview } from '@/lib/api-client';
import type { ReportsOverview } from '@/types';

export default function RiskControlsReportPage() {
  const [data, setData] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const overview = await getReportsOverview();
        if (!cancelled && overview) setData(overview);
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
        <Header title="Risk & Controls" description="AI Governance risk and controls overview" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Risk & Controls' }]} className="mb-2" />} />
        <div className="flex-1 p-6 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Risk & Controls" description="AI Governance risk and controls overview" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Risk & Controls' }]} className="mb-2" />} />
        <div className="flex-1 p-6">
          <EmptyState title="Could not load report" description={error} />
        </div>
      </div>
    );
  }

  const overview = data!;
  const hasTimeSeries = overview.accessTimeSeries?.length > 0;
  const hasStatusBreakdown = overview.agentStatusBreakdown && Object.keys(overview.agentStatusBreakdown).length > 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Risk & Controls"
        description="Registered agents, blocked injections, approved contexts & prompts, and access trends"
        breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Risk & Controls' }]} className="mb-2" />}
      />
      <div className="flex-1 p-6 overflow-auto space-y-8">
        <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-border/80">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Registered Agents</p>
                  <p className="text-2xl font-bold mt-0.5">{overview.registeredAgentsCount}</p>
                </div>
                <div className="rounded-lg p-2.5 bg-sky-100 dark:bg-sky-900/30">
                  <Bot className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Un-Registered (Discovered)</p>
                  <p className="text-2xl font-bold mt-0.5">{overview.unregisteredAgentsCount}</p>
                </div>
                <div className="rounded-lg p-2.5 bg-amber-100 dark:bg-amber-900/30">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Blocked Injections</p>
                  <p className="text-2xl font-bold mt-0.5">{overview.blockedInjectionsCount}</p>
                </div>
                <div className="rounded-lg p-2.5 bg-rose-100 dark:bg-rose-900/30">
                  <Shield className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approved Contexts</p>
                  <p className="text-2xl font-bold mt-0.5">{overview.approvedContextsCount}</p>
                </div>
                <div className="rounded-lg p-2.5 bg-teal-100 dark:bg-teal-900/30">
                  <FileCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approved Prompts</p>
                  <p className="text-2xl font-bold mt-0.5">{overview.approvedPromptsCount}</p>
                </div>
                <div className="rounded-lg p-2.5 bg-violet-100 dark:bg-violet-900/30">
                  <MessageSquareText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {hasTimeSeries && (
            <Card className="mt-4 border-border/80">
              <CardHeader>
                <CardTitle className="text-base">Context access (last 30 days)</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Successful vs denied injections by day</p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <D3LineChart
                    data={overview.accessTimeSeries}
                    xKey="date"
                    series={[
                      { key: 'success', name: 'Success', color: '#10b981' },
                      { key: 'denied', name: 'Denied', color: '#ef4444' },
                    ]}
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

          {hasStatusBreakdown && (
            <Card className="mt-4 border-border/80">
              <CardHeader>
                <CardTitle className="text-base">Agent approval status</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Registered agents by workflow status</p>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full max-w-md">
                  <D3BarChart
                    data={Object.entries(overview.agentStatusBreakdown).map(([name, value]) => ({ name, value }))}
                    layout="horizontal"
                    height={240}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {!hasTimeSeries && !hasStatusBreakdown && (
            <Card className="mt-4 border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No access or agent status data yet. Activity will appear here as agents use contexts and prompts.
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
