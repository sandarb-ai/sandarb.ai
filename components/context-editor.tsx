'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Sparkles, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/lib/api';
import type { ContextContent } from '@/types';

interface ContextEditorProps {
  value: ContextContent;
  onChange: (value: ContextContent) => void;
  /** Current AI generation instructions (natural language). */
  aiInstructions?: string;
  /** Callback when AI instructions change. */
  onAiInstructionsChange?: (instructions: string) => void;
  className?: string;
}

/** Jinja2 curly-brace icon {{ ... }} */
function JinjaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2C4.9 2 4 2.9 4 4v5c0 1.1-.9 2-2 2v2c1.1 0 2 .9 2 2v5c0 1.1.9 2 2 2h2v-2H6v-5c0-1.1-.5-2.1-1.3-2.8L4 12l.7-.2C5.5 11.1 6 10.1 6 9V4h2V2H6z" fill="currentColor"/>
      <path d="M18 2c1.1 0 2 .9 2 2v5c0 1.1.9 2 2 2v2c-1.1 0-2 .9-2 2v5c0 1.1-.9 2-2 2h-2v-2h2v-5c0-1.1.5-2.1 1.3-2.8l.7-.2-.7-.2C18.5 11.1 18 10.1 18 9V4h-2V2h2z" fill="currentColor"/>
      <circle cx="9" cy="12" r="1.2" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
      <circle cx="15" cy="12" r="1.2" fill="currentColor"/>
    </svg>
  );
}

export function ContextEditor({
  value,
  onChange,
  aiInstructions: aiInstructionsProp,
  onAiInstructionsChange,
  className,
}: ContextEditorProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [variables, setVariables] = useState<string[]>([]);
  const [variableWarnings, setVariableWarnings] = useState<Array<{ name: string; suggestion: string }>>([]);

  // AI Generate panel
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [localAiInstructions, setLocalAiInstructions] = useState(aiInstructionsProp ?? '');
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Refs for debouncing and abort
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  // Sync AI instructions from prop
  useEffect(() => {
    if (aiInstructionsProp !== undefined) {
      setLocalAiInstructions(aiInstructionsProp);
    }
  }, [aiInstructionsProp]);

  // Initialize text from value
  useEffect(() => {
    if (typeof value === 'string') {
      setText(value);
    } else {
      // Legacy object content: serialize to JSON so it can be edited as Jinja2
      setText(JSON.stringify(value, null, 2));
    }
  }, [value]);

  // Debounced Jinja2 validation via backend
  const validateTemplate = useCallback(async (templateText: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!templateText.trim()) {
      setIsValid(true);
      setError(null);
      setVariables([]);
      setVariableWarnings([]);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(apiUrl('/api/contexts/validate-template'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateText }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setIsValid(data.data.valid);
        setError(data.data.valid ? null : `Line ${data.data.line}: ${data.data.error}`);
        setVariables(data.data.variables || []);
        setVariableWarnings(data.data.variable_warnings || []);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        // Network error: don't mark invalid
        setIsValid(true);
        setError(null);
      }
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Validate on mount
  useEffect(() => {
    if (text) {
      validateTemplate(text);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTextChange = (newText: string) => {
    setText(newText);
    onChange(newText);

    // Debounce validation (500ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => validateTemplate(newText), 500);
  };

  const handleAiInstructionsChange = (instructions: string) => {
    setLocalAiInstructions(instructions);
    onAiInstructionsChange?.(instructions);
  };

  const handleGenerateClick = () => {
    // Save instructions via callback
    onAiInstructionsChange?.(localAiInstructions);
    setAiNotice('Instructions saved. LLM integration coming soon!');
    setTimeout(() => setAiNotice(null), 4000);
  };

  return (
    <div className={cn('flex flex-col h-full min-w-0', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <JinjaIcon className="h-3.5 w-3.5" />
          Jinja2 Template
        </div>

        <div className="flex items-center gap-2">
          {isValidating ? (
            <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating
            </Badge>
          ) : isValid ? (
            <>
              {variableWarnings.length > 0 && (
                <Badge variant="outline" className="gap-1.5 py-1 px-3 text-sm text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {variableWarnings.length} naming {variableWarnings.length === 1 ? 'warning' : 'warnings'}
                </Badge>
              )}
              <Badge variant="success" className="gap-1.5 py-1 px-3 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Valid
              </Badge>
            </>
          ) : (
            <Badge variant="destructive" className="gap-1.5 py-1 px-3 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error || 'Invalid'}
            </Badge>
          )}
        </div>
      </div>

      {/* AI Generate collapsible panel */}
      <div className="border-b">
        <button
          type="button"
          onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors"
        >
          {isAiPanelOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <Sparkles className="h-3.5 w-3.5" />
          AI Generate
        </button>

        {isAiPanelOpen && (
          <div className="px-4 pb-3 space-y-2">
            <textarea
              value={localAiInstructions}
              onChange={(e) => handleAiInstructionsChange(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-600 placeholder:text-muted-foreground/60"
              placeholder="Describe what you want in plain English... e.g. &quot;Create a refund policy that varies by region, includes EDD for high-risk customers, and lists required documents&quot;"
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/30"
                onClick={handleGenerateClick}
                disabled={!localAiInstructions.trim()}
              >
                <Zap className="h-3 w-3" />
                Generate Template
              </Button>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-violet-400" />
                LLM integration coming soon — instructions are saved with the version
              </span>
            </div>
            {aiNotice && (
              <div className="text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 rounded px-2 py-1">
                {aiNotice}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detected variables bar */}
      {variables.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b bg-muted/20 text-xs text-muted-foreground shrink-0 flex-wrap">
          <span className="font-medium">Variables:</span>
          {variables.map((v) => {
            const warning = variableWarnings.find((w) => w.name === v);
            return warning ? (
              <Badge
                key={v}
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-mono text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20"
                title={`Use snake_case: ${warning.suggestion}`}
              >
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                {v}
              </Badge>
            ) : (
              <Badge key={v} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {v}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Variable naming warnings */}
      {variableWarnings.length > 0 && (
        <div className="px-4 py-1.5 border-b bg-amber-50/50 dark:bg-amber-950/10 text-xs shrink-0">
          <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Variables must use lowercase snake_case.</span>
              {' '}
              {variableWarnings.map((w, i) => (
                <span key={w.name}>
                  {i > 0 && ', '}
                  <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono">{w.name}</code>
                  {' \u2192 '}
                  <code className="bg-green-100 dark:bg-green-900/30 px-1 rounded font-mono">{w.suggestion}</code>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Template editor textarea */}
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
          placeholder={'# Policy for {{ region }}\nRules:\n1. Follow {{ compliance_code }} protocol.\n2. Process in {{ currency }}.'}
        />
      </div>
    </div>
  );
}
