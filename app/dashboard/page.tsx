import Link from 'next/link';
import { FileJson, FileText, Activity, Zap, Bot, Building2 } from 'lucide-react';
import { Header } from '@/components/header';
import { StatsCard } from '@/components/stats-card';
import { LoadSampleDataCard } from '@/components/load-sample-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getContextCount, getRecentActivity } from '@/lib/contexts';
import { getTemplateCount } from '@/lib/templates';
import { getAgentCount } from '@/lib/agents';
import { getOrganizationsWithCounts } from '@/lib/dashboard';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let contextStats = { total: 0, active: 0 };
  let templateCount = 0;
  let agentCount = 0;
  let orgCards: Awaited<ReturnType<typeof getOrganizationsWithCounts>> = [];
  let recentActivity: Array<{ id: string; type: string; resource_type?: string; resource_id?: string; resource_name?: string; created_at: string }> = [];

  try {
    contextStats = await getContextCount();
    templateCount = getTemplateCount();
    agentCount = await getAgentCount();
    const allOrgs = await getOrganizationsWithCounts();
    orgCards = allOrgs.filter((o) => !o.isRoot);
    const raw = (await getRecentActivity(10)) as Record<string, unknown>[];
    recentActivity = raw.map((a) => ({
      id: String(a.id),
      type: String(a.type),
      resource_type: (a.resource_type as string) || undefined,
      resource_id: (a.resource_id as string) || undefined,
      resource_name: (a.resource_name as string) || undefined,
      created_at: String(a.created_at),
    }));
  } catch {
    // Fallback: show zeros and empty activity if DB not ready
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Dashboard"
        description="Aggregate metrics for Open Bank Inc (sample data)"
      />

      <div className="flex-1 p-6 space-y-6">
        {contextStats.total === 0 && orgCards.length === 0 && (
          <LoadSampleDataCard />
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Organizations"
            value={orgCards.length}
            description="Teams and divisions"
            icon={Building2}
            href="/organizations"
          />
          <StatsCard
            title="Agents"
            value={agentCount}
            description="Registered A2A agents"
            icon={Bot}
            href="/agents"
          />
          <StatsCard
            title="Total Contexts"
            value={contextStats.total}
            description="All contexts in the system"
            icon={FileJson}
            href="/contexts"
          />
          <StatsCard
            title="Active Contexts"
            value={contextStats.active}
            description="Currently active for injection"
            icon={Zap}
            href="/contexts"
          />
        </div>

        {orgCards.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Organizations</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orgCards.map((org) => (
                <Link key={org.id} href={`/organizations/${org.id}`}>
                  <Card className="flex flex-col h-full transition-colors hover:bg-muted/50 cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">{org.name}</CardTitle>
                      </div>
                      {org.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {org.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          <span className="text-2xl font-bold">{org.agentCount}</span>
                          <span className="text-sm text-muted-foreground">agents</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileJson className="h-4 w-4 text-muted-foreground" />
                          <span className="text-2xl font-bold">{org.contextCount}</span>
                          <span className="text-sm text-muted-foreground">contexts</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-auto">
                        View organization
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Link href="/contexts/new">
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer h-full">
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
                      <p className="font-medium">Create a Context</p>
                      <p className="text-sm text-muted-foreground">
                        Click the + button in the sidebar to create your first
                        context configuration.
                      </p>
                    </div>
                  </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Add Content</p>
                    <p className="text-sm text-muted-foreground">
                      Define your context using JSON or YAML format with
                      key-value pairs.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Use the API</p>
                    <p className="text-sm text-muted-foreground">
                      Inject context into your AI agents via the REST API
                      endpoint.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-2">API Example</p>
                <code className="text-xs font-mono text-muted-foreground">
                  GET /api/inject?name=my-context&format=json
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                Load sample data (bank & wealth management):{' '}
                <code className="rounded bg-muted px-1">POST /api/seed</code>
              </p>
            </CardContent>
          </Card>
          </Link>

          <Card>
            <CardHeader>
              <Link href="/contexts">
                <CardTitle className="hover:underline cursor-pointer">Recent Activity</CardTitle>
              </Link>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No recent activity. Create your first context to get started!
                </p>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => {
                    const activityHref =
                      activity.resource_type === 'context' && activity.resource_id
                        ? `/contexts/${activity.resource_id}`
                        : '/contexts';
                    return (
                      <Link
                        key={activity.id}
                        href={activityHref}
                        className="flex items-center justify-between rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              activity.type === 'create'
                                ? 'default'
                                : activity.type === 'delete'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="capitalize"
                          >
                            {activity.type}
                          </Badge>
                          <span className="text-sm font-medium">
                            {activity.resource_name ?? '—'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(activity.created_at)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
