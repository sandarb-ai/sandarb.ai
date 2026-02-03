'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { formatRelativeTime, truncate } from '@/lib/utils';
import type { Prompt } from '@/types';

interface PromptsListClientProps {
  initialPrompts: Prompt[];
}

export function PromptsListClient({ initialPrompts }: PromptsListClientProps) {
  const router = useRouter();
  const [prompts] = useState<Prompt[]>(initialPrompts);
  const [search, setSearch] = useState('');

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt and all its versions?')) return;
    try {
      const res = await fetch(`/api/prompts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
    }
  };

  const filteredPrompts = prompts.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchSearch;
  });

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Agent Prompt</h1>
              <p className="text-sm text-muted-foreground">
                All AI prompts in one place. Versioned, approval workflow, and auditable for AI governance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search prompts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9 h-9"
              />
            </div>
            <Link href="/prompts/new" className="ml-auto">
              <Button className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                New Agent Prompt
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {filteredPrompts.length === 0 ? (
          search ? (
            <EmptyState
              title="No prompts match your search"
              description="Try a different search term."
            />
          ) : (
            <EmptyState
              title="No Agent Prompt yet"
              description="Create your first prompt to define agent behavior, tone, and safety boundaries."
              actionLabel="Create Agent Prompt"
              actionHref="/prompts/new"
            />
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PromptCardProps {
  prompt: Prompt;
  onDelete?: (id: string) => void;
}

function PromptCard({ prompt, onDelete }: PromptCardProps) {
  const router = useRouter();

  return (
    <Card
      className="group transition-all hover:shadow-md hover:bg-muted/50 cursor-pointer"
      onClick={() => router.push(`/prompts/${prompt.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span className="break-words font-mono text-sm">{prompt.name}</span>
              {prompt.currentVersionId ? (
                <Badge variant="success" className="text-xs shrink-0">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs shrink-0">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No version
                </Badge>
              )}
            </CardTitle>
            {prompt.description && (
              <CardDescription>
                {truncate(prompt.description, 80)}
              </CardDescription>
            )}
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
              aria-label="Delete prompt"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete?.(prompt.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {(prompt.tags ?? []).slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {(prompt.tags ?? []).length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{(prompt.tags ?? []).length - 4}
              </Badge>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(prompt.updatedAt)}
            </span>
            {prompt.projectId && (
              <span className="truncate max-w-[100px]">
                Project: {prompt.projectId}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
