'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Shield,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Link2,
  Clock,
  Building,
  Zap,
} from 'lucide-react';
import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { D3LineChart } from '@/components/charts/d3-line-chart';
import { D3BarChart } from '@/components/charts/d3-bar-chart';
import { D3PieChart } from '@/components/charts/d3-pie-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { getReportsContext } from '@/lib/api-client';
import type { ReportsContext } from '@/types';

const CLASSIFICATION_COLORS: Record<string, string> = {
  Public: '#10b981',
  Internal: '#06b6d4',
  Confidential: '#f59e0b',
  Restricted: '#ef4444',
  MNPI: '#dc2626',
};
const RENDERING_COLORS = ['#8b5cf6', '#94a3b8'];
const REASON_COLORS = ['#ef4444', '#f59e0b', '#f97316', '#ec4899', '#a855f7'];

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/80">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v).slice(0, 10)
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ContextReportPage() {
  const [data, setData] = useState<ReportsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const ctx = await getReportsContext();
        if (!cancelled && ctx) setData(ctx);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const breadcrumb = (
    <Breadcrumb
      items={[{ label: 'Reports', href: '/reports' }, { label: 'Context Governance' }]}
      className="mb-2"
    />
  );

  if (loading && !data) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Context Governance" description="Context delivery, coverage, and compliance analytics" breadcrumb={breadcrumb} />
        <div className="flex-1 p-6 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Context Governance" description="Context delivery, coverage, and compliance analytics" breadcrumb={breadcrumb} />
        <div className="flex-1 p-6">
          <EmptyState title="Could not load report" description={error} />
        </div>
      </div>
    );
  }

  const ctx = data!;
  const renderPct = ctx.totalInjects > 0 ? Math.round((ctx.renderedCount / ctx.totalInjects) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Context Governance"
        description="Governance proof-of-delivery, coverage matrix, staleness, rendering analytics, and approval velocity"
        breadcrumb={breadcrumb}
      />
      <div className="flex-1 p-6 overflow-auto space-y-8">

        {/* ── KPI Cards ── */}
        <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard label="Total Contexts" value={ctx.totalContexts} icon={FileText} color="text-violet-600 dark:text-violet-400" bg="bg-violet-100 dark:bg-violet-900/30" />
            <StatCard label="Approved Versions" value={ctx.approvedVersions} icon={CheckCircle2} color="text-green-600 dark:text-green-400" bg="bg-green-100 dark:bg-green-900/30" />
            <StatCard label="Total Injects" value={ctx.totalInjects} icon={TrendingUp} color="text-sky-600 dark:text-sky-400" bg="bg-sky-100 dark:bg-sky-900/30" />
            <StatCard label="Denied" value={ctx.totalDenied} icon={Shield} color="text-rose-600 dark:text-rose-400" bg="bg-rose-100 dark:bg-rose-900/30" />
            <StatCard label="Rendered" value={`${renderPct}%`} icon={Zap} color="text-amber-600 dark:text-amber-400" bg="bg-amber-100 dark:bg-amber-900/30" sub={`${ctx.renderedCount} of ${ctx.totalInjects}`} />
            <StatCard label="Orphaned" value={ctx.orphanedContexts} icon={AlertTriangle} color="text-orange-600 dark:text-orange-400" bg="bg-orange-100 dark:bg-orange-900/30" sub="No linked agents" />
          </div>
        </section>

        {/* ── Row 1: Inject time series + Top consumed ── */}
        <section className="grid gap-4 lg:grid-cols-2">
          {ctx.injectTimeSeries.length > 0 && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  Context Injection Trend (30 days)
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Successful deliveries vs denied requests</p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <D3LineChart
                    data={ctx.injectTimeSeries}
                    xKey="date"
                    series={[
                      { key: 'success', name: 'Delivered', color: '#10b981' },
                      { key: 'denied', name: 'Denied', color: '#ef4444' },
                    ]}
                    height={280}
                    xTickCount={10}
                    xTickFormat={formatDate}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {ctx.topContexts.length > 0 && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-violet-500" />
                  Top Consumed Contexts
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Most frequently injected contexts by agent requests</p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <D3BarChart
                    data={ctx.topContexts.map((c) => ({ name: c.name.replace(/^context\./, ''), value: c.count }))}
                    layout="horizontal"
                    height={280}
                    showValueLabels
                    sortByValue
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Row 2: Rendering breakdown + Blocked reasons + Classification access ── */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-500" />
                Template Rendering
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">Jinja2-rendered vs raw context delivery</p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <D3PieChart
                  data={ctx.renderingBreakdown.filter((d) => d.count > 0).map((d) => ({ name: d.name, value: d.count }))}
                  height={220}
                  outerRadius={72}
                  innerRadius={28}
                  colors={RENDERING_COLORS}
                  showTotalInCenter
                  showLegend
                />
              </div>
            </CardContent>
          </Card>

          {ctx.blockedReasons.length > 0 && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-rose-500" />
                  Blocked Injection Reasons
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Why context access was denied</p>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <D3PieChart
                    data={ctx.blockedReasons.map((d) => ({ name: d.name, value: d.count }))}
                    height={220}
                    outerRadius={72}
                    innerRadius={28}
                    colors={REASON_COLORS}
                    showLegend
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {ctx.classificationAccess.length > 0 && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base">Classification Access</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Inject count by data classification level</p>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <D3BarChart
                    data={ctx.classificationAccess.map((d) => ({ name: d.name, value: d.count }))}
                    layout="horizontal"
                    height={220}
                    showValueLabels
                    sortByValue
                    colors={ctx.classificationAccess.map((d) => CLASSIFICATION_COLORS[d.name] ?? '#8b5cf6')}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Row 3: Coverage matrix + Contexts by Org ── */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-violet-500" />
                Agent-Context Coverage
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">Linking coverage between agents and contexts</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">{ctx.coverage.agentsWithContexts}</p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">Agents with linked contexts</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{ctx.coverage.agentsWithoutContexts}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Agents without contexts</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800">
                  <p className="text-3xl font-bold text-sky-700 dark:text-sky-400">{ctx.coverage.linkedContexts}</p>
                  <p className="text-xs text-sky-600 dark:text-sky-500 mt-1">Contexts linked to agents</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                  <p className="text-3xl font-bold text-rose-700 dark:text-rose-400">{ctx.coverage.orphanedContexts}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-1">Orphaned contexts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {ctx.contextsByOrg.length > 0 && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-4 w-4 text-violet-500" />
                  Contexts by Organization
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Context distribution across business units</p>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  <D3BarChart
                    data={ctx.contextsByOrg.map((d) => ({ name: d.name, value: d.count }))}
                    layout="horizontal"
                    height={260}
                    showValueLabels
                    sortByValue
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Row 4: Approval velocity + Staleness ── */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-500" />
                Approval Velocity
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">Time from context version creation to approval</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-foreground">{ctx.approvalVelocity.avgDays}</p>
                  <p className="text-xs text-muted-foreground mt-1">Avg days</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{ctx.approvalVelocity.minDays}</p>
                  <p className="text-xs text-muted-foreground mt-1">Fastest</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{ctx.approvalVelocity.maxDays}</p>
                  <p className="text-xs text-muted-foreground mt-1">Slowest</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Context Staleness
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">Oldest approved contexts by days since last update</p>
            </CardHeader>
            <CardContent>
              <div className="max-h-[260px] overflow-auto">
                {ctx.staleness.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-1.5 font-medium">Context</th>
                        <th className="text-right py-1.5 font-medium">v</th>
                        <th className="text-right py-1.5 font-medium">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ctx.staleness.slice(0, 10).map((s) => (
                        <tr key={s.name} className="border-b border-border/40">
                          <td className="py-1.5 font-mono text-xs truncate max-w-[200px]" title={s.name}>
                            {s.name.replace(/^context\./, '')}
                          </td>
                          <td className="py-1.5 text-right text-muted-foreground">v{s.version}</td>
                          <td className="py-1.5 text-right">
                            <Badge
                              variant={s.daysSince > 180 ? 'destructive' : s.daysSince > 90 ? 'outline' : 'secondary'}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {Math.round(s.daysSince)}d
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No stale contexts detected.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
