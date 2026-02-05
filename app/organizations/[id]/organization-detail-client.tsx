'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Bot, CheckCircle2, Clock, FileEdit, XCircle, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { formatDateTime } from '@/lib/utils';
import type { Organization } from '@/types';
import type { RegisteredAgent } from '@/types';

interface OrganizationDetailClientProps {
  org: Organization;
  ancestors: Organization[];
  children: Organization[];
  agents: RegisteredAgent[];
}

function AgentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'success' | 'secondary' | 'destructive' | 'outline' | 'pending_review'; icon: React.ElementType }> = {
    draft: { label: 'Draft', variant: 'secondary', icon: FileEdit },
    pending_approval: { label: 'Pending', variant: 'pending_review', icon: Clock },
    approved: { label: 'Active', variant: 'success', icon: CheckCircle2 },
    rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
  };
  const { label, variant, icon: Icon } = map[status] ?? { label: status ?? 'Draft', variant: 'secondary' as const, icon: FileEdit };
  return (
    <Badge variant={variant} className="text-xs">
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

export function OrganizationDetailClient({ org, ancestors, children, agents }: OrganizationDetailClientProps) {
  const router = useRouter();
  
  // Stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.approvalStatus === 'approved').length;
  const pendingAgents = agents.filter(a => a.approvalStatus === 'pending_approval').length;
  const draftAgents = agents.filter(a => !a.approvalStatus || a.approvalStatus === 'draft').length;

  const breadcrumbItems = [
    { label: 'Organizations', href: '/organizations' },
    ...ancestors.map((a) => ({ label: a.name, href: `/organizations/${a.id}` })),
    { label: org.name },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-background px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <Breadcrumb items={breadcrumbItems} className="mb-2" />
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-violet-600 shrink-0" />
              <h1 className="text-2xl font-semibold tracking-tight truncate">{org.name}</h1>
              {org.isRoot && <Badge variant="secondary">Root</Badge>}
            </div>
            {org.description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{org.description}</p>
            )}
          </div>
          <Link href={`/agents/new?orgId=${org.id}`}>
            <Button>
              <Bot className="h-4 w-4 mr-2" />
              Register agent
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Agents</p>
                <p className="text-2xl font-bold">{totalAgents}</p>
              </div>
              <div className="rounded-lg p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                <Bot className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Active</p>
                <p className="text-2xl font-bold text-emerald-600">{activeAgents}</p>
              </div>
              <div className="rounded-lg p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{pendingAgents}</p>
              </div>
              <div className="rounded-lg p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Draft</p>
                <p className="text-2xl font-bold text-slate-600">{draftAgents}</p>
              </div>
              <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                <FileEdit className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sub-orgs */}
        {children.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Sub-organizations ({children.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {children.map((c) => (
                  <Link
                    key={c.id}
                    href={`/organizations/${c.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors text-sm font-medium"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {c.name}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agents Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Registered Agents ({agents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No agents registered for this organization.</p>
                <Link href={`/agents/new?orgId=${org.id}`}>
                  <Button variant="outline" size="sm" className="mt-3">
                    Register first agent
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Agent Name</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Service URL</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => (
                        <tr
                          key={agent.id}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/agents/${agent.id}`)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">{agent.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-muted-foreground text-xs line-clamp-2 max-w-xs">
                              {agent.description || '—'}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <AgentStatusBadge status={agent.approvalStatus ?? 'draft'} />
                          </td>
                          <td className="py-3 px-4">
                            <a
                              href={agent.a2aUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground truncate block max-w-[200px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {agent.a2aUrl.replace(/^https?:\/\//, '')}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateTime(agent.updatedAt)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
