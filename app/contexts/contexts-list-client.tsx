'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
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
}

export function ContextsListClient({ initialContexts }: ContextsListClientProps) {
  const [contexts] = useState<Context[]>(initialContexts);
  const [search, setSearch] = useState('');
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
    } catch (error) {
      console.error('Failed to delete context:', error);
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
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contexts</h1>
          <p className="text-sm text-muted-foreground">
            Manage context configurations. Use compliance filters for audit search.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 pl-9"
            />
          </div>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-40"
            value={lineOfBusinessFilter}
            onChange={(e) => setLineOfBusinessFilter((e.target.value as LineOfBusiness) || '')}
          >
            <option value="">All LOB</option>
            {LINE_OF_BUSINESS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{LOB_LABELS[opt]}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-36"
            value={dataClassificationFilter}
            onChange={(e) => setDataClassificationFilter((e.target.value as DataClassification) || '')}
          >
            <option value="">All classification</option>
            {DATA_CLASSIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{DATA_CLASS_LABELS[opt]}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-32"
            value={regulatoryHookFilter}
            onChange={(e) => setRegulatoryHookFilter((e.target.value as RegulatoryHook) || '')}
          >
            <option value="">All regulatory</option>
            {REGULATORY_HOOK_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <Link href="/contexts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Context
            </Button>
          </Link>
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
              title="No contexts yet"
              description="Create your first context to start managing AI agent configurations."
              actionLabel="Create Context"
              actionHref="/contexts/new"
            />
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContexts.map((context) => (
              <ContextCard
                key={context.id}
                context={context}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
