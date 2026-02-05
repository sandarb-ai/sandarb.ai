'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import { Plus, Search, Building2, ExternalLink, Trash2, Table2, LayoutGrid, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { formatDateTime, cn } from '@/lib/utils';
import type { Organization } from '@/types';

type ViewMode = 'table' | 'card';

// Design pattern: Cards are fully clickable with view icon on hover

interface OrganizationsPageClientProps {
  initialOrgs: Organization[];
}

export function OrganizationsPageClient({ initialOrgs }: OrganizationsPageClientProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>(initialOrgs);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const handleDelete = async (id: string, isRoot: boolean) => {
    if (isRoot) {
      alert('Root organization cannot be deleted.');
      return;
    }
    if (!confirm('Delete this organization? Agents under it will also be removed.')) return;
    try {
      const res = await fetch(apiUrl(`/api/organizations/${id}`), { method: 'DELETE', headers: getWriteAuthHeaders() });
      if (res.ok) setOrgs(orgs.filter((o) => o.id !== id));
    } catch {
    }
  };

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <Breadcrumb items={[{ label: 'Organizations' }]} className="mb-2" />
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Root org and sub-orgs. Create orgs under root for teams (data, marketing, ops, etc.).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 pl-9 h-9"
            />
          </div>
          <div className="flex rounded-md border border-input bg-background p-0.5 h-9 ml-auto" role="group">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors',
                viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
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
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
          </div>
          <Link href="/organizations/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New organization
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {filtered.length === 0 ? (
          search ? (
            <EmptyState
              title="No organizations found"
              description={`No orgs match "${search}".`}
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="No organizations yet"
              description="Sandarb HQ is created automatically. Add sub-orgs for teams."
              actionLabel="New organization"
              actionHref="/organizations/new"
            />
          )
        ) : viewMode === 'table' ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-24">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-32">Slug</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Updated</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((org) => (
                    <tr
                      key={org.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/organizations/${org.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium truncate">{org.name}</span>
                        </div>
                        {(org.description || org.slug) && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 pl-6 max-w-md">
                            {org.description || `Slug: ${org.slug}`}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {org.isRoot ? (
                          <Badge variant="secondary" className="text-xs">Root</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sub-org</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {org.slug}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(org.updatedAt)}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {!org.isRoot && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Delete organization"
                            onClick={() => handleDelete(org.id, org.isRoot)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((org) => (
              <Card
                key={org.id}
                className="group flex flex-col relative transition-all hover:shadow-md hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/organizations/${org.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate">{org.name}</span>
                      {org.isRoot && (
                        <Badge variant="secondary" className="text-xs shrink-0">Root</Badge>
                      )}
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mr-1" />
                      {!org.isRoot && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-70 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete organization"
                          onClick={() => handleDelete(org.id, org.isRoot)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {org.description || `Slug: ${org.slug}`}
                  </p>
                  <div className="mt-auto pt-2 border-t border-border/60 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(org.updatedAt)}
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
