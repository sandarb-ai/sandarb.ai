'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Bot, ExternalLink, Trash2, Table2, LayoutGrid, CheckCircle2, Clock, FileEdit, XCircle, Building2 } from 'lucide-react';
import { formatApprovedBy, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { RegisteredAgent } from '@/types';
import type { Organization } from '@/types';
import type { AgentStats } from '@/types';

type ViewMode = 'table' | 'card';

interface AgentsPageClientProps {
  initialAgents: RegisteredAgent[];
  initialOrgs: Organization[];
  initialStats: AgentStats;
}

function getOrgName(orgId: string, orgs: Organization[]): string {
  return orgs.find((o) => o.id === orgId)?.name ?? orgId;
}

/** Normalize API response to RegisteredAgent[] (accept snake_case or camelCase). */
function normalizeAgentList(raw: unknown[]): RegisteredAgent[] {
  return raw.map((item) => {
    const o = item as Record<string, unknown>;
    const str = (v: unknown) => (v == null ? undefined : String(v));
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String(x))) : [];
    const bool = (v: unknown) => Boolean(v);
    return {
      id: str(o.id) ?? '',
      orgId: str(o.orgId ?? o.org_id) ?? '',
      agentId: (o.agentId ?? o.agent_id) != null ? (str(o.agentId ?? o.agent_id) ?? null) : null,
      name: str(o.name) ?? '',
      description: o.description != null ? (str(o.description) ?? null) : null,
      a2aUrl: str(o.a2aUrl ?? o.a2a_url) ?? '',
      agentCard: ((o.agentCard ?? o.agent_card) as RegisteredAgent['agentCard']) ?? null,
      status: (str(o.status) || 'active') as RegisteredAgent['status'],
      approvalStatus: (str(o.approvalStatus ?? o.approval_status) || 'draft') as RegisteredAgent['approvalStatus'],
      approvedBy: (o.approvedBy ?? o.approved_by) != null ? (str(o.approvedBy ?? o.approved_by) ?? null) : null,
      approvedAt: (o.approvedAt ?? o.approved_at) != null ? (str(o.approvedAt ?? o.approved_at) ?? null) : null,
      submittedBy: (o.submittedBy ?? o.submitted_by) != null ? (str(o.submittedBy ?? o.submitted_by) ?? null) : null,
      createdBy: (o.createdBy ?? o.created_by) != null ? (str(o.createdBy ?? o.created_by) ?? null) : null,
      createdAt: str(o.createdAt ?? o.created_at) ?? '',
      updatedAt: str(o.updatedAt ?? o.updated_at) ?? '',
      updatedBy: (o.updatedBy ?? o.updated_by) != null ? (str(o.updatedBy ?? o.updated_by) ?? null) : null,
      ownerTeam: (o.ownerTeam ?? o.owner_team) != null ? (str(o.ownerTeam ?? o.owner_team) ?? null) : null,
      toolsUsed: arr(o.toolsUsed ?? o.tools_used),
      allowedDataScopes: arr(o.allowedDataScopes ?? o.allowed_data_scopes),
      piiHandling: bool(o.piiHandling ?? o.pii_handling),
      regulatoryScope: arr(o.regulatoryScope ?? o.regulatory_scope),
    };
  });
}

/** Single status badge: one value per agent (Draft, Pending, Active, Rejected). No "Approved" label. */
function AgentStatusBadge({ approvalStatus }: { approvalStatus: string }) {
  const map: Record<string, { label: string; variant: 'success' | 'secondary' | 'destructive' | 'outline' | 'pending_review' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    pending_approval: { label: 'Pending', variant: 'pending_review' },
    approved: { label: 'Active', variant: 'success' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };
  const { label, variant } = map[approvalStatus ?? 'draft'] ?? { label: approvalStatus ?? 'Draft', variant: 'secondary' as const };
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

type StatusFilter = null | 'approved' | 'draft' | 'pending_approval' | 'rejected';

function StatCard({
  label,
  value,
  variant = 'sky',
  icon: Icon,
  onClick,
  selected,
}: {
  label: string;
  value: number;
  variant?: 'sky' | 'teal' | 'violet' | 'orange' | 'rose' | 'slate' | 'emerald' | 'amber' | 'red';
  icon: React.ElementType;
  onClick?: () => void;
  selected?: boolean;
}) {
  const styles: Record<string, string> = {
    sky: 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30',
    teal: 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30',
    red: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30',
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50',
  };
  const s = styles[variant] ?? styles.slate;
  const content = (
    <CardContent className="p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
      </div>
      <div className={cn('rounded-lg p-2', s)}>
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  );
  return (
    <Card
      className={cn(
        'overflow-hidden transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        selected && 'ring-2 ring-primary'
      )}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full text-left block" aria-pressed={selected} aria-label={label}>
          {content}
        </button>
      ) : (
        content
      )}
    </Card>
  );
}

