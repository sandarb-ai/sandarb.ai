'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatRelativeTime, truncate } from '@/lib/utils';
import type { Context } from '@/types';

interface ContextCardProps {
  context: Context;
  onDelete?: (id: string) => void;
}

export function ContextCard({ context, onDelete }: ContextCardProps) {
  const router = useRouter();
  const contentPreview = JSON.stringify(context.content, null, 2);

  return (
    <Card
      className="group relative transition-shadow hover:shadow-md hover:bg-muted/50 cursor-pointer"
      onClick={() => router.push(`/contexts/${context.id}`)}
    >
      <div
        className="absolute top-2 right-2 flex items-center gap-1 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Link href={`/contexts/${context.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete?.(context.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <CardHeader className="pb-3 pr-20">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {context.name}
              {context.isActive ? (
                <Badge variant="success" className="text-xs">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
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
              {(context.regulatoryHooks ?? []).map((h) => (
                <Badge key={h} variant="outline" className="text-xs">
                  {h}
                </Badge>
              ))}
            </div>
            {/* Tags and metadata */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(context.tags ?? []).slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {(context.tags ?? []).length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{(context.tags ?? []).length - 3}
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
