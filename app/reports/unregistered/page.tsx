'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { getReportsUnregisteredAgents } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import type { UnauthenticatedDetection } from '@/types';

export default function UnregisteredAgentsReportPage() {
  const [list, setList] = useState<UnauthenticatedDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const agents = await getReportsUnregisteredAgents(100);
        if (!cancelled) setList(agents);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading && list.length === 0 && !error) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Un-Registered Agents" description="Discovered by Sandarb AI Governance Agent" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Un-Registered Agents' }]} className="mb-2" />} />
        <div className="flex-1 p-6 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && list.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Un-Registered Agents" description="Discovered by Sandarb AI Governance Agent" breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Un-Registered Agents' }]} className="mb-2" />} />
        <div className="flex-1 p-6">
          <EmptyState title="Could not load report" description={error} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Un-Registered Agents"
        description="Agents discovered at scan targets but not yet registered in the Agent Registry"
        breadcrumb={<Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Un-Registered Agents' }]} className="mb-2" />}
      />
      <div className="flex-1 p-6 overflow-auto space-y-6">
        <p className="text-sm text-muted-foreground">
          The Sandarb AI Governance Agent scans configured targets and records agents that are not yet registered.
          Register these agents in the Agent Registry to grant controlled access to contexts and prompts.
        </p>
        {list.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No un-registered agents discovered. Run discovery scans to detect agents at configured targets.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Source URL</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Detected agent ID</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Scan time</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <a
                          href={row.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1"
                        >
                          {row.sourceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                        {row.detectedAgentId ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(row.scanRunAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
              {list.length} discovery record{list.length !== 1 ? 's' : ''} shown
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