export function AgentsPageClient({ initialAgents, initialOrgs, initialStats }: AgentsPageClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<RegisteredAgent[]>(() => normalizeAgentList(initialAgents));
  const stats = initialStats;
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [statusFilterLoading, setStatusFilterLoading] = useState(false);

  const fetchAgentsByStatus = async (approvalStatus: StatusFilter) => {
    setStatusFilterLoading(true);
    try {
      const q = new URLSearchParams();
      if (approvalStatus) q.set('approval_status', approvalStatus);
      q.set('limit', '500');
      q.set('offset', '0');
      const path = '/api/agents?' + q.toString();
      const res = await fetch(apiUrl(path));
      const data = await res.json();
      if (data?.data) {
        // Handle paginated response shape { agents, total, limit, offset }
        const payload = data.data;
        const list = Array.isArray(payload)
          ? payload
          : (payload?.agents && Array.isArray(payload.agents))
            ? payload.agents
            : [];
        setAgents(normalizeAgentList(list));
      }
      setStatusFilter(approvalStatus);
      router.refresh();
    } finally {
      setStatusFilterLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this agent from the registry?')) return;
    try {
      const res = await fetch(apiUrl(`/api/agents/${id}`), { method: 'DELETE', headers: getWriteAuthHeaders() });
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
      <header className="border-b bg-background px-6 py-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Breadcrumb items={[{ label: 'Agents' }]} className="mb-2" />
              <h1 className="text-2xl font-semibold tracking-tight">Agent Registry</h1>
              <p className="text-sm text-muted-foreground mt-1">
                A2A-compatible agents. Register by service URL or add manually.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/agents/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Register agent
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats row - clickable cards filter list by status (Total = show all, same as current) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Total agents"
              value={stats.total}
              variant="sky"
              icon={Bot}
              onClick={() => fetchAgentsByStatus(null)}
              selected={statusFilter === null}
            />
            <StatCard
              label="Active"
              value={stats.approved}
              variant="emerald"
              icon={CheckCircle2}
              onClick={() => fetchAgentsByStatus('approved')}
              selected={statusFilter === 'approved'}
            />
            <StatCard
              label="Draft"
              value={stats.draft}
              variant="slate"
              icon={FileEdit}
              onClick={() => fetchAgentsByStatus('draft')}
              selected={statusFilter === 'draft'}
            />
            <StatCard
              label="Pending"
              value={stats.pending_approval}
              variant="amber"
              icon={Clock}
              onClick={() => fetchAgentsByStatus('pending_approval')}
              selected={statusFilter === 'pending_approval'}
            />
            <StatCard
              label="Rejected"
              value={stats.rejected}
              variant="red"
              icon={XCircle}
              onClick={() => fetchAgentsByStatus('rejected')}
              selected={statusFilter === 'rejected'}
            />
          </div>
          {statusFilterLoading && (
            <p className="text-xs text-muted-foreground">Loading agents…</p>
          )}

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
            <div className="flex rounded-md border border-input bg-background p-0.5 h-9 ml-auto" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors',
                  viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
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
                  viewMode === 'card' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
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
            <EmptyState title="No agents found" description="Try changing filters." />
          ) : (
            <EmptyState
              icon={Bot}
              title="No agents registered"
              description="Register an A2A agent by URL or add one manually."
              actionLabel="Register agent"
              actionHref="/agents/new"
            />
          )
        ) : viewMode === 'table' ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: 800 }}>
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[22%]">Agent</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[14%]">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[18%]">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[14%]">Updated</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[24%]">Service URL</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-[8%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/agents/${agent.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium truncate">{agent.name}</span>
                        </div>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 pl-6">{agent.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/organizations/${agent.orgId}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors text-xs font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Building2 className="h-3 w-3" />
                          {getOrgName(agent.orgId, initialOrgs)}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <AgentStatusBadge approvalStatus={agent.approvalStatus ?? 'draft'} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(agent.updatedAt)}
                        {agent.updatedBy && <span className="block truncate mt-0.5">{formatApprovedBy(agent.updatedBy)}</span>}
                      </td>
                      <td className="py-3 px-4 min-w-0">
                        <a
                          href={agent.a2aUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground truncate block text-xs"
                          title={agent.a2aUrl}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {agent.a2aUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <a href={agent.a2aUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Open URL">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Delete"
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
                <CardContent className="p-5 flex flex-col gap-3">
                  {/* Organization banner */}
                  <div className="flex items-center justify-between gap-2 -mx-5 -mt-5 px-4 py-2.5 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/30">
                    <Link
                      href={`/organizations/${agent.orgId}`}
                      className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 transition-colors text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Building2 className="h-4 w-4" />
                      {getOrgName(agent.orgId, initialOrgs)}
                    </Link>
                    <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
                      <AgentStatusBadge approvalStatus={agent.approvalStatus ?? 'draft'} />
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <Bot className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate">{agent.name}</span>
                    </div>
                  </div>
                  {agent.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground truncate" title={agent.a2aUrl}>
                    {agent.a2aUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </p>
                  <div className="text-xs text-muted-foreground flex items-center justify-end mt-auto pt-2 border-t border-border/60">
                    <span>{formatDateTime(agent.updatedAt)}{agent.updatedBy ? ` · ${formatApprovedBy(agent.updatedBy)}` : ''}</span>
                  </div>
                  <div className="flex justify-end gap-0.5 -mb-1" onClick={(e) => e.stopPropagation()}>
                    <a href={agent.a2aUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(agent.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
