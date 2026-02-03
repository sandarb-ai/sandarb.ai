'use client';

import { diffLines } from 'diff';
import { cn } from '@/lib/utils';

export interface TextDiffViewProps {
  /** Previous version text. */
  oldText: string;
  /** Newer version text. */
  newText: string;
  /** Label for old version (e.g. "v1" or "Previous"). */
  oldLabel?: string;
  /** Label for new version (e.g. "v2" or "Current"). */
  newLabel?: string;
  className?: string;
}

/**
 * Renders a line-by-line diff of two text contents (e.g. prompt body).
 * Green = added, red = removed. Used in Prompt Version History to compare versions.
 */
export function TextDiffView({
  oldText,
  newText,
  oldLabel = 'Previous',
  newLabel = 'Current',
  className,
}: TextDiffViewProps) {
  const changes = diffLines(oldText, newText);

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
