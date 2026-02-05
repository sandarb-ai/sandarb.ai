'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, Clock, CheckCircle2, FileEdit, Table2, LayoutGrid, FileText, User, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { apiUrl } from '@/lib/api';
import { formatDateTime, truncate, cn } from '@/lib/utils';
import type { Prompt } from '@/types';

type ViewMode = 'table' | 'card';

interface PromptsListClientProps {
  initialPrompts: Prompt[];
}

function PromptStatusBadge({ hasActiveVersion }: { hasActiveVersion: boolean }) {
  if (hasActiveVersion) {
    return <Badge variant="success" className="text-xs">Active</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">Draft</Badge>;
}

export function PromptsListClient({ initialPrompts }: PromptsListClientProps) {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt and all its versions?')) return;
    try {
      const res = await fetch(apiUrl(`/api/prompts/${id}`), { method: 'DELETE' });
      if (res.ok) {
        setPrompts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
    }
  };

  const filteredPrompts = prompts.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // Stats
  const totalPrompts = prompts.length;
  const activePrompts = prompts.filter((p) => !!p.currentVersionId).length;
  const draftPrompts = prompts.filter((p) => !p.currentVersionId).length;

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-background px-6 py-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Agent Prompt</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Versioned AI prompts with approval workflow. Defines agent behavior, tone, and safety boundaries.
              </p>
            </div>
            <Link href="/prompts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Prompt
              </Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            <Card className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{totalPrompts}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-lg font-bold">{activePrompts}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                  <FileEdit className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Draft</p>
                  <p className="text-lg font-bold">{draftPrompts}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search prompts..."
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
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {filteredPrompts.length === 0 ? (
          search ? (
            <EmptyState title="No prompts match your search" description="Try a different search term." />
          ) : (
            <EmptyState
              icon={FileText}
              title="No prompts yet"
              description="Create your first prompt to define agent behavior, tone, and safety boundaries."
              actionLabel="Create Prompt"
              actionHref="/prompts/new"
            />
          )
        ) : viewMode === 'table' ? (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Prompt</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-24">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Version</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Organization</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Created By</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Approved By</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Updated</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrompts.map((prompt) => (
                      <tr
                        key={prompt.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => router.push(`/prompts/${prompt.id}`)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="font-medium truncate">{prompt.name}</span>
                          </div>
                          {prompt.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5 pl-6 max-w-md">{prompt.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <PromptStatusBadge hasActiveVersion={!!prompt.currentVersionId} />
                        </td>
                        <td className="py-3 px-4">
                          {prompt.currentVersion ? (
                            <Badge variant="outline" className="font-mono text-xs">v{prompt.currentVersion.version}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-muted-foreground">
                            {prompt.organizations?.length
                              ? prompt.organizations.map((org) => org.name).join(', ')
                              : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs text-muted-foreground">
                            {prompt.createdBy ? (
                              <span className="flex items-center gap-1" title={formatDateTime(prompt.createdAt)}>
                                <User className="h-3 w-3 shrink-0" />
                                {truncate(prompt.createdBy, 12)}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                            {prompt.createdAt && (
                              <div className="mt-0.5">{formatDateTime(prompt.createdAt)}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs text-muted-foreground">
                            {prompt.approvedBy ? (
                              <span className="flex items-center gap-1" title={prompt.approvedAt ? formatDateTime(prompt.approvedAt) : undefined}>
                                <UserCheck className="h-3 w-3 shrink-0" />
                                {truncate(prompt.approvedBy, 12)}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                            {prompt.approvedAt && (
                              <div className="mt-0.5">{formatDateTime(prompt.approvedAt)}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(prompt.updatedAt)}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(prompt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrompts.map((prompt) => (
              <Card
                key={prompt.id}
                className="group flex flex-col transition-all hover:shadow-md hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/prompts/${prompt.id}`)}
              >
                <CardContent className="p-5 flex flex-col gap-3">
                  {/* Header with status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate">{prompt.name}</span>
                    </div>
                    <PromptStatusBadge hasActiveVersion={!!prompt.currentVersionId} />
                  </div>

                  {/* Description */}
                  {prompt.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{prompt.description}</p>
                  )}

                  {/* Version & Organization */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {prompt.currentVersion && (
                      <Badge variant="outline" className="font-mono text-xs">v{prompt.currentVersion.version}</Badge>
                    )}
                    {prompt.organizations?.length ? (
                      <span className="text-xs text-muted-foreground">
                        {prompt.organizations.map((org) => org.name).join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Created By / Approved By (match context cards) */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border/60 pt-2">
                    <div>
                      <p className="font-medium text-foreground/80 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Created By
                      </p>
                      {prompt.createdBy ? (
                        <p title={formatDateTime(prompt.createdAt)}>{truncate(prompt.createdBy, 14)}</p>
                      ) : (
                        <p>—</p>
                      )}
                      {prompt.createdAt && <p className="mt-0.5">{formatDateTime(prompt.createdAt)}</p>}
                    </div>
                    <div>
                      <p className="font-medium text-foreground/80 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        Approved By
                      </p>
                      {prompt.approvedBy ? (
                        <p title={prompt.approvedAt ? formatDateTime(prompt.approvedAt) : undefined}>{truncate(prompt.approvedBy, 14)}</p>
                      ) : (
                        <p>—</p>
                      )}
                      {prompt.approvedAt && <p className="mt-0.5">{formatDateTime(prompt.approvedAt)}</p>}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/60">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(prompt.updatedAt)}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(prompt.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
