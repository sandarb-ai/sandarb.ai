'use client';

import { useState, useMemo } from 'react';
import { Copy, Check, AlertCircle, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatContent } from '@/lib/utils';
import type { ContextContent, InjectionFormat } from '@/types';

interface ContextPreviewProps {
  content: ContextContent;
  contextName: string;
  /** Compact mode: hide duplicate header, empty state, smaller API section */
  compact?: boolean;
}

function isEmptyContent(content: ContextContent): boolean {
  if (typeof content === 'string') return content.trim().length === 0;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return true;
  return Object.keys(content).length === 0;
}

export function ContextPreview({ content, contextName, compact }: ContextPreviewProps) {
  const [format, setFormat] = useState<InjectionFormat>('json');
  const [copied, setCopied] = useState(false);

  const isStringMode = typeof content === 'string';
  const safeContent = isStringMode ? {} : (content && typeof content === 'object' && !Array.isArray(content) ? content : {});
  const empty = isEmptyContent(content);
  const { output: formattedContent, error: formatError } = useMemo(() => {
    if (empty) return { output: '', error: null };
    // For string content (Jinja2 templates), show the raw string
    if (isStringMode) {
      return { output: content as string, error: null };
    }
    try {
      const fmt = format === 'xml' ? 'text' : format;
      const out = formatContent(safeContent, fmt);
      return { output: out, error: null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Failed to format preview' };
    }
  }, [content, safeContent, format, empty, isStringMode]);

  const apiUrl = `/api/inject?name=${encodeURIComponent(contextName || 'context-name')}&format=${format}`;

  const handleCopy = async () => {
    if (formatError || !formattedContent) return;
    await navigator.clipboard.writeText(formattedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={compact ? 'flex flex-col h-full min-h-0' : 'space-y-4'}>
      {!compact && <h3 className="font-medium">Injection Preview</h3>}

      {/* Format tabs + copy */}
      <div className={`flex items-center justify-between shrink-0 ${compact ? 'px-3 pt-2 pb-1 border-b border-border/60' : ''}`}>
        <Tabs value={format} onValueChange={(v) => setFormat(v as InjectionFormat)}>
          <TabsList className={compact ? 'h-7' : 'h-8'}>
            <TabsTrigger value="json" className="text-xs px-2">JSON</TabsTrigger>
            <TabsTrigger value="yaml" className="text-xs px-2">YAML</TabsTrigger>
            <TabsTrigger value="text" className="text-xs px-2">Text</TabsTrigger>
          </TabsList>
        </Tabs>
        {!empty && formattedContent && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>

      {/* Preview area — empty state when no content */}
      <div className={`relative flex-1 min-h-[120px] overflow-auto ${compact ? 'p-3' : ''}`}>
        {formatError ? (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{formatError}</span>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-4 py-6 rounded-lg bg-muted/40 border border-dashed border-muted-foreground/20">
            <FileJson className="h-10 w-10 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Edit content to see live preview</p>
            <p className="text-xs text-muted-foreground mt-0.5">JSON, YAML, or text — as your agent would receive it</p>
          </div>
        ) : (
          <pre className="rounded-lg bg-muted/50 p-3 font-mono text-xs overflow-auto min-h-[120px] max-h-[none] whitespace-pre-wrap break-words">
            {formattedContent || '{}'}
          </pre>
        )}
      </div>

      {/* API section — compact when embedded */}
      {compact ? (
        <div className="shrink-0 px-3 pb-2 pt-1 border-t border-border/40 flex items-center gap-2 flex-wrap">
          <code className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px] lg:max-w-none" title={apiUrl}>
            GET {apiUrl}
          </code>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => navigator.clipboard.writeText(apiUrl)}>
            Copy URL
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">API Endpoint</h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono truncate">GET {apiUrl}</code>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(apiUrl)}>Copy</Button>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Usage Example</h4>
            <pre className="rounded-lg bg-muted p-3 font-mono text-xs overflow-auto">{`curl "http://localhost:3000${apiUrl}"`}</pre>
          </div>
        </>
      )}
    </div>
  );
}
