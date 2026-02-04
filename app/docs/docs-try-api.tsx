'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AgentSkill } from '@/types';

function CodeBlock({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 overflow-hidden">
      {label && (
        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/80">
          {label}
        </div>
      )}
      <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto max-h-48 overflow-y-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function DocsTryInject() {
  const [name, setName] = useState('ib-trading-limits');
  const [format, setFormat] = useState('json');
  const [agentId, setAgentId] = useState('sandarb-context-preview');
  const [traceId, setTraceId] = useState(`docs-try-${Date.now()}`);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [body, setBody] = useState<string>('');

  const run = async () => {
    setLoading(true);
    setStatus(null);
    setBody('');
    try {
      const url = `/api/inject?name=${encodeURIComponent(name)}&format=${format}`;
      const res = await fetch(url, {
        headers: {
          'X-Sandarb-Agent-ID': agentId,
          'X-Sandarb-Trace-ID': traceId,
        },
      });
      setStatus(res.status);
      const data = await res.json().catch(() => ({}));
      setBody(JSON.stringify(data, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        Requests go to the same origin as this page (no CORS). Use <code className="rounded bg-muted px-1">sandarb-context-preview</code> as Agent ID to skip policy for testing. If you get 500, check that Postgres is running and the DB is initialized and seeded (e.g. <code className="rounded bg-muted px-1">npm run db:init-pg</code> and <code className="rounded bg-muted px-1">npm run db:full-reset-pg</code> or load sample data).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Context name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ib-trading-limits" className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs">Format</Label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="json">json</option>
            <option value="yaml">yaml</option>
            <option value="text">text</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">X-Sandarb-Agent-ID</Label>
          <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1 h-9 font-mono text-xs" />
        </div>
        <div>
          <Label className="text-xs">X-Sandarb-Trace-ID</Label>
          <Input value={traceId} onChange={(e) => setTraceId(e.target.value)} className="mt-1 h-9 font-mono text-xs" />
        </div>
      </div>
      <Button onClick={run} disabled={loading} size="sm">
        {loading ? 'Sending…' : 'Send GET /api/inject'}
      </Button>
      {status != null && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Response {status}
          </p>
          <CodeBlock label="Body">{body || '{}'}</CodeBlock>
        </div>
      )}
    </div>
  );
}

export function DocsTryA2a({ skills }: { skills: AgentSkill[] }) {
  const [skillId, setSkillId] = useState('list_contexts');
  const [inputJson, setInputJson] = useState('{}');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [body, setBody] = useState<string>('');

  const run = async () => {
    setLoading(true);
    setStatus(null);
    setBody('');
    try {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(inputJson || '{}');
      } catch {
        setBody('Invalid JSON in input');
        setLoading(false);
        return;
      }
      const reqBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'skills/execute',
        params: { skill: skillId, input: parsedInput },
      };
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token.trim()) headers['Authorization'] = `Bearer ${token.trim()}`;

      const res = await fetch('/api/a2a', {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
      });
      setStatus(res.status);
      const data = await res.json().catch(() => ({}));
      setBody(JSON.stringify(data, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const currentSkill = skills.find((s) => s.id === skillId);
  const getExampleForSkill = (id: string) =>
    id === 'list_contexts'
      ? '{}'
      : id === 'get_context'
        ? '{"name": "ib-trading-limits", "sourceAgent": "your-registered-agent-id"}'
        : id === 'get_prompt'
          ? '{"name": "customer-support-agent"}'
          : id === 'agent/info' || id === 'skills/list'
            ? '{}'
            : '{}';

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        Try A2A <code className="rounded bg-muted px-1">skills/execute</code>. POST /api/a2a requires <strong>Authorization: Bearer &lt;token&gt;</strong>; leave blank to see 401.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Skill</Label>
          <select
            value={skillId}
            onChange={(e) => {
              const next = e.target.value;
              setSkillId(next);
              setInputJson(getExampleForSkill(next));
            }}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Bearer token (optional)</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token for authenticated try"
            className="mt-1 h-9 font-mono text-xs"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Input (JSON)</Label>
        <textarea
          value={inputJson}
          onChange={(e) => setInputJson(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          placeholder='{"name": "my-context", "sourceAgent": "my-agent"}'
        />
        {currentSkill?.inputSchema && (
          <p className="mt-1 text-xs text-muted-foreground">
            Required: {(currentSkill.inputSchema as { required?: string[] }).required?.join(', ') || '—'}
          </p>
        )}
      </div>
      <Button onClick={run} disabled={loading} size="sm">
        {loading ? 'Sending…' : 'Send POST /api/a2a'}
      </Button>
      {status != null && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Response {status}
          </p>
          <CodeBlock label="Body">{body || '{}'}</CodeBlock>
        </div>
      )}
    </div>
  );
}
