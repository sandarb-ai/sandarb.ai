'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight, Table2, LayoutGrid, Trash2, Clock, CheckCircle2, FileEdit, Database, Shield, Lock, Globe, Building2, User, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import { formatDateTime, truncate, cn } from '@/lib/utils';
import type { Context, DataClassification, RegulatoryHook, Organization } from '@/types';
import { DATA_CLASSIFICATION_OPTIONS, REGULATORY_HOOK_OPTIONS } from '@/types';

type ViewMode = 'table' | 'card';

const DATA_CLASS_LABELS: Record<DataClassification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
};

const DATA_CLASS_ICONS: Record<DataClassification, React.ElementType> = {
  public: Globe,
  internal: Shield,
  confidential: Lock,
  restricted: Lock,
};

const DATA_CLASS_COLORS: Record<DataClassification, string> = {
  public: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  internal: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  confidential: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  restricted: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
};

function ContextStatusBadge({ hasActiveVersion }: { hasActiveVersion: boolean }) {
  if (hasActiveVersion) {
    return <Badge variant="success" className="text-xs">Active</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">Draft</Badge>;
}

interface ContextsListClientProps {
  initialContexts: Context[];
  total: number;
  totalActive?: number;
  totalDraft?: number;
  page: number;
  pageSize: number;
}

export function ContextsListClient({ initialContexts, total, totalActive: totalActiveProp, totalDraft: totalDraftProp, page, pageSize }: ContextsListClientProps) {
  const router = useRouter();
  const [contexts, setContexts] = useState<Context[]>(initialContexts);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [dataClassificationFilter, setDataClassificationFilter] = useState<DataClassification | ''>('');
  const [regulatoryHookFilter, setRegulatoryHookFilter] = useState<RegulatoryHook | ''>('');

  useEffect(() => {
    fetch(apiUrl('/api/organizations'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setOrganizations(d.data as Organization[]);
        }
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this context?')) return;
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}`), { method: 'DELETE', headers: getWriteAuthHeaders() });
      if (res.ok) {
        setContexts((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
    }
  };

  const filteredContexts = contexts.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      (c.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchOrg = !orgFilter || c.orgId === orgFilter;
    const matchDataClass = !dataClassificationFilter || c.dataClassification === dataClassificationFilter;
    const matchReg =
      !regulatoryHookFilter ||
      (c.regulatoryHooks ?? []).includes(regulatoryHookFilter);
    return matchSearch && matchOrg && matchDataClass && matchReg;
  });

  // Stats: use API totals when provided so Total shows full DB count (e.g. 3200)
  const totalContexts = total;
  const activeContexts = totalActiveProp ?? contexts.filter((c) => !!c.currentVersionId).length;
  const draftContexts = totalDraftProp ?? contexts.filter((c) => !c.currentVersionId).length;

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-background px-6 py-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Breadcrumb items={[{ label: 'Contexts' }]} className="mb-2" />
              <h1 className="text-2xl font-semibold tracking-tight">Agent Context</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Reference data and documents agents can access at runtime. Versioned with approval workflow.
              </p>
            </div>
            <Link href="/contexts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Context
              </Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            <Card className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{totalContexts}</p>
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
                  <p className="text-lg font-bold">{activeContexts}</p>
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
                  <p className="text-lg font-bold">{draftContexts}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 pl-9 h-9"
              />
            </div>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9 shrink-0 min-w-[180px]"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
            >
              <option value="">All organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9 shrink-0"
              value={dataClassificationFilter}
              onChange={(e) => setDataClassificationFilter((e.target.value as DataClassification) || '')}
            >
              <option value="">All classification</option>
              {DATA_CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{DATA_CLASS_LABELS[opt]}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9 shrink-0"
              value={regulatoryHookFilter}
              onChange={(e) => setRegulatoryHookFilter((e.target.value as RegulatoryHook) || '')}
            >
              <option value="">All regulatory</option>
              {REGULATORY_HOOK_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
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
        {filteredContexts.length === 0 ? (
          search || orgFilter || dataClassificationFilter || regulatoryHookFilter ? (
            <EmptyState
              title="No contexts match filters"
              description="Try changing search or compliance filters."
            />
          ) : (
            <EmptyState
              icon={Database}
              title="No contexts yet"
              description="Create your first context — reference data and documents agents can access."
              actionLabel="Create Context"
              actionHref="/contexts/new"
            />
          )
        ) : viewMode === 'table' ? (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Context</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-24">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Version</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Classification</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Organization</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Created By</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Approved By</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Updated</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContexts.map((context) => {
                      const ClassIcon = context.dataClassification ? DATA_CLASS_ICONS[context.dataClassification] : Shield;
                      return (
                        <tr
                          key={context.id}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/contexts/${context.id}`)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="font-medium truncate">{context.name}</span>
                            </div>
                            {context.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5 pl-6 max-w-md">{context.description}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <ContextStatusBadge hasActiveVersion={!!context.currentVersionId} />
                          </td>
                          <td className="py-3 px-4">
                            {context.currentVersion ? (
                              <Badge variant="outline" className="font-mono text-xs">v{context.currentVersion.version}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {context.dataClassification ? (
                              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', DATA_CLASS_COLORS[context.dataClassification])}>
                                <ClassIcon className="h-3 w-3" />
                                {DATA_CLASS_LABELS[context.dataClassification]}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-muted-foreground">
                              {context.organization?.name ?? '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-muted-foreground">
                              {context.createdBy ? (
                                <span className="flex items-center gap-1" title={formatDateTime(context.createdAt)}>
                                  <User className="h-3 w-3 shrink-0" />
                                  {truncate(context.createdBy, 12)}
                                </span>
                              ) : (
                                <span>—</span>
                              )}
                              {context.createdAt && (
                                <div className="mt-0.5">{formatDateTime(context.createdAt)}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-muted-foreground">
                              {context.approvedBy ? (
                                <span className="flex items-center gap-1" title={context.approvedAt ? formatDateTime(context.approvedAt) : undefined}>
                                  <UserCheck className="h-3 w-3 shrink-0" />
                                  {truncate(context.approvedBy, 12)}
                                </span>
                              ) : (
                                <span>—</span>
                              )}
                              {context.approvedAt && (
                                <div className="mt-0.5">{formatDateTime(context.approvedAt)}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(context.updatedAt)}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(context.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {total.toLocaleString()} contexts
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => router.push(`/contexts?page=${page - 1}`)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => router.push(`/contexts?page=${page + 1}`)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredContexts.map((context) => {
                const ClassIcon = context.dataClassification ? DATA_CLASS_ICONS[context.dataClassification] : Shield;
                return (
                  <Card
                    key={context.id}
                    className="group flex flex-col transition-all hover:shadow-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/contexts/${context.id}`)}
                  >
                    <CardContent className="p-5 flex flex-col gap-3">
                      {/* Classification banner */}
                      {context.dataClassification && (
                        <div className={cn(
                          'flex items-center justify-between gap-2 -mx-5 -mt-5 px-4 py-2 border-b',
                          DATA_CLASS_COLORS[context.dataClassification].replace('text-', 'border-').split(' ')[0] + '/30'
                        )}>
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', DATA_CLASS_COLORS[context.dataClassification])}>
                            <ClassIcon className="h-3.5 w-3.5" />
                            {DATA_CLASS_LABELS[context.dataClassification]}
                          </span>
                          <ContextStatusBadge hasActiveVersion={!!context.currentVersionId} />
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Database className="h-5 w-5 text-muted-foreground shrink-0" />
                          <span className="font-semibold truncate">{context.name}</span>
                        </div>
                        {!context.dataClassification && (
                          <ContextStatusBadge hasActiveVersion={!!context.currentVersionId} />
                        )}
                      </div>

                      {/* Description */}
                      {context.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{context.description}</p>
                      )}

                      {/* Version & Organization */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {context.currentVersion && (
                          <Badge variant="outline" className="font-mono text-xs">v{context.currentVersion.version}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {context.organization?.name ?? '—'}
                        </span>
                      </div>

                      {/* Created By / Approved By */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border/60 pt-2">
                        <div>
                          <p className="font-medium text-foreground/80 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Created By
                          </p>
                          {context.createdBy ? (
                            <p title={formatDateTime(context.createdAt)}>{truncate(context.createdBy, 14)}</p>
                          ) : (
                            <p>—</p>
                          )}
                          {context.createdAt && <p className="mt-0.5">{formatDateTime(context.createdAt)}</p>}
                        </div>
                        <div>
                          <p className="font-medium text-foreground/80 flex items-center gap-1">
                            <UserCheck className="h-3 w-3" />
                            Approved By
                          </p>
                          {context.approvedBy ? (
                            <p title={context.approvedAt ? formatDateTime(context.approvedAt) : undefined}>{truncate(context.approvedBy, 14)}</p>
                          ) : (
                            <p>—</p>
                          )}
                          {context.approvedAt && <p className="mt-0.5">{formatDateTime(context.approvedAt)}</p>}
                        </div>
                      </div>

                      {/* Regulatory hooks */}
                      {(context.regulatoryHooks ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(context.regulatoryHooks ?? []).slice(0, 3).map((hook) => (
                            <Badge key={hook} variant="outline" className="text-xs">
                              {hook}
                            </Badge>
                          ))}
                          {(context.regulatoryHooks ?? []).length > 3 && (
                            <span className="text-xs text-muted-foreground">+{(context.regulatoryHooks ?? []).length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/60">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(context.updatedAt)}
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(context.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {total.toLocaleString()} contexts
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => router.push(`/contexts?page=${page - 1}`)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => router.push(`/contexts?page=${page + 1}`)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
