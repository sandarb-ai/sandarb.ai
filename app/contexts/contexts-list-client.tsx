'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContextCard } from '@/components/context-card';
import { EmptyState } from '@/components/empty-state';
import type { Context, LineOfBusiness, DataClassification, RegulatoryHook } from '@/types';
import {
  LINE_OF_BUSINESS_OPTIONS,
  DATA_CLASSIFICATION_OPTIONS,
  REGULATORY_HOOK_OPTIONS,
} from '@/types';

const LOB_LABELS: Record<LineOfBusiness, string> = {
  retail: 'Retail',
  investment_banking: 'Investment Banking',
  wealth_management: 'Wealth Management',
};

const DATA_CLASS_LABELS: Record<DataClassification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
};

interface ContextsListClientProps {
  initialContexts: Context[];
  total: number;
  page: number;
  pageSize: number;
}

export function ContextsListClient({ initialContexts, total, page, pageSize }: ContextsListClientProps) {
  const router = useRouter();
  const [contexts] = useState<Context[]>(initialContexts);
  const [search, setSearch] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [lineOfBusinessFilter, setLineOfBusinessFilter] = useState<LineOfBusiness | ''>('');
  const [dataClassificationFilter, setDataClassificationFilter] = useState<DataClassification | ''>('');
  const [regulatoryHookFilter, setRegulatoryHookFilter] = useState<RegulatoryHook | ''>('');

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this context?')) return;
    try {
      const res = await fetch(`/api/contexts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.reload();
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
    const matchLOB = !lineOfBusinessFilter || c.lineOfBusiness === lineOfBusinessFilter;
    const matchDataClass = !dataClassificationFilter || c.dataClassification === dataClassificationFilter;
    const matchReg =
      !regulatoryHookFilter ||
      (c.regulatoryHooks ?? []).includes(regulatoryHookFilter);
    return matchSearch && matchLOB && matchDataClass && matchReg;
  });

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Agent Context</h1>
              <p className="text-sm text-muted-foreground">
                The "Reference Library" for agents: data and documents agents can access at runtime.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-nowrap overflow-x-auto pb-1 -mx-1 min-h-10">
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
              className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9 shrink-0 w-[8.5rem]"
              value={lineOfBusinessFilter}
              onChange={(e) => setLineOfBusinessFilter((e.target.value as LineOfBusiness) || '')}
            >
              <option value="">All LOB</option>
              {LINE_OF_BUSINESS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{LOB_LABELS[opt]}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9 shrink-0 w-[10rem]"
              value={dataClassificationFilter}
              onChange={(e) => setDataClassificationFilter((e.target.value as DataClassification) || '')}
            >
              <option value="">All classification</option>
              {DATA_CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{DATA_CLASS_LABELS[opt]}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9 shrink-0 w-[8.5rem]"
              value={regulatoryHookFilter}
              onChange={(e) => setRegulatoryHookFilter((e.target.value as RegulatoryHook) || '')}
            >
              <option value="">All regulatory</option>
              {REGULATORY_HOOK_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <Link href="/contexts/new" className="shrink-0 ml-1">
              <Button className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                New Agent Context
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {filteredContexts.length === 0 ? (
          search || lineOfBusinessFilter || dataClassificationFilter || regulatoryHookFilter ? (
            <EmptyState
              title="No contexts match filters"
              description="Try changing search or compliance filters."
            />
          ) : (
            <EmptyState
              title="No Agent Context yet"
              description="Create your first context — the reference data and documents agents can access."
              actionLabel="Create Agent Context"
              actionHref="/contexts/new"
            />
          )
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredContexts.map((context) => (
                <ContextCard
                  key={context.id}
                  context={context}
                  onDelete={handleDelete}
                />
              ))}
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
