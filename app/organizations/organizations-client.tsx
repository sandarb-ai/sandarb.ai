'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { Plus, Search, Building2, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import type { Organization } from '@/types';

// Design pattern: Cards are fully clickable with view icon on hover

interface OrganizationsPageClientProps {
  initialOrgs: Organization[];
}

export function OrganizationsPageClient({ initialOrgs }: OrganizationsPageClientProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>(initialOrgs);
  const [search, setSearch] = useState('');

  const handleDelete = async (id: string, isRoot: boolean) => {
    if (isRoot) {
      alert('Root organization cannot be deleted.');
      return;
    }
    if (!confirm('Delete this organization? Agents under it will also be removed.')) return;
    try {
      const res = await fetch(apiUrl(`/api/organizations/${id}`), { method: 'DELETE' });
      if (res.ok) setOrgs(orgs.filter((o) => o.id !== id));
    } catch {
    }
  };

  const filtered = orgs.filter(
    (o) =>
      !o.isRoot &&
      (o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.slug.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Root org and sub-orgs. Create orgs under root for teams (data, marketing, ops, etc.).
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
            />
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
              description="A root organization is created automatically. Add sub-orgs for teams."
              actionLabel="New organization"
              actionHref="/organizations/new"
            />
          )
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
