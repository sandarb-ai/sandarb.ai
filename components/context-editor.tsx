'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Tabs
          value={format}
          onValueChange={(v) => handleFormatChange(v as 'json' | 'yaml')}
        >
          <TabsList>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="yaml">YAML</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 text-sm">
          {isValid ? (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Valid
            </span>
          ) : (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Invalid
            </span>
          )}
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        className={cn(
          'min-h-[300px] font-mono text-sm',
          !isValid && 'border-destructive focus-visible:ring-destructive'
        )}
        placeholder={
          format === 'json'
            ? '{\n  "key": "value"\n}'
            : 'key: value\n'
        }
      />

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
