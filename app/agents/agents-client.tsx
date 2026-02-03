'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Bot, ExternalLink, Trash2, Table2, LayoutGrid, RefreshCw } from 'lucide-react';
import { formatDate, formatApprovedBy } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { apiUrl } from '@/lib/api';
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

export function AgentsPageClient({ initialAgents, initialOrgs }: AgentsPageClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<RegisteredAgent[]>(initialAgents);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [reseedLoading, setReseedLoading] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this agent from the registry?')) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch {
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
                A2A-compatible agents. Register by service URL or add manually. Sorted by last updated.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={reseedLoading}
                onClick={async () => {
                  setReseedLoading(true);
                  try {
                    const res = await fetch(apiUrl('/api/seed?reseed_agents=1'), { method: 'POST' });
                    if (res.ok) {
                      const listRes = await fetch(apiUrl('/api/agents'));
                      const listData = await listRes.json();
                      if (listData?.data) setAgents(listData.data);
                      router.refresh();
                    }
                  } finally {
                    setReseedLoading(false);
                  }
                }}
              >
                {reseedLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Reseed Agent Registry
              </Button>
              <Link href="/agents/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Register agent
                </Button>
              </Link>
            </div>
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
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-sm min-w-[900px]" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[200px]">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Approval</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[180px]">Service URL</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Created</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Last updated</th>
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
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {agent.approvalStatus === 'approved' && agent.approvedBy
                          ? `Approved by ${formatApprovedBy(agent.approvedBy)}`
                          : agent.approvalStatus === 'pending_approval' && agent.submittedBy
                            ? `Submitted by ${formatApprovedBy(agent.submittedBy)}`
                            : '—'}
                      </td>
                      <td className="py-3 px-4 min-w-0 max-w-[220px]">
                        <a
                          href={agent.a2aUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground truncate block"
                          title={agent.a2aUrl}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {agent.a2aUrl}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap" title={agent.createdAt}>
                        <span className="block">{formatDate(agent.createdAt)}</span>
                        {agent.createdBy && (
                          <span className="block text-xs mt-0.5">{formatApprovedBy(agent.createdBy)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap" title={agent.updatedAt}>
                        <span className="block">{formatDate(agent.updatedAt)}</span>
                        {agent.updatedBy && (
                          <span className="block text-xs mt-0.5">{formatApprovedBy(agent.updatedBy)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <a href={agent.a2aUrl} target="_blank" rel="noopener noreferrer" className="rounded-md">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Open service URL">
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
                <CardContent className="flex-1 flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description || agent.a2aUrl}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {(agent.approvalStatus === 'approved' && agent.approvedBy) || (agent.approvalStatus === 'pending_approval' && agent.submittedBy) ? (
                      <p>
                        {agent.approvalStatus === 'approved' ? 'Approved' : 'Submitted'} by {formatApprovedBy(agent.approvedBy ?? agent.submittedBy)}
                      </p>
                    ) : null}
                    <p>Created {formatDate(agent.createdAt)}{agent.createdBy ? ` · ${formatApprovedBy(agent.createdBy)}` : ''}</p>
                    <p>Updated {formatDate(agent.updatedAt)}{agent.updatedBy ? ` · ${formatApprovedBy(agent.updatedBy)}` : ''}</p>
                  </div>
                  <a
                    href={agent.a2aUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground truncate block mt-auto"
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
