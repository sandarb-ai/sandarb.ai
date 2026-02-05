'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export type SamplesPayload = {
  contextNames: string[];
  contextIds: string[];
  promptNames: string[];
  promptIds: string[];
  agentIds: string[];
  previewContextAgentId: string;
  previewPromptAgentId: string;
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function injectSampleExamples(
  spec: Record<string, unknown>,
  samples: SamplesPayload
): Record<string, unknown> {
  const out = deepClone(spec);
  const paths = out.paths as Record<string, Record<string, { parameters?: Array<{ name: string; in: string; schema?: { example?: unknown } }> }>> | undefined;
  if (!paths) return out;

  const traceExample = 'swagger-trace-1';
  const firstContextName = samples.contextNames[0] ?? 'ib-trading-limits';
  const firstPromptName = samples.promptNames[0] ?? 'retail-customer-support-playbook';
  const firstContextId = samples.contextIds[0] ?? '';
  const firstPromptId = samples.promptIds[0] ?? '';
  const firstAgentId = samples.agentIds[0] ?? '';

  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    const pathLower = pathKey.toLowerCase();
    const isInject = pathLower.includes('/inject');
    const isPromptPull = pathLower.includes('/prompts/pull') || pathLower.includes('/prompts%2Fpull');

    for (const method of Object.keys(pathItem)) {
      if (method === 'parameters' || !['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) continue;
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;
      const params = op.parameters as Array<{ name: string; in: string; example?: unknown; schema?: { example?: unknown } }> | undefined;
      if (!Array.isArray(params)) continue;

      for (const p of params) {
        const name = (p as { name?: string }).name;
        const paramIn = (p as { in?: string }).in;
        if (!name) continue;

        if (paramIn === 'query') {
          if (name === 'name') {
            const example = isPromptPull ? firstPromptName : firstContextName;
            if (p.schema) (p.schema as { example?: string }).example = example;
            else (p as { example?: string }).example = example;
          } else if (name === 'id' && firstContextId) {
            if (p.schema) (p.schema as { example?: string }).example = firstContextId;
            else (p as { example?: string }).example = firstContextId;
          } else if ((name === 'agentId' || name === 'agent_id') && (isInject || isPromptPull)) {
            const example = isPromptPull ? samples.previewPromptAgentId : samples.previewContextAgentId;
            if (p.schema) (p.schema as { example?: string }).example = example;
            else (p as { example?: string }).example = example;
          } else if (name === 'traceId' || name === 'trace_id') {
            if (p.schema) (p.schema as { example?: string }).example = traceExample;
            else (p as { example?: string }).example = traceExample;
          }
        } else if (paramIn === 'path') {
          if ((name === 'context_id' || name === 'contextId') && firstContextId) {
            if (p.schema) (p.schema as { example?: string }).example = firstContextId;
            else (p as { example?: string }).example = firstContextId;
          } else if ((name === 'prompt_id' || name === 'promptId') && firstPromptId) {
            if (p.schema) (p.schema as { example?: string }).example = firstPromptId;
            else (p as { example?: string }).example = firstPromptId;
          } else if ((name === 'agent_id' || name === 'agentId') && firstAgentId) {
            if (p.schema) (p.schema as { example?: string }).example = firstAgentId;
            else (p as { example?: string }).example = firstAgentId;
          }
        } else if (paramIn === 'header') {
          const headerLower = name.toLowerCase();
          if (headerLower === 'x-sandarb-agent-id') {
            const example = isPromptPull ? samples.previewPromptAgentId : (isInject ? samples.previewContextAgentId : firstAgentId || samples.previewContextAgentId);
            if (p.schema) (p.schema as { example?: string }).example = example;
            else (p as { example?: string }).example = example;
          } else if (headerLower === 'x-sandarb-trace-id') {
            if (p.schema) (p.schema as { example?: string }).example = traceExample;
            else (p as { example?: string }).example = traceExample;
          }
        }
      }
    }
  }
  return out;
}

export function DocsSwaggerUI({ initialApiBase }: { initialApiBase: string }) {
  const defaultBase = initialApiBase || 'http://localhost:8000';
  const [apiBase, setApiBase] = useState(defaultBase);
  const [inputValue, setInputValue] = useState(defaultBase);
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSpec = async (base: string) => {
    const url = `${base.replace(/\/$/, '')}/openapi.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to load OpenAPI spec: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ...data,
      servers: [{ url: base.replace(/\/$/, ''), description: 'Sandarb API' }],
    };
  };

  const fetchSamples = async (base: string): Promise<SamplesPayload | null> => {
    try {
      const url = `${base.replace(/\/$/, '')}/api/samples`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as SamplesPayload;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchSpec(apiBase), fetchSamples(apiBase)])
      .then(([merged, samples]) => {
        if (cancelled) return;
        const defaultSamples: SamplesPayload = {
          contextNames: ['ib-trading-limits', 'wm-suitability-policy'],
          contextIds: [],
          promptNames: ['customer-support-agent', 'retail-customer-support-playbook'],
          promptIds: [],
          agentIds: [],
          previewContextAgentId: 'sandarb-context-preview',
          previewPromptAgentId: 'sandarb-prompt-preview',
        };
        const payload = samples ?? defaultSamples;
        const withExamples = injectSampleExamples(merged, payload);
        setSpec(withExamples);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const handleApply = () => {
    const next = inputValue.trim();
    if (next) setApiBase(next);
  };

  const [presetLabel, setPresetLabel] = useState('');
  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host === 'localhost' || host === '127.0.0.1') {
      setPresetLabel('Local: use http://localhost:8000');
    } else if (host) {
      setPresetLabel('GCP / production: use your Sandarb API URL (e.g. https://your-api.run.app)');
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          API Reference is loaded from the <strong className="text-foreground">FastAPI backend</strong> OpenAPI spec.
          Set the base URL to match where your backend is running so &quot;Try it out&quot; hits the correct server.
        </p>
        {presetLabel ? <p className="text-xs text-muted-foreground">{presetLabel}</p> : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="swagger-api-base" className="text-xs">API base URL</Label>
            <Input
              id="swagger-api-base"
              type="url"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="http://localhost:8000"
              className="mt-1 h-9 font-mono text-sm"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleApply} className="h-9">
            Apply &amp; reload spec
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <span className="text-muted-foreground">Ensure the backend is running and CORS allows this origin.</span>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Loading OpenAPI spec…
        </div>
      )}

      {!loading && spec && (
        <div className="swagger-wrapper [&_.swagger-ui]:bg-background [&_.swagger-ui_.opblock]:border-border [&_.swagger-ui_.opblock-summary-path]:text-foreground [&_.swagger-ui_.opblock-summary-method]:text-foreground [&_.swagger-ui_.table-thead]:border-border [&_.swagger-ui_.parameter__name]:text-foreground [&_.swagger-ui_.response-col_status]:text-foreground [&_.swagger-ui_.response-col_links]:text-foreground [&_.swagger-ui_.info_.title]:text-foreground [&_.swagger-ui_.info_p]:text-muted-foreground [&_.swagger-ui_.opblock-tag]:border-border [&_.swagger-ui_.btn.execute]:bg-violet-600 [&_.swagger-ui_.btn.execute]:hover:bg-violet-700">
          <SwaggerUI spec={spec} />
        </div>
      )}
    </div>
  );
}
