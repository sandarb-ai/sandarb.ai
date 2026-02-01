'use client';

import { diffLines } from 'diff';
import { cn } from '@/lib/utils';

export interface ContentDiffViewProps {
  /** Previous version (e.g. revision or older). */
  oldContent: Record<string, unknown>;
  /** Newer version (e.g. current context or later revision). */
  newContent: Record<string, unknown>;
  /** Label for old version (e.g. "v1" or "Revision 2024-01-15"). */
  oldLabel?: string;
  /** Label for new version (e.g. "Current" or "v2"). */
  newLabel?: string;
  className?: string;
}

/**
 * Renders a line-by-line diff of two JSON context contents.
 * Green = added, red = removed. Used in Version History to compare revisions.
 */
export function ContentDiffView({
  oldContent,
  newContent,
  oldLabel = 'Previous',
  newLabel = 'Current',
  className,
}: ContentDiffViewProps) {
  const oldStr = JSON.stringify(oldContent, null, 2);
  const newStr = JSON.stringify(newContent, null, 2);
  const changes = diffLines(oldStr, newStr);

  return (
    <div className={cn('rounded-lg border bg-muted/30 overflow-hidden', className)}>
      <div className="flex items-center gap-4 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>{oldLabel}</span>
        <span>{newLabel}</span>
      </div>
      <pre className="p-3 text-xs font-mono overflow-x-auto max-h-[70vh] overflow-y-auto whitespace-pre">
        {changes.map((part, i) => {
          const style = part.added
            ? 'bg-green-500/20 text-green-800 dark:text-green-300'
            : part.removed
              ? 'bg-red-500/20 text-red-800 dark:text-red-300'
              : 'text-muted-foreground';
          const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
          const lines = part.value.split('\n');
          return (
            <span key={i} className={cn('block', style)}>
              {lines.map((line, j) => (
                <span key={j} className="block">
                  {prefix}
                  {line}
                </span>
              ))}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
