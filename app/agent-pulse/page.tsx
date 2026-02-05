import { Header } from '@/components/header';
import { StatsCard } from '@/components/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getBlockedInjections, getA2ALog, getUnauthenticatedDetections } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/utils';
import { ShieldAlert, Bot, Radio, Hash } from 'lucide-react';
import { AgentPulseScanButton } from './agent-pulse-scan-button';
import { AgentPulseChat } from './agent-pulse-chat';

export const dynamic = 'force-dynamic';

export default async function AgentPulsePage() {
  let blocked: Array<{ id: string; createdAt?: string; details?: { agentId?: string; reason?: string }; resourceName?: string; createdBy?: string }> = [];
  let unauthenticated: Array<{ id: string; sourceUrl?: string; scanRunAt?: string; detectedAgentId?: string }> = [];
  let a2aLog: Array<{ id: string; [key: string]: unknown }> = [];

  try {
    const [b, u, a] = await Promise.all([
      getBlockedInjections(50),
      getUnauthenticatedDetections(50),
      getA2ALog(200),
    ]);
    blocked = Array.isArray(b) ? b : [];
    unauthenticated = Array.isArray(u) ? u : [];
    a2aLog = Array.isArray(a) ? a : [];
  } catch {
    // Fallback: empty lists if backend not ready
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Agent Pulse"
        description="Governance dashboard: A2A communication between agents and Sandarb"
      >
        <AgentPulseScanButton />
      </Header>

      <div className="flex-1 flex min-h-0">
        {/* Left pane: same look as other Sandarb pages (cards, background, spacing) */}
        <aside className="w-2/3 min-w-0 flex flex-col overflow-y-auto border-r border-border bg-background">
          <div className="flex-1 p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <StatsCard
                title="Blocked Injections"
                value={blocked.length}
                description="Policy violations (e.g. cross-LOB or unregistered agent)"
                icon={ShieldAlert}
              />
              <StatsCard
                title="Unauthenticated Agents"
                value={unauthenticated.length}
                description="Detected agents not registered in Sandarb"
                icon={Bot}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-5 w-5" />
                  Blocked injections
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Context injection attempts blocked when agent LOB does not match context LOB or agent is unregistered.
                </p>
              </CardHeader>
              <CardContent>
                {blocked.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center rounded-lg bg-muted/50">
                    No blocked injections. All injection requests are compliant.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto">
                    {blocked.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-1 rounded-lg border border-border p-3 bg-card"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate" title={entry.details?.agentId}>
                            Agent: {entry.details?.agentId ?? entry.createdBy ?? '—'}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatRelativeTime(entry.createdAt)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground truncate" title={entry.resourceName}>
                          Context: {entry.resourceName}
                        </div>
                        <Badge variant="destructive" className="w-fit text-xs">
                          {entry.details?.reason ?? 'Policy violation'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Radio className="h-5 w-5" />
                  Shadow AI discovery
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Agents detected on the network that are not registered in Sandarb. Run a scan to discover them.
                </p>
              </CardHeader>
              <CardContent>
                {unauthenticated.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center rounded-lg bg-muted/50">
                    No unauthenticated agents detected. Use &quot;Run discovery scan&quot; to probe configured targets.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[240px] overflow-y-auto">
                    {unauthenticated.map((d) => (
                      <div
                        key={d.id}
                        className="flex flex-col gap-1 rounded-lg border border-amber-500/30 dark:border-amber-500/20 p-3 bg-amber-500/5 dark:bg-amber-500/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate" title={d.sourceUrl}>
                            {d.sourceUrl}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatRelativeTime(d.scanRunAt)}
                          </span>
                        </div>
                        {d.detectedAgentId && (
                          <span className="text-xs text-muted-foreground">
                            Agent ID: {d.detectedAgentId}
                          </span>
                        )}
                        <Badge variant="warning" className="w-fit text-xs">
                          Unauthenticated agent detected
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Right pane: 1/3 — A2A log (unchanged) */}
        <section className="w-1/3 min-w-0 flex flex-col shrink-0 bg-background">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-[15px]">a2a-log</h2>
            <span className="text-xs text-muted-foreground ml-2">Agents ↔ Sandarb</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {a2aLog.length} message{a2aLog.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <AgentPulseChat entries={a2aLog} />
          </div>
        </section>
      </div>
    </div>
  );
}
