'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Bot, ExternalLink, GitPullRequest, Trash2, Table2, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';
import type { RegisteredAgent } from '@/types';
import type { Organization } from '@/types';

type ViewMode = 'table' | 'card';

interface AgentsPageClientProps {
  initialAgents: RegisteredAgent[];
  initialOrgs: Organization[];
}

function getOrgName(orgId: string, orgs: Organization[]): string {
  return orgs.find((o) => o.id === orgId)?.name ?? orgId;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === 'active' ? 'success' : 'secondary'} className="text-xs capitalize">
      {status}
    </Badge>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const s = status ?? 'draft';
  return (
    <Badge
      variant={s === 'approved' ? 'success' : s === 'pending_approval' ? 'secondary' : 'outline'}
      className="text-xs capitalize"
    >
      {s === 'pending_approval' ? (
        <><GitPullRequest className="h-3 w-3 mr-1 inline" /> Pending</>
      ) : (
        s
      )}
    </Badge>
  );
}

export function AgentsPageClient({ initialAgents, initialOrgs }: AgentsPageClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<RegisteredAgent[]>(initialAgents);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this agent from the registry?')) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const nonRootOrgIds = new Set(initialOrgs.filter((o) => !o.isRoot).map((o) => o.id));
  const agentsNotInRoot = agents.filter((a) => nonRootOrgIds.has(a.orgId));
  const orgsForDropdown = initialOrgs.filter((o) => !o.isRoot);
  const byOrg = (a: RegisteredAgent) => !orgFilter || a.orgId === orgFilter;
  const bySearch = (a: RegisteredAgent) =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase()) ||
    a.a2aUrl.toLowerCase().includes(search.toLowerCase());
  const filtered = agentsNotInRoot.filter(byOrg).filter(bySearch);

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Agent Registry</h1>
              <p className="text-sm text-muted-foreground">
                A2A-compatible agents. Register by URL or add manually.
              </p>
            </div>
            <Link href="/agents/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Register agent
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 pl-9 h-9"
              />
            </div>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9 min-w-[140px]"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
            >
              <option value="">All orgs</option>
              {orgsForDropdown.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <div className="flex rounded-md border border-input bg-background p-0.5 h-9" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors',
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
                aria-pressed={viewMode === 'table'}
              >
                <Table2 className="h-4 w-4" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={cn(
                  'flex items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors',
                  viewMode === 'card'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
                aria-pressed={viewMode === 'card'}
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {filtered.length === 0 ? (
          search || orgFilter ? (
            <EmptyState
              title="No agents found"
              description="Try changing filters."
            />
          ) : (
            <EmptyState
              icon={Bot}
              title="No agents registered"
              description="Register an A2A agent by URL or add one manually. Use this registry to choose which agents are available to your team."
              actionLabel="Register agent"
              actionHref="/agents/new"
            />
          )
        ) : viewMode === 'table' ? (
          <div className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Approval</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[12rem]">A2A URL</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-b border-border/80 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/agents/${agent.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{agent.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {getOrgName(agent.orgId, initialOrgs)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={agent.status} />
                      </td>
                      <td className="py-3 px-4">
                        <ApprovalBadge status={agent.approvalStatus ?? 'draft'} />
                      </td>
                      <td className="py-3 px-4">
                        <a
                          href={agent.a2aUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground truncate block max-w-[16rem]"
                          title={agent.a2aUrl}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {agent.a2aUrl}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <a href={agent.a2aUrl} target="_blank" rel="noopener noreferrer" className="rounded-md">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Open A2A URL">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Delete agent"
                            onClick={() => handleDelete(agent.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <Card
                key={agent.id}
                className="group flex flex-col relative transition-all hover:shadow-md hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/agents/${agent.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <Bot className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate">{agent.name}</span>
                      <StatusBadge status={agent.status} />
                      <ApprovalBadge status={agent.approvalStatus ?? 'draft'} />
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mr-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-70 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete agent"
                        onClick={() => handleDelete(agent.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {agent.description || agent.a2aUrl}
                  </p>
                  <a
                    href={agent.a2aUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground self-start mt-auto truncate max-w-full"
                    title={agent.a2aUrl}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {agent.a2aUrl}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
