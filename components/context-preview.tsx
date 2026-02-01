'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatContent } from '@/lib/utils';
import type { InjectionFormat } from '@/types';

interface ContextPreviewProps {
  content: Record<string, unknown>;
  contextName: string;
}

export function ContextPreview({ content, contextName }: ContextPreviewProps) {
  const [format, setFormat] = useState<InjectionFormat>('json');
  const [copied, setCopied] = useState(false);

  const fmt = format === 'xml' ? 'text' : format;
  const formattedContent = formatContent(content, fmt);
  const apiUrl = `/api/inject?name=${encodeURIComponent(contextName)}&format=${format}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Injection Preview</h3>
        <Tabs
          value={format}
          onValueChange={(v) => setFormat(v as InjectionFormat)}
        >
          <TabsList className="h-8">
            <TabsTrigger value="json" className="text-xs px-2">
              JSON
            </TabsTrigger>
            <TabsTrigger value="yaml" className="text-xs px-2">
              YAML
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs px-2">
              Text
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Preview */}
      <div className="relative">
        <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-auto max-h-64">
          {formattedContent}
        </pre>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* API Endpoint */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          API Endpoint
        </h4>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono truncate">
            GET {apiUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(apiUrl)}
          >
            Copy
          </Button>
        </div>
      </div>

      {/* Usage Example */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          Usage Example
        </h4>
        <pre className="rounded-lg bg-muted p-3 font-mono text-xs overflow-auto">
          {`curl "http://localhost:3000${apiUrl}"`}
        </pre>
      </div>
    </div>
  );
}
