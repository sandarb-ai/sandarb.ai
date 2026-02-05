'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Trash2, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatRelativeTime, truncate, toTagList } from '@/lib/utils';
import type { Context } from '@/types';

interface ContextCardProps {
  context: Context;
  onDelete?: (id: string) => void;
}

export function ContextCard({ context, onDelete }: ContextCardProps) {
  const router = useRouter();
  const contentPreview = context.content != null ? JSON.stringify(context.content, null, 2) : '';
  const tags = toTagList(context.tags);
  const regulatoryHooks = toTagList(context.regulatoryHooks);

  return (
    <Card
      className="group transition-all hover:shadow-md hover:bg-muted/50 cursor-pointer"
      onClick={() => router.push(`/contexts/${context.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span className="break-words">{context.name}</span>
              {context.isActive ? (
                <Badge variant="success" className="text-xs shrink-0">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Inactive
                </Badge>
              )}
            </CardTitle>
            {context.description && (
              <CardDescription>
                {truncate(context.description, 80)}
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
              aria-label="Delete context"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete?.(context.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Content Preview */}
            <div className="rounded-md bg-muted p-3 font-mono text-xs overflow-hidden">
              <pre className="max-h-24 overflow-hidden text-muted-foreground">
                {truncate(contentPreview, 200)}
              </pre>
            </div>

            {/* Compliance metadata (system-enforced) */}
            <div className="flex flex-wrap gap-1">
              {context.lineOfBusiness && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {context.lineOfBusiness.replace('_', ' ')}
                </Badge>
              )}
              {context.dataClassification && (
                <Badge variant="outline" className="text-xs capitalize">
                  {context.dataClassification}
                </Badge>
              )}
              {regulatoryHooks.map((h) => (
                <Badge key={h} variant="outline" className="text-xs">
                  {h}
                </Badge>
              ))}
            </div>
            {/* Linked agents: which agent(s) this context belongs to */}
            <div className="border-t border-border/60 pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Bot className="h-3 w-3" />
                Used by
              </p>
              {(context.agents ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(context.agents ?? []).slice(0, 4).map((a) => (
                    <Link
                      key={a.id}
                      href={`/agents/${a.id}`}
                      className="text-xs font-medium text-primary hover:underline truncate max-w-[8rem]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.name}
                    </Link>
                  ))}
                  {(context.agents ?? []).length > 4 && (
                    <span className="text-xs text-muted-foreground">+{(context.agents ?? []).length - 4} more</span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Not linked to any agent</p>
              )}
            </div>

            {/* Tags and metadata */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{tags.length - 3}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(context.updatedAt)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}
