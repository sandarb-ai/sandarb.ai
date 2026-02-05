import Link from 'next/link';
import { FileText, FileJson, Zap, Bot, Building2, ExternalLink } from 'lucide-react';
import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { StatsCard } from '@/components/stats-card';
import { LoadSampleDataCard } from '@/components/load-sample-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getDashboard,
  getRecentOrganizationsWithCounts,
  getRecentAgents,
  getRecentPrompts,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import type { Prompt, RegisteredAgent } from '@/types';

export const dynamic = 'force-dynamic';

interface OrgWithCounts {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  agentCount: number;
  contextCount: number;
  [key: string]: unknown;
}

export default async function DashboardPage() {
  let promptStats = { total: 0, active: 0 };
  let contextStats = { total: 0, active: 0 };
  let agentCount = 0;
  let orgCount = 0;
  let recentOrgs: OrgWithCounts[] = [];
  let recentAgents: RegisteredAgent[] = [];
  let recentPrompts: Prompt[] = [];

  try {
    const d = await getDashboard();
    if (d) {
      promptStats = (d.promptStats as { total: number; active: number }) ?? { total: 0, active: 0 };
      contextStats = (d.contextStats as { total: number; active: number }) ?? { total: 0, active: 0 };
      agentCount = (d.agentCount as number) ?? 0;
      orgCount = (d.orgCount as number) ?? 0;
      recentOrgs = (d.recentOrgs as OrgWithCounts[]) ?? [];
      recentAgents = (d.recentAgents as RegisteredAgent[]) ?? [];
      recentPrompts = (d.recentPrompts as Prompt[]) ?? [];
    }
  } catch {
    // Fallback: show zeros and empty lists if backend not ready
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Dashboard"
        description={orgCount || agentCount || contextStats.active || promptStats.active ? 'Aggregate metrics from your database' : 'Aggregate metrics (load data with ./scripts/load_sandarb_data.sh)'}
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard' }]} className="mb-2" />}
      />

      <div className="flex-1 p-6 space-y-6">
        {promptStats.total === 0 && orgCount === 0 && (
          <LoadSampleDataCard />
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Organizations"
            value={orgCount}
            description="Teams and divisions"
            icon={Building2}
            href="/organizations"
            variant="indigo"
          />
          <StatsCard
            title="Agent Registry"
            value={agentCount}
            description="Registered A2A agents"
            icon={Bot}
            href="/agents"
            variant="sky"
          />
          <StatsCard
            title="Active Contexts"
            value={contextStats.active}
            description="Context data for agents"
            icon={FileJson}
            href="/contexts"
            variant="orange"
          />
          <StatsCard
            title="Active Prompts"
            value={promptStats.active}
            description="Prompts with approved versions"
            icon={FileText}
            href="/prompts"
            variant="teal"
          />
        </div>

        {/* Organizations */}
        {recentOrgs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-violet-600 dark:text-violet-400">Organizations</h2>
              <Link href="/organizations" className="text-sm text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentOrgs.map((org) => (
                <Link key={org.id} href={`/organizations/${org.id}`}>
                  <Card className="group flex flex-col h-full transition-all hover:bg-muted/50 hover:shadow-md cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                          <CardTitle className="text-base truncate">{org.name}</CardTitle>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {org.description != null && String(org.description) && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {String(org.description)}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          <Bot className="h-3.5 w-3.5 inline mr-1" />
                          {org.agentCount} agents
                        </span>
                        <span className="text-muted-foreground">
                          <FileJson className="h-3.5 w-3.5 inline mr-1" />
                          {org.contextCount} contexts
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Agents */}
        {recentAgents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-violet-600 dark:text-violet-400">Agent Registry</h2>
              <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentAgents.map((agent) => (
                <Link key={agent.id} href={`/agents/${agent.id}`}>
                  <Card className="group flex flex-col h-full transition-all hover:bg-muted/50 hover:shadow-md cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Bot className="h-5 w-5 text-muted-foreground shrink-0" />
                          <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {agent.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {agent.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            agent.approvalStatus === 'approved'
                              ? 'success'
                              : agent.approvalStatus === 'pending_approval'
                                ? 'pending_review'
                                : agent.approvalStatus === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                          }
                          className="text-xs"
                        >
                          {agent.approvalStatus}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(agent.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Agent Prompts */}
        {recentPrompts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-violet-600 dark:text-violet-400">Agent Prompt</h2>
              <Link href="/prompts" className="text-sm text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentPrompts.map((prompt) => (
                <Link key={prompt.id} href={`/prompts/${prompt.id}`}>
                  <Card className="group flex flex-col h-full transition-all hover:bg-muted/50 hover:shadow-md cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          <CardTitle className="text-base truncate font-mono">{prompt.name}</CardTitle>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {prompt.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {prompt.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={prompt.currentVersionId ? 'success' : 'secondary'} className="text-xs">
                          {prompt.currentVersionId ? 'Active' : 'Draft'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(prompt.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Start - only show when empty */}
        {promptStats.total === 0 && recentAgents.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Create Agent Context</p>
                    <p className="text-sm text-muted-foreground">
                      The "Reference Library" — data and documents agents can access.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Create Agent Prompt</p>
                    <p className="text-sm text-muted-foreground">
                      The "Employee Handbook" — instructions on behavior and safety.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Register agent</p>
                    <p className="text-sm text-muted-foreground">
                      Connect your A2A agents to the governance platform.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-2">Load Sample Data</p>
                <code className="text-xs font-mono text-muted-foreground">
                  POST /api/seed
                </code>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
