'use client';

import { useState, useEffect } from 'react';
import { Scale, RefreshCw, Bot, Shield } from 'lucide-react';
import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { D3PieChart } from '@/components/charts/d3-pie-chart';
import { D3BarChart } from '@/components/charts/d3-bar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { getReportsRegulatory } from '@/lib/api-client';
import type { ReportsRegulatory } from '@/types';

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const CLASSIFICATION_ORDER = ['Public', 'Internal', 'Confidential', 'Restricted'];
const CLASSIFICATION_COLORS: Record<string, string> = {
  Public: '#10b981',
  Internal: '#06b6d4',
  Confidential: '#f59e0b',
  Restricted: '#ef4444',
};

export default function RegulatoryReportPage() {
  const [data, setData] = useState<ReportsRegulatory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const regulatory = await getReportsRegulatory();
        if (!cancelled && regulatory) setData(regulatory);
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
        <Header title="Regulatory Report" description="Context and prompt version status, data classification" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Regulatory' }]} className="mb-2" />} />
        <div className="flex-1 p-6 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Regulatory Report" description="Context and prompt version status, data classification" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Regulatory' }]} className="mb-2" />} />
        <div className="flex-1 p-6">
          <EmptyState title="Could not load report" description={error} />
        </div>
      </div>
    );
  }

  const regulatory = data!;
  const hasContext = Object.keys(regulatory.contextVersionsByStatus).length > 0;
  const hasPrompt = Object.keys(regulatory.promptVersionsByStatus).length > 0;
  const hasClassification = Object.keys(regulatory.dataClassificationCounts).length > 0;
  const agentsByScope = regulatory.agentsByRegulatoryScope ?? {};
  const agentsByClass = regulatory.agentsByDataClassification ?? {};
  const hasAgentsByScope = Object.keys(agentsByScope).length > 0;
  const hasAgentsByClass = Object.keys(agentsByClass).length > 0;
  const hasAny = hasContext || hasPrompt || hasClassification || hasAgentsByScope || hasAgentsByClass;

  const classificationEntries = Object.entries(regulatory.dataClassificationCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
    value,
  }));
  const classificationData = [...classificationEntries].sort((a, b) => {
    const ai = CLASSIFICATION_ORDER.indexOf(a.name);
    const bi = CLASSIFICATION_ORDER.indexOf(b.name);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b.value - a.value;
  });
  const agentsByClassData = Object.entries(agentsByClass)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(), value }))
    .sort((a, b) => b.value - a.value);
  const agentsByScopeData = Object.entries(agentsByScope).map(([name, value]) => ({ name, value }));
  const classificationBarColors = classificationData.map((d) => CLASSIFICATION_COLORS[d.name] ?? '#8b5cf6');
  const agentsByClassBarColors = agentsByClassData.map((d) => CLASSIFICATION_COLORS[d.name] ?? '#8b5cf6');

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Regulatory Report"
        description="Context and prompt version status, data classification for compliance and audit"
        breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Regulatory' }]} className="mb-2" />}
      />
      <div className="flex-1 p-6 overflow-auto space-y-8">
        <p className="text-sm text-muted-foreground">
          Version status and data classification support regulatory workflows and audit requirements.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {hasContext && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-violet-500" />
                  Context versions by status
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Version approval breakdown for contexts</p>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <D3PieChart
                    data={Object.entries(regulatory.contextVersionsByStatus).map(([name, value]) => ({ name, value }))}
                    height={240}
                    outerRadius={72}
                    innerRadius={28}
                    colors={CHART_COLORS}
                    showTotalInCenter
                    showLegend
                  />
                </div>
              </CardContent>
            </Card>
          )}
          {hasPrompt && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-cyan-500" />
                  Prompt versions by status
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Version approval breakdown for prompts</p>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <D3PieChart
                    data={Object.entries(regulatory.promptVersionsByStatus).map(([name, value]) => ({ name, value }))}
                    height={240}
                    outerRadius={72}
                    innerRadius={28}
                    colors={[...CHART_COLORS.slice(1), CHART_COLORS[0]]}
                    showTotalInCenter
                    showLegend
                  />
                </div>
              </CardContent>
            </Card>
          )}
          {hasClassification && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base">Contexts by classification level</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">Context count per data classification</p>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <D3BarChart
                    data={classificationData}
                    layout="horizontal"
                    height={220}
                    showValueLabels
                    sortByValue
                    colors={classificationBarColors}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Agents by regulatory scope and by data classification */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            Agents by regulatory & classification
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {hasAgentsByScope && (
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-500" />
                    Agents by regulatory scope
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">
                    Registered agents declaring each regulatory scope (e.g. GDPR, FINRA)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full min-h-[220px]">
                    <D3BarChart
                      data={agentsByScopeData}
                      layout="horizontal"
                      height={280}
                      showValueLabels
                      sortByValue
                      colors={CHART_COLORS}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            {hasAgentsByClass && (
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Agents by data classification</CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">
                    Distinct agents linked to contexts at each classification level
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px] w-full">
                    <D3BarChart
                      data={agentsByClassData}
                      layout="horizontal"
                      height={220}
                      showValueLabels
                      sortByValue
                      colors={agentsByClassBarColors}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {!hasAny && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No regulatory data yet. Add contexts and prompts with version status and data classification; register agents with regulatory scope to see agent breakdowns.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
