'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Bot, ExternalLink, GitPullRequest, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import type { RegisteredAgent } from '@/types';
import type { Organization } from '@/types';

interface AgentsPageClientProps {
  initialAgents: RegisteredAgent[];
  initialOrgs: Organization[];
}

export function AgentsPageClient({ initialAgents, initialOrgs }: AgentsPageClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<RegisteredAgent[]>(initialAgents);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('');

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this agent from the registry?')) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const byOrg = (a: RegisteredAgent) => !orgFilter || a.orgId === orgFilter;
  const bySearch = (a: RegisteredAgent) =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase()) ||
    a.a2aUrl.toLowerCase().includes(search.toLowerCase());
  const filtered = agents.filter(byOrg).filter(bySearch);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            A2A-compatible agents. Register by URL or add manually.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-40"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
          >
            <option value="">All orgs</option>
            {initialOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <Link href="/agents/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Register agent
            </Button>
          </Link>
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
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <Card
                key={agent.id}
                className="flex flex-col relative transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/agents/${agent.id}`)}
              >
                <div
                  className="absolute top-2 right-2 flex items-center gap-1 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/agents/${agent.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(agent.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-20">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{agent.name}</span>
                    <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {agent.status}
                    </Badge>
                    <Badge
                      variant={
                        (agent.approvalStatus ?? 'draft') === 'approved'
                          ? 'default'
                          : (agent.approvalStatus ?? 'draft') === 'pending_approval'
                            ? 'secondary'
                            : 'outline'
                      }
                      className="text-xs capitalize"
                    >
                      {(agent.approvalStatus ?? 'draft') === 'pending_approval' ? (
                        <><GitPullRequest className="h-3 w-3 mr-1 inline" /> Pending</>
                      ) : (
                        agent.approvalStatus ?? 'draft'
                      )}
                    </Badge>
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
                    className="text-muted-foreground hover:text-foreground self-start mt-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
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
