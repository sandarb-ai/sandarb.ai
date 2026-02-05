'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import yaml from 'js-yaml';

interface ContextEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  className?: string;
}

export function ContextEditor({
  value,
  onChange,
  className,
}: ContextEditorProps) {
  const [format, setFormat] = useState<'json' | 'yaml'>('json');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  // Initialize text from value
  useEffect(() => {
    try {
      if (format === 'json') {
        setText(JSON.stringify(value, null, 2));
      } else {
        setText(yaml.dump(value));
      }
      setError(null);
      setIsValid(true);
    } catch (e) {
      setError('Failed to serialize content');
      setIsValid(false);
    }
  }, [value, format]);

  const handleTextChange = (newText: string) => {
    setText(newText);

    try {
      let parsed: Record<string, unknown>;
      if (format === 'json') {
        parsed = JSON.parse(newText);
      } else {
        parsed = yaml.load(newText) as Record<string, unknown>;
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Content must be an object');
      }

      setError(null);
      setIsValid(true);
      onChange(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid format');
      setIsValid(false);
    }
  };

  const handleFormatChange = (newFormat: 'json' | 'yaml') => {
    // Only convert if current content is valid
    if (isValid) {
      try {
        let parsed: Record<string, unknown>;
        if (format === 'json') {
          parsed = JSON.parse(text);
        } else {
          parsed = yaml.load(text) as Record<string, unknown>;
        }

        if (newFormat === 'json') {
          setText(JSON.stringify(parsed, null, 2));
        } else {
          setText(yaml.dump(parsed));
        }
      } catch (e) {
        // Keep current text if conversion fails
      }
    }
    setFormat(newFormat);
  };

  return (
    <div className={cn('flex flex-col h-full min-w-0', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <Tabs
          value={format}
          onValueChange={(v) => handleFormatChange(v as 'json' | 'yaml')}
        >
          <TabsList className="h-8">
            <TabsTrigger value="json" className="text-xs px-3 h-7">JSON</TabsTrigger>
            <TabsTrigger value="yaml" className="text-xs px-3 h-7">YAML</TabsTrigger>
          </TabsList>
        </Tabs>

        {isValid ? (
          <Badge variant="success" className="gap-1.5 py-1 px-3 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Valid
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1.5 py-1 px-3 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error || 'Invalid'}
          </Badge>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          wrap="soft"
          className={cn(
            'context-editor-textarea flex-1 w-full min-w-0 min-h-[300px] p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none border-0 rounded-b-xl bg-transparent',
            !isValid && 'bg-destructive/5'
          )}
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            overflowX: 'hidden',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
          placeholder={
            format === 'json'
              ? '{\n  "key": "value"\n}'
              : 'key: value\n'
          }
        />
      </div>
    </div>
  );
}
